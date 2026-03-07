import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { FundraisingModule } from '../fundraising/fundraising.module';
import { StreamModule } from '../stream/stream.module';
import { MerchandiseModule } from '../merchandise/merchandise.module';
import { PhotoModule } from '../photo/photo.module';
import { NotificationModule } from '../notification/notification.module';
import { FundraisingStats } from '../fundraising/fundraising-stats.entity';
import { Merchandise } from '../merchandise/merchandise.entity';
import { EmailTemplate } from '../notification/email-template.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([FundraisingStats, Merchandise, EmailTemplate]),
    FundraisingModule,
    StreamModule,
    MerchandiseModule,
    PhotoModule,
    NotificationModule,
  ],
  controllers: [AdminController],
})
export class AdminModule {}
