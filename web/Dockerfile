# Front (papel D): build do Vite servido pelo Nginx, que também é a porta de entrada da API.
FROM node:22-bookworm-slim AS build
WORKDIR /web
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /web/dist /usr/share/nginx/html
