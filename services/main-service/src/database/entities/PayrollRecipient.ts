import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  JoinColumn,
  Check,
} from 'typeorm';
import { PayrollBatch } from './PayrollBatch';

export type PayrollRecipientStatus = 'pending' | 'sent' | 'failed';

@Entity('payroll_recipients')
@Index(['batchId'])
@Index(['walletAddress'])
@Index(['status'])
@Check('amount_positive', 'amount > 0')
@Check('wallet_format', "wallet_address ~* '^0x[a-fA-F0-9]{40}$'")
@Check('status_valid', "status IN ('pending', 'sent', 'failed')")
export class PayrollRecipient {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'batch_id', type: 'uuid', nullable: false })
  batchId!: string;

  // Recipient details
  @Column({ type: 'varchar', length: 255, nullable: false })
  name!: string;

  @Column({ name: 'wallet_address', type: 'varchar', length: 42, nullable: false })
  walletAddress!: string;

  @Column({ type: 'decimal', precision: 36, scale: 18, nullable: false })
  amount!: string;

  // Additional recipient information
  @Column({ type: 'varchar', length: 320, nullable: true })
  email?: string;

  @Column({ name: 'employee_id', type: 'varchar', length: 100, nullable: true })
  employeeId?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  department?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  position?: string;

  // Payment details
  @Column({
    type: 'varchar',
    length: 20,
    default: 'pending',
    nullable: false,
  })
  status!: PayrollRecipientStatus;

  @Column({ name: 'tx_hash', type: 'varchar', length: 66, nullable: true })
  txHash?: string;

  @Column({ name: 'gas_used', type: 'bigint', nullable: true })
  gasUsed?: string;

  @Column({ name: 'gas_price', type: 'decimal', precision: 36, scale: 18, nullable: true })
  gasPrice?: string;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string;

  // Metadata
  @Column({ type: 'jsonb', default: {}, nullable: false })
  metadata!: {
    paymentType?: 'salary' | 'bonus' | 'commission' | 'reimbursement' | 'other';
    baseSalary?: string;
    bonusAmount?: string;
    hoursWorked?: number;
    hourlyRate?: string;
    exchangeRate?: string;
    usdValue?: string;
    taxWithholding?: string;
    notes?: string;
  };

  // Timestamps
  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt?: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt?: Date;

  // Relations
  @ManyToOne(() => PayrollBatch, batch => batch.recipients, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'batch_id' })
  batch!: PayrollBatch;

  // Computed properties
  get displayAmount(): string {
    return this.batch?.token?.formatAmountWithSymbol(this.amount) || this.amount;
  }

  get shortWalletAddress(): string {
    return `${this.walletAddress.slice(0, 6)}...${this.walletAddress.slice(-4)}`;
  }

  get shortTxHash(): string | null {
    return this.txHash ? `${this.txHash.slice(0, 8)}...${this.txHash.slice(-6)}` : null!;
  }

  get isPending(): boolean {
    return this.status === 'pending';
  }

  get isSent(): boolean {
    return this.status === 'sent';
  }

  get isFailed(): boolean {
    return this.status === 'failed';
  }

  get displayName(): string {
    if (this.employeeId) {
      return `${this.name} (${this.employeeId})`;
    }
    return this.name;
  }

  get walletAddressUrl(): string | null {
    return this.batch?.network?.getAddressUrl(this.walletAddress) || null;
  }

  get explorerUrl(): string | null {
    return this.txHash && this.batch?.network 
      ? this.batch.network.getTransactionUrl(this.txHash) 
      : null!;
  }

  get totalGasCost(): string | null {
    if (!this.gasUsed || !this.gasPrice) return null;
    const gasCost = BigInt(this.gasUsed) * BigInt(this.gasPrice);
    return gasCost.toString();
  }

  get displayGasCost(): string | null {
    const totalCost = this.totalGasCost;
    if (!totalCost) return null;
    
    const amount = Number(totalCost) / Math.pow(10, 18);
    return `${amount.toFixed(6)} ${this.batch?.network?.symbol || 'ETH'}`;
  }

  get departmentAndPosition(): string | null {
    const parts = [this.department, this.position].filter(Boolean);
    return parts.length > 0 ? parts.join(' - ') : null!;
  }

  // Methods
  toJSON() {
    return {
      ...this,
      displayAmount: this.displayAmount,
      shortWalletAddress: this.shortWalletAddress,
      shortTxHash: this.shortTxHash,
      isPending: this.isPending,
      isSent: this.isSent,
      isFailed: this.isFailed,
      displayName: this.displayName,
      walletAddressUrl: this.walletAddressUrl,
      explorerUrl: this.explorerUrl,
      totalGasCost: this.totalGasCost,
      displayGasCost: this.displayGasCost,
      departmentAndPosition: this.departmentAndPosition,
    };
  }

  markAsSent(txHash: string, gasUsed?: string, gasPrice?: string): void {
    this.status = 'sent';
    this.txHash = txHash;
    this.gasUsed = gasUsed;
    this.gasPrice = gasPrice;
    this.sentAt = new Date();
  }

  markAsFailed(errorMessage: string): void {
    this.status = 'failed';
    this.errorMessage = errorMessage;
  }

  retry(): void {
    if (this.status === 'failed') {
      this.status = 'pending';
      this.errorMessage = undefined;
      this.txHash = undefined;
      this.gasUsed = undefined;
      this.gasPrice = undefined;
      this.sentAt = undefined;
    }
  }

  updateMetadata(key: string, value: any): void {
    this.metadata = { ...this.metadata, [key]: value }!;
  }

  calculateUsdValue(exchangeRate: string): void {
    const amountNum = parseFloat(this.amount);
    const rateNum = parseFloat(exchangeRate);
    
    if (!isNaN(amountNum) && !isNaN(rateNum)) {
      const usdValue = (amountNum * rateNum).toFixed(2);
      this.updateMetadata('usdValue', usdValue);
      this.updateMetadata('exchangeRate', exchangeRate);
    }
  }

  // Static methods
  static validateWalletAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  static validateAmount(amount: string): boolean {
    const num = parseFloat(amount);
    return !isNaN(num) && num > 0;
  }

  static validateStatus(status: string): status is PayrollRecipientStatus {
    return ['pending', 'sent', 'failed'].includes(status);
  }

  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static fromCsvRow(
    row: {
      name: string;
      walletAddress: string;
      amount: string;
      email?: string;
      employeeId?: string;
      department?: string;
      position?: string;
    }
  ): Partial<PayrollRecipient> {
    return {
      name: row.name,
      walletAddress: row.walletAddress,
      amount: row.amount,
      email: row.email,
      employeeId: row.employeeId,
      department: row.department,
      position: row.position,
      status: 'pending',
    };
  }

  static validateCsvRow(row: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!row.name || typeof row.name !== 'string') {
      errors.push('Name is required');
    }

    if (!row.walletAddress || !PayrollRecipient.validateWalletAddress(row.walletAddress)) {
      errors.push('Valid wallet address is required');
    }

    if (!row.amount || !PayrollRecipient.validateAmount(row.amount)) {
      errors.push('Valid amount is required');
    }

    if (row.email && !PayrollRecipient.validateEmail(row.email)) {
      errors.push('Invalid email format');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}