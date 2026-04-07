import { IsEmail, IsString, IsOptional, IsEnum, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePhotoCheckoutDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsString()
  package_type: string;

  @IsOptional()
  @IsString()
  photo_storage_path?: string;

  @IsOptional()
  @IsString()
  origin?: string;

  @ApiProperty({ required: false, enum: ['approved', 'rejected', 'pending'] })
  @IsEnum(['approved', 'rejected', 'pending'])
  @IsOptional()
  moderation_status?: 'approved' | 'rejected' | 'pending';

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  moderation_reason?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  photo_url?: string;
}
