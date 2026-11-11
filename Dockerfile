# Uma imagem por serviço, escolhida pelo argumento APP:
#   docker build --build-arg APP=contas-api -t veridit/contas-api .
# O docker-compose.yml já passa o APP de cada serviço.
# Quando o package-lock.json estiver no repositório, troquem "npm install" por "npm ci".
# O captura-worker vai precisar do Chromium do Playwright: quando ele entrar,
# ganha um Dockerfile próprio (ou um estágio extra) com "npx playwright install --with-deps chromium".
#
# Prisma: serviço com apps/<APP>/prisma/schema.prisma tem o cliente gerado no build e as
# migrações aplicadas ao subir o contêiner (infra/docker/iniciar.sh). O Prisma precisa do OpenSSL.

FROM node:22-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ARG APP
RUN test -n "$APP" && npm run prisma:generate && npx nest build "$APP"
# Schema e migrações do serviço, se ele usar Prisma (pasta vazia se não usar)
RUN mkdir -p /app/servico-prisma && if [ -d "apps/$APP/prisma" ]; then cp -r "apps/$APP/prisma/." /app/servico-prisma/; fi

FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ARG APP
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/servico-prisma ./prisma
COPY --from=build /app/dist/apps/${APP} ./dist
COPY infra/docker/iniciar.sh ./iniciar.sh
CMD ["sh", "iniciar.sh"]
