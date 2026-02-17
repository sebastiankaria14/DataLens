from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from .core.config import settings
from .core.database import engine, Base
from .routers import auth_router, datasets_router, chat_router



@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup: Create database tables
    Base.metadata.create_all(bind=engine)
    print("Database tables created")
    
    yield
    
    # Shutdown
    print("Application shutting down")


# Create FastAPI application
app = FastAPI(
    title="DataForge API",
    description="ML Dataset Preparation & Cleaning Platform",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS - Must be before routes
# Allow any local dev origin (Vite port can vary).
app.add_middleware(
    CORSMiddleware,
    allow_origins=[],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)

# Include routers
app.include_router(auth_router)
app.include_router(datasets_router)
app.include_router(chat_router)

@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "DataForge API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
