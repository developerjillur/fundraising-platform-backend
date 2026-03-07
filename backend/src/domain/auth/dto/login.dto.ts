import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin@example.com', description: 'Admin email address' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'admin12345', description: 'Password (min 6 chars)', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;
}
