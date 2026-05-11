import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Exclude } from 'class-transformer';

export enum UserRole {
  CLIENT = 'client',
  ADMIN = 'admin',
}

export enum IdType {
  V = 'V',
  E = 'E',
  P = 'P',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 100 })
  email: string;

  @Column({ unique: true, length: 40 })
  username: string;

  @Column({ length: 255, nullable: true })
  @Exclude()
  passwordHash: string;

  @Column({ length: 40 })
  firstName: string;

  @Column({ length: 40 })
  lastName: string;

  @Column({ type: 'enum', enum: IdType, default: IdType.V })
  idType: IdType;

  @Column({ length: 20, nullable: true })
  idNumber: string;

  @Column({ nullable: true, length: 20, default: null })
  phone: string;

  @Column({ nullable: true, length: 50 })
  address: string;

  @Column({ nullable: true, length: 255 })
  avatarUrl: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.CLIENT,
  })
  role: UserRole;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
