from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from .config import settings

settings.ensure_dirs()

is_sqlite = settings.DATABASE_URL.startswith("sqlite")
connect_args = {"check_same_thread": False} if is_sqlite else {}

# For PostgreSQL/Supabase: pool_pre_ping sends a lightweight SELECT 1 before
# each connection use, so SQLAlchemy transparently reconnects when the server
# closed an idle connection (Supabase/PgBouncer idle timeout). Without this,
# the app throws "server closed the connection unexpectedly" -> 500 errors
# on attendance start and other endpoints.
engine_kwargs = {"pool_pre_ping": True} if not is_sqlite else {}

engine = create_engine(settings.DATABASE_URL, connect_args=connect_args, **engine_kwargs, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
