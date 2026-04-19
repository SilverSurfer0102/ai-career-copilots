import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from database import create_db_and_tables
import models  # noqa: F401 — registers all SQLModel tables

from routers import profiles, jobs, retrieval, generate, validate, export, blocks

logging.basicConfig(level=getattr(logging, settings.log_level.upper(), logging.INFO))
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting AI Career Copilot API")
    create_db_and_tables()
    yield
    logger.info("Shutting down AI Career Copilot API")


app = FastAPI(
    title="AI Career Copilot",
    description="Evidence-grounded resume and cover letter generation.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(profiles.router, prefix="/profiles", tags=["profiles"])
app.include_router(jobs.router, prefix="/jobs", tags=["jobs"])
app.include_router(retrieval.router, prefix="/retrieval", tags=["retrieval"])
app.include_router(generate.router, prefix="/generate", tags=["generate"])
app.include_router(validate.router, prefix="/validate", tags=["validate"])
app.include_router(export.router, prefix="/export", tags=["export"])
app.include_router(blocks.router, prefix="/profiles", tags=["blocks"])


@app.get("/health", tags=["system"])
def health():
    return {"status": "ok", "version": "0.1.0"}
