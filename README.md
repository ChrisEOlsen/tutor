# Tutor — AI-Powered Interactive Learning

Build custom, chapter-by-chapter courses around any project you want to learn. Describe what you want to build, and Tutor generates a full curriculum with quizzes, code exercises, AI-graded tests, and resource links.

Built on the [GOVA Monolith](https://github.com/ChrisEOlsen/gova-monolith) — an AI-second framework where the LLM drives MCP tools that render deterministic Go templates and vanilla JS, not raw HTML.

## What It Does

1. **Describe a project** — e.g., "write a memory allocator in C using an explicit free list"
2. **AI clarifies scope** — asks 2–3 targeted questions about language, prerequisites, and goals
3. **Generate outline** — AI produces a chapter-by-chapter curriculum
4. **Generate course** — chapters are generated one at a time with live progress
5. **Study** — work through rich visual sections: code blocks, concept cards, diagrams, comparison tables, inline quizzes
6. **Test** — each chapter ends with a mix of multiple choice, written, and code questions. The AI grades written and code answers inline.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [GOVA Monolith](https://github.com/ChrisEOlsen/gova-monolith) (Go + Vanilla JS + SQLite) |
| AI | Claude Haiku 4.5 (course/outline generation) · Claude Sonnet 4.6 (chat/grading) |
| AI Gateway | OpenRouter |
| Database | SQLite (WAL mode) |
| Router | chi |
| CSS | Tailwind CLI (standalone) |
| Deployment | Docker + Cloudflare Tunnel |

The AI returns structured JSON. Go handlers never render HTML. All DOM rendering is vanilla JS using `createElement` — no innerHTML, no templates, no build step.

## Quick Start

```bash
cp env.example .env
# Edit .env: set OPENROUTER_API_KEY
openssl rand -hex 32  # paste as SESSION_SECRET
```

```bash
docker compose up -d
```

Open `http://localhost:8081` and create your first course.

## Architecture

```
User → Dashboard → New Course → Chat (AI clarifies) → Outline → Generate → Study → Test
```

- **Single table** — all course data (chat history, outline, chapters, test results) stored as JSON in one `courses` record
- **No auth** — designed for single-machine local deployment
- **Synchronous AI** — POST endpoints block until the AI responds. Simple, no polling infrastructure needed.

## Project Structure

```
src/app/
├── handlers/          # JSON API endpoints
│   ├── openrouter.go  # OpenRouter client + system prompts
│   ├── course_chat.go # Chat + outline generation
│   ├── course_generate.go  # Chapter-by-chapter generation
│   ├── course_grading.go   # AI test grading
│   └── ...
├── models/
│   └── Course.go      # CRUD with caching
├── static/
│   ├── pages/         # HTML shells (home, chat, study, new_course)
│   ├── js/
│   │   ├── lib/
│   │   │   ├── api.js       # CSRF-safe fetch wrapper
│   │   │   └── sections.js  # Chapter section renderer
│   │   ├── home.js          # Dashboard
│   │   ├── chat.js          # Chat interface
│   │   ├── study.js         # Study + test UI
│   │   └── new_course.js    # Course creation form
│   └── css/
└── main.go            # Routes + middleware
```

## License

MIT
