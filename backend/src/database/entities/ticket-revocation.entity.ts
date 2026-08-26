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

export enum TicketRevocationSeatAction {
  RELEASE = 'release',
  BLOCK = 'block',
}

/** Immutable audit record for one organizer/admin ticket revocation operation. */
@Entity('ticket_revocations')
export class TicketRevocation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  eventId: string;

  @ManyToOne(() => Event, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'eventId' })
  event: Event;

  @Column('uuid')
  revokedByUserId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'revokedByUserId' })
  revokedBy: User;

  @Column({ type: 'varchar', length: 20 })
  seatAction: TicketRevocationSeatAction;

  @Column({ type: 'varchar', length: 500 })
  reason: string;

  @Column({ type: 'jsonb' })
  ticketIds: string[];

  @Column({ type: 'jsonb' })
  ticketCodes: string[];

  @Column({ type: 'jsonb' })
  seatIds: string[];

  @CreateDateColumn()
  revokedAt: Date;
}
