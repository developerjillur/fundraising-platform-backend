import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailTemplate } from './email-template.entity';
import { NotificationService } from './notification.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([EmailTemplate])],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
