# syntax=docker/dockerfile:1.7
# Production image for the Next.js web app (standalone output).
# NEXT_PUBLIC_* values are inlined into the browser bundle at build time.
ARG NODE_IMAGE=node:20-alpine

FROM ${NODE_IMAGE} AS manifests
WORKDIR /src
COPY . .
RUN mkdir /out && cp package.json package-lock.json /out/ \
 && find apps services -maxdepth 2 -name package.json | tar -cf - -T - | tar -xf - -C /out

FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY --from=manifests /out ./
RUN --mount=type=secret,id=extra_ca,required=false \
    --mount=type=cache,target=/root/.npm \
    if [ -s /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi; \
    npm ci --workspace=apps/web --include-workspace-root=false --no-audit --no-fund
COPY packages packages
COPY apps/web apps/web
ARG NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
ARG NEXT_PUBLIC_SOCKET_URL=http://localhost:3004
ARG NEXT_PUBLIC_GRAFANA_URL=http://localhost:3200
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    NEXT_PUBLIC_SOCKET_URL=${NEXT_PUBLIC_SOCKET_URL} \
    NEXT_PUBLIC_GRAFANA_URL=${NEXT_PUBLIC_GRAFANA_URL} \
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY}
# next/font downloads the Google fonts at build time, so the optional CA applies here too.
RUN --mount=type=secret,id=extra_ca,required=false \
    if [ -s /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi; \
    npm run build --workspace=apps/web

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3100 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3100
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=6 \
  CMD node -e "fetch('http://127.0.0.1:3100/').then(r=>process.exit(r.status<500?0:1),()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]
