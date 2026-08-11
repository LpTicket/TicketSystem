import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Event } from './event.entity';
import { User } from './user.entity';

/**
 * Internal audit record for a payout made outside LPTicket to an event organizer.
 * This never creates a Stripe transfer or changes an order, payment, or ticket.
 */
@Entity('organizer_payouts')
export class OrganizerPayout {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  eventId: string;

  @ManyToOne(() => Event, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'eventId' })
  event: Event;

  /** Organizer who owned the event when this payment was recorded. */
  @Column('uuid')
  organizerUserId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'organizerUserId' })
  organizer: User;

  /** Administrator who recorded the external transfer. */
  @Column('uuid')
  recordedByUserId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'recordedByUserId' })
  recordedBy: User;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  /** Optional transfer reference, payment method, or internal note. */
  @Column({ type: 'varchar', nullable: true, length: 300 })
  note: string | null;

  @CreateDateColumn()
  paidAt: Date;
}
