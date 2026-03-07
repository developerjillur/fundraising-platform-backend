import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('merchandise')
export class Merchandise {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'int' })
  price_cents: number;

  @Column({ type: 'text', nullable: true })
  image_url: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  printful_product_id: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  printful_variant_id: string;

  @Column({ type: 'json', nullable: true })
  variants: any;

  @Column({ type: 'int', nullable: true })
  stock_quantity: number;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'int', default: 0 })
  sort_order: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
