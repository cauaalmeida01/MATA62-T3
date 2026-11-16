import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { TipoUsuario } from '../dominio';

/** Formato da entrada. As regras de negócio (CPF válido, OAB para advogado) ficam no domínio. */
export class CadastrarUsuarioDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  nome!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  senha!: string;

  @IsIn(['ADVOGADO', 'COMUM'])
  tipo!: TipoUsuario;

  @IsString()
  cpf!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  oab?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  telefone?: string;
}

export class LogarDto {
  @IsEmail()
  email!: string;

  @IsString()
  senha!: string;
}
