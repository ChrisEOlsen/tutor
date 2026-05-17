package handlers

import (
	"database/sql"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"gova/app/cache"
	"gova/app/models"
)

func CoursesDeleteDELETE(readDB, writeDB *sql.DB, appCache *cache.Cache) http.HandlerFunc {
	cm := models.NewCourseModel(readDB, writeDB, appCache)
	return func(w http.ResponseWriter, r *http.Request) {
		idStr := chi.URLParam(r, "id")
		id, err := strconv.ParseInt(idStr, 10, 64)
		if err != nil {
			jsonError(w, "invalid course id", 400)
			return
		}
		if err := cm.Delete(id); err != nil {
			jsonError(w, err.Error(), 500)
			return
		}
		jsonOK(w, map[string]bool{"deleted": true})
	}
}
