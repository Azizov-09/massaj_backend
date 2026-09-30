import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AnnouncementAudience } from '@prisma/client';
import { IsArray, IsBoolean, IsDateString, IsEnum, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreateAnnouncementDto {
  @ApiProperty({ description: 'Announcement title' })
  @IsString()
  @Length(1, 200)
  title!: string;

  @ApiProperty({ description: 'Full announcement body / notice text' })
  @IsString()
  @Length(1, 5000)
  message!: string;

  @ApiProperty({ enum: AnnouncementAudience, description: 'Target audience' })
  @IsEnum(AnnouncementAudience)
  audience!: AnnouncementAudience;

  @ApiPropertyOptional({ description: 'Specific target user UUIDs if custom audience', type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  recipientUserIds?: string[];

  @ApiPropertyOptional({ description: 'Send in-app notification', default: true })
  @IsOptional()
  @IsBoolean()
  sendInApp?: boolean;

  @ApiPropertyOptional({ description: 'Send broadcast SMS', default: false })
  @IsOptional()
  @IsBoolean()
  sendSms?: boolean;

  @ApiPropertyOptional({ description: 'Scheduled publication date-time (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}

export class PublishAnnouncementDto {
  @ApiPropertyOptional({ description: 'Optional list of user UUIDs to deliver publication to', type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  recipientUserIds?: string[];
}
