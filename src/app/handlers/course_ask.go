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

type askReq struct {
	Question string `json:"question"`
}

func CourseAskPOST(readDB, writeDB *sql.DB, appCache *cache.Cache) http.HandlerFunc {
	cm := models.NewCourseModel(readDB, writeDB, appCache)
	client := NewOpenRouterClient()
	return func(w http.ResponseWriter, r *http.Request) {
		idStr := chi.URLParam(r, "id")
		id, err := strconv.ParseInt(idStr, 10, 64)
		if err != nil {
			jsonError(w, "invalid course id", 400)
			return
		}

		course, err := cm.Find(id)
		if err != nil {
			jsonError(w, "course not found", 404)
			return
		}

		var req askReq
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			jsonError(w, "invalid request body", 400)
			return
		}

		// Build context from chapters
		context := "Course: " + course.Title + "\n\n"
		var chapters []map[string]any
		if err := json.Unmarshal([]byte(course.Chapters), &chapters); err == nil {
			for i, ch := range chapters {
				if title, ok := ch["title"].(string); ok {
					context += "Chapter " + strconv.Itoa(i+1) + ": " + title + "\n"
				}
				if sections, ok := ch["sections"].([]any); ok {
					for _, s := range sections {
						if sec, ok := s.(map[string]any); ok {
							if typ, ok := sec["type"].(string); ok && typ == "text" {
								if content, ok := sec["content"].(string); ok {
									context += content + "\n"
								}
							}
						}
					}
				}
			}
		}

		apiMessages := []Message{
			{Role: "system", Content: SystemPromptAsk + "\n\n" + context},
			{Role: "user", Content: req.Question},
		}

		response, err := client.Chat(ModelDefault, apiMessages, 0.7)
		if err != nil {
			jsonError(w, "AI error: "+err.Error(), 500)
			return
		}

		jsonOK(w, map[string]string{"response": response})
	}
}

func CourseRegenerateChapterPOST(readDB, writeDB *sql.DB, appCache *cache.Cache) http.HandlerFunc {
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

		var outline []string
		if err := json.Unmarshal([]byte(course.Outline), &outline); err != nil || idx >= len(outline) {
			jsonError(w, "chapter index out of range", 400)
			return
		}

		var req struct {
			Prompt string `json:"prompt"`
		}
		json.NewDecoder(r.Body).Decode(&req)

		title := outline[idx]
		prompt := "Regenerate chapter: " + title
		if req.Prompt != "" {
			prompt += "\nUser feedback: " + req.Prompt
		}

		apiMessages := []Message{
			{Role: "system", Content: SystemPromptGenerateChapter},
			{Role: "user", Content: prompt},
		}

		response, err := client.Chat(ModelDefault, apiMessages, 0.7)
		if err != nil {
			jsonError(w, "AI error: "+err.Error(), 500)
			return
		}

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

		var chapter map[string]any
		if err := json.Unmarshal([]byte(response), &chapter); err != nil {
			jsonError(w, "failed to parse chapter: "+err.Error(), 500)
			return
		}

		// Replace in chapters
		var chapters []map[string]any
		json.Unmarshal([]byte(course.Chapters), &chapters)
		for len(chapters) <= idx {
			chapters = append(chapters, nil)
		}
		chapters[idx] = chapter
		chaptersJSON, _ := json.Marshal(chapters)

		// Clear test results for this chapter
		var testResultsMap map[string]any
		json.Unmarshal([]byte(course.TestResults), &testResultsMap)
		if testResultsMap != nil {
			delete(testResultsMap, strconv.Itoa(idx))
		}
		testResultsJSON, _ := json.Marshal(testResultsMap)

		if err := cm.Update(id, course.Title, course.Status, course.ChatHistory, course.Outline, string(chaptersJSON), course.CurrentChapter, string(testResultsJSON), course.FinalGrade); err != nil {
			jsonError(w, "failed to save chapter", 500)
			return
		}

		jsonOK(w, map[string]any{"chapter": chapter, "index": idx})
	}
}
