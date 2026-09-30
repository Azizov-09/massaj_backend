import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AppointmentStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';

export class CreateAppointmentDto {
  @ApiProperty({ description: 'Target child UUID', example: '11111111-1111-1111-1111-111111111111' })
  @IsUUID()
  childId!: string;

  @ApiProperty({ description: 'Parent UUID responsible for booking', example: '22222222-2222-2222-2222-222222222222' })
  @IsUUID()
  parentId!: string;

  @ApiProperty({ description: 'Specialist UUID assigned to appointment', example: '33333333-3333-3333-3333-333333333333' })
  @IsUUID()
  specialistId!: string;

  @ApiProperty({ description: 'Service catalog item UUID', example: '44444444-4444-4444-4444-444444444444' })
  @IsUUID()
  serviceId!: string;

  @ApiProperty({ description: 'ISO 8601 start date-time', example: '2026-10-01T10:00:00Z' })
  @IsDateString()
  startAt!: string;

  @ApiProperty({ description: 'ISO 8601 end date-time', example: '2026-10-01T11:00:00Z' })
  @IsDateString()
  endAt!: string;

  @ApiPropertyOptional({ description: 'Optional appointment notes or special instructions', example: 'Focus on lower back massage' })
  @IsOptional()
  @IsString()
  @Length(1, 2000)
  notes?: string;
}

export class UpdateAppointmentDto {
  @ApiPropertyOptional({ description: 'New specialist UUID', example: '33333333-3333-3333-3333-333333333333' })
  @IsOptional()
  @IsUUID()
  specialistId?: string;

  @ApiPropertyOptional({ description: 'New service UUID', example: '44444444-4444-4444-4444-444444444444' })
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @ApiPropertyOptional({ description: 'Rescheduled start date-time', example: '2026-10-02T10:00:00Z' })
  @IsOptional()
  @IsDateString()
  startAt?: string;

  @ApiPropertyOptional({ description: 'Rescheduled end date-time', example: '2026-10-02T11:00:00Z' })
  @IsOptional()
  @IsDateString()
  endAt?: string;

  @ApiPropertyOptional({ description: 'Updated appointment notes' })
  @IsOptional()
  @IsString()
  @Length(1, 2000)
  notes?: string;
}

export class AppointmentQueryDto {
  @ApiPropertyOptional({ description: 'Filter by child UUID' })
  @IsOptional()
  @IsUUID()
  childId?: string;

  @ApiPropertyOptional({ description: 'Filter by specialist UUID' })
  @IsOptional()
  @IsUUID()
  specialistId?: string;

  @ApiPropertyOptional({ enum: AppointmentStatus, description: 'Filter by appointment status' })
  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit = 20;
}
