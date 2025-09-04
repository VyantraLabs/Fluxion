const { DataSource } = require('typeorm');
require('dotenv').config();

const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || (isDevelopment ? 'localhost' : 'postgres'),
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || (isDevelopment ? 'postgres' : 'fluxion_app'),
  password: process.env.DB_PASSWORD || (isDevelopment ? 'password' : 'password'),
  database: process.env.DB_DATABASE || (isDevelopment ? 'fluxion_dev' : 'fluxion_prod'),
  ssl: process.env.DB_SSL === 'true' || false,
  
  entities: ['dist/database/entities/*.js'],
  migrations: ['dist/database/migrations/*.js'],
  migrationsTableName: 'fluxion_migrations',
  
  synchronize: false,
  logging: process.env.DB_LOGGING === 'true' || isDevelopment,
});

async function runMigrations() {
  try {
    console.log('Initializing database connection...');
    await dataSource.initialize();
    console.log('Running migrations...');
    await dataSource.runMigrations();
    console.log('Migrations completed successfully');
    await dataSource.destroy();
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();