import { IsString, Matches } from 'class-validator';

export class VerifyAbnDto {
  @IsString()
  @Matches(/^[\d\s-]{11,14}$/, {
    message: 'ABN must be an 11-digit Australian Business Number',
  })
  abn: string;
}
