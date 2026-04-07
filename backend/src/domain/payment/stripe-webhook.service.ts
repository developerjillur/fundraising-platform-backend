import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import Stripe from 'stripe';
import { Supporter } from '../fundraising/supporter.entity';
import { Order } from '../merchandise/order.entity';
import { StreamQueue } from '../stream/stream-queue.entity';
import { FundraisingService } from '../fundraising/fundraising.service';
import { NotificationService } from '../notification/notification.service';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class StripeWebhookService {
  private readonly logger = new Logger(StripeWebhookService.name);

  constructor(
    @InjectRepository(Supporter) private supporterRepo: Repository<Supporter>,
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    @InjectRepository(StreamQueue) private queueRepo: Repository<StreamQueue>,
    private fundraisingService: FundraisingService,
    private notificationService: NotificationService,
    private settingsService: SettingsService,
    private dataSource: DataSource,
  ) {}

  async handleWebhook(rawBody: Buffer, signature: string) {
    const stripeKey = await this.settingsService.getStripeSecretKey();
    const webhookSecret = await this.settingsService.getStripeWebhookSecret();
    const stripe = new Stripe(stripeKey, { apiVersion: '2024-12-18.acacia' as any });

    let event: Stripe.Event;
    try {
      if (webhookSecret && signature) {
        event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
      } else {
        event = JSON.parse(rawBody.toString());
      }
    } catch (err) {
      this.logger.error('Webhook signature verification failed', err);
      throw err;
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'payment_intent.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      case 'checkout.session.expired':
      case 'checkout.session.async_payment_failed':
        await this.handleSessionExpired(event.data.object as Stripe.Checkout.Session);
        break;
      case 'charge.refunded':
        await this.handleRefund(event.data.object as Stripe.Charge);
        break;
    }
    return { received: true };
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const type = session.metadata?.type;
    if (type === 'photo') {
      await this.handlePhotoPayment(session);
    } else if (type === 'merch') {
      await this.handleMerchPayment(session);
    }
  }

  private async handlePhotoPayment(session: Stripe.Checkout.Session) {
    const supporter = await this.supporterRepo.findOne({
      where: { stripe_checkout_session_id: session.id },
    });
    if (!supporter) return;

    supporter.payment_status = 'completed';
    supporter.stripe_payment_intent_id = session.payment_intent as string;

    // Only add to queue if moderation approved
    if (supporter.moderation_status === 'approved') {
      const maxPos = await this.queueRepo
        .createQueryBuilder('q')
        .select('MAX(q.queue_position)', 'max')
        .getRawOne();
      const nextPos = (maxPos?.max || 0) + 1;

      const queueItem = this.queueRepo.create({
        supporter_id: supporter.id,
        photo_url: supporter.photo_url || '',
        photo_storage_path: supporter.photo_storage_path,
        package_type: supporter.package_type || 'standard',
        display_duration_seconds: supporter.display_duration_seconds || 10,
        has_badge: supporter.package_type === 'premium',
        queue_position: nextPos,
        status: 'waiting',
      });
      await this.queueRepo.save(queueItem);
      supporter.display_status = 'queued';
    } else if (supporter.moderation_status === 'rejected') {
      try {
        await this.notificationService.sendTemplateEmail(
          'photo_rejected',
          supporter.email,
          supporter.name,
          {
            name: supporter.name,
            reason: supporter.moderation_reason || 'Content policy violation',
            reupload_url: `${process.env.FRONTEND_URL || 'http://localhost:8080'}/reupload/${supporter.id}`,
          },
        );
      } catch (e) {
        this.logger.warn('Rejection email failed', e);
      }
    } else {
      // moderation_status is 'pending' — moderation might be disabled, queue anyway
      const maxPos = await this.queueRepo
        .createQueryBuilder('q')
        .select('MAX(q.queue_position)', 'max')
        .getRawOne();
      const nextPos = (maxPos?.max || 0) + 1;

      const queueItem = this.queueRepo.create({
        supporter_id: supporter.id,
        photo_url: supporter.photo_url || '',
        photo_storage_path: supporter.photo_storage_path,
        package_type: supporter.package_type || 'standard',
        display_duration_seconds: supporter.display_duration_seconds || 10,
        has_badge: supporter.package_type === 'premium',
        queue_position: nextPos,
        status: 'waiting',
      });
      await this.queueRepo.save(queueItem);
      supporter.display_status = 'queued';
    }
    await this.supporterRepo.save(supporter);

    await this.fundraisingService.incrementStats(supporter.amount_cents, true);
    await this.fundraisingService.trackPurchase(
      supporter.email, supporter.amount_cents, true, supporter.id,
    );

    // Best-effort notifications
    try {
      await this.notificationService.sendKlaviyoEvent('Photo Purchased', supporter.email, supporter.name, {
        package_type: supporter.package_type,
        amount: supporter.amount_cents / 100,
        name: supporter.name,
      });
    } catch (e) { this.logger.warn('Klaviyo event failed', e); }

    try {
      await this.notificationService.sendTemplateEmail('photo_purchased', supporter.email, supporter.name, {
        name: supporter.name,
        package_type: supporter.package_type,
        amount: `$${(supporter.amount_cents / 100).toFixed(2)}`,
      });
    } catch (e) { this.logger.warn('Email failed', e); }
  }

  private async handleMerchPayment(session: Stripe.Checkout.Session) {
    const order = await this.orderRepo.findOne({
      where: { stripe_checkout_session_id: session.id },
    });
    if (!order) return;

    order.payment_status = 'completed';
    order.stripe_payment_intent_id = session.payment_intent as string;
    await this.orderRepo.save(order);

    await this.fundraisingService.incrementStats(order.total_cents, false);
    await this.fundraisingService.trackPurchase(
      order.customer_email, order.total_cents, false, order.id,
    );

    try {
      await this.notificationService.sendKlaviyoEvent('Merchandise Purchased', order.customer_email, order.customer_name, {
        order_number: order.order_number,
        amount: order.total_cents / 100,
      });
    } catch (e) { this.logger.warn('Klaviyo event failed', e); }

    try {
      await this.notificationService.sendTemplateEmail('merch_order_confirmation', order.customer_email, order.customer_name, {
        name: order.customer_name,
        order_number: order.order_number,
        amount: `$${(order.total_cents / 100).toFixed(2)}`,
      });
    } catch (e) { this.logger.warn('Email failed', e); }
  }

  private async handlePaymentFailed(pi: Stripe.PaymentIntent) {
    const supporter = await this.supporterRepo.findOne({
      where: { stripe_payment_intent_id: pi.id },
    });
    if (supporter) {
      supporter.payment_status = 'failed';
      await this.supporterRepo.save(supporter);
    }
    const order = await this.orderRepo.findOne({
      where: { stripe_payment_intent_id: pi.id },
    });
    if (order) {
      order.payment_status = 'failed';
      await this.orderRepo.save(order);
    }
  }

  private async handleSessionExpired(session: Stripe.Checkout.Session) {
    const supporter = await this.supporterRepo.findOne({
      where: { stripe_checkout_session_id: session.id },
    });
    if (supporter && supporter.payment_status === 'pending') {
      supporter.payment_status = 'failed';
      await this.supporterRepo.save(supporter);
    }
    const order = await this.orderRepo.findOne({
      where: { stripe_checkout_session_id: session.id },
    });
    if (order && order.payment_status === 'pending') {
      order.payment_status = 'failed';
      await this.orderRepo.save(order);
    }
  }

  private async handleRefund(charge: Stripe.Charge) {
    const pi = charge.payment_intent as string;
    if (!pi) return;
    await this.supporterRepo.update({ stripe_payment_intent_id: pi }, { payment_status: 'refunded' });
    await this.orderRepo.update({ stripe_payment_intent_id: pi }, { payment_status: 'refunded' });
  }
}
