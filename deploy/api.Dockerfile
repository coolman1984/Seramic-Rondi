# خادم روندي
FROM node:22-bookworm-slim
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile \
 && pnpm --filter @rondi/shared build \
 && pnpm --filter @rondi/api build
RUN chmod +x deploy/api-entrypoint.sh
ENV NODE_ENV=production
USER node
EXPOSE 4000
ENTRYPOINT ["deploy/api-entrypoint.sh"]
