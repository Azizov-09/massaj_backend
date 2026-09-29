import { IsInt, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';

export class CreateUserProfileDto {
  @IsString() @Length(2, 160) fullName!: string;
  @IsString() @Length(7, 32) phone!: string;
  @IsString() @Length(12, 128) @Matches(/[a-z]/) @Matches(/[A-Z]/) @Matches(/\d/) password!: string;
}
export class CreateParentDto extends CreateUserProfileDto { @IsOptional() @IsString() @Length(1, 500) address?: string; }
export class UpdateParentDto { @IsOptional() @IsString() @Length(2, 160) fullName?: string; @IsOptional() @IsString() @Length(1, 500) address?: string; }
export class CreateSpecialistDto extends CreateUserProfileDto { @IsString() @Length(2, 250) specialization!: string; @IsInt() @Min(0) @Max(80) experienceYears!: number; @IsOptional() @IsString() @Length(1, 5000) bio?: string; }
export class UpdateSpecialistDto { @IsOptional() @IsString() @Length(2, 250) specialization?: string; @IsOptional() @IsInt() @Min(0) @Max(80) experienceYears?: number; @IsOptional() @IsString() @Length(1, 5000) bio?: string; }
