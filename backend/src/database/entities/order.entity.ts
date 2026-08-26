import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { Event } from './event.entity';

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
@Index(['stripeSessionId'])
@Index(['eventId'])
@Index(['status'])
@Index(['eventId', 'status'])
@Index(['userId'])
@Index(['specialCodeId'])
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

  /** Payment method that actually completed the Stripe payment (card, klarna, etc.). */
  @Column({ type: 'varchar', nullable: true, length: 40 })
  paymentMethodType: string | null;

  /** Actual Stripe processing fee, populated from the Charge balance transaction. */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  actualStripeFee: number | null;

  /** Standard 2.9% + $0.30 card cost used as the comparison baseline. */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  standardCardFee: number | null;

  /** Klarna-only cost above the standard card baseline, charged to the organizer. */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  organizerProcessingAdjustment: number;

  /** not_required, pending, reconciled, or failed. Historical orders remain not_required. */
  @Column({ type: 'varchar', length: 20, default: 'not_required' })
  stripeFeeReconciliationStatus: string;

  @Column({ type: 'timestamp', nullable: true })
  stripeFeeReconciledAt: Date | null;

  @Column({ type: 'varchar', nullable: true, length: 150 })
  stripeChargeId: string | null;

  @Column({ type: 'varchar', nullable: true, length: 150 })
  stripeBalanceTransactionId: string | null;

  @Column({ type: 'int', default: 1 })
  ticketCount: number;

  /** 
   * JSON-stringified representation of the specific seats purchased.
   * Provides a redundant snapshot of seat data at the time of purchase.
   */
  @Column({ type: 'text', nullable: true })
  seatsData: string;

  @Column({ type: 'timestamp', nullable: true })
  paidAt: Date | null;

  /**
   * Minimal audit trail for customer-requested ticket delivery after a door sale.
   * Recipients are masked so the operational log does not duplicate full PII.
   */
  @Column({ type: 'text', nullable: true })
  ticketDeliveryLog: string | null;

  /** Identifies the checkout flow that originated the order. */
  @Column({ type: 'varchar', length: 40, default: 'online' })
  salesChannel: string;

  /** Special influencer/referral code used at checkout */
  @Column({ type: 'varchar', nullable: true, length: 40 })
  specialCode: string | null;

  /** ID of the SpecialCode record used */
  @Column({ type: 'uuid', nullable: true })
  specialCodeId: string | null;

  /** ID of the user who owns the special code */
  @Column({ type: 'uuid', nullable: true })
  specialCodeOwnerId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
