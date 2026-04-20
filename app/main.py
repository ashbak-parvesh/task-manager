from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import Base, engine
from app.routes import task, user


# ---------------------------
# CREATE TABLES (ASYNC FIX)
# ---------------------------
async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


# ---------------------------
# LIFESPAN
# ---------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


# ---------------------------
# APP FACTORY
# ---------------------------
def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description="FastAPI Task Manager API",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    # ---------------------------
    # CORS
    # ---------------------------
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ---------------------------
    # ERROR HANDLER
    # ---------------------------
    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "detail": "Internal server error",
                "path": str(request.url),
            },
        )

    # ---------------------------
    # ROUTES
    # ---------------------------
    app.include_router(user.router)
    app.include_router(task.router)

    # ---------------------------
    # FRONTEND
    # ---------------------------
    app.mount(
        "/",
        StaticFiles(directory="frontend", html=True),
        name="frontend",
    )

    # ---------------------------
    # HEALTH CHECK
    # ---------------------------
    @app.get("/health")
    async def health():
        return {
            "status": "ok",
            "app": settings.APP_NAME,
            "version": settings.APP_VERSION,
        }

    return app


# ---------------------------
# APP INSTANCE
# ---------------------------
app = create_app()