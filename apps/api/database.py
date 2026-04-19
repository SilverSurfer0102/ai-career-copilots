from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy import event
from config import settings

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


def get_session():
    with Session(engine) as session:
        yield session
