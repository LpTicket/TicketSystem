import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { VenueSection } from './venue-section.entity';

export enum SeatStatus {
  AVAILABLE = 'available',
  LOCKED = 'locked',
  SOLD = 'sold',
}

@Entity('seats')
export class Seat {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  sectionId: string;

  @ManyToOne(() => VenueSection, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sectionId' })
  section: VenueSection;

  @Column({ length: 10 })
  rowLabel: string;

  @Column({ type: 'int' })
  seatNumber: number;

  @Column({
    type: 'enum',
    enum: SeatStatus,
    default: SeatStatus.AVAILABLE,
  })
  status: SeatStatus;

  @Column({ type: 'uuid', nullable: true })
  lockedBy: string;

  @Column({ type: 'timestamp', nullable: true })
  lockExpiresAt: Date | null;
}
