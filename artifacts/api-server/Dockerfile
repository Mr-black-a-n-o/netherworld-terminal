FROM node:20-alpine
RUN npm install -g pnpm
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY lib/package.json ./lib/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter api-server build
WORKDIR /app/artifacts/api-server
EXPOSE 8080
CMD ["pnpm", "run", "start"]
