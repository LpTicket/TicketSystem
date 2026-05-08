import { AppDataSource } from './data-source';

async function fixDb() {
  try {
    console.log('Connecting to DB to fix column sizes...');
    // Initialize without synchronize to avoid the error
    AppDataSource.setOptions({ synchronize: false });
    await AppDataSource.initialize();

    console.log('Fixing users table...');
    await AppDataSource.query('ALTER TABLE "users" ALTER COLUMN "email" TYPE varchar(100)');
    await AppDataSource.query('ALTER TABLE "users" ALTER COLUMN "username" TYPE varchar(40)');
    await AppDataSource.query('ALTER TABLE "users" ALTER COLUMN "firstName" TYPE varchar(40)');
    await AppDataSource.query('ALTER TABLE "users" ALTER COLUMN "lastName" TYPE varchar(40)');
    await AppDataSource.query('ALTER TABLE "users" ALTER COLUMN "address" TYPE varchar(50)');
    await AppDataSource.query('ALTER TABLE "users" ALTER COLUMN "avatarUrl" TYPE varchar(255)');

    console.log('Fixing events table...');
    await AppDataSource.query('ALTER TABLE "events" ALTER COLUMN "title" TYPE varchar(100)');
    await AppDataSource.query('ALTER TABLE "events" ALTER COLUMN "slug" TYPE varchar(100)');
    await AppDataSource.query('ALTER TABLE "events" ALTER COLUMN "category" TYPE varchar(40)');
    await AppDataSource.query('ALTER TABLE "events" ALTER COLUMN "venueName" TYPE varchar(60)');
    await AppDataSource.query('ALTER TABLE "events" ALTER COLUMN "venueAddress" TYPE varchar(100)');
    await AppDataSource.query('ALTER TABLE "events" ALTER COLUMN "imageUrl" TYPE varchar(255)');
    await AppDataSource.query('ALTER TABLE "events" ALTER COLUMN "bannerImageUrl" TYPE varchar(255)');

    console.log('Fixing event_categories table...');
    await AppDataSource.query('ALTER TABLE "event_categories" ALTER COLUMN "slug" TYPE varchar(40)');
    await AppDataSource.query('ALTER TABLE "event_categories" ALTER COLUMN "labelEs" TYPE varchar(40)');
    await AppDataSource.query('ALTER TABLE "event_categories" ALTER COLUMN "labelEn" TYPE varchar(40)');

    console.log('Fixing tickets table...');
    await AppDataSource.query('ALTER TABLE "tickets" ALTER COLUMN "sectionName" TYPE varchar(40)');

    console.log('Fixing venue_sections table...');
    await AppDataSource.query('ALTER TABLE "venue_sections" ALTER COLUMN "name" TYPE varchar(40)');

    console.log('Fixing orders table...');
    await AppDataSource.query('ALTER TABLE "orders" ALTER COLUMN "stripeSessionId" TYPE varchar(150)');
    await AppDataSource.query('ALTER TABLE "orders" ALTER COLUMN "stripePaymentIntent" TYPE varchar(150)');

    console.log('All columns updated successfully! Now synchronize will work properly.');
    process.exit(0);
  } catch (error) {
    console.error('Error fixing DB:', error);
    process.exit(1);
  }
}

fixDb();
