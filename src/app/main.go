package main

import (
	"io"
	"log"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	chiMiddleware "github.com/go-chi/chi/v5/middleware"
	"gova/app/cache"
	"gova/app/db"
	"gova/app/handlers"
	"gova/app/middleware"
)

func main() {
	if logPath := os.Getenv("LOG_PATH"); logPath != "" {
		if f, err := os.OpenFile(logPath, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0644); err == nil {
			log.SetOutput(io.MultiWriter(os.Stdout, f))
		}
	}

	if secret := os.Getenv("SESSION_SECRET"); len(secret) < 32 {
		log.Fatal("SESSION_SECRET must be set and at least 32 characters")
	}

	database, err := db.Open(os.Getenv("DB_PATH"))
	if err != nil {
		log.Fatalf("db: %v", err)
	}
	defer database.Close()

	appCache := cache.New()

	r := chi.NewRouter()
	r.Use(chiMiddleware.Logger)
	r.Use(chiMiddleware.Recoverer)
	r.Use(middleware.Security)
	r.Use(middleware.CSRF)
	r.Use(middleware.Auth)

	// Static files
	r.Handle("/static/*", http.StripPrefix("/static/", http.FileServer(http.Dir("./static"))))

	// Pages
	r.Get("/", handlers.HomeGET())
	r.Get("/static/pages/new_course.html", handlers.NewCourseGET())
	r.Get("/static/pages/chat.html", handlers.ChatGET())
	r.Get("/static/pages/study.html", handlers.StudyGET())

	// Course CRUD
	r.Get("/api/courses", handlers.CoursesListGET(database.Read, database.Write, appCache))
	r.Post("/api/courses", handlers.CoursesCreatePOST(database.Read, database.Write, appCache))
	r.Get("/api/courses/{id}", handlers.CourseDetailGET(database.Read, database.Write, appCache))
	r.Delete("/api/courses/{id}", handlers.CoursesDeleteDELETE(database.Read, database.Write, appCache))

	// Chat flow
	r.Post("/api/courses/{id}/chat", handlers.CourseChatPOST(database.Read, database.Write, appCache))
	r.Post("/api/courses/{id}/generate_outline", handlers.CourseGenerateOutlinePOST(database.Read, database.Write, appCache))

	// Course generation
	r.Post("/api/courses/{id}/generate_all", handlers.CourseGenerateAllPOST(database.Read, database.Write, appCache))
	r.Get("/api/courses/{id}/generation_status", handlers.CourseGenerateStatusGET(database.Read, database.Write, appCache))
	r.Post("/api/courses/{id}/generate_chapter/{index}", handlers.CourseGenerateChapterPOST(database.Read, database.Write, appCache))
	r.Post("/api/courses/{id}/regenerate_chapter/{index}", handlers.CourseRegenerateChapterPOST(database.Read, database.Write, appCache))

	// Study
	r.Get("/api/courses/{id}/chapter/{index}", handlers.CourseChapterGET(database.Read, database.Write, appCache))
	r.Post("/api/courses/{id}/progress", handlers.CourseProgressPOST(database.Read, database.Write, appCache))

	// Testing
	r.Post("/api/courses/{id}/test/{index}", handlers.CourseTestPOST(database.Read, database.Write, appCache))

	// Course context chat
	r.Post("/api/courses/{id}/ask", handlers.CourseAskPOST(database.Read, database.Write, appCache))

	// Always listen on 8080 inside the container.
	// APP_PORT controls the host-side port mapping in docker-compose.yml.
	const port = "8080"
	log.Printf("GOVA app listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, r))
}
