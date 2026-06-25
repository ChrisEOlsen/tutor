package models

import (
	"database/sql"
	"encoding/json"
	"time"
	"gova/app/cache"
)

type Course struct {
	ID              int64     `json:"id"`
	Title           string    `json:"title"`
	Status          string    `json:"status"`
	ChatHistory     string    `json:"chat_history"`
	Outline         string    `json:"outline"`
	Chapters        string    `json:"chapters"`
	CurrentChapter  int64     `json:"current_chapter"`
	TestResults     string    `json:"test_results"`
	FinalGrade      float64   `json:"final_grade"`
	GenerationError string    `json:"generation_error"`
	CreatedAt       time.Time `json:"created_at"`
}

type CourseModel struct {
	readDB  *sql.DB
	writeDB *sql.DB
	cache   *cache.Cache
}

func NewCourseModel(readDB, writeDB *sql.DB, c *cache.Cache) *CourseModel {
	return &CourseModel{readDB: readDB, writeDB: writeDB, cache: c}
}

func (m *CourseModel) GetAll() ([]Course, error) {
	const cacheKey = "courses:all"
	if hit, ok := m.cache.Get(cacheKey); ok {
		var items []Course
		if err := json.Unmarshal(hit, &items); err == nil {
			return items, nil
		}
	}
	rows, err := m.readDB.Query("SELECT id, title, status, chat_history, outline, chapters, current_chapter, test_results, final_grade, generation_error, created_at FROM courses ORDER BY created_at DESC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []Course
	for rows.Next() {
		var item Course
		if err := rows.Scan(&item.ID, &item.Title, &item.Status, &item.ChatHistory, &item.Outline, &item.Chapters, &item.CurrentChapter, &item.TestResults, &item.FinalGrade, &item.GenerationError, &item.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	if data, err := json.Marshal(items); err == nil {
		m.cache.Set(cacheKey, data, 5*time.Minute)
	}
	return items, nil
}

func (m *CourseModel) Find(id int64) (*Course, error) {
	row := m.readDB.QueryRow("SELECT id, title, status, chat_history, outline, chapters, current_chapter, test_results, final_grade, generation_error, created_at FROM courses WHERE id = ?", id)
	var item Course
	err := row.Scan(&item.ID, &item.Title, &item.Status, &item.ChatHistory, &item.Outline, &item.Chapters, &item.CurrentChapter, &item.TestResults, &item.FinalGrade, &item.GenerationError, &item.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &item, nil
}

func (m *CourseModel) Create(title string, status string, chat_history string, outline string, chapters string, current_chapter int64, test_results string, final_grade float64) (int64, error) {
	res, err := m.writeDB.Exec(
		"INSERT INTO courses (title, status, chat_history, outline, chapters, current_chapter, test_results, final_grade, generation_error) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '')",
		title, status, chat_history, outline, chapters, current_chapter, test_results, final_grade,
	)
	if err != nil {
		return 0, err
	}
	m.cache.Bust("courses:")
	return res.LastInsertId()
}

func (m *CourseModel) Update(id int64, title string, status string, chatHistory string, outline string, chapters string, currentChapter int64, testResults string, finalGrade float64) error {
	_, err := m.writeDB.Exec(
		"UPDATE courses SET title = ?, status = ?, chat_history = ?, outline = ?, chapters = ?, current_chapter = ?, test_results = ?, final_grade = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
		title, status, chatHistory, outline, chapters, currentChapter, testResults, finalGrade, id,
	)
	if err == nil {
		m.cache.Bust("courses:")
	}
	return err
}

func (m *CourseModel) Delete(id int64) error {
	_, err := m.writeDB.Exec("DELETE FROM courses WHERE id = ?", id)
	if err == nil {
		m.cache.Bust("courses:")
	}
	return err
}

// UpdateGenerationProgress updates only generation-relevant fields (used by background job).
func (m *CourseModel) UpdateGenerationProgress(id int64, status string, chapters string, currentChapter int64, generationError string) error {
	_, err := m.writeDB.Exec(
		"UPDATE courses SET status = ?, chapters = ?, current_chapter = ?, generation_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
		status, chapters, currentChapter, generationError, id,
	)
	if err == nil {
		m.cache.Bust("courses:")
	}
	return err
}
