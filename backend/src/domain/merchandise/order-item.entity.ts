import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Order } from './order.entity';
import { Merchandise } from './merchandise.entity';

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36 })
  order_id: string;

  @Column({ type: 'varchar', length: 36 })
  merchandise_id: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  variant_info: string;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column({ type: 'int' })
  unit_price_cents: number;

  @Column({ type: 'int' })
  total_cents: number;

  @ManyToOne(() => Order, (order) => order.order_items)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @ManyToOne(() => Merchandise)
  @JoinColumn({ name: 'merchandise_id' })
  merchandise: Merchandise;

  @CreateDateColumn()
  created_at: Date;
}
