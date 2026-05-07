import { AppDataSource } from './data-source';

async function migrate() {
  console.log('🔄 Connecting to database...');
  const ds = await AppDataSource.initialize();

  try {
    console.log('🔄 Step 1: Converting column to TEXT temporarily...');
    await ds.query(`ALTER TABLE users ALTER COLUMN role DROP DEFAULT;`);
    await ds.query(`ALTER TABLE users ALTER COLUMN role TYPE TEXT;`);
    console.log('✅ Column changed to TEXT');


    console.log('🔄 Step 2: Updating existing role values...');
    await ds.query(`
      UPDATE users
      SET role = 'client'
      WHERE role IN ('buyer', 'organizer');
    `);
    console.log('✅ Rows updated: buyer/organizer → client');

    console.log('🔄 Step 3: Cleaning up old enum and creating new one...');
    await ds.query(`DROP TYPE IF EXISTS users_role_enum;`);
    await ds.query(`CREATE TYPE users_role_enum AS ENUM ('client', 'admin');`);
    console.log('✅ New enum created: (client, admin)');

    console.log('🔄 Step 4: Converting column back to enum...');
    await ds.query(`
      ALTER TABLE users
        ALTER COLUMN role TYPE users_role_enum
        USING role::users_role_enum;
    `);
    await ds.query(`ALTER TABLE users ALTER COLUMN role SET DEFAULT 'client';`);
    console.log('✅ Column converted back to enum with default "client"');

    console.log('\n🎉 Migration completed successfully!');

  } catch (err) {
    console.error('❌ Migration failed:', err);
  } finally {
    await ds.destroy();
  }
}

migrate();
