# syntax=docker/dockerfile:1.7
# Production image. This service has its own package-lock.json (outside the root workspace).
# Optional: --secret id=extra_ca,src=/path/ca.pem to build behind a TLS-intercepting proxy.
ARG NODE_IMAGE=node:20-alpine

FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=secret,id=extra_ca,required=false \
    --mount=type=cache,target=/root/.npm \
    if [ -s /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi; \
    npm ci --legacy-peer-deps --no-audit --no-fund
COPY . .
RUN npm run build && npm prune --omit=dev --legacy-peer-deps

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
RUN mkdir -p tmp uploads && chown node:node tmp uploads
USER node
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=6 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "dist/main"]
