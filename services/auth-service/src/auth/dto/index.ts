import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin@acme-university.edu' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'SecureP@ss123' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiPropertyOptional({ example: 'acme-university' })
  @IsOptional()
  @IsString()
  tenantSlug?: string;
}

export class RefreshTokenDto {
  @ApiProperty({ description: 'Valid refresh token' })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class PasswordResetRequestDto {
  @ApiProperty({ example: 'user@acme-university.edu' })
  @IsEmail()
  email: string;
}

export class PasswordResetConfirmDto {
  @ApiProperty({ description: 'Password reset token from email' })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({ example: 'NewSecureP@ss456' })
  @IsString()
  @MinLength(8)
  newPassword: string;
}

export class FirstLoginResetDto {
  @ApiProperty({ description: 'Current temporary password' })
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @ApiProperty({ example: 'MyNewSecureP@ss789' })
  @IsString()
  @MinLength(8)
  newPassword: string;

  @ApiProperty({ example: 'MyNewSecureP@ss789' })
  @IsString()
  @MinLength(8)
  confirmPassword: string;
}

export class LogoutDto {
  @ApiPropertyOptional({ description: 'Refresh token to revoke' })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

export class RegisterDto {
  @ApiProperty({ example: 'user@acme.edu' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'SecureP@ss123' })
  @IsString()
  @MinLength(10)
  password: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ example: 'CANDIDATE' })
  @IsString()
  @IsNotEmpty()
  role: string;

  @ApiPropertyOptional({ example: 'acme-university' })
  @IsOptional()
  @IsString()
  tenantSlug?: string;

  @ApiPropertyOptional({ example: 'Acme University' })
  @IsOptional()
  @IsString()
  tenantName?: string;
}
