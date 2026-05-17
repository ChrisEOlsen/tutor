package handlers

import (
	"net/http"
)

func NewCourseGET() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "./static/pages/new_course.html")
	}
}
