FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci && npx prisma generate
COPY . .
RUN npm run build
ENV NODE_ENV=production
EXPOSE 3001
USER node
CMD ["node", "dist-server/server/index.js"]
