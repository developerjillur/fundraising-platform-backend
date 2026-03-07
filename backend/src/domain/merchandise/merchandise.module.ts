import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Merchandise } from './merchandise.entity';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';
import { MerchandiseService } from './merchandise.service';
import { MerchandiseController } from './merchandise.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Merchandise, Order, OrderItem])],
  controllers: [MerchandiseController],
  providers: [MerchandiseService],
  exports: [MerchandiseService],
})
export class MerchandiseModule {}
