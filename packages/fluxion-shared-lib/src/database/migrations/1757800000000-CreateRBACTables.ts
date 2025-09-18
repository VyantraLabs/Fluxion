import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateRBACTables1757800000000 implements MigrationInterface {
  name = 'CreateRBACTables1757800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create roles table
    await queryRunner.createTable(
      new Table({
        name: 'roles',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            isPrimary: true,
          },
          {
            name: 'key',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'name',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'type',
            type: 'enum',
            enum: ['system', 'organization'],
            isNullable: false,
          },
          {
            name: 'is_system_role',
            type: 'boolean',
            default: false,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
          },
          {
            name: 'priority',
            type: 'integer',
            default: 0,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'deleted_at',
            type: 'timestamptz',
            isNullable: true,
          },
        ],
      }),
      true
    );

    // Create permissions table
    await queryRunner.createTable(
      new Table({
        name: 'permissions',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            isPrimary: true,
          },
          {
            name: 'key',
            type: 'varchar',
            length: '100',
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'name',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'category',
            type: 'enum',
            enum: ['invoice', 'payment', 'user', 'organization', 'reports', 'system'],
            isNullable: false,
          },
          {
            name: 'is_system_permission',
            type: 'boolean',
            default: false,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'deleted_at',
            type: 'timestamptz',
            isNullable: true,
          },
        ],
      }),
      true
    );

    // Create user_roles table
    await queryRunner.createTable(
      new Table({
        name: 'user_roles',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            isPrimary: true,
          },
          {
            name: 'user_id',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'role_id',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'organization_id',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'granted_by',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'granted_at',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'expires_at',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'deleted_at',
            type: 'timestamptz',
            isNullable: true,
          },
        ],
      }),
      true
    );

    // Create role_permissions table
    await queryRunner.createTable(
      new Table({
        name: 'role_permissions',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            isPrimary: true,
          },
          {
            name: 'role_id',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'permission_id',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'granted_by',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'granted_at',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'deleted_at',
            type: 'timestamptz',
            isNullable: true,
          },
        ],
      }),
      true
    );

    // Create indexes
    await queryRunner.createIndex('roles', new TableIndex({ name: 'IDX_roles_key_type', columnNames: ['key', 'type'], isUnique: true }));
    await queryRunner.createIndex('roles', new TableIndex({ name: 'IDX_roles_type', columnNames: ['type'] }));
    
    await queryRunner.createIndex('permissions', new TableIndex({ name: 'IDX_permissions_key', columnNames: ['key'], isUnique: true }));
    await queryRunner.createIndex('permissions', new TableIndex({ name: 'IDX_permissions_category', columnNames: ['category'] }));
    
    await queryRunner.createIndex('user_roles', new TableIndex({ name: 'IDX_user_roles_user_role', columnNames: ['user_id', 'role_id'], isUnique: true }));
    await queryRunner.createIndex('user_roles', new TableIndex({ name: 'IDX_user_roles_user_id', columnNames: ['user_id'] }));
    await queryRunner.createIndex('user_roles', new TableIndex({ name: 'IDX_user_roles_role_id', columnNames: ['role_id'] }));
    await queryRunner.createIndex('user_roles', new TableIndex({ name: 'IDX_user_roles_organization_id', columnNames: ['organization_id'] }));
    
    await queryRunner.createIndex('role_permissions', new TableIndex({ name: 'IDX_role_permissions_role_permission', columnNames: ['role_id', 'permission_id'], isUnique: true }));
    await queryRunner.createIndex('role_permissions', new TableIndex({ name: 'IDX_role_permissions_role_id', columnNames: ['role_id'] }));
    await queryRunner.createIndex('role_permissions', new TableIndex({ name: 'IDX_role_permissions_permission_id', columnNames: ['permission_id'] }));

    // Create foreign key constraints
    await queryRunner.createForeignKey(
      'user_roles',
      new TableForeignKey({
        name: 'FK_user_roles_user_id',
        columnNames: ['user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      })
    );

    await queryRunner.createForeignKey(
      'user_roles',
      new TableForeignKey({
        name: 'FK_user_roles_role_id',
        columnNames: ['role_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'roles',
        onDelete: 'CASCADE',
      })
    );

    await queryRunner.createForeignKey(
      'user_roles',
      new TableForeignKey({
        name: 'FK_user_roles_organization_id',
        columnNames: ['organization_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'organizations',
        onDelete: 'CASCADE',
      })
    );

    await queryRunner.createForeignKey(
      'user_roles',
      new TableForeignKey({
        name: 'FK_user_roles_granted_by',
        columnNames: ['granted_by'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      })
    );

    await queryRunner.createForeignKey(
      'role_permissions',
      new TableForeignKey({
        name: 'FK_role_permissions_role_id',
        columnNames: ['role_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'roles',
        onDelete: 'CASCADE',
      })
    );

    await queryRunner.createForeignKey(
      'role_permissions',
      new TableForeignKey({
        name: 'FK_role_permissions_permission_id',
        columnNames: ['permission_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'permissions',
        onDelete: 'CASCADE',
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraints
    const userRolesTable = await queryRunner.getTable('user_roles');
    if (userRolesTable) {
      const foreignKeys = userRolesTable.foreignKeys;
      for (const foreignKey of foreignKeys) {
        await queryRunner.dropForeignKey('user_roles', foreignKey);
      }
    }

    const rolePermissionsTable = await queryRunner.getTable('role_permissions');
    if (rolePermissionsTable) {
      const foreignKeys = rolePermissionsTable.foreignKeys;
      for (const foreignKey of foreignKeys) {
        await queryRunner.dropForeignKey('role_permissions', foreignKey);
      }
    }

    // Drop tables
    await queryRunner.dropTable('role_permissions', true);
    await queryRunner.dropTable('user_roles', true);
    await queryRunner.dropTable('permissions', true);
    await queryRunner.dropTable('roles', true);
  }
}