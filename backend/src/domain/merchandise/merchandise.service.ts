import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Merchandise } from './merchandise.entity';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';
import { SettingsService } from '../settings/settings.service';
import { NotificationService } from '../notification/notification.service';
import { FundraisingService } from '../fundraising/fundraising.service';

@Injectable()
export class MerchandiseService {
  private readonly logger = new Logger(MerchandiseService.name);

  constructor(
    @InjectRepository(Merchandise) private merchRepo: Repository<Merchandise>,
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    @InjectRepository(OrderItem) private orderItemRepo: Repository<OrderItem>,
    private settingsService: SettingsService,
    private notificationService: NotificationService,
    @Inject(forwardRef(() => FundraisingService))
    private fundraisingService: FundraisingService,
  ) {}

  private async printfulHeaders(): Promise<Record<string, string> | null> {
    const apiKey = await this.settingsService.getPrintfulApiKey();
    if (!apiKey) return null;
    const storeId = await this.settingsService.getPrintfulStoreId();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };
    if (storeId) headers['X-PF-Store-Id'] = storeId;
    return headers;
  }

  private resolveVariantId(merch: Merchandise, variantInfo: string | null | undefined): string | null {
    if (merch.printful_variant_id) return String(merch.printful_variant_id);
    if (!variantInfo || !merch.variants || !Array.isArray(merch.variants)) return null;

    const wanted = variantInfo.toLowerCase().trim();
    const match = merch.variants.find((v: any) => {
      const name = String(v?.name || '').toLowerCase();
      return name === wanted || name.includes(wanted);
    });
    return match?.variant_id ? String(match.variant_id) : null;
  }

  private mapItemsToPrintful(items: OrderItem[]): {
    printfulItems: Array<Record<string, any>>;
    skipped: string[];
  } {
    const printfulItems: Array<Record<string, any>> = [];
    const skipped: string[] = [];

    for (const it of items) {
      const merch = it.merchandise;
      if (!merch) {
        skipped.push(`item ${it.id} (no merch)`);
        continue;
      }
      const variantId = this.resolveVariantId(merch, it.variant_info);
      if (!variantId) {
        skipped.push(`${merch.name} ${it.variant_info || ''}`);
        continue;
      }
      printfulItems.push({
        sync_variant_id: Number.parseInt(variantId, 10),
        quantity: it.quantity,
        retail_price: ((it.unit_price_cents || 0) / 100).toFixed(2),
      });
    }

    return { printfulItems, skipped };
  }

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

  /**
   * Push a paid order to Printful for fulfillment.
   * Idempotent: skips if order already has a printful_order_id.
   * Confirms (auto-fulfills) the order if `printful_auto_confirm=true` setting,
   * otherwise leaves it as a draft for manual review in the Printful dashboard.
   */
  async createPrintfulOrder(orderId: string): Promise<{ success: boolean; printful_order_id?: string; error?: string }> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) return { success: false, error: 'Order not found' };

    if (order.printful_order_id) {
      this.logger.log(`Order ${order.order_number} already has Printful id ${order.printful_order_id}, skipping`);
      return { success: true, printful_order_id: order.printful_order_id };
    }

    const headers = await this.printfulHeaders();
    if (!headers) {
      this.logger.warn(`Printful API key not configured — order ${order.order_number} not pushed`);
      return { success: false, error: 'Printful not configured' };
    }

    // Resolve order items with merchandise so we can map to Printful variant_id
    const items = await this.orderItemRepo.find({
      where: { order_id: order.id },
      relations: ['merchandise'],
    });
    if (items.length === 0) return { success: false, error: 'No items on order' };

    const { printfulItems, skipped } = this.mapItemsToPrintful(items);

    if (printfulItems.length === 0) {
      this.logger.error(`Order ${order.order_number}: no items had a Printful variant_id (skipped: ${skipped.join(', ')})`);
      return { success: false, error: 'No items mappable to Printful variants' };
    }

    // Build recipient from shipping_address (stored as JSON on the order)
    const sa: any = order.shipping_address || {};
    const recipient = {
      name: order.customer_name,
      email: order.customer_email,
      address1: sa.line1 || sa.address1 || '',
      address2: sa.line2 || sa.address2 || undefined,
      city: sa.city || '',
      state_code: sa.state || sa.state_code || undefined,
      country_code: this.toCountryCode(sa.country),
      zip: sa.postal_code || sa.zip || '',
    };

    // Validate minimum recipient fields
    if (!recipient.address1 || !recipient.city || !recipient.country_code || !recipient.zip) {
      this.logger.error(`Order ${order.order_number}: incomplete shipping address`);
      return { success: false, error: 'Incomplete shipping address' };
    }

    const autoConfirm = (await this.settingsService.get('printful_auto_confirm', 'false')) === 'true';
    const payload = {
      external_id: order.order_number,
      recipient,
      items: printfulItems,
      retail_costs: {
        currency: 'USD',
        subtotal: ((order.subtotal_cents || order.total_cents) / 100).toFixed(2),
        shipping: ((order.shipping_cents || 0) / 100).toFixed(2),
        total: ((order.total_cents || 0) / 100).toFixed(2),
      },
    };

    try {
      const url = `https://api.printful.com/orders${autoConfirm ? '?confirm=true' : ''}`;
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      const data: any = await res.json();
      if (!res.ok || data?.error) {
        const msg = data?.error?.message || data?.result || `HTTP ${res.status}`;
        this.logger.error(`Printful order create failed for ${order.order_number}: ${msg}`);
        return { success: false, error: typeof msg === 'string' ? msg : JSON.stringify(msg) };
      }

      const printfulOrderId = String(data.result?.id || '');
      const printfulStatus: string = data.result?.status || 'draft';
      order.printful_order_id = printfulOrderId;
      order.fulfillment_status = printfulStatus === 'pending' ? 'submitted' : 'pending';
      await this.orderRepo.save(order);

      this.logger.log(`Order ${order.order_number} → Printful ${printfulOrderId} (status: ${printfulStatus})`);
      if (skipped.length > 0) {
        this.logger.warn(`Order ${order.order_number} had ${skipped.length} unmappable items: ${skipped.join(', ')}`);
      }
      return { success: true, printful_order_id: printfulOrderId };
    } catch (e: any) {
      this.logger.error(`Printful order create exception for ${order.order_number}`, e);
      return { success: false, error: e?.message || 'Network error' };
    }
  }

  private toCountryCode(country: string | null | undefined): string {
    if (!country) return '';
    const c = country.trim();
    if (c.length === 2) return c.toUpperCase();
    // Common name → ISO mapping (small set; fall back to first 2 chars uppercased)
    const map: Record<string, string> = {
      'united states': 'US', 'usa': 'US', 'us': 'US',
      'canada': 'CA', 'united kingdom': 'GB', 'uk': 'GB', 'great britain': 'GB',
      'australia': 'AU', 'germany': 'DE', 'france': 'FR', 'spain': 'ES',
      'italy': 'IT', 'netherlands': 'NL', 'sweden': 'SE', 'norway': 'NO',
      'denmark': 'DK', 'finland': 'FI', 'iceland': 'IS', 'ireland': 'IE',
      'japan': 'JP', 'mexico': 'MX', 'brazil': 'BR', 'india': 'IN',
      'singapore': 'SG', 'new zealand': 'NZ', 'switzerland': 'CH',
      'belgium': 'BE', 'austria': 'AT', 'poland': 'PL', 'portugal': 'PT',
    };
    return map[c.toLowerCase()] || c.substring(0, 2).toUpperCase();
  }

  /**
   * Look up an order by Printful's external_id (which is our order_number)
   * or by Printful's internal id. Used by the webhook handler.
   */
  async findOrderByPrintfulRef(printfulId?: string | number, externalId?: string): Promise<Order | null> {
    if (printfulId) {
      const o = await this.orderRepo.findOne({
        where: { printful_order_id: String(printfulId) },
        relations: ['order_items', 'order_items.merchandise'],
      });
      if (o) return o;
    }
    if (externalId) {
      return this.orderRepo.findOne({
        where: { order_number: externalId },
        relations: ['order_items', 'order_items.merchandise'],
      });
    }
    return null;
  }

  /**
   * Apply a Printful status update (from webhook or polling) to an order.
   * Returns the order and whether the fulfillment_status transitioned to 'shipped'
   * (so the caller can fire the shipped notification).
   */
  async applyPrintfulStatusUpdate(
    order: Order,
    printfulStatus: string,
    shipment?: { tracking_number?: string; tracking_url?: string },
  ): Promise<{ order: Order; transitionedToShipped: boolean }> {
    const statusMap: Record<string, string> = {
      draft: 'pending', pending: 'pending', failed: 'canceled', canceled: 'canceled',
      inprocess: 'in_production', onhold: 'pending', partial: 'shipped', fulfilled: 'delivered',
    };
    const previous = order.fulfillment_status;

    if (printfulStatus && statusMap[printfulStatus]) {
      order.fulfillment_status = statusMap[printfulStatus];
    }
    if (shipment?.tracking_number) {
      order.tracking_number = shipment.tracking_number;
      order.tracking_url = shipment.tracking_url || order.tracking_url;
      order.fulfillment_status = 'shipped';
    }

    await this.orderRepo.save(order);

    const transitionedToShipped = previous !== 'shipped' && order.fulfillment_status === 'shipped';
    return { order, transitionedToShipped };
  }

  /**
   * Process an incoming Printful webhook payload.
   * Reference: https://developers.printful.com/docs/#tag/Webhook-API
   *
   * Handled event types:
   *   - package_shipped       → flip to shipped, persist tracking, notify customer
   *   - package_returned      → flip to canceled-equivalent
   *   - order_failed          → mark canceled, log
   *   - order_canceled        → mark canceled
   *   - order_updated         → re-sync status from Printful
   *   - order_put_hold        → keep as pending
   *
   * Signature validation is performed if `printful_webhook_secret` is set.
   */
  async processPrintfulWebhook(
    payload: any,
    rawBody: string | Buffer,
    signature: string | null,
  ): Promise<{ received: boolean; processed?: string; error?: string }> {
    // Optional signature verification
    const secret = await this.settingsService.get('printful_webhook_secret', '');
    if (secret) {
      if (!signature) {
        this.logger.warn('Printful webhook missing signature header');
        return { received: false, error: 'missing signature' };
      }
      const body = typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : rawBody;
      const expected = createHmac('sha256', secret).update(body).digest('hex');
      const provided = signature.replace(/^sha256=/, '').trim();
      try {
        const a = Buffer.from(expected, 'hex');
        const b = Buffer.from(provided, 'hex');
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          this.logger.warn('Printful webhook signature mismatch');
          return { received: false, error: 'invalid signature' };
        }
      } catch {
        this.logger.warn('Printful webhook signature parse error');
        return { received: false, error: 'invalid signature' };
      }
    }

    const eventType: string = payload?.type || 'unknown';
    const data: any = payload?.data || {};
    const printfulOrder: any = data.order || data;
    const printfulId = printfulOrder?.id;
    const externalId = printfulOrder?.external_id;

    const order = await this.findOrderByPrintfulRef(printfulId, externalId);
    if (!order) {
      this.logger.warn(`Printful webhook ${eventType}: no matching order (printful_id=${printfulId}, external=${externalId})`);
      return { received: true, error: 'order not found' };
    }

    // Translate event → status update
    let printfulStatus = printfulOrder?.status || '';
    let shipment: { tracking_number?: string; tracking_url?: string } | undefined;

    switch (eventType) {
      case 'package_shipped':
        printfulStatus = 'partial'; // → shipped via mapping; tracking forces shipped
        shipment = {
          tracking_number: data.shipment?.tracking_number,
          tracking_url: data.shipment?.tracking_url,
        };
        break;
      case 'package_returned':
      case 'order_failed':
      case 'order_canceled':
        printfulStatus = 'canceled';
        break;
      case 'order_put_hold':
        printfulStatus = 'onhold';
        break;
      case 'order_updated':
      case 'order_remove_hold':
        // Re-sync from Printful to get the authoritative status
        await this.syncPrintfulStatus();
        return { received: true, processed: eventType };
      default:
        this.logger.log(`Printful webhook ${eventType} (no-op)`);
        return { received: true, processed: 'noop' };
    }

    const { transitionedToShipped } = await this.applyPrintfulStatusUpdate(order, printfulStatus, shipment);

    if (transitionedToShipped) {
      await this.notifyOrderShipped(order);
    }

    return { received: true, processed: eventType };
  }

  /**
   * Send the merch_shipped email + fire the Order Shipped Klaviyo event.
   * Best-effort: failures are logged but don't propagate.
   */
  async notifyOrderShipped(order: Order): Promise<void> {
    const cs = await this.fundraisingService
      .getCustomerStatsByEmail(order.customer_email)
      .catch(() => null);
    const cumulativeCents = cs ? Number(cs.total_spent_cents) : Number(order.total_cents);

    // Pull product names for the event
    const items = await this.orderItemRepo.find({
      where: { order_id: order.id },
      relations: ['merchandise'],
    });
    const productNames = items.map((i) => i.merchandise?.name).filter(Boolean);

    try {
      await this.notificationService.sendKlaviyoEvent('Order Shipped', order.customer_email, order.customer_name, {
        order_number: order.order_number,
        amount_dollars: Number(order.total_cents) / 100,
        amount_cents: Number(order.total_cents),
        item_count: items.reduce((sum, i) => sum + (i.quantity || 0), 0),
        product_names: productNames,
        tracking_number: order.tracking_number,
        tracking_url: order.tracking_url,
        shipped_at: new Date().toISOString(),
        cumulative_customer_value_dollars: cumulativeCents / 100,
        cumulative_customer_value_cents: cumulativeCents,
        photo_purchase_count: cs?.photo_purchase_count || 0,
        merch_purchase_count: cs?.merch_purchase_count || 1,
        prize_entries: cs?.grand_prize_entries || 0,
      });
    } catch (e) {
      this.logger.warn(`Klaviyo Order Shipped failed for ${order.order_number}`, e);
    }

    try {
      await this.notificationService.sendTemplateEmail('merch_shipped', order.customer_email, order.customer_name, {
        name: order.customer_name,
        order_number: order.order_number,
        tracking_url: order.tracking_url || '',
        tracking_number: order.tracking_number || '',
      });
    } catch (e) {
      this.logger.warn(`merch_shipped email failed for ${order.order_number}`, e);
    }
  }
}
