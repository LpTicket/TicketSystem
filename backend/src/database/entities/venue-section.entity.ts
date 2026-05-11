import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Event } from './event.entity';

export enum SectionType {
  SEATED = 'seated',
  STANDING = 'standing',
  TABLE = 'table',
  VIP = 'vip',
  STAGE = 'stage',
}

@Entity('venue_sections')
export class VenueSection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  eventId: string;

  @ManyToOne(() => Event, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'eventId' })
  event: Event;

  @Column({ length: 40 })
  name: string;

  @Column({
    type: 'enum',
    enum: SectionType,
    default: SectionType.SEATED,
  })
  sectionType: SectionType;

  @Column({ type: 'int', default: 1 })
  rows: number;

  @Column({ type: 'int', default: 10 })
  seatsPerRow: number;

  @Column({ type: 'int', default: 0 })
  capacity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ length: 7, default: '#6366f1' })
  color: string;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  // SVG positioning for the seat map
  @Column({ type: 'float', default: 0 })
  mapX: number;

  @Column({ type: 'float', default: 0 })
  mapY: number;

  @Column({ type: 'float', default: 200 })
  mapWidth: number;

  @Column({ type: 'float', default: 100 })
  mapHeight: number;

  @Column({ type: 'float', default: 0 })
  curve: number;

  @Column({ type: 'boolean', default: false })
  isWheelchair: boolean;

  @Column({ length: 20, default: 'round' })
  tableShape: string;

  @Column({ length: 20, default: 'individual' })
  tablePurchaseMode: string; // 'individual' | 'whole'

  @Column({ type: 'text', nullable: true })
  seatsConfig: string;
}
