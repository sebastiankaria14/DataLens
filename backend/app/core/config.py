from pydantic_settings import BaseSettings
from typing import List
from pathlib import Path


_BASE_DIR = Path(__file__).resolve().parents[2]
_ENV_FILE = _BASE_DIR / ".env"


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "sqlite:///./dataforge.db"
    
    # JWT
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # CORS
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:5174"
    
    # File Upload
    MAX_FILE_SIZE_MB: int = 100
    # Use absolute paths by default so background jobs work regardless of CWD
    UPLOAD_DIR: str = str(_BASE_DIR / "uploads")
    PROCESSED_DIR: str = str(_BASE_DIR / "processed")
    
    @property
    def allowed_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]
    
    class Config:
        env_file = str(_ENV_FILE)
        case_sensitive = True


settings = Settings()
