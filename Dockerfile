# ChessButFree multiplayer + voice-chat signalling server (also serves the built web app).
FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/server/package.json packages/server/
COPY packages/web/package.json packages/web/
RUN npm ci
COPY . .
RUN npm run build
ENV PORT=8787 DATA_DIR=/data
EXPOSE 8787
CMD ["npx", "tsx", "packages/server/src/index.ts"]
