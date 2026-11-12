import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class CriarCarteiraDto {
  @IsUUID()
  userId!: string;
}

export class ReservarCreditoDto {
  @IsUUID()
  userId!: string;

  @IsUUID()
  solicitacaoId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  quantidade: number = 1;
}

/** O captura-worker manda o motivo ao liberar; guardamos só no log por enquanto. */
export class EncerrarReservaDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;
}
