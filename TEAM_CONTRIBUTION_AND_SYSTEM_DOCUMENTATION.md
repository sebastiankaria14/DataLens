# DataLens Team Contribution and System Documentation

## Project Team
- Rayyan
- Sabiq
- Atharva
- Sebastian

## Ownership Decision
The frontend part of the project is assigned to **Rayyan**.

---

## 1. Project Overview
DataLens is a full-stack dataset preparation platform that allows users to upload raw datasets, profile data quality, clean and transform data, prepare ML-ready outputs, and download processed files.

The project follows a modern web architecture:
- Frontend: React + TypeScript + Vite
- Backend: FastAPI + SQLAlchemy
- Data processing: DuckDB + Polars + PyArrow
- Auth and API security: JWT-based authentication
- Storage: filesystem for datasets + relational DB for metadata

Primary goals:
- Make dataset preparation simple for ML workflows
- Avoid loading large files into memory whenever possible
- Keep the API responsive with background processing
- Provide user-friendly profiling and cleaning features end-to-end

---

## 2. Team Allocation (Final)

### Rayyan - Frontend Lead and Owner
**Primary ownership:** All frontend architecture, UI/UX, client-side routing, API integration layer, auth state management in UI, data visualization pages, and frontend reliability.

### Sabiq - Backend API and Authentication Lead
**Primary ownership:** FastAPI service architecture, auth flows, security middleware/dependencies, API endpoint design, request/response schemas, and backend integration contracts.

### Atharva - Data Engineering and Processing Lead
**Primary ownership:** Profiling engine, cleaning pipeline, Parquet conversion flow, sampling/balancing logic, ML-prep operations, and dataset processing performance.

### Sebastian - System Integration, Database, QA, and Documentation Lead
**Primary ownership:** End-to-end integration, database and storage setup, environment configuration, operational workflow, testing/validation, issue tracking, and project documentation.

---

## 3. Detailed Member Contributions

## 3.1 Rayyan (Frontend)

### Scope and responsibilities
- Designed and maintained the frontend application structure.
- Implemented route architecture and protected navigation flow.
- Built user-facing pages for authentication, dashboard, upload, and dataset details.
- Integrated frontend services with backend REST APIs.
- Managed client-side authentication state and session handling.
- Built reusable UI components and page-level interactions.
- Ensured responsive behavior and coherent user experience across screens.

### Key frontend deliverables
- React app route map (public + protected routes).
- Upload dataset flow and user feedback behavior.
- Dataset details page with profile rendering and periodic refresh while background jobs run.
- Auth UX: login, signup, forgot password, profile-linked routes.
- API client with token injection and automatic unauthorized-session handling.

### Tools and technologies used by Rayyan
- React
- TypeScript
- Vite
- React Router
- Axios
- Tailwind CSS
- Recharts / charting integrations
- Framer Motion (UI transitions where applicable)

### Frontend engineering outcomes
- Smooth frontend-backend contract usage.
- Clear auth guard behavior for protected pages.
- Better user visibility into dataset status transitions.
- Reliable token-based API access on the client side.

---

## 3.2 Sabiq (Backend API and Security)

### Scope and responsibilities
- Built core FastAPI application structure and modular routing strategy.
- Implemented auth API endpoints for signup/login and user identity flows.
- Managed JWT token generation and validation paths.
- Implemented backend dependency chain for protected endpoints.
- Maintained CORS and API access policies for local development and app integration.
- Defined and aligned request/response contracts for frontend consumption.

### Key backend deliverables
- FastAPI app bootstrap and router wiring.
- Authentication router and user account endpoint behaviors.
- Secure password hashing (PBKDF2 via Passlib) + token issuance and verification.
- Protected route dependency for authenticated user context.
- API-level validation and error semantics.

### Tools and technologies used by Sabiq
- FastAPI
- SQLAlchemy
- Pydantic / pydantic-settings
- python-jose (JWT)
- Passlib
- Uvicorn

### Backend engineering outcomes
- Stable API backbone for all DataLens operations.
- Secure user authentication workflow.
- Consistent integration interface for frontend and data services.

---

## 3.3 Atharva (Data Processing and ML Preparation)

### Scope and responsibilities
- Designed data profiling and cleaning execution flow.
- Implemented conversion path from uploaded files to Parquet.
- Developed profiling logic for statistics, missingness, duplicates, quality scoring, and distribution checks.
- Implemented cleaning strategies for missing values, deduplication, outlier handling, filtering, and normalization.
- Built data balancing and split utilities for ML readiness.
- Improved processing architecture for larger-file handling and operational consistency.

### Key data-engineering deliverables
- DuckDB-powered profiling service.
- Polars-powered cleaning service.
- Parquet conversion utility and storage convention.
- Sampling and balancing operations for class-distribution adjustment.
- Train/test split support and ML-prep endpoints.

### Tools and technologies used by Atharva
- DuckDB
- Polars
- PyArrow
- OpenPyXL / XLS ingestion support
- JSON/CSV/Excel processing stack

### Data pipeline outcomes
- Faster analytical queries on columnar data.
- Cleaner datasets generated through configurable rules.
- Better ML pipeline preparation with balancing and split support.

---

## 3.4 Sebastian (Integration, Operations, QA, Documentation)

### Scope and responsibilities
- Coordinated cross-module integration between frontend, API, and data processing.
- Managed local environment setup and runtime workflow for team usage.
- Owned DB + storage path consistency and startup behavior verification.
- Performed end-to-end testing for upload -> profile -> clean -> download flow.
- Tracked system-level issues and validated fixes across modules.
- Created and maintained architecture, setup, and status documentation.

### Key integration deliverables
- Operational startup workflow for backend and frontend.
- Cross-layer validation of auth and dataset lifecycle.
- Folder/storage behavior checks for uploads and processed outputs.
- API sanity checks and runbook-style usage documentation.
- Consolidated status and architecture documentation artifacts.

### Tools and technologies used by Sebastian
- SQLite (and PostgreSQL-ready configurations)
- FastAPI docs tooling (Swagger/ReDoc)
- Environment management via .env
- Operational scripts and workflow commands
- Project-level documentation standards

### Integration outcomes
- Stable end-to-end execution path.
- Clear team handoff model between frontend, API, and data layers.
- Better maintainability through structured docs and runbooks.

---

## 4. Tech Stack (Consolidated)

## 4.1 Frontend Stack
- React
- TypeScript
- Vite (rolldown-vite override)
- React Router
- Axios
- Tailwind CSS
- Recharts
- Framer Motion

## 4.2 Backend Stack
- FastAPI
- Uvicorn
- SQLAlchemy
- Pydantic + pydantic-settings
- python-jose (JWT)
- Passlib
- python-multipart
- aiofiles

## 4.3 Data and Analytics Stack
- DuckDB (embedded analytical engine)
- Polars (high-performance data transformation)
- PyArrow (columnar format support)
- OpenPyXL / xlrd (Excel support)
- NumPy and Pandas (utility/compatibility use where needed)

## 4.4 Storage and Environment
- Metadata DB: SQLite by default (PostgreSQL-compatible setup paths)
- Raw files: backend uploads directory
- Processed outputs: backend processed directory
- Parquet-centric optimized storage path

---

## 5. System Design

## 5.1 High-level architecture
1. User interacts with React frontend.
2. Frontend calls FastAPI endpoints using Axios with Bearer token.
3. Backend authenticates user and validates request.
4. Dataset upload is persisted to disk and metadata is stored in DB.
5. Background processes run profiling and cleaning tasks.
6. Results are persisted and exposed through profile/download endpoints.

## 5.2 Logical components
- Presentation layer: frontend pages and components
- API layer: routers, schema validation, auth dependency chain
- Service layer: profiler, cleaner, sampler, converter
- Persistence layer:
  - metadata database
  - filesystem object storage for datasets

## 5.3 Design principles followed
- Keep heavy data processing server-side.
- Keep frontend focused on orchestration and visualization.
- Use modular routers and services for maintainability.
- Separate metadata persistence from large file storage.
- Favor efficient file/query patterns for scale.

---

## 6. End-to-End Workflow (Start to End)

## 6.1 Development workflow
1. Requirements and architecture planning.
2. Role distribution across the four team members.
3. Backend scaffold and auth foundation.
4. Data processing services implementation.
5. Frontend screens and API integration.
6. End-to-end integration testing.
7. Validation, bug fixes, and iteration.
8. Documentation and handoff preparation.

## 6.2 Runtime user workflow
1. User creates account or logs in.
2. User uploads dataset (CSV/Excel/JSON).
3. Backend stores file and metadata entry.
4. Background profiling starts.
5. Frontend polls dataset status.
6. Profile results become available and are displayed.
7. User applies cleaning/ML-prep settings.
8. Backend executes cleaning and writes output files.
9. User downloads processed dataset for ML workflows.

## 6.3 Dataset lifecycle stages
- uploaded
- profiling
- profiled
- cleaned (or failed when processing errors occur)

---

## 7. Interface and Contract Workflow

### Frontend to backend interactions
- Auth requests: signup, login, current user retrieval
- Dataset operations: upload, list, details, profile retrieval
- Processing actions: clean, balance/analyze, split operations
- Export actions: download processed output

### Security and identity workflow
- User logs in and receives JWT token.
- Token stored client-side and attached to each API call.
- Backend verifies token and resolves active user context.
- Unauthorized responses trigger frontend auth reset behavior.

---

## 8. Quality and Reliability Workflow

### Validation coverage performed by team
- API route behavior checks using documentation endpoints.
- Upload validation (file type and size constraints).
- Dataset status transition checks during background tasks.
- Frontend route protection verification.
- Error-path handling for auth failures and invalid requests.

### Operational quality practices
- Keep settings in environment files.
- Keep file paths and processing directories explicit.
- Keep routers/services separated by concern.
- Keep metadata and data-file responsibilities separate.

---

## 9. Final Role Summary
- **Rayyan:** Frontend complete ownership (UI, routing, auth UX, API consumption, visualization flow).
- **Sabiq:** Backend API + authentication + security and endpoint contracts.
- **Atharva:** Data profiling/cleaning/sampling/ML-prep processing engines.
- **Sebastian:** Integration, environment/operations, testing workflow, and documentation.

This split ensures clear responsibility boundaries, cleaner collaboration, and maintainable long-term ownership across all major platform layers.

---

## 10. Project Closure Notes
- Frontend ownership is formally assigned to Rayyan.
- The project has complete coverage across UI, backend services, data processing, and system integration.
- The end-to-end workflow from raw upload to ML-ready export is implemented and documented.

This document can be used as:
- team contribution evidence
- architecture and workflow explanation
- onboarding reference for future maintainers
- project review/reporting artifact
