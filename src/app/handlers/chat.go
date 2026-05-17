package handlers

import (
	"net/http"
)

func ChatGET() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "./static/pages/chat.html")
	}
}
