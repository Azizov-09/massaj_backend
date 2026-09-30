import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AttendanceStatus, GoalStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';

export class CreateAttendanceDto {
  @ApiProperty({ description: 'Appointment UUID' })
  @IsUUID()
  appointmentId!: string;

  @ApiProperty({ enum: AttendanceStatus, description: 'Attendance outcome', example: AttendanceStatus.PRESENT })
  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;

  @ApiPropertyOptional({ description: 'Optional attendance note (e.g. arrived 10 mins late)' })
  @IsOptional()
  @IsString()
  @Length(1, 1000)
  note?: string;
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
  @Max(3000)
  movement?: string;

  @ApiPropertyOptional({ description: 'Coordination evaluation notes' })
  @IsOptional()
  @IsString()
  @Max(3000)
  coordination?: string;

  @ApiPropertyOptional({ description: 'Flexibility / joint range of motion' })
  @IsOptional()
  @IsString()
  @Max(3000)
  flexibility?: string;

  @ApiPropertyOptional({ description: 'Physical tolerance during session' })
  @IsOptional()
  @IsString()
  @Max(3000)
  activityTolerance?: string;

  @ApiPropertyOptional({ description: 'Child behavioral response to session' })
  @IsOptional()
  @IsString()
  @Max(3000)
  sessionResponse?: string;

  @ApiProperty({ description: 'Comprehensive professional clinical observation' })
  @IsString()
  @Length(1, 5000)
  professionalObservation!: string;
}

export class UpdateAssessmentDto {
  @ApiPropertyOptional({ description: 'Movement / motor evaluation notes' })
  @IsOptional()
  @IsString()
  @Max(3000)
  movement?: string;

  @ApiPropertyOptional({ description: 'Coordination evaluation notes' })
  @IsOptional()
  @IsString()
  @Max(3000)
  coordination?: string;

  @ApiPropertyOptional({ description: 'Flexibility / joint range of motion' })
  @IsOptional()
  @IsString()
  @Max(3000)
  flexibility?: string;

  @ApiPropertyOptional({ description: 'Physical tolerance during session' })
  @IsOptional()
  @IsString()
  @Max(3000)
  activityTolerance?: string;

  @ApiPropertyOptional({ description: 'Child behavioral response to session' })
  @IsOptional()
  @IsString()
  @Max(3000)
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

  @ApiProperty({ description: 'Progress milestone title', example: 'Independent Sitting Milestone' })
  @IsString()
  @Length(1, 200)
  title!: string;

  @ApiProperty({ description: 'Detailed developmental progress description' })
  @IsString()
  @Length(1, 5000)
  description!: string;
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
}

export class CreateGoalDto {
  @ApiProperty({ description: 'Target child UUID' })
  @IsUUID()
  childId!: string;

  @ApiPropertyOptional({ description: 'Assigned specialist UUID' })
  @IsOptional()
  @IsUUID()
  specialistId?: string;

  @ApiProperty({ description: 'Therapeutic goal title', example: 'Improve neck muscle control' })
  @IsString()
  @Length(1, 200)
  title!: string;

  @ApiPropertyOptional({ description: 'Goal milestones and criteria' })
  @IsOptional()
  @IsString()
  @Max(5000)
  description?: string;

  @ApiPropertyOptional({ description: 'Target completion date (YYYY-MM-DD)', example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  targetDate?: string;

  @ApiPropertyOptional({ description: 'Percentage completed (0-100)', example: 25, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  progress?: number;
}

export class UpdateGoalDto {
  @ApiPropertyOptional({ description: 'Therapeutic goal title' })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  title?: string;

  @ApiPropertyOptional({ description: 'Goal milestones and criteria' })
  @IsOptional()
  @IsString()
  @Max(5000)
  description?: string;

  @ApiPropertyOptional({ description: 'Target completion date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  targetDate?: string;

  @ApiPropertyOptional({ description: 'Percentage completed (0-100)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  progress?: number;

  @ApiPropertyOptional({ enum: GoalStatus, description: 'Goal status' })
  @IsOptional()
  @IsEnum(GoalStatus)
  status?: GoalStatus;
}
