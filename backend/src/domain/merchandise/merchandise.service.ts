import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Merchandise } from './merchandise.entity';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class MerchandiseService {
  constructor(
    @InjectRepository(Merchandise) private merchRepo: Repository<Merchandise>,
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    @InjectRepository(OrderItem) private orderItemRepo: Repository<OrderItem>,
    private settingsService: SettingsService,
  ) {}

  async getActiveProducts() {
    return this.merchRepo.find({ where: { active: true }, order: { sort_order: 'ASC' } });
  }

  async getAllProducts() {
    return this.merchRepo.find({ order: { sort_order: 'ASC' } });
  }

  async getProduct(id: string) {
    return this.merchRepo.findOne({ where: { id } });
  }

  async createProduct(data: Partial<Merchandise>) {
    return this.merchRepo.save(this.merchRepo.create(data));
  }

  async updateProduct(id: string, data: Partial<Merchandise>) {
    await this.merchRepo.update(id, data);
    return this.merchRepo.findOne({ where: { id } });
  }

  async deleteProduct(id: string) {
    return this.merchRepo.delete(id);
  }

  async lookupOrder(email?: string, orderNumber?: string) {
    const qb = this.orderRepo.createQueryBuilder('o')
      .leftJoinAndSelect('o.order_items', 'oi')
      .leftJoinAndSelect('oi.merchandise', 'm');

    if (email) {
      qb.where('o.customer_email = :email', { email });
    } else if (orderNumber) {
      qb.where('o.order_number = :orderNumber', { orderNumber });
    } else {
      return { orders: [] };
    }

    const orders = await qb.orderBy('o.created_at', 'DESC').take(20).getMany();
    return { orders };
  }

  async getOrderBySession(sessionId: string) {
    const order = await this.orderRepo.findOne({ where: { stripe_checkout_session_id: sessionId } });
    return order?.order_number || null;
  }

  async getOrders(limit = 200) {
    return this.orderRepo.find({
      relations: ['order_items', 'order_items.merchandise'],
      order: { created_at: 'DESC' },
      take: limit,
    });
  }

  async updateOrder(id: string, data: Partial<Order>) {
    await this.orderRepo.update(id, data);
    return this.orderRepo.findOne({ where: { id }, relations: ['order_items'] });
  }

  async syncPrintfulProducts() {
    const apiKey = await this.settingsService.getPrintfulApiKey();
    const storeId = await this.settingsService.getPrintfulStoreId();
    if (!apiKey) return { error: 'Printful API key not configured', synced: 0 };

    try {
      const baseUrl = 'https://api.printful.com';
      const headers: Record<string, string> = { Authorization: `Bearer ${apiKey}` };
      if (storeId) headers['X-PF-Store-Id'] = storeId;

      const res = await fetch(`${baseUrl}/sync/products?limit=100`, { headers });
      const data = await res.json();
      const products = data.result || [];
      let synced = 0;

      for (const p of products) {
        try {
        const detailRes = await fetch(`${baseUrl}/sync/products/${p.id}`, { headers });
        const detail = await detailRes.json();
        const syncProduct = detail.result?.sync_product;
        const syncVariants = detail.result?.sync_variants || [];
        if (!syncProduct) continue;

        const variants = syncVariants.map((v: any) => ({
          id: v.id,
          name: v.name,
          retail_price: v.retail_price,
          variant_id: v.variant_id,
        }));

        const price = syncVariants.length > 0
          ? Math.min(...syncVariants.map((v: any) => parseFloat(v.retail_price || '0') * 100))
          : 0;

        const imageUrl = syncVariants[0]?.files?.find((f: any) => f.type === 'preview')?.preview_url
          || syncProduct.thumbnail_url;

        const existing = await this.merchRepo.findOne({ where: { printful_product_id: String(p.id) } });
        if (existing) {
          existing.name = syncProduct.name;
          existing.variants = variants;
          existing.price_cents = Math.round(price);
          existing.image_url = imageUrl;
          await this.merchRepo.save(existing);
        } else {
          await this.merchRepo.save(this.merchRepo.create({
            name: syncProduct.name,
            printful_product_id: String(p.id),
            variants,
            price_cents: Math.round(price),
            image_url: imageUrl,
            active: true,
          }));
        }
        synced++;
        } catch {
          // skip individual product errors
        }
      }

      return { synced, total_found: products.length, message: `Synced ${synced} products` };
    } catch (e) {
      return { error: e.message, synced: 0 };
    }
  }

  async syncPrintfulStatus() {
    const apiKey = await this.settingsService.getPrintfulApiKey();
    const storeId = await this.settingsService.getPrintfulStoreId();
    if (!apiKey) return { error: 'Not configured', synced: 0 };

    // Filter to orders with printful_order_id set and not delivered/canceled
    const toSync = await this.orderRepo
      .createQueryBuilder('o')
      .where('o.printful_order_id IS NOT NULL')
      .andWhere('o.fulfillment_status NOT IN (:...statuses)', { statuses: ['delivered', 'canceled'] })
      .getMany();

    const headers: Record<string, string> = { Authorization: `Bearer ${apiKey}` };
    if (storeId) headers['X-PF-Store-Id'] = storeId;

    let synced = 0;
    for (const order of toSync) {
      try {
        const res = await fetch(`https://api.printful.com/orders/${order.printful_order_id}`, { headers });
        const data = await res.json();
        const result = data.result;
        if (!result) continue;

        const statusMap: Record<string, string> = {
          draft: 'pending', pending: 'pending', failed: 'canceled', canceled: 'canceled',
          inprocess: 'in_production', onhold: 'pending', partial: 'shipped', fulfilled: 'delivered',
        };

        order.fulfillment_status = statusMap[result.status] || order.fulfillment_status;

        if (result.shipments?.length > 0) {
          const shipment = result.shipments[0];
          order.tracking_number = shipment.tracking_number;
          order.tracking_url = shipment.tracking_url;
          if (shipment.tracking_number) order.fulfillment_status = 'shipped';
        }

        await this.orderRepo.save(order);
        synced++;
      } catch (e) {
        // continue
      }
    }

    return { synced, total: toSync.length };
  }
}
