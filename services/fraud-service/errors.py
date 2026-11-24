"""Unified error body, identical to the NestJS services:
{statusCode, error, message, requestId, timestamp, path}. Copy kept in sync with
personalization-service/app/core/errors.py (checked by scripts/check-shared-copies.mjs).
"""
import logging
from datetime import datetime, timezone
from http import HTTPStatus

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("errors")


def _reason(status: int) -> str:
    try:
        return HTTPStatus(status).phrase
    except ValueError:
        return "Error"


def error_response(request: Request, status: int, message, headers=None) -> JSONResponse:
    body = {
        "statusCode": status,
        "error": _reason(status),
        "message": message,
        "requestId": request.headers.get("x-request-id"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "path": request.url.path,
    }
    return JSONResponse(status_code=status, content=body, headers=headers)


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(StarletteHTTPException)
    async def http_error(request: Request, exc: StarletteHTTPException):
        return error_response(request, exc.status_code, exc.detail, getattr(exc, "headers", None))

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError):
        messages = [f"{'.'.join(str(p) for p in e.get('loc', [])[1:])}: {e.get('msg')}".lstrip(": ") for e in exc.errors()]
        return error_response(request, 400, messages)

    @app.exception_handler(Exception)
    async def unexpected_error(request: Request, exc: Exception):
        logger.exception("Unhandled error on %s %s [%s]", request.method, request.url.path, request.headers.get("x-request-id", "-"))
        return error_response(request, 500, "Internal server error")
