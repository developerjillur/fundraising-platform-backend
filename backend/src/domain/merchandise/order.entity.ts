import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { OrderItem } from './order-item.entity';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  order_number: string;

  @Column({ type: 'varchar', length: 255 })
  customer_name: string;

  @Column({ type: 'varchar', length: 255 })
  customer_email: string;

  @Column({ type: 'json', nullable: true })
  shipping_address: any;

  @Column({ type: 'int', nullable: true })
  subtotal_cents: number;

  @Column({ type: 'int', nullable: true })
  shipping_cents: number;

  @Column({ type: 'int', default: 0 })
  total_cents: number;

  @Column({ type: 'enum', enum: ['pending', 'completed', 'failed', 'refunded'], default: 'pending' })
  payment_status: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  stripe_checkout_session_id: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  stripe_payment_intent_id: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  printful_order_id: string;

  @Column({ type: 'enum', enum: ['pending', 'submitted', 'in_production', 'shipped', 'delivered', 'canceled'], default: 'pending' })
  fulfillment_status: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  tracking_number: string;

  @Column({ type: 'text', nullable: true })
  tracking_url: string;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  order_items: OrderItem[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
