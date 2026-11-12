// Pacote "compartilhado" da Figura 3 do T2 (auditoria, autorização).
// O que todos os serviços usam e que não é regra de negócio de nenhum deles.
export * from './autorizacao';
export * from './bootstrap';
export * from './erros/erros-dominio';
export * from './erros/filtro-erros-dominio';
export * from './health/health.module';
