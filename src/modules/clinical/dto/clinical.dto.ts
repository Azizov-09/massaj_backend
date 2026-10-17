import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AttendanceStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Length, Max, MaxLength, Min } from 'class-validator';

export class CreateAttendanceDto {
  @ApiProperty({ description: 'Target child UUID' })
  @IsUUID()
  childId!: string;

  @ApiPropertyOptional({ description: 'Optional specialist UUID' })
  @IsOptional()
  @IsUUID()
  specialistId?: string;

  @ApiProperty({ enum: AttendanceStatus, description: 'Attendance outcome' })
  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;

  @ApiPropertyOptional({ description: 'Optional attendance note (e.g. arrived 10 mins late)' })
  @IsOptional()
  @IsString()
  @Length(1, 1000)
  note?: string;

  @ApiPropertyOptional({ description: 'Optional date of attendance (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  date?: string;
}

export class UpdateAttendanceDto {
  @ApiProperty({ enum: AttendanceStatus, description: 'Updated attendance outcome' })
  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;

  @ApiPropertyOptional({ description: 'Updated attendance note' })
  @IsOptional()
  @IsString()
  @Length(1, 1000)
  note?: string;
}

export class CreateAssessmentDto {
  @ApiProperty({ description: 'Target child UUID' })
  @IsUUID()
  childId!: string;

  @ApiPropertyOptional({ description: 'Assessing specialist UUID' })
  @IsOptional()
  @IsUUID()
  specialistId?: string;

  @ApiPropertyOptional({ description: 'Movement / motor evaluation notes' })
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  movement?: string;

  @ApiPropertyOptional({ description: 'Coordination evaluation notes' })
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  coordination?: string;

  @ApiPropertyOptional({ description: 'Flexibility / joint range of motion' })
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  flexibility?: string;

  @ApiPropertyOptional({ description: 'Physical tolerance during session' })
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  activityTolerance?: string;

  @ApiPropertyOptional({ description: 'Child behavioral response to session' })
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  sessionResponse?: string;

  @ApiProperty({ description: 'Comprehensive professional clinical observation' })
  @IsString()
  @Length(1, 5000)
  professionalObservation!: string;

  @ApiPropertyOptional({ description: 'When the assessment was performed (ISO 8601); cannot be in the future' })
  @IsOptional()
  @IsDateString()
  assessedAt?: string;
}

export class UpdateAssessmentDto {
  @ApiPropertyOptional({ description: 'Movement / motor evaluation notes' })
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  movement?: string;

  @ApiPropertyOptional({ description: 'Coordination evaluation notes' })
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  coordination?: string;

  @ApiPropertyOptional({ description: 'Flexibility / joint range of motion' })
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  flexibility?: string;

  @ApiPropertyOptional({ description: 'Physical tolerance during session' })
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  activityTolerance?: string;

  @ApiPropertyOptional({ description: 'Child behavioral response to session' })
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  sessionResponse?: string;

  @ApiPropertyOptional({ description: 'Comprehensive professional clinical observation' })
  @IsOptional()
  @IsString()
  @Length(1, 5000)
  professionalObservation?: string;
}

export class CreateProgressDto {
  @ApiProperty({ description: 'Target child UUID' })
  @IsUUID()
  childId!: string;

  @ApiPropertyOptional({ description: 'Authoring specialist UUID' })
  @IsOptional()
  @IsUUID()
  specialistId?: string;

  @ApiProperty({ description: 'Progress milestone title' })
  @IsString()
  @Length(1, 200)
  title!: string;

  @ApiProperty({ description: 'Detailed developmental progress description' })
  @IsString()
  @Length(1, 5000)
  description!: string;

  @ApiPropertyOptional({ description: 'When the clinical progress occurred (ISO 8601); cannot be in the future' })
  @IsOptional()
  @IsDateString()
  occurredAt?: string;
}

export class UpdateProgressDto {
  @ApiPropertyOptional({ description: 'Progress milestone title' })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  title?: string;

  @ApiPropertyOptional({ description: 'Detailed developmental progress description' })
  @IsOptional()
  @IsString()
  @Length(1, 5000)
  description?: string;

  @ApiPropertyOptional({ description: 'When the clinical progress occurred (ISO 8601); cannot be in the future' })
  @IsOptional()
  @IsDateString()
  occurredAt?: string;
}

export class ClinicalListQueryDto {
  @ApiPropertyOptional({ description: 'Filter by child UUID' })
  @IsOptional()
  @IsUUID()
  childId?: string;

  @ApiPropertyOptional({ description: 'Filter by specialist UUID' })
  @IsOptional()
  @IsUUID()
  specialistId?: string;

  @ApiPropertyOptional({ description: 'Start of clinical date range (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'End of clinical date range (ISO 8601)' })
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
