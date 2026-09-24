# Mainline — one Railway service: API + static SPA.
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc* ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter @mainline/api... --filter @mainline/web...
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
COPY apps/web apps/web
ARG VITE_API_URL=""
RUN pnpm --filter @mainline/web build && pnpm --filter @mainline/api build \
  && rm -f apps/web/dist/**/*.map \
  && pnpm --filter @mainline/api deploy --prod --legacy /out

FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /out/package.json ./package.json
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/drizzle ./drizzle
COPY --from=build /app/apps/web/dist ./web/dist
COPY --from=build /app/apps/api/data ./data
ENV WEB_DIST=/app/web/dist
EXPOSE 8787
CMD ["node", "dist/main.js"]
