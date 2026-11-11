-- Esquema da relatorios-api (docs/contratos.md, seção 6).
CREATE SCHEMA IF NOT EXISTS "relatorios";

-- CreateTable
CREATE TABLE "relatorios"."registros" (
    "id" UUID NOT NULL,
    "solicitacao_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "reserva_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "inicio" TIMESTAMPTZ(3) NOT NULL,
    "fim" TIMESTAMPTZ(3) NOT NULL,
    "evidencia_id" UUID NOT NULL,
    "manifesto_sha256" CHAR(64) NOT NULL,
    "carimbo_fonte" TEXT NOT NULL,
    "carimbo_horario" TIMESTAMPTZ(3) NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "registros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relatorios"."registro_arquivos" (
    "id" UUID NOT NULL,
    "registro_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "tamanho_bytes" BIGINT NOT NULL,
    "chave" TEXT NOT NULL,

    CONSTRAINT "registro_arquivos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "registros_solicitacao_id_key" ON "relatorios"."registros"("solicitacao_id");

-- CreateIndex
CREATE INDEX "registros_user_id_criado_em_idx" ON "relatorios"."registros"("user_id", "criado_em" DESC);

-- CreateIndex
CREATE INDEX "registro_arquivos_registro_id_idx" ON "relatorios"."registro_arquivos"("registro_id");

-- AddForeignKey
ALTER TABLE "relatorios"."registro_arquivos" ADD CONSTRAINT "registro_arquivos_registro_id_fkey" FOREIGN KEY ("registro_id") REFERENCES "relatorios"."registros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Registro é prova: depois de concluído, não muda nem some (mesma ideia da trilha de auditoria).
CREATE FUNCTION "relatorios"."bloquear_alteracao"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'registros concluídos não podem ser alterados nem apagados';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "registros_somente_inclusao" BEFORE UPDATE OR DELETE ON "relatorios"."registros"
  FOR EACH ROW EXECUTE FUNCTION "relatorios"."bloquear_alteracao"();

CREATE TRIGGER "registro_arquivos_somente_inclusao" BEFORE UPDATE OR DELETE ON "relatorios"."registro_arquivos"
  FOR EACH ROW EXECUTE FUNCTION "relatorios"."bloquear_alteracao"();
