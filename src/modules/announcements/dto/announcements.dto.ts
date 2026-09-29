import { AnnouncementAudience } from '@prisma/client';
import { IsArray, IsBoolean, IsDateString, IsEnum, IsOptional, IsString, IsUUID, Length } from 'class-validator';
export class CreateAnnouncementDto { @IsString() @Length(1, 200) title!: string; @IsString() @Length(1, 5000) message!: string; @IsEnum(AnnouncementAudience) audience!: AnnouncementAudience; @IsOptional() @IsArray() @IsUUID('4', { each: true }) recipientUserIds?: string[]; @IsOptional() @IsBoolean() sendInApp?: boolean; @IsOptional() @IsBoolean() sendSms?: boolean; @IsOptional() @IsDateString() scheduledAt?: string; }
export class PublishAnnouncementDto { @IsOptional() @IsArray() @IsUUID('4', { each: true }) recipientUserIds?: string[]; }
