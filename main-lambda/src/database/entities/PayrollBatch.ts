import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  JoinColumn,
  Check,
} from 'typeorm';
import { Organization } from './Organization';
import { User } from './User';
import { BlockchainNetwork } from './BlockchainNetwork';
import { Token } from './Token';
import { PayrollRecipient } from './PayrollRecipient';

export type PayrollBatchStatus = 'draft' | 'processing' | 'completed' | 'failed' | 'partially_completed';

@Entity('payroll_batches')
@Index(['organizationId'])
@Index(['createdBy'])
@Index(['networkId'])
@Index(['tokenId'])
@Index(['status'])
@Index(['executedAt'])
@Check('status_valid', "status IN ('draft', 'processing', 'completed', 'failed', 'partially_completed')")
export class PayrollBatch {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organization_id', type: 'uuid', nullable: false })
  organizationId!: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: false })
  createdBy!: string;

  // Batch details
  @Column({ type: 'varchar', length: 255, nullable: false })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'network_id', type: 'uuid', nullable: false })
  networkId!: string;

  @Column({ name: 'token_id', type: 'uuid', nullable: false })
  tokenId!: string;

  // Status and totals
  @Column({
    type: 'varchar',
    length: 20,
    default: 'draft',
    nullable: false,
  })
  status!: PayrollBatchStatus;

  @Column({ name: 'total_amount', type: 'decimal', precision: 36, scale: 18, default: '0' })
  totalAmount!: string;

  @Column({ name: 'recipients_count', type: 'integer', default: 0 })
  recipientsCount!: number;

  @Column({ name: 'successful_count', type: 'integer', default: 0 })
  successfulCount!: number;

  @Column({ name: 'failed_count', type: 'integer', default: 0 })
  failedCount!: number;

  // Transaction details
  @Column({ name: 'tx_hash', type: 'varchar', length: 66, nullable: true })
  txHash?: string;

  @Column({ name: 'gas_used', type: 'bigint', nullable: true })
  gasUsed?: string;

  @Column({ name: 'gas_price', type: 'decimal', precision: 36, scale: 18, nullable: true })
  gasPrice?: string;

  @Column({ name: 'block_number', type: 'bigint', nullable: true })
  blockNumber?: string;

  // Metadata
  @Column({ type: 'jsonb', default: {}, nullable: false })
  metadata!: {
    batchType?: 'salary' | 'bonus' | 'commission' | 'reimbursement' | 'other';
    payrollPeriod?: string;
    exchangeRate?: string;
    totalUsdValue?: string;
    approvedBy?: string;
    notes?: string;
    errorDetails?: any[];
    retryCount?: number;
  };

  // Timestamps
  @Column({ name: 'executed_at', type: 'timestamptz', nullable: true })
  executedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt?: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt?: Date;

  // Relations
  @ManyToOne(() => Organization, organization => organization.payrollBatches, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

  @ManyToOne(() => User, user => user.payrollBatches, {
    nullable: false,
  })
  @JoinColumn({ name: 'created_by' })
  createdByUser!: User;

  @ManyToOne(() => BlockchainNetwork, network => network.payrollBatches, {
    nullable: false,
  })
  @JoinColumn({ name: 'network_id' })
  network!: BlockchainNetwork;

  @ManyToOne(() => Token, token => token.payrollBatches, {
    nullable: false,
  })
  @JoinColumn({ name: 'token_id' })
  token!: Token;

  @OneToMany(() => PayrollRecipient, recipient => recipient.batch, { cascade: true })
  recipients!: PayrollRecipient[];

  // Computed properties
  get displayTotalAmount(): string {
    return this.token?.formatAmountWithSymbol(this.totalAmount) || this.totalAmount;
  }

  get shortTxHash(): string | null {
    return this.txHash ? `${this.txHash.slice(0, 8)}...${this.txHash.slice(-6)}` : null!;
  }

  get successRate(): number {
    return this.recipientsCount > 0 ? (this.successfulCount / this.recipientsCount) * 100 : 0!;
  }

  get isCompleted(): boolean {
    return this.status === 'completed';
  }

  get isProcessing(): boolean {
    return this.status === 'processing';
  }

  get isDraft(): boolean {
    return this.status === 'draft';
  }

  get isFailed(): boolean {
    return this.status === 'failed';
  }

  get isPartiallyCompleted(): boolean {
    return this.status === 'partially_completed';
  }

  get canEdit(): boolean {
    return this.status === 'draft';
  }

  get canExecute(): boolean {
    return this.status === 'draft' && this.recipientsCount > 0;
  }

  get canRetry(): boolean {
    return this.status === 'failed' || this.status === 'partially_completed';
  }

  get explorerUrl(): string | null {
    return this.txHash && this.network ? this.network.getTransactionUrl(this.txHash) : null!;
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
    return `${amount.toFixed(6)} ${this.network?.symbol || 'ETH'}`;
  }

  get averageAmountPerRecipient(): string {
    if (this.recipientsCount === 0) return '0';
    return (parseFloat(this.totalAmount) / this.recipientsCount).toString();
  }

  get displayAverageAmount(): string {
    return this.token?.formatAmountWithSymbol(this.averageAmountPerRecipient) || this.averageAmountPerRecipient;
  }

  // Methods
  toJSON() {
    return {
      ...this,
      displayTotalAmount: this.displayTotalAmount,
      shortTxHash: this.shortTxHash,
      successRate: this.successRate,
      isCompleted: this.isCompleted,
      isProcessing: this.isProcessing,
      isDraft: this.isDraft,
      isFailed: this.isFailed,
      isPartiallyCompleted: this.isPartiallyCompleted,
      canEdit: this.canEdit,
      canExecute: this.canExecute,
      canRetry: this.canRetry,
      explorerUrl: this.explorerUrl,
      totalGasCost: this.totalGasCost,
      displayGasCost: this.displayGasCost,
      averageAmountPerRecipient: this.averageAmountPerRecipient,
      displayAverageAmount: this.displayAverageAmount,
    };
  }

  calculateTotals(): void {
    if (this.recipients && this.recipients.length > 0) {
      this.recipientsCount = this.recipients.length;
      this.totalAmount = this.recipients
        .reduce((sum, recipient) => sum + parseFloat(recipient.amount), 0)
        .toString();
      
      this.successfulCount = this.recipients.filter(r => r.status === 'sent').length;
      this.failedCount = this.recipients.filter(r => r.status === 'failed').length;
    }
  }

  startProcessing(): void {
    if (this.status === 'draft') {
      this.status = 'processing';
    }
  }

  markAsCompleted(txHash: string, blockNumber?: string, gasUsed?: string, gasPrice?: string): void {
    this.status = 'completed';
    this.txHash = txHash;
    this.blockNumber = blockNumber;
    this.gasUsed = gasUsed;
    this.gasPrice = gasPrice;
    this.executedAt = new Date();
  }

  markAsPartiallyCompleted(txHash?: string): void {
    this.status = 'partially_completed';
    if (txHash) {
      this.txHash = txHash;
    }
    this.executedAt = new Date();
  }

  markAsFailed(error?: string): void {
    this.status = 'failed';
    this.executedAt = new Date();
    if (error) {
      this.metadata = {
        ...this.metadata,
        errorDetails: [...(this.metadata.errorDetails || []), error],
      };
    }
  }

  incrementRetryCount(): void {
    this.metadata = {
      ...this.metadata,
      retryCount: (this.metadata.retryCount || 0) + 1,
    };
  }

  addRecipient(_recipient: Partial<PayrollRecipient>): void {
    if (!this.canEdit) {
      throw new Error('Cannot add recipients to a batch that is not in draft status');
    }
    
    // This would be handled by the service layer in practice
    // The recipients relationship would be updated through TypeORM
  }

  removeRecipient(_recipientId: string): void {
    if (!this.canEdit) {
      throw new Error('Cannot remove recipients from a batch that is not in draft status');
    }
    
    // This would be handled by the service layer in practice
  }

  // Static methods
  static validateStatus(status: string): status is PayrollBatchStatus {
    return ['draft', 'processing', 'completed', 'failed', 'partially_completed'].includes(status);
  }

  static validateAmount(amount: string): boolean {
    const num = parseFloat(amount);
    return !isNaN(num) && num >= 0;
  }

  static generateBatchTitle(type: string, period?: string): string {
    const timestamp = new Date().toISOString().slice(0, 10);
    const formattedType = type.charAt(0).toUpperCase() + type.slice(1);
    
    if (period) {
      return `${formattedType} - ${period}`;
    }
    
    return `${formattedType} - ${timestamp}`;
  }
}