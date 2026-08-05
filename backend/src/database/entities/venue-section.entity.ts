import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Event } from './event.entity';

export enum SectionType {
  SEATED = 'seated',
  STANDING = 'standing',
  TABLE = 'table',
  VIP = 'vip',
  STAGE = 'stage',
  DECOR = 'decor',
}

@Entity('venue_sections')
@Index(['eventId'])
export class VenueSection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  eventId: string;

  @ManyToOne(() => Event, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'eventId' })
  event: Event;

  // Keep the production schema stable while the wider-name migration is
  // prepared separately. PostgreSQL accepts exactly 40 characters here.
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

  @Column({ type: 'float', default: 0 })
  rotation: number;

  @Column({ type: 'float', default: 0 })
  labelFontSize: number;

  @Column({ type: 'boolean', default: false })
  isWheelchair: boolean;

  @Column({ length: 20, default: 'round' })
  tableShape: string;

  @Column({ length: 20, default: 'individual' })
  tablePurchaseMode: string; // 'individual' | 'whole'

  @Column({ type: 'text', nullable: true })
  seatsConfig: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  pendingPrice: number | null;

  // --- Configurable Fee Parameters (Overrides Event-level fees if non-null) ---
  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  serviceFeePercent: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  serviceFeeFixedPerTicket: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  processingFeePercent: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  processingFeeFixedPerTicket: number | null;
}
