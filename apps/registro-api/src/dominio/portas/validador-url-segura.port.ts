export const VALIDADOR_URL_SEGURA = Symbol('VALIDADOR_URL_SEGURA');

export interface IValidadorUrlSegura {
  validar(url: string): Promise<void>;
}
