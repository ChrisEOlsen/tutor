package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"gova/app/cache"
	"gova/app/models"
)

func CourseChapterGET(readDB, writeDB *sql.DB, appCache *cache.Cache) http.HandlerFunc {
	cm := models.NewCourseModel(readDB, writeDB, appCache)
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

		jsonOK(w, chapters[idx])
	}
}

func CourseProgressPOST(readDB, writeDB *sql.DB, appCache *cache.Cache) http.HandlerFunc {
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

		var req struct {
			CurrentChapter int64 `json:"current_chapter"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			jsonError(w, "invalid request body", 400)
			return
		}

		if err := cm.Update(id, course.Title, course.Status, course.ChatHistory, course.Outline, course.Chapters, req.CurrentChapter, course.TestResults, course.FinalGrade); err != nil {
			jsonError(w, "failed to update progress", 500)
			return
		}

		jsonOK(w, map[string]bool{"ok": true})
	}
}
