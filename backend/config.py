from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    webhook_secret: str = "MY_SECRET_TOKEN"
    initial_capital: float = 10000.0
    fee_rate: float = 0.001
    slippage: float = 0.0005
    database_url: str = "sqlite+aiosqlite:///./paper_trading.db"

    @field_validator("database_url", mode="before")
    @classmethod
    def fix_db_url(cls, v: str) -> str:
        # Render provides postgres:// URLs; convert to SQLAlchemy async driver format
        if v.startswith("postgres://"):
            return "postgresql+asyncpg://" + v[len("postgres://"):]
        if v.startswith("postgresql://") and "+asyncpg" not in v:
            return "postgresql+asyncpg://" + v[len("postgresql://"):]
        return v

    class Config:
        env_file = ".env"


settings = Settings()
