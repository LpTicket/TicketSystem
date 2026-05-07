import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { join } from 'path';
import { User, Event, VenueSection, Seat, Order, Ticket, EventCategoryEntity, PaymentMethod } from './entities';

dotenv.config({ path: join(__dirname, '../../.env') });

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || '12345a',
  database: process.env.DB_NAME || 'ticketsystemdb',
  entities: [User, Event, VenueSection, Seat, Order, Ticket, EventCategoryEntity, PaymentMethod],
  synchronize: false,
  logging: false,
});
