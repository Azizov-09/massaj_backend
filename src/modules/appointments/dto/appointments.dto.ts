import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AppointmentStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateAppointmentDto {
  @ApiProperty()
  @IsUUID()
  childId!: string;

  @ApiProperty()
  @IsUUID()
  parentId!: string;

  @ApiProperty()
  @IsUUID()
  specialistId!: string;

  @ApiProperty()
  @IsUUID()
  serviceId!: string;

  @ApiProperty({ description: 'Appointment start time in ISO 8601 format' })
  @IsDateString()
  startAt!: string;

  @ApiPropertyOptional({ description: 'Stable identifier shared by every appointment in a course' })
  @ValidateIf((dto: CreateAppointmentDto) => dto.sequenceNumber !== undefined)
  @IsString()
  @Length(3, 100)
  courseKey?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 100 })
  @ValidateIf((dto: CreateAppointmentDto) => dto.courseKey !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  sequenceNumber?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 1000)
  notes?: string;
}

export class UpdateAppointmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  specialistId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 1000)
  notes?: string;
}

export class UpdateAppointmentStatusDto {
  @ApiProperty({ enum: AppointmentStatus })
  @IsEnum(AppointmentStatus)
  status!: AppointmentStatus;
}

export class AppointmentQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  childId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  specialistId?: string;

  @ApiPropertyOptional({ enum: AppointmentStatus })
  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 50, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;
}
