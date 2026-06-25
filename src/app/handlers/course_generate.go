package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"

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

	var mu sync.Mutex
	var wg sync.WaitGroup
	var firstErr string
	completed := 0

	for i, title := range outline {
		wg.Add(1)
		go func(i int, title string) {
			defer wg.Done()

			prompt := fmt.Sprintf("Generate chapter %d of %d: %s\n\nCourse title: %s\nFull outline: %v",
				i+1, len(outline), title, courseTitle, outline)

			apiMessages := []Message{
				{Role: "system", Content: SystemPromptGenerateChapter},
				{Role: "user", Content: prompt},
			}

			response, err := client.Chat(ModelPrimary, apiMessages, 0.7)
			if err != nil {
				mu.Lock()
				if firstErr == "" {
					firstErr = err.Error()
				}
				mu.Unlock()
				log.Printf("course %d generation failed at chapter %d: %v", courseID, i+1, err)
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
				mu.Lock()
				if firstErr == "" {
					firstErr = "failed to parse chapter " + strconv.Itoa(i+1) + ": " + err.Error()
				}
				mu.Unlock()
				log.Printf("course %d parse failed at chapter %d: %v", courseID, i+1, err)
				return
			}

			mu.Lock()
			chapters[i] = chapter
			completed++
			snap, _ := json.Marshal(chapters)
			done := int64(completed)
			mu.Unlock()

			if err := cm.UpdateGenerationProgress(courseID, "generating", string(snap), done-1, ""); err != nil {
				log.Printf("course %d save progress failed at chapter %d: %v", courseID, i+1, err)
			}
		}(i, title)
	}

	wg.Wait()

	mu.Lock()
	finalErr := firstErr
	chaptersJSON, _ := json.Marshal(chapters)
	mu.Unlock()

	if finalErr != "" {
		_ = cm.UpdateGenerationProgress(courseID, "generating", string(chaptersJSON), 0, finalErr)
		log.Printf("course %d generation failed: %v", courseID, finalErr)
		return
	}

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
