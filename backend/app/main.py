from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.db import engine, Base
from app.api.routes import auth, rfqs, auctions, evaluation, bidder, dashboard

# Create tables for MVP convenience (production would use Alembic migrations).
# Wrapped so the app can still be imported for tests when the DB is temporarily unavailable.
try:
    Base.metadata.create_all(bind=engine)
except Exception as exc:  # pragma: no cover - logged by the container runtime
    print(f"Warning: could not initialize database schema: {exc}")

app = FastAPI(title="Comet API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin, "http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(rfqs.router, prefix="/api")
app.include_router(auctions.router, prefix="/api")
app.include_router(evaluation.router, prefix="/api")
app.include_router(bidder.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok", "app": "comet"}
