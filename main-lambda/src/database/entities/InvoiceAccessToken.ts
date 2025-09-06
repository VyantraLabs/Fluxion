import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  JoinColumn,
  Check,
  BeforeInsert,
} from 'typeorm';
import { ulid } from 'ulid';
import { Invoice } from './Invoice';

@Entity('invoice_access_tokens')
@Index(['invoiceId'])
@Index(['token'], { unique: true })
@Index(['expiresAt'])
@Index(['invoiceId', 'token'])
@Check('token_length', 'LENGTH(token) = 64')
@Check('access_count_positive', 'access_count >= 0')
@Check('expires_at_future', 'expires_at > created_at')
export class InvoiceAccessToken {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Column({ name: 'invoice_id', type: 'varchar', nullable: false })
  invoiceId!: string;

  @Column({ type: 'varchar', length: 64, unique: true, nullable: false })
  token!: string;

  @Column({ name: 'client_email', type: 'varchar', length: 320, nullable: true })
  clientEmail?: string;

  @Column({ name: 'client_name', type: 'varchar', length: 255, nullable: true })
  clientName?: string;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: false })
  expiresAt!: Date;

  @Column({ name: 'last_accessed_at', type: 'timestamptz', nullable: true })
  lastAccessedAt?: Date;

  @Column({ name: 'last_accessed_ip', type: 'varchar', length: 45, nullable: true })
  lastAccessedIp?: string;

  @Column({ name: 'access_count', type: 'integer', default: 0 })
  accessCount!: number;

  @Column({ name: 'max_access_count', type: 'integer', default: 100 })
  maxAccessCount!: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'created_by', type: 'varchar', length: 255, nullable: true })
  createdBy?: string; // User who created the token

  @Column({ type: 'jsonb', default: {}, nullable: false })
  metadata!: {
    userAgent?: string;
    referrer?: string;
    accessLog?: Array<{
      timestamp: string;
      ip: string;
      userAgent?: string;
    }>;
    permissions?: {
      canDownload?: boolean;
      canPay?: boolean;
      canViewHistory?: boolean;
    };
    customMessage?: string;
  };

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  // Relations
  @ManyToOne(() => Invoice, invoice => invoice.accessTokens, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'invoice_id' })
  invoice!: Invoice;

  // Computed properties
  get isExpired(): boolean {
    return new Date() > this.expiresAt;
  }

  get isValid(): boolean {
    return this.isActive && 
           !this.isExpired && 
           this.accessCount < this.maxAccessCount;
  }

  get remainingAccesses(): number {
    return Math.max(0, this.maxAccessCount - this.accessCount);
  }

  get daysUntilExpiry(): number {
    const now = new Date();
    const timeDiff = this.expiresAt.getTime() - now.getTime();
    return Math.max(0, Math.ceil(timeDiff / (1000 * 3600 * 24)));
  }

  get hoursUntilExpiry(): number {
    const now = new Date();
    const timeDiff = this.expiresAt.getTime() - now.getTime();
    return Math.max(0, Math.ceil(timeDiff / (1000 * 3600)));
  }

  get accessUrl(): string {
    // This will be set by the service layer with the actual frontend URL
    return `/public/invoice/${this.token}`;
  }

  // Methods
  recordAccess(ip?: string, userAgent?: string): void {
    this.accessCount += 1;
    this.lastAccessedAt = new Date();
    
    if (ip) {
      this.lastAccessedIp = ip;
    }

    // Log the access
    if (!this.metadata.accessLog) {
      this.metadata.accessLog = [];
    }

    this.metadata.accessLog.push({
      timestamp: new Date().toISOString(),
      ip: ip || 'unknown',
      userAgent,
    });

    // Keep only last 50 access logs to prevent unbounded growth
    if (this.metadata.accessLog.length > 50) {
      this.metadata.accessLog = this.metadata.accessLog.slice(-50);
    }
  }

  deactivate(): void {
    this.isActive = false;
  }

  activate(): void {
    this.isActive = true;
  }

  extendExpiry(days: number): void {
    const newExpiryDate = new Date();
    newExpiryDate.setDate(newExpiryDate.getDate() + days);
    this.expiresAt = newExpiryDate;
  }

  setPermissions(permissions: {
    canDownload?: boolean;
    canPay?: boolean;
    canViewHistory?: boolean;
  }): void {
    this.metadata = {
      ...this.metadata,
      permissions: { ...this.metadata.permissions, ...permissions }
    };
  }

  setCustomMessage(message: string): void {
    this.metadata = {
      ...this.metadata,
      customMessage: message
    };
  }

  // Static methods
  static generateSecureToken(): string {
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('hex');
  }

  static createAccessToken(
    invoiceId: string,
    expiresInDays: number = 30,
    clientEmail?: string,
    clientName?: string,
    createdBy?: string
  ): Partial<InvoiceAccessToken> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    return {
      invoiceId,
      token: this.generateSecureToken(),
      clientEmail,
      clientName,
      expiresAt,
      createdBy,
      isActive: true,
      accessCount: 0,
      maxAccessCount: 100,
      metadata: {
        permissions: {
          canDownload: true,
          canPay: true,
          canViewHistory: false,
        }
      }
    };
  }

  static validateToken(token: string): boolean {
    return /^[a-f0-9]{64}$/.test(token);
  }

  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // JSON serialization
  toJSON() {
    return {
      id: this.id,
      invoiceId: this.invoiceId,
      token: this.token,
      clientEmail: this.clientEmail,
      clientName: this.clientName,
      expiresAt: this.expiresAt,
      lastAccessedAt: this.lastAccessedAt,
      accessCount: this.accessCount,
      maxAccessCount: this.maxAccessCount,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      // Computed properties
      isExpired: this.isExpired,
      isValid: this.isValid,
      remainingAccesses: this.remainingAccesses,
      daysUntilExpiry: this.daysUntilExpiry,
      hoursUntilExpiry: this.hoursUntilExpiry,
      accessUrl: this.accessUrl,
      metadata: {
        ...this.metadata,
        accessLog: undefined, // Don't expose full access log in JSON
        accessLogCount: this.metadata.accessLog?.length || 0,
      }
    };
  }

  // Minimal JSON for public use (hide sensitive data)
  toPublicJSON() {
    return {
      token: this.token,
      expiresAt: this.expiresAt,
      accessCount: this.accessCount,
      remainingAccesses: this.remainingAccesses,
      daysUntilExpiry: this.daysUntilExpiry,
      permissions: this.metadata.permissions,
      customMessage: this.metadata.customMessage,
    };
  }

  @BeforeInsert()
  generateId(): void {
    if (!this.id) {
      this.id = ulid();
    }
  }
}