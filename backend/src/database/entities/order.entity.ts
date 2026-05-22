import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Event } from './event.entity';
import { SpecialCode } from './special-code.entity';

/**
 * OrderStatus
 * Represents the current payment/fulfillment state of an order.
 */
export enum OrderStatus {
  PENDING = 'pending',   // User has initiated checkout but hasn't paid yet
  PAID = 'paid',         // Payment confirmed by Stripe webhook
  CANCELLED = 'cancelled', // Order timed out or was manually cancelled
  REFUNDED = 'refunded', // Payment returned to user
}

/**
 * Order Entity
 * Tracks a financial transaction for tickets.
 * Stores detailed fee breakdowns and references to external payment processors.
 */
@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column('uuid')
  eventId: string;

  @ManyToOne(() => Event)
  @JoinColumn({ name: 'eventId' })
  event: Event;

  /** Sum of all base ticket prices before fees */
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  subtotal: number;

  /** Platform service fee (LPTicket's commission) */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  lpFee: number;

  /** Cost passed through from Stripe for credit card processing */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  processingFee: number;

  /** Final amount charged to the user's card */
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total: number;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  status: OrderStatus;

  /** Reference for the Stripe Checkout session */
  @Column({ nullable: true, length: 150 })
  stripeSessionId: string;

  /** Reference for the finalized Stripe Payment Intent */
  @Column({ nullable: true, length: 150 })
  stripePaymentIntent: string;

  @Column({ type: 'int', default: 1 })
  ticketCount: number;

  /** 
   * JSON-stringified representation of the specific seats purchased.
   * Provides a redundant snapshot of seat data at the time of purchase.
   */
  @Column({ type: 'text', nullable: true })
  seatsData: string;

  @Column({ nullable: true, length: 40 })
  specialCode: string | null;

  @Column({ type: 'uuid', nullable: true })
  specialCodeOwnerId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'specialCodeOwnerId' })
  specialCodeOwner: User | null;

  @Column({ type: 'uuid', nullable: true })
  specialCodeId: string | null;

  @ManyToOne(() => SpecialCode, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'specialCodeId' })
  specialCodeEntity: SpecialCode | null;

  @Column({ type: 'timestamp', nullable: true })
  paidAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
