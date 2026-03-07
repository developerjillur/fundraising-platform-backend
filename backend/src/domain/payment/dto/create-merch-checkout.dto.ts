import { IsEmail, IsString, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class CheckoutItem {
  @IsString()
  merchandise_id: string;

  quantity: number;

  @IsOptional()
  @IsString()
  variant_info?: string;
}

export class CreateMerchCheckoutDto {
  @IsString()
  customer_name: string;

  @IsEmail()
  customer_email: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckoutItem)
  items: CheckoutItem[];

  @IsOptional()
  shipping_address?: any;

  @IsOptional()
  @IsString()
  origin?: string;
}
