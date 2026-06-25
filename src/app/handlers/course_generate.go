package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"gova/app/cache"
	"gova/app/models"
)

func CourseGenerateAllPOST(readDB, writeDB *sql.DB, appCache *cache.Cache) http.HandlerFunc {
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

		var outline []string
		if err := json.Unmarshal([]byte(course.Outline), &outline); err != nil {
			jsonError(w, "no outline found", 400)
			return
		}

		// Set status to generating
		if err := cm.Update(id, course.Title, "generating", course.ChatHistory, course.Outline, "[]", 0, "{}", 0); err != nil {
			jsonError(w, "failed to update course", 500)
			return
		}

		chapters := make([]map[string]any, 0, len(outline))

		for i, title := range outline {
			// Build prompt with context
			var existingChapters []string
			for _, ch := range chapters {
				if t, ok := ch["title"].(string); ok {
					existingChapters = append(existingChapters, t)
				}
			}

			prompt := fmt.Sprintf("Generate chapter %d of %d: %s\n\nCourse title: %s\nPrevious chapters: %v",
				i+1, len(outline), title, course.Title, existingChapters)

			apiMessages := []Message{
				{Role: "system", Content: SystemPromptGenerateChapter},
				{Role: "user", Content: prompt},
			}

			response, err := client.Chat(ModelPrimary, apiMessages, 0.7)
			if err != nil {
				jsonError(w, fmt.Sprintf("AI error on chapter %d: %v", i+1, err), 500)
				return
			}

			// Parse JSON from response
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
				jsonError(w, fmt.Sprintf("failed to parse chapter %d: %v", i+1, err), 500)
				return
			}

			chapters = append(chapters, chapter)

			// Save progress after each chapter
			chaptersJSON, _ := json.Marshal(chapters)
			if err := cm.Update(id, course.Title, "generating", course.ChatHistory, course.Outline, string(chaptersJSON), int64(i), "{}", 0); err != nil {
				jsonError(w, "failed to save progress", 500)
				return
			}
		}

		chaptersJSON, _ := json.Marshal(chapters)
		if err := cm.Update(id, course.Title, "active", course.ChatHistory, course.Outline, string(chaptersJSON), 0, "{}", 0); err != nil {
			jsonError(w, "failed to finalize course", 500)
			return
		}

		jsonOK(w, map[string]any{"chapters": chapters, "total": len(chapters)})
	}
}

func CourseGenerateChapterPOST(readDB, writeDB *sql.DB, appCache *cache.Cache) http.HandlerFunc {
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

		title := outline[idx]
		prompt := fmt.Sprintf("Generate chapter %d of %d: %s\n\nCourse title: %s", idx+1, len(outline), title, course.Title)

		apiMessages := []Message{
			{Role: "system", Content: SystemPromptGenerateChapter},
			{Role: "user", Content: prompt},
		}

		response, err := client.Chat(ModelPrimary, apiMessages, 0.7)
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

		// Add to chapters
		var chapters []map[string]any
		json.Unmarshal([]byte(course.Chapters), &chapters)

		// Ensure chapters array is the right size
		for len(chapters) <= idx {
			chapters = append(chapters, nil)
		}
		chapters[idx] = chapter

		chaptersJSON, _ := json.Marshal(chapters)

		// Set status to active when the last chapter is generated
		status := course.Status
		if idx == len(outline)-1 {
			status = "active"
		}

		if err := cm.Update(id, course.Title, status, course.ChatHistory, course.Outline, string(chaptersJSON), course.CurrentChapter, course.TestResults, course.FinalGrade); err != nil {
			jsonError(w, "failed to save chapter", 500)
			return
		}

		jsonOK(w, map[string]any{
			"chapter": chapter,
			"index":   idx,
			"total":   len(outline),
		})
	}
}
