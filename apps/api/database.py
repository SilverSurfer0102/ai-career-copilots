import logging
from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy import event, text
from config import settings

logger = logging.getLogger(__name__)

connect_args = {"check_same_thread": False, "timeout": 30} if settings.database_url.startswith("sqlite") else {}

engine = create_engine(
    settings.database_url,
    echo=(settings.app_env == "development"),
    pool_pre_ping=True,
    connect_args=connect_args,
)


@event.listens_for(engine, "connect")
def _set_wal_mode(dbapi_connection, _connection_record):
    if settings.database_url.startswith("sqlite"):
        dbapi_connection.execute("PRAGMA journal_mode=WAL")


def create_db_and_tables() -> None:
    SQLModel.metadata.create_all(engine)
    _apply_schema_migrations()


def _apply_schema_migrations() -> None:
    """Idempotent column-level migrations for SQLite (no alembic versioning needed)."""
    migrations = [
        "ALTER TABLE generation_run ADD COLUMN application_id TEXT REFERENCES application(id)",
    ]
    with engine.connect() as conn:
        for sql in migrations:
            try:
                conn.execute(text(sql))
                conn.commit()
                logger.info("Migration applied: %s", sql[:60])
            except Exception:
                pass  # column already exists — safe to ignore


def get_session():
    with Session(engine) as session:
        yield session
