# TaskFlow — FastAPI Task Manager

A production-style **Task Manager Web Application** built with FastAPI,
SQLAlchemy (async), SQLite, JWT authentication, and a plain
HTML / CSS / JavaScript frontend.

---

## Table of Contents

- [Features](#features)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Quick Start (Local)](#quick-start-local)
- [Running with Docker](#running-with-docker)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Running Tests](#running-tests)
- [Frontend Overview](#frontend-overview)
- [Design Decisions](#design-decisions)
- [Future Improvements](#future-improvements)

---

## Features

### Authentication
| Feature | Detail |
|---|---|
| Register | `POST /auth/register` — username, email, password |
| Login | `POST /auth/login` — returns JWT Bearer token |
| Profile | `GET /auth/me` — returns current user |
| Delete account | `DELETE /auth/me` — cascades to all tasks |

### Task Management *(authenticated users only)*
| Feature | Detail |
|---|---|
| Create task | `POST /tasks` |
| List tasks | `GET /tasks` — paginated, filterable |
| Get task | `GET /tasks/{id}` |
| Update task | `PUT /tasks/{id}` — partial update supported |
| Delete task | `DELETE /tasks/{id}` |

### Extra
- **Pagination** — `page` + `page_size` query params on `GET /tasks`
- **Filtering** — `completed`, `priority`, `search` query params
- **Password hashing** — bcrypt via passlib
- **JWT** — signed with HS256, configurable expiry
- **User isolation** — users can only access their own tasks
- **Async** — fully async SQLAlchemy + aiosqlite
- **Docker** — multi-stage image with non-root user
- **Tests** — 35+ pytest-asyncio tests with in-memory SQLite

---

## Project Structure

```
task-manager/
├── app/
│   ├── config.py          # Pydantic-settings (reads .env)
│   ├── database.py        # Async engine, session factory, Base
│   ├── models.py          # SQLAlchemy ORM models (User, Task)
│   ├── schemas.py         # Pydantic request / response schemas
│   ├── auth.py            # Password hashing, JWT, get_current_user
│   ├── main.py            # App factory, middleware, routers, lifespan
│   └── routes/
│       ├── user.py        # /auth/* endpoints
│       └── task.py        # /tasks/* endpoints
├── frontend/
│   ├── index.html         # Single-page app shell
│   ├── style.css          # Dark-mode design system
│   └── script.js          # Vanilla JS — auth, CRUD, pagination
├── tests/
│   └── test_main.py       # Async pytest suite (35+ tests)
├── .env.example           # Environment variable template
├── Dockerfile             # Multi-stage production image
├── requirements.txt       # Pinned Python dependencies
└── README.md
```

---

## Prerequisites

| Tool | Version |
|---|---|
| Python | 3.11 or 3.12 |
| pip | 23+ |
| Docker *(optional)* | 24+ |

---

## Quick Start (Local)

### 1 — Clone the repository

```bash
git clone https://github.com/your-username/task-manager.git
cd task-manager
```

### 2 — Create and activate a virtual environment

```bash
# macOS / Linux
python -m venv venv
source venv/bin/activate

# Windows (PowerShell)
python -m venv venv
.\venv\Scripts\Activate.ps1
```

### 3 — Install dependencies

```bash
pip install -r requirements.txt
```

### 4 — Configure environment

```bash
cp .env.example .env
```

Open `.env` and set a strong `SECRET_KEY`:

```bash
# Generate one with:
python -c "import secrets; print(secrets.token_hex(32))"
```

### 5 — Run the development server

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 6 — Open the app

| URL | Description |
|---|---|
| http://localhost:8000 | Frontend (HTML/CSS/JS) |
| http://localhost:8000/docs | Swagger UI |
| http://localhost:8000/redoc | ReDoc |
| http://localhost:8000/health | Health check |

---

## Running with Docker

### Build the image

```bash
docker build -t task-manager:latest .
```

### Run the container

```bash
docker run -d \
  --name task-manager \
  -p 8000:8000 \
  -v $(pwd)/data:/data \
  -e SECRET_KEY="your-strong-secret-here" \
  -e DEBUG="false" \
  task-manager:latest
```

The SQLite database is stored in the `/data` volume so it
**persists across container restarts**.

### Stop and remove

```bash
docker stop task-manager && docker rm task-manager
```

### Docker Compose *(optional convenience)*

```yaml
# docker-compose.yml
version: "3.9"
services:
  api:
    build: .
    ports:
      - "8000:8000"
    volumes:
      - ./data:/data
    env_file:
      - .env
    restart: unless-stopped
```

```bash
docker compose up -d
docker compose logs -f
docker compose down
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `APP_NAME` | `FastAPI Task Manager` | Shown in docs + health check |
| `APP_VERSION` | `1.0.0` | Shown in docs + health check |
| `DEBUG` | `false` | Enables SQL query logging |
| `DATABASE_URL` | `sqlite+aiosqlite:///./task_manager.db` | Async DB connection string |
| `SECRET_KEY` | *(must set)* | JWT signing key — **keep secret** |
| `ALGORITHM` | `HS256` | JWT signing algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | JWT lifetime in minutes |
| `ALLOWED_ORIGINS` | `["*"]` | CORS allowed origins |

> **Tip:** Copy `.env.example` → `.env` and never commit `.env` to git.

---

## API Reference

### Authentication

#### `POST /auth/register`
```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "Secure1Pass"
}
```
Returns `201` with the created user object.

---

#### `POST /auth/login`
Form-encoded body (`application/x-www-form-urlencoded`):
```
username=john_doe&password=Secure1Pass
```
Returns `200` with:
```json
{ "access_token": "<jwt>", "token_type": "bearer" }
```

---

#### `GET /auth/me`
**Header:** `Authorization: Bearer <token>`

Returns the authenticated user's profile.

---

### Tasks

All task endpoints require:
```
Authorization: Bearer <token>
```

#### `POST /tasks`
```json
{
  "title": "Buy groceries",
  "description": "Milk, eggs, bread",
  "priority": "high",
  "due_date": "2025-12-31T18:00:00Z"
}
```

---

#### `GET /tasks`

| Query Param | Type | Description |
|---|---|---|
| `page` | int | Page number, default `1` |
| `page_size` | int | Items per page, default `10`, max `100` |
| `completed` | bool | `true` / `false` |
| `priority` | string | `low` / `medium` / `high` |
| `search` | string | Substring match on title |

Example:
```
GET /tasks?completed=false&priority=high&page=1&page_size=5
```

---

#### `GET /tasks/{id}`
Returns a single task or `404`.

---

#### `PUT /tasks/{id}`
Partial update — only send the fields you want to change:
```json
{ "completed": true }
```

---

#### `DELETE /tasks/{id}`
Returns `200` with a confirmation message or `404`.

---

## Running Tests

```bash
# Install dependencies (if not already done)
pip install -r requirements.txt

# Run all tests with verbose output
pytest tests/test_main.py -v

# Run a specific test class
pytest tests/test_main.py::TestCreateTask -v

# Run with coverage report
pip install pytest-cov
pytest tests/test_main.py -v --cov=app --cov-report=term-missing
```

### Test coverage includes

- User registration (success, duplicate username/email, weak password)
- Login (success, wrong password, non-existent user)
- JWT authentication (`/auth/me`, invalid token)
- Task CRUD (create, list, get, update, delete)
- Pagination and filtering (completed, priority, search)
- User isolation (cannot access another user's tasks)
- Health check endpoint

---

## Frontend Overview

The frontend is a single-page application served directly by FastAPI
via `StaticFiles`.

| File | Responsibility |
|---|---|
| `index.html` | App shell — auth forms, task list, edit modal |
| `style.css` | Dark-mode design system with CSS custom properties |
| `script.js` | Vanilla JS — auth flow, CRUD, filters, pagination |

### Key frontend features

- **Tab-based auth** — Login / Register switch without page reload
- **JWT persistence** — Token stored in `localStorage`, auto-restored
- **Debounced search** — 300 ms debounce on the search filter input
- **Inline completion toggle** — Checkbox per task card
- **Edit modal** — Pre-populated form, closes on Escape or backdrop click
- **Overdue indicator** — Due dates in the past are highlighted in red
- **Toast notifications** — Non-blocking feedback for every action
- **Pagination controls** — Prev / Next + page number buttons

---

## Design Decisions

| Decision | Rationale |
|---|---|
| Async SQLAlchemy + aiosqlite | Non-blocking I/O; drop-in swap to PostgreSQL by changing `DATABASE_URL` |
| Pydantic v2 | Faster validation, `model_dump(exclude_unset=True)` enables true partial updates |
| Multi-stage Docker build | Lean runtime image — no compilers or build tools in production |
| Non-root Docker user | Security best practice — limits blast radius if the app is compromised |
| In-memory SQLite for tests | Fast, isolated, zero-config — no test database setup required |
| Same-origin frontend | Avoids CORS complexity in development; trivial to split for production |

---

## Future Improvements

- **PostgreSQL support** — Change `DATABASE_URL` and set `--workers > 1`
- **Refresh tokens** — Slide token expiry without forcing re-login
- **Email verification** — Confirm address on registration
- **Rate limiting** — `slowapi` middleware on auth endpoints
- **Task categories / tags** — Many-to-many relationship
- **File attachments** — S3 / local storage per task
- **WebSocket updates** — Real-time task sync across browser tabs
- **CI/CD pipeline** — GitHub Actions: lint → test → build → push image

---

## License

MIT — free to use, modify, and distribute.