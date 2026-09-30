import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AppointmentStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';

export class CreateAppointmentDto {
  @ApiProperty({ description: 'Target child UUID' })
  @IsUUID()
  childId!: string;

  @ApiProperty({ description: 'Parent UUID responsible for booking' })
  @IsUUID()
  parentId!: string;

  @ApiProperty({ description: 'Specialist UUID assigned to appointment' })
  @IsUUID()
  specialistId!: string;

  @ApiProperty({ description: 'Service catalog item UUID' })
  @IsUUID()
  serviceId!: string;

  @ApiProperty({ description: 'ISO 8601 start date-time' })
  @IsDateString()
  startAt!: string;

  @ApiProperty({ description: 'ISO 8601 end date-time' })
  @IsDateString()
  endAt!: string;

  @ApiPropertyOptional({ description: 'Optional appointment notes or special instructions' })
  @IsOptional()
  @IsString()
  @Length(1, 2000)
  notes?: string;
}

export class UpdateAppointmentDto {
  @ApiPropertyOptional({ description: 'New specialist UUID' })
  @IsOptional()
  @IsUUID()
  specialistId?: string;

  @ApiPropertyOptional({ description: 'New service UUID' })
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @ApiPropertyOptional({ description: 'Rescheduled start date-time' })
  @IsOptional()
  @IsDateString()
  startAt?: string;

  @ApiPropertyOptional({ description: 'Rescheduled end date-time' })
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
