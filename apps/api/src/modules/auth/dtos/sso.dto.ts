import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsIn,
  IsOptional,
} from 'class-validator';

export class SsoAuthorizeDto {
  @IsIn(['code'], { message: 'response_type must be "code"' })
  @IsNotEmpty()
  response_type: string = 'code';

  @IsString()
  @IsNotEmpty()
  client_id!: string;

  @IsString()
  @IsNotEmpty()
  redirect_uri!: string;

  @IsString()
  @MinLength(43)
  @MaxLength(128)
  code_challenge!: string;

  @IsIn(['S256'], { message: 'code_challenge_method must be "S256"' })
  @IsNotEmpty()
  code_challenge_method: string = 'S256';

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(256)
  state!: string;

  @IsString()
  @IsOptional()
  scope?: string;
}

export class SsoExchangeDto {
  @IsIn(['authorization_code'], { message: 'grant_type must be "authorization_code"' })
  @IsNotEmpty()
  grant_type: string = 'authorization_code';

  @IsString()
  @IsNotEmpty()
  @MinLength(16)
  @MaxLength(256)
  code!: string;

  @IsString()
  @IsNotEmpty()
  client_id!: string;

  @IsString()
  @IsNotEmpty()
  redirect_uri!: string;

  @IsString()
  @MinLength(43)
  @MaxLength(128)
  code_verifier!: string;

  @IsString()
  @IsNotEmpty({ message: 'state parameter is required' })
  @MinLength(8)
  @MaxLength(256)
  state!: string;
}

export class SsoLogoutDto {
  @IsString()
  @IsOptional()
  sessionId?: string;
}
