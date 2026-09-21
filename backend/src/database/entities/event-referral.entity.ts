import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Event } from './event.entity';

@Entity('event_referrals')
@Index(['eventId', 'code'], { unique: true })
export class EventReferral {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  eventId: string;

  @ManyToOne(() => Event, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'eventId' })
  event: Event;

  @Column({ type: 'varchar', length: 40 })
  code: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
