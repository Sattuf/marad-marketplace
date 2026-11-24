# syntax=docker/dockerfile:1.7
# Production image for a NestJS service that lives in the root npm workspace
# (dependencies are pinned by the root package-lock.json).
#
#   docker build -f infra/docker/node-workspace.Dockerfile --build-arg SERVICE=api-gateway .
#
# Optional: --secret id=extra_ca,src=/path/ca.pem to build behind a TLS-intercepting proxy
# (ADR-003). The CA is mounted for the install step only and never stored in a layer.

ARG NODE_IMAGE=node:20-alpine

# --- Manifests only, so dependency layers are cached until a package.json changes ---------
FROM ${NODE_IMAGE} AS manifests
WORKDIR /src
COPY . .
RUN mkdir /out && cp package.json package-lock.json /out/ \
 && find apps services -maxdepth 2 -name package.json | tar -cf - -T - | tar -xf - -C /out

# --- Full dependencies + compile --------------------------------------------------------
FROM ${NODE_IMAGE} AS build
ARG SERVICE
WORKDIR /app
COPY --from=manifests /out ./
RUN --mount=type=secret,id=extra_ca,required=false \
    --mount=type=cache,target=/root/.npm \
    if [ -s /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi; \
    npm ci --workspace=services/${SERVICE} --include-workspace-root=false --no-audit --no-fund
COPY services/${SERVICE} services/${SERVICE}
RUN npm run build --workspace=services/${SERVICE}

# --- Production dependencies only -------------------------------------------------------
FROM ${NODE_IMAGE} AS prod-deps
ARG SERVICE
WORKDIR /app
COPY --from=manifests /out ./
RUN --mount=type=secret,id=extra_ca,required=false \
    --mount=type=cache,target=/root/.npm \
    if [ -s /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi; \
    npm ci --omit=dev --workspace=services/${SERVICE} --include-workspace-root=false --no-audit --no-fund \
 && mkdir -p services/${SERVICE}/node_modules

# --- Runtime ----------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS runtime
ARG SERVICE
ENV NODE_ENV=production
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/services/${SERVICE}/node_modules ./services/${SERVICE}/node_modules
COPY --from=build /app/services/${SERVICE}/dist ./services/${SERVICE}/dist
COPY services/${SERVICE}/package.json ./services/${SERVICE}/
WORKDIR /app/services/${SERVICE}
# Writable directories for local media storage (mounted as volumes in compose).
RUN mkdir -p tmp uploads && chown node:node tmp uploads
USER node
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=6 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "dist/main"]
