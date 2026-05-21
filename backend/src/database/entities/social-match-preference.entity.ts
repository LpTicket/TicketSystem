import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { Event } from './event.entity';

@Entity('social_match_preferences')
@Index(['userId', 'eventId'], { unique: true })
export class SocialMatchPreference {
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

  @Column({ default: false })
  enabled: boolean;

  @Column('simple-array', { nullable: true })
  interests: string[];

  @Column({ default: false })
  invisibleMode: boolean;

  @Column({ default: false })
  shareLocation: boolean;

  @Column({ nullable: true, length: 120 })
  instagram: string | null;

  @Column({ nullable: true, length: 120 })
  industry: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
