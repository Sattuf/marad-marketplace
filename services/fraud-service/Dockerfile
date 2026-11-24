# syntax=docker/dockerfile:1.7
# Production image. Optional: --secret id=extra_ca,src=/path/ca.pem to build behind a
# TLS-intercepting proxy (appended to pip's CA bundle for the install step only).
FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /app
COPY requirements.txt .
RUN --mount=type=secret,id=extra_ca,required=false \
    if [ -s /run/secrets/extra_ca ]; then \
      cat "$(python -c 'import pip._vendor.certifi as c; print(c.where())')" /run/secrets/extra_ca > /tmp/ca.pem; \
      export PIP_CERT=/tmp/ca.pem; \
    fi; \
    pip install -r requirements.txt && rm -f /tmp/ca.pem
COPY . .
RUN useradd --system --uid 10001 --no-create-home app
USER app
EXPOSE 8001
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=6 \
  CMD python -c "import os, urllib.request; urllib.request.urlopen('http://127.0.0.1:%s/health' % os.environ.get('PORT', '8001'), timeout=4)"
CMD ["sh", "-c", "exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8001}"]
