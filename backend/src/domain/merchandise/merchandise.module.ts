import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Merchandise } from './merchandise.entity';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';
import { MerchandiseService } from './merchandise.service';
import { MerchandiseController } from './merchandise.controller';
import { NotificationModule } from '../notification/notification.module';
import { FundraisingModule } from '../fundraising/fundraising.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Merchandise, Order, OrderItem]),
    NotificationModule,
    forwardRef(() => FundraisingModule),
  ],
  controllers: [MerchandiseController],
  providers: [MerchandiseService],
  exports: [MerchandiseService],
})
export class MerchandiseModule {}
