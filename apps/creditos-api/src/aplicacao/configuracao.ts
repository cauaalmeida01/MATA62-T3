/** Créditos de teste dados a cada carteira nova (a compra, REQ05/REQ06, está fora da sprint). */
export const CREDITOS_INICIAIS = Symbol('CREDITOS_INICIAIS');

export function creditosIniciaisDoAmbiente(): number {
  const valor = Number(process.env.CREDITOS_INICIAIS ?? 5);
  return Number.isInteger(valor) && valor >= 0 ? valor : 5;
}
