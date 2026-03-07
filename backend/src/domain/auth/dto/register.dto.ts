import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'admin@example.com', description: 'Email address for new admin' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'securepass123', description: 'Password (min 6 chars)', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;
}
