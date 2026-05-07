import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from './user.entity';

export enum PaymentMethodType {
  CREDIT_CARD = 'credit_card',
  BANK_ACCOUNT = 'bank_account',
}

@Entity('payment_methods')
export class PaymentMethod {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'enum', enum: PaymentMethodType })
  type: PaymentMethodType;

  @Column({ length: 4 })
  last4: string;

  @Column({ length: 50, nullable: true })
  brand: string; // e.g. Visa, MasterCard, Bank Name

  @Column({ length: 255 })
  providerId: string; // Stripe payment method id or similar

  @Column({ default: false })
  isDefault: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
