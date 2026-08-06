import { IsString, IsNotEmpty, IsOptional, IsEmail, IsEnum, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TenantStatus } from '@prisma/client/tenant';

export class CreateTenantDto {
  @ApiProperty({ example: 'ACME University' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'acme-university' })
  @IsString()
  @IsNotEmpty()
  slug: string;

  @ApiProperty({ example: 'admin@acme-university.edu' })
  @IsEmail()
  adminEmail: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  adminFirstName: string;

  @ApiProperty({ example: 'Smith' })
  @IsString()
  adminLastName: string;

  @ApiPropertyOptional({ example: 'enterprise' })
  @IsOptional()
  @IsString()
  plan?: string;
}

export class UpdateTenantDto {
  @ApiPropertyOptional({ example: 'ACME University Updated' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: TenantStatus })
  @IsOptional()
  @IsEnum(TenantStatus)
  status?: TenantStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  maxSeats?: number;
}

export class UpdateBrandingDto {
  @ApiPropertyOptional({ example: 'https://cdn.example.com/logo.png' })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({ example: '#6C1D5F' })
  @IsOptional()
  @IsString()
  primaryColor?: string;

  @ApiPropertyOptional({ example: '#FF6200' })
  @IsOptional()
  @IsString()
  secondaryColor?: string;

  @ApiPropertyOptional({ example: 'ACME University' })
  @IsOptional()
  @IsString()
  companyName?: string;
}

export class UpdateSettingsDto {
  @ApiPropertyOptional({ example: 'America/New_York' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ example: 'en-US' })
  @IsOptional()
  @IsString()
  locale?: string;

  @ApiPropertyOptional({ example: 'MM/DD/YYYY' })
  @IsOptional()
  @IsString()
  dateFormat?: string;

  @ApiPropertyOptional()
  @IsOptional()
  enableEmailNotifications?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  enableInAppNotifications?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  enableProctoring?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  maxConcurrentExams?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultInstructions?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notificationEmails?: string;
}
