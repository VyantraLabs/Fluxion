import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  BeforeInsert,
} from 'typeorm';
import { ulid } from 'ulid';

export type SettingCategory = 'system' | 'security' | 'limits' | 'notifications' | 'integrations' | 'general';

@Entity('system_settings')
@Index(['key'], { unique: true })
@Index(['category'])
@Index(['isPublic'])
export class SystemSettings {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Column({ type: 'varchar', length: 255, nullable: false, unique: true })
  key!: string;

  @Column({ type: 'jsonb', nullable: false })
  value!: any;

  @Column({ type: 'varchar', length: 100, default: 'general' })
  category!: SettingCategory;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'is_public', type: 'boolean', default: false })
  isPublic!: boolean;

  @Column({ name: 'is_encrypted', type: 'boolean', default: false })
  isEncrypted!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @Column({ name: 'updated_by', type: 'varchar', length: 255, nullable: true })
  updatedBy?: string;

  // Computed properties
  get displayName(): string {
    return this.key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  get isSystemCritical(): boolean {
    const criticalKeys = [
      'maintenance_mode',
      'database_url',
      'jwt_secret',
      'encryption_key',
      'admin_api_key'
    ];
    return criticalKeys.includes(this.key);
  }

  get typedValue(): any {
    if (typeof this.value === 'string') {
      // Try to parse JSON strings
      try {
        return JSON.parse(this.value);
      } catch {
        // Handle special string values
        if (this.value === 'true') return true;
        if (this.value === 'false') return false;
        if (!isNaN(Number(this.value))) return Number(this.value);
        return this.value;
      }
    }
    return this.value;
  }

  // Methods
  toJSON() {
    const { isEncrypted, value, ...rest } = this;
    return {
      ...rest,
      value: isEncrypted ? '[ENCRYPTED]' : this.typedValue,
      displayName: this.displayName,
      isSystemCritical: this.isSystemCritical,
    };
  }

  setValue(newValue: any, updatedBy?: string): void {
    this.value = newValue;
    this.updatedBy = updatedBy;
  }

  getBooleanValue(): boolean {
    const val = this.typedValue;
    if (typeof val === 'boolean') return val;
    if (typeof val === 'string') return val.toLowerCase() === 'true';
    if (typeof val === 'number') return val !== 0;
    return false;
  }

  getNumberValue(defaultValue: number = 0): number {
    const val = this.typedValue;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const parsed = parseInt(val, 10);
      return isNaN(parsed) ? defaultValue : parsed;
    }
    return defaultValue;
  }

  getStringValue(defaultValue: string = ''): string {
    const val = this.typedValue;
    return typeof val === 'string' ? val : String(val || defaultValue);
  }

  getArrayValue<T = any>(defaultValue: T[] = []): T[] {
    const val = this.typedValue;
    return Array.isArray(val) ? val : defaultValue;
  }

  getObjectValue<T = any>(defaultValue: T = {} as T): T {
    const val = this.typedValue;
    return typeof val === 'object' && val !== null && !Array.isArray(val) ? val : defaultValue;
  }

  // Static factory methods
  static create(
    key: string,
    value: any,
    category: SettingCategory = 'general',
    options: {
      description?: string;
      isPublic?: boolean;
      isEncrypted?: boolean;
      updatedBy?: string;
    } = {}
  ): Partial<SystemSettings> {
    return {
      key,
      value,
      category,
      description: options.description,
      isPublic: options.isPublic ?? false,
      isEncrypted: options.isEncrypted ?? false,
      updatedBy: options.updatedBy,
    };
  }

  static createMaintenanceMode(enabled: boolean, updatedBy?: string): Partial<SystemSettings> {
    return this.create(
      'maintenance_mode',
      enabled,
      'system',
      {
        description: 'Enable/disable system maintenance mode',
        isPublic: false,
        updatedBy,
      }
    );
  }

  static createRateLimit(requestsPerMinute: number, updatedBy?: string): Partial<SystemSettings> {
    return this.create(
      'rate_limit_requests_per_minute',
      requestsPerMinute,
      'security',
      {
        description: 'API rate limit per IP per minute',
        isPublic: false,
        updatedBy,
      }
    );
  }

  // Static validation methods
  static validateKey(key: string): boolean {
    const keyPattern = /^[a-z0-9_]+$/;
    return keyPattern.test(key) && key.length <= 255;
  }

  static validateCategory(category: string): category is SettingCategory {
    return ['system', 'security', 'limits', 'notifications', 'integrations', 'general'].includes(category);
  }

  // Static query helpers
  static getByKeyQuery(key: string) {
    return { where: { key } };
  }

  static getByCategoryQuery(category: SettingCategory) {
    return { where: { category } };
  }

  static getPublicSettingsQuery() {
    return { where: { isPublic: true } };
  }

  static getCriticalSettingsQuery() {
    const criticalKeys = [
      'maintenance_mode',
      'database_url',
      'jwt_secret',
      'encryption_key',
      'admin_api_key'
    ];
    return { where: { key: { $in: criticalKeys } } };
  }

  @BeforeInsert()
  generateId(): void {
    if (!this.id) {
      this.id = ulid();
    }
  }
}