from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # --------------------------------------------------
    # APP INFO
    # --------------------------------------------------
    APP_NAME: str = "Task Manager API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    # --------------------------------------------------
    # DATABASE (ASYNC SQLITE - IMPORTANT FIX)
    # --------------------------------------------------
    DATABASE_URL: str = "sqlite+aiosqlite:///./app.db"

    # --------------------------------------------------
    # JWT AUTH
    # --------------------------------------------------
    SECRET_KEY: str = "super-secret-key-change-this"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # --------------------------------------------------
    # CORS
    # --------------------------------------------------
    ALLOWED_ORIGINS: list = ["*"]


settings = Settings()