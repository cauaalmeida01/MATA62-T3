import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { FONTES_CARIMBO, FonteCarimbo } from '../dominio/registro';

/** Corpo de POST /api/internal/registros/:solicitacaoId/conclusao (docs/contratos.md, seção 3). */

const SHA256 = /^[0-9a-f]{64}$/i;

export class CarimboDto {
  @IsIn(FONTES_CARIMBO)
  fonte!: FonteCarimbo;

  @IsDateString()
  horario!: string;

  // O token do carimbo fica guardado na evidencia-api; aqui só chega e é ignorado.
  @IsOptional() @IsString()
  tokenBase64?: string;
}

export class ArquivoDto {
  @IsString() @MinLength(1) nome!: string;
  @IsString() tipo!: string;
  @Matches(SHA256) sha256!: string;
  @IsInt() @Min(0) tamanhoBytes!: number;
  @IsString() chave!: string;
}

export class PacoteDto {
  @IsUUID() evidenciaId!: string;
  @Matches(SHA256) manifestoSha256!: string;

  @ValidateNested() @Type(() => CarimboDto)
  carimbo!: CarimboDto;

  @IsArray() @ArrayNotEmpty() @ValidateNested({ each: true }) @Type(() => ArquivoDto)
  arquivos!: ArquivoDto[];
}

export class ConclusaoDto {
  @IsUUID() userId!: string;
  @IsUUID() reservaId!: string;
  @IsUrl({ require_tld: false }) url!: string;
  @IsString() titulo!: string;
  @IsDateString() inicio!: string;
  @IsDateString() fim!: string;

  @ValidateNested() @Type(() => PacoteDto)
  pacote!: PacoteDto;
}
