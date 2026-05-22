import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Event } from './event.entity';

@Entity('special_codes')
export class SpecialCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 40 })
  code: string;

  @Column('uuid')
  ownerUserId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'ownerUserId' })
  owner: User;

  @Column({ type: 'uuid', nullable: true })
  eventId: string | null;

  @ManyToOne(() => Event, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'eventId' })
  event: Event | null;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
