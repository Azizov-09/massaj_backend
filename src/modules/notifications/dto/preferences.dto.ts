import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationPreferencesDto {
  @ApiPropertyOptional({ description: 'In-app notification for appointments' })
  @IsOptional()
  @IsBoolean()
  appointmentInApp?: boolean;

  @ApiPropertyOptional({ description: 'SMS notification for appointments' })
  @IsOptional()
  @IsBoolean()
  appointmentSms?: boolean;

  @ApiPropertyOptional({ description: 'In-app notification for payment receipts' })
  @IsOptional()
  @IsBoolean()
  paymentInApp?: boolean;

  @ApiPropertyOptional({ description: 'SMS notification for payment receipts' })
  @IsOptional()
  @IsBoolean()
  paymentSms?: boolean;

  @ApiPropertyOptional({ description: 'In-app notification for debt reminders' })
  @IsOptional()
  @IsBoolean()
  debtInApp?: boolean;

  @ApiPropertyOptional({ description: 'SMS notification for debt reminders' })
  @IsOptional()
  @IsBoolean()
  debtSms?: boolean;

  @ApiPropertyOptional({ description: 'In-app notification for rehabilitation sessions' })
  @IsOptional()
  @IsBoolean()
  sessionInApp?: boolean;

  @ApiPropertyOptional({ description: 'SMS notification for rehabilitation sessions' })
  @IsOptional()
  @IsBoolean()
  sessionSms?: boolean;

  @ApiPropertyOptional({ description: 'In-app notification for clinical assessments' })
  @IsOptional()
  @IsBoolean()
  assessmentInApp?: boolean;

  @ApiPropertyOptional({ description: 'In-app notification for milestone progress' })
  @IsOptional()
  @IsBoolean()
  progressInApp?: boolean;

  @ApiPropertyOptional({ description: 'In-app notification for general announcements' })
  @IsOptional()
  @IsBoolean()
  announcementInApp?: boolean;

  @ApiPropertyOptional({ description: 'SMS notification for general announcements' })
  @IsOptional()
  @IsBoolean()
  announcementSms?: boolean;
}
