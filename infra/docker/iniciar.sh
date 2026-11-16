#!/bin/sh
# Sobe um serviço. Se ele tem migrações do Prisma, aplica antes (prisma migrate deploy é idempotente).
set -e
if [ -f prisma/schema.prisma ]; then
  npx prisma migrate deploy --schema prisma/schema.prisma
fi
exec node dist/main.js
