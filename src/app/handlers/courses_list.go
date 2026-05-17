package handlers

import (
	"database/sql"
	"net/http"
	"gova/app/cache"
	"gova/app/models"
)

func CoursesListGET(readDB, writeDB *sql.DB, appCache *cache.Cache) http.HandlerFunc {
	cm := models.NewCourseModel(readDB, writeDB, appCache)
	return func(w http.ResponseWriter, r *http.Request) {
		items, err := cm.GetAll()
		if err != nil {
			jsonError(w, err.Error(), 500)
			return
		}
		jsonOK(w, items)
	}
}
