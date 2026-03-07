import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('stream_events')
export class StreamEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  photo_id: string;

  @Column({ type: 'varchar', length: 50 })
  event_type: string;

  @Column({ type: 'json', nullable: true })
  payload: any;

  @CreateDateColumn()
  created_at: Date;
}
