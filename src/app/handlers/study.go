package handlers

import (
	"net/http"
)

func StudyGET() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "./static/pages/study.html")
	}
}
