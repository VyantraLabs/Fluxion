const { AppDataSource } = require('./dist/database/data-source');

async function checkOrganizations() {
  try {
    await AppDataSource.initialize();
    const queryRunner = AppDataSource.createQueryRunner();
    
    const orgs = await queryRunner.query('SELECT id, name, slug FROM organizations');
    console.log('Existing organizations:');
    console.table(orgs);
    
    await queryRunner.release();
    await AppDataSource.destroy();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkOrganizations();