import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { Event } from './event.entity';
import { Order } from './order.entity';
import { Seat } from './seat.entity';
import { VenueSection } from './venue-section.entity';

export enum TicketStatus {
  ACTIVE = 'active',
  USED = 'used',
  CANCELLED = 'cancelled',
}

@Entity('tickets')
@Index(['eventId'])
@Index(['orderId'])
@Index(['userId'])
@Index(['status'])
export class Ticket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 20 })
  ticketCode: string;

  @Column('uuid')
  orderId: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column('uuid')
  eventId: string;

  @ManyToOne(() => Event)
  @JoinColumn({ name: 'eventId' })
  event: Event;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid', nullable: true })
  seatId: string | null;

  @ManyToOne(() => Seat, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'seatId' })
  seat: Seat | null;

  @Column({ type: 'uuid', nullable: true })
  sectionId: string | null;

  @ManyToOne(() => VenueSection, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'sectionId' })
  section: VenueSection | null;

  @Column({ length: 40, nullable: true })
  sectionName: string;

  @Column({ length: 10, nullable: true })
  rowLabel: string;

  @Column({ type: 'int', nullable: true })
  seatNumber: number;

  @Column({ type: 'text', nullable: true })
  qrData: string;

  @Column({
    type: 'enum',
    enum: TicketStatus,
    default: TicketStatus.ACTIVE,
  })
  status: TicketStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @CreateDateColumn()
  createdAt: Date;
}
