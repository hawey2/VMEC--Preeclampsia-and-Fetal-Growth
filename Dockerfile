# Preeclampsia risk app: one image with the web pages, the API and the risk engine.

# 1. Build the web pages.
FROM node:20-alpine AS web
WORKDIR /src/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
# The build reads the coefficient file to print its checksum.
COPY engine/pe_risk/coefficients/ /src/engine/pe_risk/coefficients/
COPY web/ ./
RUN npm run build

# 2. Python runtime.
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PE_WEB_DIST=/app/web/dist
WORKDIR /app
COPY engine/ engine/
COPY api/ api/
RUN pip install --no-cache-dir ./engine ./api \
 && useradd --system --uid 10001 pe
COPY --from=web /src/web/dist web/dist
USER pe
EXPOSE 8000
HEALTHCHECK --interval=60s --timeout=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health')"
# Migrations run automatically when the app starts.
CMD ["uvicorn", "pe_api.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
