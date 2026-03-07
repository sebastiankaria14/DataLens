<div align="center">
  <h1>DataForge</h1>
  <p><strong>Production-grade dataset preparation platform for machine learning.</strong><br/>
  Profile, clean, visualize, and export ML-ready data — without ever loading it into memory.</p>

  <p>
    <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"/></a>
    <a href="https://www.python.org/downloads/"><img src="https://img.shields.io/badge/Python-3.10+-3776AB.svg?logo=python&logoColor=white" alt="Python 3.10+"/></a>
    <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-18+-339933.svg?logo=node.js&logoColor=white" alt="Node.js 18+"/></a>
    <a href="https://fastapi.tiangolo.com/"><img src="https://img.shields.io/badge/FastAPI-0.115-009688.svg?logo=fastapi&logoColor=white" alt="FastAPI"/></a>
    <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-18-61DAFB.svg?logo=react&logoColor=black" alt="React 18"/></a>
    <a href="https://duckdb.org/"><img src="https://img.shields.io/badge/DuckDB-1.1-FFC107.svg" alt="DuckDB"/></a>
    <a href="https://www.pola.rs/"><img src="https://img.shields.io/badge/Polars-1.13-CD792C.svg" alt="Polars"/></a>
  </p>
</div>

---

## Overview

DataForge is a full-stack web application built for data scientists and ML engineers who need to go from raw files to clean, ML-ready datasets as fast as possible.

It leverages **DuckDB** for embedded zero-copy analytics and **Polars** for high-performance data transformations — meaning files are queried directly from disk with no in-memory loading, making it practical even for large datasets.

```
Upload ? Auto-Profile ? Visualize ? Clean ? Export
```

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [Project Structure](#project-structure)
- [Performance](#performance)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## Features

### Dataset Profiling
- **Data quality score** (0–100) based on completeness, duplicates, and consistency
- Column-level statistics: mean, median, std, min, max, quartiles, cardinality
- Missing value analysis with per-column percentages
- Duplicate row detection and flagging
- Memory usage estimation (without full load)
- Imbalance warnings for classification target columns
- **Domain classification** — auto-detects Finance, Healthcare, Sports, HR, etc.
- **ML suitability suggestions** — recommends Regression, Classification, Clustering, etc. with confidence levels

### Data Cleaning (Polars-powered)
- Remove duplicate rows
- Handle missing values: `drop`, `fill_mean`, `fill_median`, `fill_mode`, `fill_zero`, `auto`  
  `auto` applies fill_mean for numeric columns and fill_mode for text — automatically
- Outlier detection and handling via **IQR** or **Z-score**, with cap or remove action
- Column filtering (select columns to keep)
- Min-max normalization for numeric columns
- Label encoding for low-cardinality categorical columns
- Re-run cleaning with updated options at any time

### ML Preparation
- Class balancing: oversampling, undersampling, or combined
- Imbalance analysis per target column
- Train/test split with optional stratification
- Export in **CSV**, **Parquet**, or **Excel**

### Visualizations
- Interactive histograms for numeric columns
- Bar charts for categorical distributions
- Box plots for outlier visibility
- Per-column statistics displayed alongside charts

### AI Assistance
- AI-generated dataset summaries and descriptions
- Conversational assistant — ask questions about your data in natural language
- Suggested cleaning strategies based on profile results

### Authentication & Security
- JWT-based auth (PBKDF2 password hashing)
- OAuth2 password flow (`/api/auth/login`)
- Protected routes with auto-logout on token expiry
- Profile and password management

---

## Tech Stack

### Frontend

| Technology | Version | Purpose |
|---|---|---|
| React | 18 | UI framework |
| TypeScript | 5.x | Type-safe development |
| Vite | 6.x | Build tooling and dev server |
| Tailwind CSS | 3.4 | Utility-first styling |
| Framer Motion | 11 | Animations and transitions |
| Recharts | 3 | Data visualization |
| React Router | 7 | Client-side routing |
| Axios | 1.x | HTTP client with interceptors |

### Backend

| Technology | Version | Purpose |
|---|---|---|
| FastAPI | 0.115 | High-performance async API framework |
| DuckDB | 1.1.3 | Embedded analytics engine (zero-copy) |
| Polars | 1.13 | Vectorized DataFrame processing |
| PyArrow | 18 | Columnar format conversion |
| SQLAlchemy | 2.0 | ORM for metadata storage |
| Pydantic | 2.x | Schema validation and settings |
| Uvicorn | 0.32 | ASGI production server |
| python-jose | 3.x | JWT generation and validation |
| Passlib | 1.7 | Secure password hashing |

### Storage

| Layer | Technology |
|---|---|
| Metadata | SQLite (dev) / PostgreSQL (prod) |
| Raw uploads | File system (`backend/uploads/`) |
| Processed data | Parquet (`backend/processed/parquet/`) |
| Cleaned output | Parquet / CSV / Excel (`backend/processed/`) |

---

## Architecture

```
+--------------------------------------------------------------+
¦                        React Frontend                        ¦
¦   Auth · Dashboard · Upload · Dataset Detail · ML Panel     ¦
+--------------------------------------------------------------+
                             ¦  REST (Axios + JWT Bearer)
                             ?
+--------------------------------------------------------------+
¦                       FastAPI Backend                        ¦
¦                                                              ¦
¦   /api/auth          /api/datasets          Background       ¦
¦   -------------      -----------------      -----------      ¦
¦   signup             upload                 Profiling task   ¦
¦   login              profile                Cleaning task    ¦
¦   me / update        clean                  ML prep task     ¦
¦   change-password    balance / split                         ¦
¦                      visualize / ai                          ¦
+-------------------------------------------------------------+
                  ¦                  ¦
        +---------?-------+  +------?-----------+
        ¦   DuckDB         ¦  ¦     Polars        ¦
        ¦  (Profiler)      ¦  ¦   (Cleaner /      ¦
        ¦  reads Parquet   ¦  ¦    Sampler)       ¦
        ¦  directly        ¦  ¦  lazy evaluation  ¦
        +-----------------+  +------------------+
                  ¦
        +---------?-----------------------------+
        ¦              Storage                  ¦
        ¦  SQLite (metadata)  ·  File system    ¦
        ¦  uploads/  ·  processed/parquet/      ¦
        +---------------------------------------+
```

### Design Principles

- **Zero-copy processing** — DuckDB queries Parquet files directly on disk; no full dataset load
- **Lazy evaluation** — Polars builds a query plan before executing; avoids unnecessary materialization
- **Metadata-only database** — SQLite/PostgreSQL stores paths and stats, never raw data
- **Background tasks** — Profiling and cleaning are async; API never blocks
- **Parquet-first** — All uploads are immediately converted; columnar format gives 10–100× query speedups and 50–80% size reduction

---

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- Git
- Ollama _(optional — required for AI chat features)_

### 1. Clone

```bash
git clone https://github.com/yourusername/dataforge.git
cd dataforge
```

### 2. Backend

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate        # macOS/Linux
venv\Scripts\activate           # Windows

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env — at minimum set SECRET_KEY

# Start the server
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Backend available at:

| URL | Description |
|---|---|
| http://localhost:8000 | API root |
| http://localhost:8000/docs | Swagger UI |
| http://localhost:8000/redoc | ReDoc |
| http://localhost:8000/health | Health check |

### 3. Frontend

```bash
# In a new terminal
cd frontend
npm install
npm run dev
```

Frontend available at **http://localhost:5173**

### 4. AI Features (Optional)

```bash
ollama pull codellama:13b
ollama serve
```

---

## Configuration

### Backend — `backend/.env`

```env
# Required
SECRET_KEY=<generate with: openssl rand -hex 32>
DATABASE_URL=sqlite:///./dataforge.db

# File storage
UPLOAD_DIR=uploads
PROCESSED_DIR=processed
MAX_FILE_SIZE_MB=100

# AI (optional)
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=codellama:13b
```

**Generate a secure key:**
```bash
openssl rand -hex 32
```

**PostgreSQL (production):**
```env
DATABASE_URL=postgresql://user:password@localhost:5432/dataforge
```

### Frontend — `frontend/.env`

```env
VITE_API_URL=http://localhost:8000
```

The default (`http://localhost:8000`) is used automatically if `.env` is absent.

---

## API Reference

All endpoints require `Authorization: Bearer <token>` except `/api/auth/login` and `/api/auth/signup`.

### Auth

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/signup` | Register a new user |
| `POST` | `/api/auth/login` | Obtain JWT (form data) |
| `POST` | `/api/auth/login/json` | Obtain JWT (JSON body) |
| `GET` | `/api/auth/me` | Get current user |
| `PUT` | `/api/auth/me` | Update name / email |
| `POST` | `/api/auth/change-password` | Change password |

### Datasets

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/datasets/upload` | Upload a dataset (multipart) |
| `GET` | `/api/datasets/` | List all datasets |
| `GET` | `/api/datasets/{id}` | Get dataset metadata |
| `DELETE` | `/api/datasets/{id}` | Delete a dataset |
| `GET` | `/api/datasets/{id}/profile` | Get full profiling results |
| `GET` | `/api/datasets/{id}/preview` | Preview first N rows |
| `GET` | `/api/datasets/{id}/insights` | Get AI-generated insights |
| `POST` | `/api/datasets/{id}/ai` | Ask a question about the data |
| `GET` | `/api/datasets/{id}/visualization` | Column visualization data |
| `POST` | `/api/datasets/{id}/clean` | Start cleaning job |
| `GET` | `/api/datasets/{id}/clean/status` | Poll cleaning status |
| `GET` | `/api/datasets/{id}/download` | Download original file |
| `GET` | `/api/datasets/{id}/download-cleaned` | Download cleaned file (`?format=csv\|parquet\|excel`) |
| `POST` | `/api/datasets/{id}/balance` | Balance class distribution |
| `GET` | `/api/datasets/{id}/analyze-imbalance/{col}` | Analyze target imbalance |
| `POST` | `/api/datasets/{id}/train-test-split` | Split into train/test sets |
| `GET` | `/api/datasets/{id}/ml-analysis` | Get ML readiness analysis |
| `POST` | `/api/datasets/{id}/prepare-ml` | Run ML preparation pipeline |

Full interactive documentation is available at `/docs` when the backend is running.

---

## Project Structure

```
dataforge/
+-- backend/
¦   +-- app/
¦   ¦   +-- main.py                  # FastAPI app, lifespan, CORS, router wiring
¦   ¦   +-- core/
¦   ¦   ¦   +-- config.py            # Pydantic settings (reads .env)
¦   ¦   ¦   +-- database.py          # SQLAlchemy engine & session
¦   ¦   ¦   +-- security.py          # JWT utilities, PBKDF2 hashing
¦   ¦   ¦   +-- dependencies.py      # get_current_user dependency
¦   ¦   +-- models/
¦   ¦   ¦   +-- user.py              # users table
¦   ¦   ¦   +-- dataset.py           # datasets table (metadata + profile_data JSON)
¦   ¦   +-- routers/
¦   ¦   ¦   +-- auth.py              # /api/auth/* endpoints
¦   ¦   ¦   +-- datasets.py          # /api/datasets/* endpoints
¦   ¦   ¦   +-- chat.py              # /api/chat/* endpoints
¦   ¦   +-- schemas/
¦   ¦   ¦   +-- user.py              # UserCreate, UserRead, UserUpdate
¦   ¦   ¦   +-- dataset.py           # DatasetCreate, DatasetRead, CleaningOptions
¦   ¦   +-- services/
¦   ¦   ¦   +-- profiler.py          # DuckDB profiling, domain classification
¦   ¦   ¦   +-- cleaner.py           # Polars cleaning pipeline
¦   ¦   ¦   +-- sampling.py          # Class balancing, train-test split
¦   ¦   ¦   +-- parquet_converter.py # CSV/Excel/JSON ? Parquet
¦   ¦   ¦   +-- llm_service.py       # Ollama integration
¦   ¦   +-- utils/
¦   ¦       +-- prompt_builder.py    # LLM prompt templates
¦   +-- uploads/                     # Raw uploaded files
¦   +-- processed/
¦   ¦   +-- parquet/                 # Converted Parquet files
¦   +-- requirements.txt
¦   +-- .env.example
¦
+-- frontend/
¦   +-- src/
¦   ¦   +-- App.tsx                  # Route definitions
¦   ¦   +-- main.tsx                 # React entry point
¦   ¦   +-- index.css                # Design system (Tailwind + custom utilities)
¦   ¦   +-- context/
¦   ¦   ¦   +-- AuthContext.tsx      # Global auth state
¦   ¦   +-- services/
¦   ¦   ¦   +-- api.ts               # Axios instance (JWT injection, 401 handling)
¦   ¦   ¦   +-- auth.ts              # Auth service (localStorage persistence)
¦   ¦   ¦   +-- dataset.ts           # Dataset API client
¦   ¦   +-- components/
¦   ¦   ¦   +-- DatasetHeader.tsx    # Page header with stat tiles
¦   ¦   ¦   +-- DatasetOverview.tsx  # Insight card (domain, ML suitability)
¦   ¦   ¦   +-- ProfilingStats.tsx   # Quality score + stats cards
¦   ¦   ¦   +-- ColumnsTable.tsx     # Per-column statistics table
¦   ¦   ¦   +-- CleaningPanel.tsx    # Cleaning options and results
¦   ¦   ¦   +-- CleaningCharts.tsx   # Before/after cleaning charts
¦   ¦   ¦   +-- MLPanel.tsx          # ML preparation controls
¦   ¦   ¦   +-- ActionButtons.tsx    # Explore / Chat action buttons
¦   ¦   ¦   +-- VisualizationWorkspace.tsx  # Slide-in chart workspace
¦   ¦   ¦   +-- ChatWorkspace.tsx    # Slide-in AI chat
¦   ¦   +-- pages/
¦   ¦   ¦   +-- Login.tsx / Signup.tsx
¦   ¦   ¦   +-- Dashboard.tsx
¦   ¦   ¦   +-- UploadDataset.tsx
¦   ¦   ¦   +-- DatasetDetails.tsx
¦   ¦   ¦   +-- Profile.tsx / Settings.tsx
¦   ¦   ¦   +-- Activities.tsx
¦   ¦   ¦   +-- Notifications.tsx
¦   ¦   +-- types/
¦   +-- package.json
¦   +-- vite.config.ts
¦   +-- tailwind.config.js
¦   +-- .env.example
¦
+-- README.md
+-- LICENSE
+-- package.json
```

---

## Performance

DataForge is architected to handle large datasets without exhausting memory.

### Backend

| Optimization | Detail |
|---|---|
| Zero-copy profiling | DuckDB reads Parquet directly from disk — no DataFrame materialization |
| Lazy query execution | Polars builds a logical plan before execution; unused columns are never loaded |
| Parquet conversion | Applied immediately on upload; provides 50–80% size reduction and 10–100× faster queries vs CSV |
| Async background tasks | Profiling and cleaning are offloaded via `BackgroundTasks`; the API returns immediately |
| Chunked file handling | Large uploads are streamed; no full-file buffering in application memory |

### Frontend

| Optimization | Detail |
|---|---|
| On-demand visualizations | Chart data is only fetched when the workspace is opened |
| Smart polling | Status polling stops automatically once profiling/cleaning completes |
| Lightweight state | No Redux or heavy state library — context + local state only |
| Tabular numbers | `tabular-nums` font feature prevents jitter in stat dashboards |

---

## Roadmap

| Status | Feature |
|---|---|
| ? | JWT authentication + profile management |
| ? | Multi-format upload (CSV, Excel, JSON) |
| ? | Automatic Parquet conversion |
| ? | DuckDB-powered profiling & quality scoring |
| ? | Domain classification + ML suitability suggestions |
| ? | Interactive visualizations (histogram, bar, box plot) |
| ? | Polars cleaning pipeline with smart auto-fill |
| ? | Class balancing & train-test split |
| ? | AI dataset summaries & chat assistant |
| ? | Re-clean with new options |
| ? | Multi-format export (CSV, Parquet, Excel) |
| ?? | Docker Compose setup |
| ?? | Dataset versioning (snapshots per clean run) |
| ?? | Correlation matrix and scatter plot visualizations |
| ?? | Custom transformation pipelines (code-as-config) |
| ?? | Cloud storage integration (S3, Azure Blob) |
| ?? | Automated feature engineering suggestions |
| ?? | PostgreSQL + Redis for production deployment |
| ?? | Model-ready exports (TFRecord, HuggingFace Datasets) |
| ?? | CI/CD pipeline and test suite |

---

## Contributing

Contributions are welcome. Please follow standard GitHub flow:

1. **Fork** the repository
2. **Create a branch** — `git checkout -b feature/your-feature`
3. **Commit** with a descriptive message — `git commit -m 'feat: add scatter plot visualization'`
4. **Push** — `git push origin feature/your-feature`
5. **Open a Pull Request** with a clear description of the change

### Guidelines

- Match the existing code style (Ruff for Python, ESLint for TypeScript)
- Keep commits atomic and scoped
- Write defensive code — handle both `null` API responses and unexpected data shapes
- Update this README if your change adds or removes a user-facing feature

---

## License

Licensed under the **MIT License**. See [LICENSE](LICENSE) for the full text.

---

<div align="center">
  <sub>Built with FastAPI · DuckDB · Polars · React · TypeScript · Tailwind CSS</sub>
</div>

