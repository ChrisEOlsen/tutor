package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"gova/app/cache"
	"gova/app/models"
)

type createCourseReq struct {
	Title string `json:"title"`
}

func CoursesCreatePOST(readDB, writeDB *sql.DB, appCache *cache.Cache) http.HandlerFunc {
	cm := models.NewCourseModel(readDB, writeDB, appCache)
	return func(w http.ResponseWriter, r *http.Request) {
		var req createCourseReq
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			jsonError(w, "invalid request body", 400)
			return
		}
		if req.Title == "" {
			jsonError(w, "title is required", 400)
			return
		}
		id, err := cm.Create(req.Title, "chatting", "[]", "[]", "[]", 0, "{}", 0)
		if err != nil {
			jsonError(w, err.Error(), 500)
			return
		}
		jsonOK(w, map[string]int64{"id": id})
	}
}
