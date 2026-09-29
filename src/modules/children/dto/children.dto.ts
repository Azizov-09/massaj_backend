import { ChildStatus, Gender } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class CreateChildDto {
  @IsString() @Length(1, 100) firstName!: string;
  @IsString() @Length(1, 100) lastName!: string;
  @IsDateString() birthDate!: string;
  @IsEnum(Gender) gender!: Gender;
  @IsOptional() @IsString() @Length(1, 500) address?: string;
  @IsOptional() @IsString() @Length(1, 5000) notes?: string;
}
export class UpdateChildDto {
  @IsOptional() @IsString() @Length(1, 100) firstName?: string;
  @IsOptional() @IsString() @Length(1, 100) lastName?: string;
  @IsOptional() @IsDateString() birthDate?: string;
  @IsOptional() @IsEnum(Gender) gender?: Gender;
  @IsOptional() @IsString() @Length(1, 500) address?: string;
  @IsOptional() @IsString() @Length(1, 5000) notes?: string;
}
export class LinkParentDto { @IsString() @Length(2, 80) relationship!: string; @IsOptional() @IsBoolean() isPrimary?: boolean; }
export class ChildQueryDto { @IsOptional() @IsString() @Length(1, 100) search?: string; @IsOptional() @IsEnum(ChildStatus) status?: ChildStatus; @IsOptional() @Type(() => Number) @Min(1) page = 1; @IsOptional() @Type(() => Number) @Min(1) @Max(100) limit = 20; }
