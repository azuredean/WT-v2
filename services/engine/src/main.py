"""Whale Tracker V2 - FastAPI Engine Entry Point."""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .api.router import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    print("🐳 Whale Tracker Engine starting...")
    # TODO: Initialize database connections
    # TODO: Start market ingester workers
    # TODO: Start signal processor workers
    yield
    print("🐳 Whale Tracker Engine shutting down...")
    # TODO: Cleanup connections


app = FastAPI(
    title="Whale Tracker V2 Engine",
    description="Market Participant Profiling & Trading Engine API",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "whale-tracker-engine"}
