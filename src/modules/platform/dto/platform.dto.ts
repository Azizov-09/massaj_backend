import { ConsentType } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsObject, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';
export class RecordConsentDto { @IsOptional() @IsUUID() parentId?: string; @IsEnum(ConsentType) type!: ConsentType; @IsBoolean() granted!: boolean; }
export class UpdateConsentDto { @IsBoolean() granted!: boolean; }
export class CreateDocumentDto { @IsOptional() @IsUUID() parentId?: string; @IsString() @Length(1, 255) name!: string; @IsString() @Length(1, 500) fileKey!: string; @IsString() @Length(3, 120) mimeType!: string; @IsInt() @Min(1) @Max(10 * 1024 * 1024) size!: number; @IsString() @Length(1, 80) type!: string; }
export class UpdateSettingsDto { @IsOptional() @IsString() @Length(2, 200) centerName?: string; @IsOptional() @IsString() @Length(1, 500) logoUrl?: string; @IsOptional() @IsString() @Length(7, 32) phone?: string; @IsOptional() @IsString() @Length(1, 500) address?: string; @IsOptional() @IsObject() workingHours?: Record<string, unknown>; @IsOptional() @IsObject() notificationSettings?: Record<string, unknown>; }
