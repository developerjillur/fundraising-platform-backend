import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Supporter } from '../fundraising/supporter.entity';
import { StreamQueue } from '../stream/stream-queue.entity';
import { Order } from '../merchandise/order.entity';
import { OrderItem } from '../merchandise/order-item.entity';
import { Merchandise } from '../merchandise/merchandise.entity';
import { PhotoPackage } from '../photo/photo-package.entity';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { StripeWebhookService } from './stripe-webhook.service';
import { FundraisingModule } from '../fundraising/fundraising.module';
import { NotificationModule } from '../notification/notification.module';
import { StreamModule } from '../stream/stream.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Supporter, StreamQueue, Order, OrderItem, Merchandise, PhotoPackage]),
    FundraisingModule,
    NotificationModule,
    StreamModule,
  ],
  controllers: [PaymentController],
  providers: [PaymentService, StripeWebhookService],
  exports: [PaymentService],
})
export class PaymentModule {}
