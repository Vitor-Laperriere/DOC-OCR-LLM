import { IsString, MinLength, MaxLength } from 'class-validator';

export class AskDocumentDto {
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  question!: string;
}
