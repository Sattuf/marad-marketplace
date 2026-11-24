# syntax=docker/dockerfile:1.7
# One-shot migration runner: applies db/migrations and exits.
FROM node:20-alpine
WORKDIR /db
COPY package.json package-lock.json ./
RUN --mount=type=secret,id=extra_ca,required=false \
    if [ -s /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi; \
    npm ci --omit=dev --no-audit --no-fund
COPY migrate.mjs ./
COPY migrations ./migrations
USER node
CMD ["node", "migrate.mjs"]
