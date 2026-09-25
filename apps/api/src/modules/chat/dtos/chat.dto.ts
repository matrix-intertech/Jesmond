import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class InitConversationDto {
  @IsUUID()
  @IsNotEmpty()
  propertyId!: string;
}

export class InitDirectConversationDto {
  @IsUUID()
  @IsNotEmpty()
  recipientUserId!: string;
}

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20000)
  encryptedPayload!: string;

  @IsString()
  @IsOptional()
  @MaxLength(512)
  iv?: string;
}
