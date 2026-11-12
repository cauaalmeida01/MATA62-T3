/** A contas-api só precisa de uma coisa da creditos-api: criar a carteira do usuário novo. */
export const CREDITOS_CLIENT = Symbol('CREDITOS_CLIENT');

export interface ICreditosClient {
  criarCarteira(userId: string): Promise<void>;
}
