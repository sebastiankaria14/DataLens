# DataForge - ML Dataset Preparation Platform

A production-grade platform for preparing and cleaning datasets for machine learning.

## Features

- **Authentication**: JWT-based user authentication with secure password hashing
- **Dataset Upload**: Support for CSV, Excel, and JSON files
- **Automatic Profiling**: DuckDB-powered data profiling with comprehensive statistics
- **Data Cleaning**: Polars-based cleaning pipeline with:
  - Duplicate removal
  - Missing value handling
  - Outlier detection and removal
  - Column filtering
  - Data normalization
- **Export**: Download cleaned datasets ready for ML training

## Tech Stack

- **FastAPI**: High-performance async web framework
- **SQLAlchemy**: SQL toolkit and ORM
- **DuckDB**: In-process analytical database for profiling
- **Polars**: Lightning-fast DataFrame library for data cleaning
- **PyArrow**: Columnar data format
- **JWT**: Secure token-based authentication

## Setup

1. Create a virtual environment:
```bash
python -m venv venv
venv\Scripts\activate  # Windows
source venv/bin/activate  # Linux/Mac
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Create `.env` file (copy from `.env.example`):
```bash
cp .env.example .env
```

4. Run the application:
```bash
uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`

## API Documentation

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Endpoints

### Authentication
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - Login user (form data)
- `POST /api/auth/login/json` - Login user (JSON)
- `POST /api/auth/forgot-password` - Request password reset
- `GET /api/auth/me` - Get current user info

### Datasets
- `POST /api/datasets/upload` - Upload dataset
- `GET /api/datasets/` - List user's datasets
- `GET /api/datasets/{id}` - Get dataset details
- `GET /api/datasets/{id}/profile` - Get profiling results
- `POST /api/datasets/{id}/clean` - Clean dataset
- `GET /api/datasets/{id}/download` - Download processed dataset
- `DELETE /api/datasets/{id}` - Delete dataset

## Project Structure

```
backend/
├── app/
│   ├── core/           # Core configuration and utilities
│   │   ├── config.py   # Settings management
│   │   ├── security.py # JWT and password hashing
│   │   ├── database.py # Database connection
│   │   └── dependencies.py # FastAPI dependencies
│   ├── models/         # SQLAlchemy models
│   │   ├── user.py
│   │   └── dataset.py
│   ├── schemas/        # Pydantic schemas
│   │   ├── user.py
│   │   └── dataset.py
│   ├── routers/        # API endpoints
│   │   ├── auth.py
│   │   └── datasets.py
│   ├── services/       # Business logic
│   │   ├── profiler.py # DuckDB profiling service
│   │   └── cleaner.py  # Polars cleaning service
│   └── main.py         # Application entry point
├── uploads/            # Uploaded files
├── processed/          # Cleaned files
├── requirements.txt
└── .env
```

## Environment Variables

- `DATABASE_URL`: Database connection string (default: SQLite)
- `SECRET_KEY`: JWT secret key
- `ALGORITHM`: JWT algorithm (default: HS256)
- `ACCESS_TOKEN_EXPIRE_MINUTES`: Token expiration time
- `ALLOWED_ORIGINS`: CORS allowed origins
- `MAX_FILE_SIZE_MB`: Maximum file upload size
- `UPLOAD_DIR`: Upload directory path
- `PROCESSED_DIR`: Processed files directory path
