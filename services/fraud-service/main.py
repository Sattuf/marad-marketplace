from fastapi import FastAPI
from contextlib import asynccontextmanager
import database

from routers import device, transaction, risk, admin
from security import require_secret
from jwt_keys import public_keys
from errors import install_error_handlers

import os
import sentry_sdk
from observability import setup_logging, setup_tracing
from prometheus_fastapi_instrumentator import Instrumentator

setup_logging()
if os.getenv("SENTRY_DSN"):
    sentry_sdk.init(dsn=os.getenv("SENTRY_DSN"), traces_sample_rate=0.1)

@asynccontextmanager
async def lifespan(app: FastAPI):
    public_keys()  # fails at boot on a missing or malformed JWT_PUBLIC_JWKS
    require_secret("INTERNAL_SECRET")
    await database.connect_to_postgres()
    yield
    await database.close_postgres_connection()

app = FastAPI(title="Fraud Service", version="1.0.0", lifespan=lifespan)

install_error_handlers(app)
setup_tracing(app, "fraud-service")
Instrumentator().instrument(app).expose(app)

app.include_router(device.router)
app.include_router(transaction.router)
app.include_router(risk.router)
app.include_router(admin.router)

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
