from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    webhook_secret: str = "MY_SECRET_TOKEN"
    initial_capital: float = 10000.0
    fee_rate: float = 0.001
    slippage: float = 0.0005
    database_url: str = "sqlite+aiosqlite:///./paper_trading.db"

    class Config:
        env_file = ".env"


settings = Settings()
