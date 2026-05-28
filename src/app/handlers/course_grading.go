package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"gova/app/cache"
	"gova/app/models"
)

func CourseTestPOST(readDB, writeDB *sql.DB, appCache *cache.Cache) http.HandlerFunc {
	cm := models.NewCourseModel(readDB, writeDB, appCache)
	client := NewOpenRouterClient()
	return func(w http.ResponseWriter, r *http.Request) {
		idStr := chi.URLParam(r, "id")
		id, err := strconv.ParseInt(idStr, 10, 64)
		if err != nil {
			jsonError(w, "invalid course id", 400)
			return
		}

		idxStr := chi.URLParam(r, "index")
		idx, err := strconv.Atoi(idxStr)
		if err != nil {
			jsonError(w, "invalid chapter index", 400)
			return
		}

		course, err := cm.Find(id)
		if err != nil {
			jsonError(w, "course not found", 404)
			return
		}

		var chapters []map[string]any
		if err := json.Unmarshal([]byte(course.Chapters), &chapters); err != nil || idx >= len(chapters) {
			jsonError(w, "chapter not found", 404)
			return
		}

		chapter := chapters[idx]
		test, ok := chapter["test"].(map[string]any)
		if !ok {
			jsonError(w, "no test found", 400)
			return
		}

		questionsRaw, _ := test["questions"].([]any)

		var req struct {
			Answers []map[string]any `json:"answers"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			jsonError(w, "invalid request body", 400)
			return
		}

		results := make([]map[string]any, 0, len(req.Answers))
		totalScore := 0

		for _, ans := range req.Answers {
			qIdx := intFromFloat(ans["questionIndex"])
			qType, _ := ans["type"].(string)
			answer, _ := ans["answer"].(string)

			if qIdx < 0 || qIdx >= len(questionsRaw) {
				continue
			}

			q := questionsRaw[qIdx].(map[string]any)

			if qType == "multiple_choice" {
				correct := intFromFloat(q["correct"])
				score := 0
				if intFromFloat(answer) == correct {
					score = 100
				}
				results = append(results, map[string]any{
					"questionIndex": qIdx,
					"score":         score,
					"feedback":      feedbackForScore(score),
				})
				totalScore += score
			} else {
				// AI grading for written/code
				rubric, _ := q["rubric"].(string)
				question, _ := q["question"].(string)
				prompt := strings.Join([]string{
					"Question: " + question,
					"Student answer: " + answer,
					"Rubric: " + rubric,
				}, "\n")

				apiMessages := []Message{
					{Role: "system", Content: SystemPromptGrade},
					{Role: "user", Content: prompt},
				}

				response, err := client.Chat(ModelDefault, apiMessages, 0.3)
				if err != nil {
					results = append(results, map[string]any{
						"questionIndex": qIdx,
						"score":         0,
						"feedback":      "Grading failed: " + err.Error(),
					})
					continue
				}

				// Parse grading response
				response = strings.TrimSpace(response)
				if strings.HasPrefix(response, "```") {
					lines := strings.Split(response, "\n")
					var cleaned []string
					inBlock := false
					for _, line := range lines {
						if strings.Contains(line, "```") {
							inBlock = !inBlock
							continue
						}
						if inBlock {
							cleaned = append(cleaned, line)
						}
					}
					response = strings.Join(cleaned, "\n")
				}

				var grading map[string]any
				score := 0
				feedback := "Grading failed: unable to parse AI response."
				if err := json.Unmarshal([]byte(response), &grading); err != nil {
					// Fallback: try to extract JSON object from response
					start := strings.Index(response, "{")
					end := strings.LastIndex(response, "}")
					if start >= 0 && end > start {
						jsonStr := response[start : end+1]
						if err2 := json.Unmarshal([]byte(jsonStr), &grading); err2 == nil {
							score = intFromFloat(grading["score"])
							fb, _ := grading["feedback"].(string)
							if fb != "" {
								feedback = fb
							}
						} else {
							feedback = "Grading failed: AI returned invalid JSON. Raw: " + response[:min(len(response), 200)]
						}
					} else {
						feedback = "Grading failed: no JSON found in AI response."
					}
				} else {
					score = intFromFloat(grading["score"])
					fb, _ := grading["feedback"].(string)
					if fb != "" {
						feedback = fb
					}
				}

				results = append(results, map[string]any{
					"questionIndex": qIdx,
					"score":         score,
					"feedback":      feedback,
				})
				totalScore += score
			}
		}

		avgScore := 0
		if len(results) > 0 {
			avgScore = totalScore / len(results)
		}

		// Build per-question results with submitted answers
		type questionResult struct {
			QuestionIndex int    `json:"questionIndex"`
			Type          string `json:"type"`
			Answer        string `json:"answer"`
			Score         int    `json:"score"`
			Feedback      string `json:"feedback"`
		}

		questionResults := make([]questionResult, 0, len(req.Answers))
		for i, ans := range req.Answers {
			if i >= len(results) {
				break
			}
			qType, _ := ans["type"].(string)
			answer, _ := ans["answer"].(string)
			qr := questionResult{
				QuestionIndex: intFromFloat(req.Answers[i]["questionIndex"]),
				Type:          qType,
				Answer:        answer,
				Score:         intFromFloat(results[i]["score"]),
				Feedback:      results[i]["feedback"].(string),
			}
			questionResults = append(questionResults, qr)
		}

		// Save test results with per-question detail
		var testResultsMap map[string]any
		json.Unmarshal([]byte(course.TestResults), &testResultsMap)
		if testResultsMap == nil {
			testResultsMap = make(map[string]any)
		}
		testResultsMap[strconv.Itoa(idx)] = map[string]any{
			"score":     avgScore,
			"feedback":  "Chapter complete.",
			"questions": questionResults,
		}
		testResultsJSON, _ := json.Marshal(testResultsMap)

		// Check if all chapters graded → completed
		var outlineArr []string
		json.Unmarshal([]byte(course.Outline), &outlineArr)
		status := course.Status
		finalGrade := course.FinalGrade
		if len(testResultsMap) >= len(outlineArr) && len(outlineArr) > 0 {
			status = "completed"
			finalGrade = float64(avgScore)
		}

		if err := cm.Update(id, course.Title, status, course.ChatHistory, course.Outline, course.Chapters, course.CurrentChapter, string(testResultsJSON), finalGrade); err != nil {
			jsonError(w, "save error: "+err.Error(), 500)
			return
		}

		jsonOK(w, map[string]any{"results": results, "average": avgScore})
	}
}

func feedbackForScore(score int) string {
	if score == 100 {
		return "Correct!"
	}
	return "Incorrect."
}

func intFromFloat(v any) int {
	if v == nil {
		return 0
	}
	switch val := v.(type) {
	case float64:
		return int(val)
	case int:
		return val
	case string:
		n, _ := strconv.Atoi(val)
		return n
	default:
		return 0
	}
}
