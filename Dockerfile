FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source code
COPY backend/ ./

# Expose port
EXPOSE 8000

# Start FastAPI server with dynamic PORT environment variable fallback 8000
CMD exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
