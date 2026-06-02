FROM python:3.11-slim

# Install Node.js 20 for frontend build
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# --- Frontend build ---
COPY frontend/package*.json ./frontend/
RUN npm ci --prefix frontend

COPY frontend/ ./frontend/
RUN npm run build --prefix frontend

# --- Backend setup ---
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r ./backend/requirements.txt

COPY backend/ ./backend/

WORKDIR /app/backend

EXPOSE 10000

# Render injects $PORT; default to 10000 for local Docker runs
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-10000}
