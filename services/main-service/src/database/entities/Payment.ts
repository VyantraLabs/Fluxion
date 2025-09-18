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
import { Organization } from './Organization';
import { Invoice } from './Invoice';
import { BlockchainNetwork } from './BlockchainNetwork';
import { Token } from './Token';

export type PaymentStatus = 'pending' | 'confirmed' | 'failed';

@Entity('payments')
@Index(['txHash', 'chainId'], { unique: true })
@Index(['organizationId'])
@Index(['invoiceId'])
@Index(['chainId'])
@Index(['tokenId'])
@Index(['status'])
@Index(['fromAddress'])
@Index(['toAddress'])
@Index(['blockNumber'])
@Check('amount_positive', 'amount > 0')
@Check('status_valid', "status IN ('pending', 'confirmed', 'failed')")
export class Payment {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Column({ name: 'organization_id', type: 'varchar', nullable: false })
  organizationId!: string;

  @Column({ name: 'invoice_id', type: 'varchar', nullable: true })
  invoiceId?: string;

  // Transaction details
  @Column({ name: 'tx_hash', type: 'varchar', length: 66, nullable: false })
  txHash!: string;

  @Column({ name: 'chain_id', type: 'integer', nullable: false })
  chainId!: number;

  @Column({ name: 'token_id', type: 'varchar', nullable: false })
  tokenId!: string;

  // Payment details
  @Column({ name: 'from_address', type: 'varchar', length: 42, nullable: false })
  fromAddress!: string;

  @Column({ name: 'to_address', type: 'varchar', length: 42, nullable: false })
  toAddress!: string;

  @Column({ type: 'decimal', precision: 36, scale: 18, nullable: false })
  amount!: string;

  @Column({ name: 'gas_used', type: 'bigint', nullable: true })
  gasUsed?: string;

  @Column({ name: 'gas_price', type: 'decimal', precision: 36, scale: 18, nullable: true })
  gasPrice?: string;

  // Status and confirmation
  @Column({
    type: 'varchar',
    length: 20,
    default: 'pending',
    nullable: false,
  })
  status!: PaymentStatus;

  @Column({ name: 'block_number', type: 'bigint', nullable: true })
  blockNumber?: string;

  @Column({ type: 'integer', default: 0 })
  confirmations!: number;

  // Metadata
  @Column({ type: 'jsonb', default: {}, nullable: false })
  metadata!: {
    methodId?: string;
    inputData?: string;
    logs?: any[];
    errorReason?: string;
    exchangeRate?: string;
    usdValue?: string;
    gasEstimate?: string;
    nonce?: number;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
    type?: 'legacy' | 'eip1559';
  };

  // Timestamps
  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @Column({ name: 'confirmed_at', type: 'timestamptz', nullable: true })
  confirmedAt?: Date;

  // Relations
  @ManyToOne(() => Organization, organization => organization.payments, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

  @ManyToOne(() => Invoice, invoice => invoice.payments, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'invoice_id' })
  invoice?: Invoice;

  @ManyToOne(() => BlockchainNetwork, network => network.payments, {
    nullable: false,
  })
  @JoinColumn({ name: 'chain_id' })
  network!: BlockchainNetwork;

  @ManyToOne(() => Token, token => token.payments, {
    nullable: false,
  })
  @JoinColumn({ name: 'token_id' })
  token!: Token;

  // Computed properties
  get displayAmount(): string {
    return this.token?.formatAmountWithSymbol(this.amount) || this.amount;
  }

  get shortTxHash(): string {
    return `${this.txHash.slice(0, 8)}...${this.txHash.slice(-6)}`;
  }

  get shortFromAddress(): string {
    return `${this.fromAddress.slice(0, 6)}...${this.fromAddress.slice(-4)}`;
  }

  get shortToAddress(): string {
    return `${this.toAddress.slice(0, 6)}...${this.toAddress.slice(-4)}`;
  }

  get isConfirmed(): boolean {
    return this.status === 'confirmed';
  }

  get isPending(): boolean {
    return this.status === 'pending';
  }

  get isFailed(): boolean {
    return this.status === 'failed';
  }

  get explorerUrl(): string | null {
    return this.network?.getTransactionUrl(this.txHash) || null;
  }

  get fromAddressUrl(): string | null {
    return this.network?.getAddressUrl(this.fromAddress) || null;
  }

  get toAddressUrl(): string | null {
    return this.network?.getAddressUrl(this.toAddress) || null;
  }

  get totalGasCost(): string | null {
    if (!this.gasUsed || !this.gasPrice) return null;
    const gasCost = BigInt(this.gasUsed) * BigInt(this.gasPrice);
    return gasCost.toString();
  }

  get displayGasCost(): string | null {
    const totalCost = this.totalGasCost;
    if (!totalCost) return null;
    
    // Format gas cost in network native token
    const amount = Number(totalCost) / Math.pow(10, 18); // Assuming 18 decimals for gas
    return `${amount.toFixed(6)} ${this.network?.symbol || 'ETH'}`;
  }

  get confirmationProgress(): number {
    const maxConfirmations = 12; // Most networks consider 12 confirmations as final
    return Math.min((this.confirmations / maxConfirmations) * 100, 100);
  }

  get age(): number {
    return Date.now() - this.createdAt.getTime();
  }

  get ageInMinutes(): number {
    return Math.floor(this.age / (1000 * 60));
  }

  // Methods
  toJSON() {
    return {
      ...this,
      displayAmount: this.displayAmount,
      shortTxHash: this.shortTxHash,
      shortFromAddress: this.shortFromAddress,
      shortToAddress: this.shortToAddress,
      isConfirmed: this.isConfirmed,
      isPending: this.isPending,
      isFailed: this.isFailed,
      explorerUrl: this.explorerUrl,
      fromAddressUrl: this.fromAddressUrl,
      toAddressUrl: this.toAddressUrl,
      totalGasCost: this.totalGasCost,
      displayGasCost: this.displayGasCost,
      confirmationProgress: this.confirmationProgress,
      age: this.age,
      ageInMinutes: this.ageInMinutes,
    };
  }

  updateConfirmations(blockNumber: string, currentBlockNumber: string): void {
    this.blockNumber = blockNumber;
    this.confirmations = Math.max(0, parseInt(currentBlockNumber) - parseInt(blockNumber));
    
    if (this.confirmations >= 1 && this.status === 'pending') {
      this.status = 'confirmed';
      this.confirmedAt = new Date();
    }
  }

  markAsConfirmed(blockNumber: string, gasUsed?: string): void {
    this.status = 'confirmed';
    this.blockNumber = blockNumber;
    this.confirmations = 1;
    this.confirmedAt = new Date();
    
    if (gasUsed) {
      this.gasUsed = gasUsed;
    }
  }

  markAsFailed(reason?: string): void {
    this.status = 'failed';
    if (reason) {
      this.metadata = { ...this.metadata, errorReason: reason }!;
    }
  }

  addMetadata(key: string, value: any): void {
    this.metadata = { ...this.metadata, [key]: value }!;
  }

  // Static methods
  static validateTxHash(hash: string): boolean {
    return /^0x[a-fA-F0-9]{64}$/.test(hash);
  }

  static validateAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  static validateAmount(amount: string): boolean {
    const num = parseFloat(amount);
    return !isNaN(num) && num > 0;
  }

  static validateStatus(status: string): status is PaymentStatus {
    return ['pending', 'confirmed', 'failed'].includes(status);
  }

  static validateBlockNumber(blockNumber: string): boolean {
    const num = parseInt(blockNumber);
    return !isNaN(num) && num >= 0;
  }

  static fromBlockchainTransaction(
    transaction: {
      hash: string;
      from: string;
      to: string;
      value: string;
      gasUsed?: string;
      gasPrice?: string;
      blockNumber?: string;
    },
    organizationId: string,
    chainId: number,
    tokenId: string,
    invoiceId?: string
  ): Partial<Payment> {
    return {
      organizationId,
      invoiceId,
      txHash: transaction.hash,
      chainId,
      tokenId,
      fromAddress: transaction.from,
      toAddress: transaction.to,
      amount: transaction.value,
      gasUsed: transaction.gasUsed,
      gasPrice: transaction.gasPrice,
      blockNumber: transaction.blockNumber,
      status: transaction.blockNumber ? 'confirmed' : 'pending',
      confirmations: transaction.blockNumber ? 1 : 0,
    };
  }

  @BeforeInsert()
  generateId(): void {
    if (!this.id) {
      this.id = ulid();
    }
  }
}