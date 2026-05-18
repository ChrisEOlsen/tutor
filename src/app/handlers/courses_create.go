package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"

	"gova/app/cache"
	"gova/app/models"
)

type createCourseReq struct {
	Title string `json:"title"`
}

func CoursesCreatePOST(readDB, writeDB *sql.DB, appCache *cache.Cache) http.HandlerFunc {
	cm := models.NewCourseModel(readDB, writeDB, appCache)
	client := NewOpenRouterClient()
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

		// Generate a concise title from the user's description
		title, err := client.Chat(ModelHaiku, []Message{
			{Role: "system", Content: "Generate a short, descriptive title (max 60 characters) for a learning course based on the user's description. Return ONLY the title string, no quotes, no explanation."},
			{Role: "user", Content: req.Title},
		}, 0.3)
		if err != nil {
			// Fallback: truncate the raw description
			title = strings.TrimSpace(req.Title)
			if len(title) > 60 {
				title = title[:57] + "..."
			}
		} else {
			title = strings.TrimSpace(title)
			if len(title) == 0 || len(title) > 60 {
				title = strings.TrimSpace(req.Title)
				if len(title) > 60 {
					title = title[:57] + "..."
				}
			}
		}

		id, err := cm.Create(title, "chatting", "[]", "[]", "[]", 0, "{}", 0)
		if err != nil {
			jsonError(w, err.Error(), 500)
			return
		}
		jsonOK(w, map[string]any{"id": id, "title": title})
	}
}
