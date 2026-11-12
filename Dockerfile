# Uma imagem por serviço, escolhida pelo argumento APP:
#   docker build --build-arg APP=contas-api -t veridit/contas-api .
# O docker-compose.yml já passa o APP de cada serviço.
# Quando o package-lock.json estiver no repositório, troquem "npm install" por "npm ci".
# O captura-worker vai precisar do Chromium do Playwright: quando ele entrar,
# ganha um Dockerfile próprio (ou um estágio extra) com "npx playwright install --with-deps chromium".

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ARG APP
RUN test -n "$APP" && npx nest build "$APP"

FROM node:22-bookworm-slim
WORKDIR /app
ARG APP
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev
RUN if [ "$APP" = "captura-worker" ]; then npx playwright install --with-deps chromium; fi
COPY --from=build /app/dist/apps/${APP} ./dist
CMD ["node", "dist/main.js"]
