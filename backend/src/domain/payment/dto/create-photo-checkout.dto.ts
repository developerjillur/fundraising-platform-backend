import { IsEmail, IsString, IsOptional, MaxLength } from 'class-validator';

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
}
