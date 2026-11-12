import { ModoCaptura, ResultadoCaptura } from '../modelos';

export const MOTOR_CAPTURA = Symbol('MOTOR_CAPTURA');

export interface OpcoesCaptura {
  url: string;
  modo: ModoCaptura;
  solicitacaoId: string;
}

export interface IMotorCaptura {
  capturar(opcoes: OpcoesCaptura): Promise<ResultadoCaptura>;
}
