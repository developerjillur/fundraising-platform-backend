import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('site_settings')
export class SiteSetting {
  @PrimaryColumn({ type: 'varchar', length: 255 })
  key: string;

  @Column({ type: 'text', nullable: true })
  value: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 100, default: 'general' })
  category: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
