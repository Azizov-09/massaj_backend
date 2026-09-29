import { IsBoolean, IsOptional } from 'class-validator';
export class UpdateNotificationPreferencesDto {
  @IsOptional() @IsBoolean() appointmentInApp?: boolean; @IsOptional() @IsBoolean() appointmentSms?: boolean;
  @IsOptional() @IsBoolean() paymentInApp?: boolean; @IsOptional() @IsBoolean() paymentSms?: boolean;
  @IsOptional() @IsBoolean() debtInApp?: boolean; @IsOptional() @IsBoolean() debtSms?: boolean;
  @IsOptional() @IsBoolean() sessionInApp?: boolean; @IsOptional() @IsBoolean() sessionSms?: boolean;
  @IsOptional() @IsBoolean() assessmentInApp?: boolean; @IsOptional() @IsBoolean() progressInApp?: boolean;
  @IsOptional() @IsBoolean() announcementInApp?: boolean; @IsOptional() @IsBoolean() announcementSms?: boolean;
}
