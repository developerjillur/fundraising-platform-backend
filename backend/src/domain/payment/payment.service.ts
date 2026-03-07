import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Stripe from 'stripe';
import { Supporter } from '../fundraising/supporter.entity';
import { Order } from '../merchandise/order.entity';
import { OrderItem } from '../merchandise/order-item.entity';
import { Merchandise } from '../merchandise/merchandise.entity';
import { PhotoPackage } from '../photo/photo-package.entity';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Supporter) private supporterRepo: Repository<Supporter>,
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    @InjectRepository(OrderItem) private orderItemRepo: Repository<OrderItem>,
    @InjectRepository(Merchandise) private merchRepo: Repository<Merchandise>,
    @InjectRepository(PhotoPackage) private packageRepo: Repository<PhotoPackage>,
    private settingsService: SettingsService,
  ) {}

  private async getStripe(): Promise<Stripe> {
    const key = await this.settingsService.getStripeSecretKey();
    if (!key || !key.startsWith('sk_')) throw new BadRequestException('Stripe not configured');
    return new Stripe(key, { apiVersion: '2024-12-18.acacia' as any });
  }

  async createPhotoCheckout(body: {
    name: string;
    email: string;
    package_type: string;
    photo_storage_path?: string;
    origin?: string;
  }) {
    const { name, email, package_type, photo_storage_path, origin } = body;
    if (!name || !email) throw new BadRequestException('Name and email required');

    const pkg = await this.packageRepo.findOne({ where: { slug: package_type, active: true } });
    if (!pkg) throw new BadRequestException('Invalid package type');

    // Check for recent duplicates
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
    const duplicate = await this.supporterRepo
      .createQueryBuilder('s')
      .where('s.email = :email', { email })
      .andWhere('s.package_type = :pt', { pt: package_type })
      .andWhere('s.payment_status = :ps', { ps: 'pending' })
      .andWhere('s.created_at > :since', { since: thirtyMinAgo })
      .getOne();
    if (duplicate) throw new BadRequestException('A pending submission already exists for this email');

    const photoUrl = photo_storage_path ? `${origin || ''}/uploads/photos/${photo_storage_path.split('/').pop()}` : null;

    const supporter = this.supporterRepo.create({
      name: name.substring(0, 100),
      email: email.substring(0, 255),
      package_type,
      amount_cents: pkg.price_cents,
      display_duration_seconds: pkg.display_duration_seconds,
      photo_url: photoUrl,
      photo_storage_path,
      payment_status: 'pending',
      moderation_status: 'approved',
    });
    await this.supporterRepo.save(supporter);

    const stripe = await this.getStripe();
    const successUrl = `${origin || 'http://localhost:8080'}/payment/success?session_id={CHECKOUT_SESSION_ID}&type=photo`;
    const cancelUrl = `${origin || 'http://localhost:8080'}/payment/cancel`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: email,
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: pkg.price_cents,
          product_data: { name: `${pkg.name} Photo Package`, description: pkg.description || undefined },
        },
        quantity: 1,
      }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      metadata: { type: 'photo', supporter_id: supporter.id, package_type },
    });

    supporter.stripe_checkout_session_id = session.id;
    await this.supporterRepo.save(supporter);

    return { url: session.url, session_id: session.id };
  }

  async createMerchCheckout(body: {
    customer_name: string;
    customer_email: string;
    items: Array<{ merchandise_id: string; quantity: number; variant_info?: string }>;
    shipping_address?: any;
    origin?: string;
  }) {
    const { customer_name, customer_email, items, shipping_address, origin } = body;
    if (!customer_name || !customer_email || !items?.length) {
      throw new BadRequestException('Missing required fields');
    }

    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    let totalCents = 0;
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    const order = this.orderRepo.create({
      order_number: orderNumber,
      customer_name,
      customer_email,
      shipping_address,
      payment_status: 'pending',
      total_cents: 0,
    });
    await this.orderRepo.save(order);

    for (const item of items) {
      const merch = await this.merchRepo.findOne({ where: { id: item.merchandise_id } });
      if (!merch) continue;
      const itemTotal = merch.price_cents * (item.quantity || 1);
      totalCents += itemTotal;

      const oi = this.orderItemRepo.create({
        order_id: order.id,
        merchandise_id: merch.id,
        quantity: item.quantity || 1,
        unit_price_cents: merch.price_cents,
        total_cents: itemTotal,
        variant_info: item.variant_info,
      });
      await this.orderItemRepo.save(oi);

      lineItems.push({
        price_data: {
          currency: 'usd',
          unit_amount: merch.price_cents,
          product_data: { name: merch.name, description: item.variant_info || undefined },
        },
        quantity: item.quantity || 1,
      });
    }

    order.total_cents = totalCents;
    order.subtotal_cents = totalCents;
    await this.orderRepo.save(order);

    const stripe = await this.getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email,
      line_items: lineItems,
      success_url: `${origin || 'http://localhost:8080'}/payment/success?session_id={CHECKOUT_SESSION_ID}&type=merch`,
      cancel_url: `${origin || 'http://localhost:8080'}/payment/cancel`,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      metadata: { type: 'merch', order_id: order.id, order_number: orderNumber },
    });

    order.stripe_checkout_session_id = session.id;
    await this.orderRepo.save(order);

    return { url: session.url, session_id: session.id };
  }
}
