// Pacote "infra" da Figura 3 do T2: as implementações concretas (adaptadores).
// As interfaces (portas) ficam no domínio de cada serviço; aqui ficam só as
// classes que falam com tecnologia: ElasticMQ/SQS, RustFS/S3, SMTP, RFC 3161 e PostgreSQL.
// Cada adaptador entra junto com o serviço que precisa dele.
export * from './autorizacao/postgres-tokens-revogados';
export * from './contas/contas-database.service';
export * from './creditos/creditos-database.service';
export * from './postgres/banco-postgres';
export * from './registro/registro-database.service';
