import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  JoinColumn,
  Check,
  BeforeInsert,
} from 'typeorm';
import { ulid } from 'ulid';
import { Organization } from './Organization';
import { User } from './User';
import { BlockchainNetwork } from './BlockchainNetwork';
import { Token } from './Token';
import { Payment } from './Payment';
import { InvoiceTemplate } from './InvoiceTemplate';
import { InvoiceAccessToken } from './InvoiceAccessToken';
import { NotificationQueue } from './NotificationQueue';
import { PaymentVerificationJob } from './PaymentVerificationJob';

export type InvoiceStatus = 'draft' | 'created' | 'initiated' | 'sent' | 'paid' | 'overdue' | 'cancelled' | 'partial';

@Entity('invoices')
@Index(['invoiceNumber', 'organizationId'], { unique: true })
@Index(['organizationId'])
@Index(['createdBy'])
@Index(['chainId'])
@Index(['tokenId'])
@Index(['status'])
@Index(['dueDate'])
@Index(['clientEmail'])
@Check('amount_positive', 'amount > 0')
@Check('client_wallet_format', "client_wallet ~* '^0x[a-fA-F0-9]{40}$' OR client_wallet IS NULL")
@Check('status_valid', "status IN ('draft', 'created', 'initiated', 'sent', 'paid', 'overdue', 'cancelled', 'partial')")
export class Invoice {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Column({ name: 'organization_id', type: 'varchar', nullable: false })
  organizationId!: string;

  @Column({ name: 'created_by', type: 'varchar', nullable: false })
  createdBy!: string;

  @Column({ name: 'invoice_number', type: 'varchar', length: 50, nullable: false })
  invoiceNumber!: string;

  // Invoice details
  @Column({ type: 'varchar', length: 255, nullable: false })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate?: Date;

  // Client information
  @Column({ name: 'client_name', type: 'varchar', length: 255, nullable: true })
  clientName?: string;

  @Column({ name: 'client_email', type: 'varchar', length: 320, nullable: true })
  clientEmail?: string;

  @Column({ name: 'client_wallet', type: 'varchar', length: 42, nullable: true })
  clientWallet?: string;

  // Payment details
  @Column({ name: 'chain_id', type: 'integer', nullable: false })
  chainId!: number;

  @Column({ name: 'token_id', type: 'varchar', nullable: false })
  tokenId!: string;

  @Column({ type: 'decimal', precision: 36, scale: 18, nullable: false })
  amount!: string;

  @Column({ name: 'amount_paid', type: 'decimal', precision: 36, scale: 18, default: '0' })
  amountPaid!: string;

  // Template reference
  @Column({ name: 'template_id', type: 'varchar', nullable: true })
  templateId?: string;

  // Status and metadata
  @Column({
    type: 'varchar',
    length: 20,
    default: 'draft',
    nullable: false,
  })
  status!: InvoiceStatus;

  @Column({ type: 'jsonb', default: {}, nullable: false })
  metadata!: {
    currency?: string;
    exchangeRate?: string;
    taxRate?: number;
    taxAmount?: string;
    notes?: string;
    attachments?: string[];
    remindersSent?: number;
    customFields?: Record<string, any>;
    cancellationReason?: string;
    // Template-related data
    templateData?: Record<string, any>;
    branding?: {
      logo?: string;
      primaryColor?: string;
      companyName?: string;
      companyAddress?: string;
      companyPhone?: string;
      companyEmail?: string;
    };
    paymentInstructions?: string;
    terms?: string;
    footer?: string;
    // Client access and notifications
    clientAccessToken?: string;
    notificationPreferences?: {
      sendReminders?: boolean;
      reminderIntervals?: number[];
    };
  };

  // Client settings and access control
  @Column({ name: 'client_settings', type: 'jsonb', default: {}, nullable: false })
  clientSettings!: {
    accessTokenEnabled?: boolean;
    notificationsEnabled?: boolean;
    lastNotificationSent?: string;
    remindersSent?: number;
    viewCount?: number;
    lastViewedAt?: string;
    allowPartialPayments?: boolean;
    requireClientEmail?: boolean;
    customMessage?: string;
  };

  // QR Code and mobile payment
  @Column({ name: 'qr_code_data', type: 'text', nullable: true })
  qrCodeData?: string;

  @Column({ name: 'mobile_payment_url', type: 'text', nullable: true })
  mobilePaymentUrl?: string;

  // Timestamps
  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt?: Date;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt?: Date;

  // Relations
  @ManyToOne(() => Organization, organization => organization.invoices, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

  @ManyToOne(() => User, user => user.invoices, {
    nullable: false,
  })
  @JoinColumn({ name: 'created_by' })
  createdByUser!: User;

  @ManyToOne(() => BlockchainNetwork, network => network.invoices, {
    nullable: false,
  })
  @JoinColumn({ name: 'chain_id' })
  network!: BlockchainNetwork;

  @ManyToOne(() => Token, token => token.invoices, {
    nullable: false,
  })
  @JoinColumn({ name: 'token_id' })
  token!: Token;

  @OneToMany(() => Payment, payment => payment.invoice, { cascade: true })
  payments!: Payment[];

  // New relations
  @ManyToOne(() => InvoiceTemplate, template => template.invoices, { nullable: true })
  @JoinColumn({ name: 'template_id' })
  template?: InvoiceTemplate;

  @OneToMany(() => InvoiceAccessToken, token => token.invoice, { cascade: true })
  accessTokens!: InvoiceAccessToken[];

  @OneToMany(() => NotificationQueue, notification => notification.invoiceId)
  notifications!: NotificationQueue[];

  @OneToMany(() => PaymentVerificationJob, job => job.invoice, { cascade: true })
  verificationJobs!: PaymentVerificationJob[];

  // Computed properties
  get displayAmount(): string {
    return this.token?.formatAmountWithSymbol(this.amount) || this.amount;
  }

  get displayAmountPaid(): string {
    return this.token?.formatAmountWithSymbol(this.amountPaid) || this.amountPaid;
  }

  get remainingAmount(): string {
    const remaining = (parseFloat(this.amount) - parseFloat(this.amountPaid)).toString();
    return remaining;
  }

  get displayRemainingAmount(): string {
    return this.token?.formatAmountWithSymbol(this.remainingAmount) || this.remainingAmount;
  }

  get isOverdue(): boolean {
    if (!this.dueDate || this.status === 'paid' || this.status === 'cancelled') {
      return false;
    }
    const dueDate = this.dueDate instanceof Date ? this.dueDate : new Date(this.dueDate);
    return new Date() > dueDate;
  }

  get isPaid(): boolean {
    return this.status === 'paid' || parseFloat(this.amountPaid) >= parseFloat(this.amount);
  }

  get isPartiallyPaid(): boolean {
    return parseFloat(this.amountPaid) > 0 && parseFloat(this.amountPaid) < parseFloat(this.amount);
  }

  get paymentProgress(): number {
    return Math.min((parseFloat(this.amountPaid) / parseFloat(this.amount)) * 100, 100);
  }

  get daysUntilDue(): number | null {
    if (!this.dueDate) return null;
    const today = new Date();
    const dueDate = this.dueDate instanceof Date ? this.dueDate : new Date(this.dueDate);
    const timeDiff = dueDate.getTime() - today.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
  }

  get clientDisplayName(): string {
    return this.clientName || this.clientEmail || this.clientWallet || 'Unknown Client';
  }

  get hasTemplate(): boolean {
    return !!this.templateId;
  }

  get hasAccessTokens(): boolean {
    return this.accessTokens?.length > 0;
  }

  get activeAccessTokens(): InvoiceAccessToken[] {
    return this.accessTokens?.filter(token => token.isValid) || [];
  }

  get hasActiveAccessToken(): boolean {
    return this.activeAccessTokens.length > 0;
  }

  get pendingVerificationJobs(): PaymentVerificationJob[] {
    return this.verificationJobs?.filter(job => job.isPending) || [];
  }

  get completedVerificationJobs(): PaymentVerificationJob[] {
    return this.verificationJobs?.filter(job => job.isCompleted) || [];
  }

  get hasQRCode(): boolean {
    return !!this.qrCodeData;
  }

  get allowsPartialPayments(): boolean {
    return this.clientSettings?.allowPartialPayments ?? true;
  }

  get requiresClientEmail(): boolean {
    return this.clientSettings?.requireClientEmail ?? false;
  }

  get notificationsEnabled(): boolean {
    return this.clientSettings?.notificationsEnabled ?? true;
  }

  get viewCount(): number {
    return this.clientSettings?.viewCount || 0;
  }

  get remindersSent(): number {
    return this.clientSettings?.remindersSent || 0;
  }

  // Methods
  toJSON() {
    const { deletedAt, ...rest } = this;
    return {
      ...rest,
      displayAmount: this.displayAmount,
      displayAmountPaid: this.displayAmountPaid,
      remainingAmount: this.remainingAmount,
      displayRemainingAmount: this.displayRemainingAmount,
      isOverdue: this.isOverdue,
      isPaid: this.isPaid,
      isPartiallyPaid: this.isPartiallyPaid,
      paymentProgress: this.paymentProgress,
      daysUntilDue: this.daysUntilDue,
      clientDisplayName: this.clientDisplayName,
      // New computed properties
      hasTemplate: this.hasTemplate,
      hasAccessTokens: this.hasAccessTokens,
      hasActiveAccessToken: this.hasActiveAccessToken,
      hasQRCode: this.hasQRCode,
      allowsPartialPayments: this.allowsPartialPayments,
      requiresClientEmail: this.requiresClientEmail,
      notificationsEnabled: this.notificationsEnabled,
      viewCount: this.viewCount,
      remindersSent: this.remindersSent,
      // Relations counts
      accessTokensCount: this.accessTokens?.length || 0,
      activeAccessTokensCount: this.activeAccessTokens.length,
      verificationJobsCount: this.verificationJobs?.length || 0,
      pendingVerificationJobsCount: this.pendingVerificationJobs.length,
    };
  }

  addPayment(paymentAmount: string): void {
    const currentPaid = parseFloat(this.amountPaid);
    const newPayment = parseFloat(paymentAmount);
    const totalAmount = parseFloat(this.amount);
    
    this.amountPaid = (currentPaid + newPayment).toString();
    
    if (currentPaid + newPayment >= totalAmount) {
      this.status = 'paid';
      this.paidAt = new Date();
    } else if (currentPaid + newPayment > 0) {
      this.status = 'partial';
    }
  }

  markAsSent(): void {
    if (this.status === 'draft') {
      this.status = 'sent';
      this.sentAt = new Date();
    }
  }

  markAsOverdue(): void {
    if (this.status === 'sent' || this.status === 'partial') {
      this.status = 'overdue';
    }
  }

  cancel(reason?: string): void {
    this.status = 'cancelled';
    if (reason) {
      this.metadata = { ...this.metadata, cancellationReason: reason }!;
    }
  }

  // New methods for enhanced functionality
  recordView(): void {
    this.clientSettings = {
      ...this.clientSettings,
      viewCount: (this.clientSettings?.viewCount || 0) + 1,
      lastViewedAt: new Date().toISOString(),
    };
  }

  incrementRemindersSent(): void {
    this.clientSettings = {
      ...this.clientSettings,
      remindersSent: (this.clientSettings?.remindersSent || 0) + 1,
      lastNotificationSent: new Date().toISOString(),
    };
  }

  setQRCodeData(qrData: string): void {
    this.qrCodeData = qrData;
  }

  setMobilePaymentUrl(url: string): void {
    this.mobilePaymentUrl = url;
  }

  enableClientAccess(): void {
    this.clientSettings = {
      ...this.clientSettings,
      accessTokenEnabled: true,
    };
  }

  disableClientAccess(): void {
    this.clientSettings = {
      ...this.clientSettings,
      accessTokenEnabled: false,
    };
  }

  setCustomMessage(message: string): void {
    this.clientSettings = {
      ...this.clientSettings,
      customMessage: message,
    };
  }

  applyTemplateData(template: InvoiceTemplate): void {
    this.templateId = template.id;
    
    // Apply template defaults
    if (template.defaultTitle && !this.title) {
      this.title = template.defaultTitle;
    }
    if (template.defaultDescription && !this.description) {
      this.description = template.defaultDescription;
    }
    if (template.defaultChainId && !this.chainId) {
      this.chainId = template.defaultChainId;
    }
    if (template.defaultTokenId && !this.tokenId) {
      this.tokenId = template.defaultTokenId;
    }

    // Apply template configuration
    this.metadata = {
      ...this.metadata,
      templateData: template.configuration.customFields || {},
      branding: template.configuration.branding,
      paymentInstructions: template.configuration.paymentInstructions,
      terms: template.configuration.terms,
    };

    this.clientSettings = {
      ...this.clientSettings,
      allowPartialPayments: template.configuration.allowPartialPayments ?? true,
      requireClientEmail: template.configuration.requireClientEmail ?? false,
      notificationsEnabled: template.configuration.autoReminders ?? true,
    };

    if (template.configuration.autoReminders && template.configuration.reminderIntervals) {
      this.metadata = {
        ...this.metadata,
        notificationPreferences: {
          sendReminders: true,
          reminderIntervals: template.configuration.reminderIntervals,
        },
      };
    }

    // Increment template usage
    template.incrementUsage();
  }

  // Static methods
  static generateInvoiceNumber(organizationSlug: string, sequence: number): string {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const seq = String(sequence).padStart(4, '0');
    return `${organizationSlug.toUpperCase()}-${year}${month}-${seq}`;
  }

  static validateInvoiceNumber(invoiceNumber: string): boolean {
    return /^[A-Z0-9-]+$/.test(invoiceNumber);
  }

  static validateAmount(amount: string): boolean {
    const num = parseFloat(amount);
    return !isNaN(num) && num > 0;
  }

  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static validateWalletAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  static validateStatus(status: string): status is InvoiceStatus {
    return ['draft', 'sent', 'paid', 'overdue', 'cancelled', 'partial'].includes(status);
  }

  @BeforeInsert()
  generateId(): void {
    if (!this.id) {
      this.id = ulid();
    }
  }
}