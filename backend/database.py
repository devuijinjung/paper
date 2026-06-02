from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase

from config import settings

engine = create_async_engine(settings.database_url, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session


async def init_db():
    async with engine.begin() as conn:
        from models import Trade, Position, BalanceHistory, AlertLog  # noqa: F401
        from sqlalchemy import text
        await conn.run_sync(Base.metadata.create_all)
        # Migration: add 'side' column to positions (futures mode upgrade)
        try:
            await conn.execute(
                text("ALTER TABLE positions ADD COLUMN side VARCHAR(8) DEFAULT 'long'")
            )
        except Exception:
            pass  # column already exists
