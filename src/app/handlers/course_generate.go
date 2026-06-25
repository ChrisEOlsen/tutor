package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"gova/app/cache"
	"gova/app/models"
)

func CourseGenerateAllPOST(readDB, writeDB *sql.DB, appCache *cache.Cache) http.HandlerFunc {
	cm := models.NewCourseModel(readDB, writeDB, appCache)
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

		if course.Status == "generating" && course.GenerationError == "" {
			jsonError(w, "generation already in progress", 409)
			return
		}

		var outline []string
		if err := json.Unmarshal([]byte(course.Outline), &outline); err != nil || len(outline) == 0 {
			jsonError(w, "no outline found", 400)
			return
		}

		// Reset generation state
		if err := cm.UpdateGenerationProgress(id, "generating", "[]", 0, ""); err != nil {
			jsonError(w, "failed to start generation", 500)
			return
		}

		// Launch background goroutine
		go func() {
			generateCourseBackground(cm, id, course.Title, outline)
		}()

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusAccepted)
		json.NewEncoder(w).Encode(map[string]any{"ok": true, "data": map[string]string{"status": "generating", "message": "Course generation started in background"}})
	}
}

func generateCourseBackground(cm *models.CourseModel, courseID int64, courseTitle string, outline []string) {
	client := NewOpenRouterClient()
	chapters := make([]map[string]any, len(outline))

	for i, title := range outline {
		// Build prompt with context from already-generated chapters
		var existingChapters []string
		for _, ch := range chapters[:i] {
			if ch != nil {
				if t, ok := ch["title"].(string); ok {
					existingChapters = append(existingChapters, t)
				}
			}
		}

		prompt := fmt.Sprintf("Generate chapter %d of %d: %s\n\nCourse title: %s\nPrevious chapters: %v",
			i+1, len(outline), title, courseTitle, existingChapters)

		apiMessages := []Message{
			{Role: "system", Content: SystemPromptGenerateChapter},
			{Role: "user", Content: prompt},
		}

		response, err := client.Chat(ModelPrimary, apiMessages, 0.7)
		if err != nil {
			// Save error and stop — status stays "generating" so UI shows failure
			chaptersJSON, _ := json.Marshal(chapters)
			_ = cm.UpdateGenerationProgress(courseID, "generating", string(chaptersJSON), int64(i), err.Error())
			log.Printf("course %d generation failed at chapter %d: %v", courseID, i+1, err)
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
			chaptersJSON, _ := json.Marshal(chapters)
			_ = cm.UpdateGenerationProgress(courseID, "generating", string(chaptersJSON), int64(i), "failed to parse chapter "+strconv.Itoa(i+1)+": "+err.Error())
			log.Printf("course %d parse failed at chapter %d: %v", courseID, i+1, err)
			return
		}

		chapters[i] = chapter

		// Save progress after each chapter
		chaptersJSON, _ := json.Marshal(chapters)
		if err := cm.UpdateGenerationProgress(courseID, "generating", string(chaptersJSON), int64(i), ""); err != nil {
			log.Printf("course %d save progress failed at chapter %d: %v", courseID, i+1, err)
		}
	}

	// All chapters done — mark as active
	chaptersJSON, _ := json.Marshal(chapters)
	if err := cm.UpdateGenerationProgress(courseID, "active", string(chaptersJSON), int64(len(outline)-1), ""); err != nil {
		log.Printf("course %d finalize failed: %v", courseID, err)
	}
	log.Printf("course %d generation complete (%d chapters)", courseID, len(outline))
}

func CourseGenerateStatusGET(readDB, writeDB *sql.DB, appCache *cache.Cache) http.HandlerFunc {
	cm := models.NewCourseModel(readDB, writeDB, appCache)
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

		// Calculate progress
		var outline []string
		json.Unmarshal([]byte(course.Outline), &outline)
		totalChapters := len(outline)

		var chapters []map[string]any
		json.Unmarshal([]byte(course.Chapters), &chapters)
		completedChapters := 0
		for _, ch := range chapters {
			if ch != nil {
				completedChapters++
			}
		}

		jsonOK(w, map[string]any{
			"status":            course.Status,
			"total_chapters":    totalChapters,
			"completed_chapters": completedChapters,
			"current_chapter":   course.CurrentChapter,
			"generation_error":  course.GenerationError,
		})
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
