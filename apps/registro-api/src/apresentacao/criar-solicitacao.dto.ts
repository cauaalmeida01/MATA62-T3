import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ModoCaptura } from '../dominio';

export class CriarSolicitacaoDto {
  @IsString({ message: 'O campo url deve ser um texto' })
  @IsNotEmpty({ message: 'O campo url é obrigatório' })
  @MaxLength(2048, { message: 'O campo url deve ter no máximo 2048 caracteres' })
  url!: string;

  @IsString({ message: 'O campo titulo deve ser um texto' })
  @IsNotEmpty({ message: 'O campo titulo é obrigatório' })
  @MaxLength(255, { message: 'O campo titulo deve ter no máximo 255 caracteres' })
  titulo!: string;

  @IsString({ message: 'O campo modo deve ser um texto' })
  @IsIn(['TELA'], { message: 'O campo modo deve ser "TELA"' })
  modo!: ModoCaptura;
}
