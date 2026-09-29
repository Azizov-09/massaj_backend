import { IsString, Length, Matches } from 'class-validator';

export class LoginDto {
  @IsString() @Length(7, 32) phone!: string;
  @IsString() @Length(1, 128) password!: string;
}

export class RefreshDto { @IsString() @Length(20, 4096) refreshToken!: string; }

export class ChangePasswordDto {
  @IsString() @Length(1, 128) currentPassword!: string;
  @IsString() @Length(12, 128) @Matches(/[a-z]/) @Matches(/[A-Z]/) @Matches(/\d/) newPassword!: string;
}
