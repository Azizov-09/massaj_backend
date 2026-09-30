import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConsentType } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsObject, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';

export class RecordConsentDto {
  @ApiPropertyOptional({ description: 'Parent granting consent UUID' })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiProperty({ enum: ConsentType, description: 'Type of consent (e.g. MEDICAL_INTERVENTION, PHOTO_VIDEO_POLICY)' })
  @IsEnum(ConsentType)
  type!: ConsentType;

  @ApiProperty({ description: 'Whether consent was granted or declined', example: true })
  @IsBoolean()
  granted!: boolean;
}

export class UpdateConsentDto {
  @ApiProperty({ description: 'Updated consent status (true to grant, false to revoke)', example: false })
  @IsBoolean()
  granted!: boolean;
}

export class CreateDocumentDto {
  @ApiPropertyOptional({ description: 'Parent registering document UUID' })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiProperty({ description: 'Document human-readable title', example: 'Pediatric Neurologist Referral 2026.pdf' })
  @IsString()
  @Length(1, 255)
  name!: string;

  @ApiProperty({ description: 'Secure storage object key / URL' })
  @IsString()
  @Length(1, 500)
  fileKey!: string;

  @ApiProperty({ description: 'MIME type of document', example: 'application/pdf' })
  @IsString()
  @Length(3, 120)
  mimeType!: string;

  @ApiProperty({ description: 'File size in bytes (max 10MB)', example: 1048576 })
  @IsInt()
  @Min(1)
  @Max(10 * 1024 * 1024)
  size!: number;

  @ApiProperty({ description: 'Document category', example: 'MEDICAL_REFERRAL' })
  @IsString()
  @Length(1, 80)
  type!: string;
}

export class UpdateSettingsDto {
  @ApiPropertyOptional({ description: 'Rehabilitation center commercial name', example: 'Balajon Health Clinic' })
  @IsOptional()
  @IsString()
  @Length(2, 200)
  centerName?: string;

  @ApiPropertyOptional({ description: 'Clinic logo URL' })
  @IsOptional()
  @IsString()
  @Length(1, 500)
  logoUrl?: string;

  @ApiPropertyOptional({ description: 'Primary clinic phone number', example: '+998712000000' })
  @IsOptional()
  @IsString()
  @Length(7, 32)
  phone?: string;

  @ApiPropertyOptional({ description: 'Center physical address' })
  @IsOptional()
  @IsString()
  @Length(1, 500)
  address?: string;

  @ApiPropertyOptional({ description: 'JSON structure of working hours per weekday' })
  @IsOptional()
  @IsObject()
  workingHours?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'JSON structure of platform notification preferences' })
  @IsOptional()
  @IsObject()
  notificationSettings?: Record<string, unknown>;
}
