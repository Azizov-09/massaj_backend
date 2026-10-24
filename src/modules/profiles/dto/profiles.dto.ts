import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SpecialistStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

const emptyStringToNull = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() || null : value;

export class CreateUserProfileDto {
  @ApiProperty({ description: 'User full name' })
  @IsString()
  @Length(2, 160)
  fullName!: string;

  @ApiProperty({ description: 'International phone number' })
  @IsString()
  @Length(7, 32)
  phone!: string;

  @ApiProperty({
    description: 'Initial password (min 12 chars, must contain uppercase, lowercase, and number)',
    format: 'password',
  })
  @IsString()
  @Length(12, 128)
  @Matches(/[a-z]/, { message: 'Password must contain at least one lowercase letter' })
  @Matches(/[A-Z]/, { message: 'Password must contain at least one uppercase letter' })
  @Matches(/\d/, { message: 'Password must contain at least one digit' })
  password!: string;
}

export class CreateParentDto extends CreateUserProfileDto {
  @ApiPropertyOptional({ description: 'Residential address', nullable: true })
  @Transform(emptyStringToNull)
  @IsOptional()
  @IsString()
  @Length(1, 500)
  address?: string | null;
}

export class UpdateParentDto {
  @ApiPropertyOptional({ description: 'Updated full name' })
  @IsOptional()
  @IsString()
  @Length(2, 160)
  fullName?: string;

  @ApiPropertyOptional({ description: 'Updated international phone number' })
  @IsOptional()
  @IsString()
  @Length(7, 32)
  phone?: string;

  @ApiPropertyOptional({ description: 'Residential address; empty string clears it', nullable: true })
  @Transform(emptyStringToNull)
  @IsOptional()
  @IsString()
  @Length(1, 500)
  address?: string | null;
}

export class UpdateParentStatusDto {
  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE'] })
  @IsIn(['ACTIVE', 'INACTIVE'])
  status!: 'ACTIVE' | 'INACTIVE';
}

export class CreateSpecialistDto extends CreateUserProfileDto {
  @ApiProperty({ description: 'Clinical specialization' })
  @IsString()
  @Length(2, 250)
  specialization!: string;

  @ApiProperty({ description: 'Years of clinical rehabilitation experience' })
  @IsInt()
  @Min(0)
  @Max(80)
  experienceYears!: number;

  @ApiPropertyOptional({ description: 'Professional biography and credentials', nullable: true })
  @Transform(emptyStringToNull)
  @IsOptional()
  @IsString()
  @Length(1, 5000)
  bio?: string | null;

  @ApiPropertyOptional({
    description: 'Canonical ISO weekdays (Monday=1 ... Sunday=7). An empty array means no working days.',
    type: [Number],
    default: [1, 2, 3, 4, 5, 6, 7],
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  workingDays?: number[];
}

export class UpdateSpecialistDto {
  @ApiPropertyOptional({ description: 'Updated full name' })
  @IsOptional()
  @IsString()
  @Length(2, 160)
  fullName?: string;

  @ApiPropertyOptional({ description: 'Updated international phone number' })
  @IsOptional()
  @IsString()
  @Length(7, 32)
  phone?: string;

  @ApiPropertyOptional({ description: 'Clinical specialization' })
  @IsOptional()
  @IsString()
  @Length(2, 250)
  specialization?: string;

  @ApiPropertyOptional({ description: 'Years of experience' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(80)
  experienceYears?: number;

  @ApiPropertyOptional({ description: 'Professional biography; empty string clears it', nullable: true })
  @Transform(emptyStringToNull)
  @IsOptional()
  @IsString()
  @Length(1, 5000)
  bio?: string | null;

  @ApiPropertyOptional({
    description: 'Canonical ISO weekdays (Monday=1 ... Sunday=7). An empty array means no working days.',
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  workingDays?: number[];
}

export class UpdateSpecialistStatusDto {
  @ApiProperty({ enum: [SpecialistStatus.ACTIVE, SpecialistStatus.INACTIVE] })
  @IsIn([SpecialistStatus.ACTIVE, SpecialistStatus.INACTIVE])
  status!: 'ACTIVE' | 'INACTIVE';
}
