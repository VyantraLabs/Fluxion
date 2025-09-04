import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  JoinColumn,
  Check,
} from 'typeorm';
import { Organization } from './Organization';
import { User } from './User';
import { BlockchainNetwork } from './BlockchainNetwork';
import { Token } from './Token';
import { Payment } from './Payment';

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled' | 'partial';

@Entity('invoices')
@Index(['invoiceNumber', 'organizationId'], { unique: true })
@Index(['organizationId'])
@Index(['createdBy'])
@Index(['networkId'])
@Index(['tokenId'])
@Index(['status'])
@Index(['dueDate'])
@Index(['clientEmail'])
@Check('amount_positive', 'amount > 0')
@Check('client_wallet_format', "client_wallet ~* '^0x[a-fA-F0-9]{40}$' OR client_wallet IS NULL")
@Check('status_valid', "status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled', 'partial')")
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organization_id', type: 'uuid', nullable: false })
  organizationId!: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: false })
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
  @Column({ name: 'network_id', type: 'uuid', nullable: false })
  networkId!: string;

  @Column({ name: 'token_id', type: 'uuid', nullable: false })
  tokenId!: string;

  @Column({ type: 'decimal', precision: 36, scale: 18, nullable: false })
  amount!: string;

  @Column({ name: 'amount_paid', type: 'decimal', precision: 36, scale: 18, default: '0' })
  amountPaid!: string;

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
  };

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
  @JoinColumn({ name: 'network_id' })
  network!: BlockchainNetwork;

  @ManyToOne(() => Token, token => token.invoices, {
    nullable: false,
  })
  @JoinColumn({ name: 'token_id' })
  token!: Token;

  @OneToMany(() => Payment, payment => payment.invoice, { cascade: true })
  payments!: Payment[];

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
    return new Date() > this.dueDate;
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
    const timeDiff = this.dueDate.getTime() - today.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
  }

  get clientDisplayName(): string {
    return this.clientName || this.clientEmail || this.clientWallet || 'Unknown Client';
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
}