export const VALIDADOR_URL_SEGURA_WORKER = Symbol('VALIDADOR_URL_SEGURA_WORKER');

export interface IValidadorUrlSegura {
  validar(url: string): Promise<void>;
}
