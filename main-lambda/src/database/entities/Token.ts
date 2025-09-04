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
import { BlockchainNetwork } from './BlockchainNetwork';
import { Invoice } from './Invoice';
import { Payment } from './Payment';
import { PayrollBatch } from './PayrollBatch';

@Entity('tokens')
@Index(['contractAddress', 'networkId'], { unique: true })
@Index(['networkId'])
@Index(['symbol'])
@Index(['isActive'])
@Check('native_address_check', '(is_native = true AND contract_address IS NULL) OR (is_native = false AND contract_address IS NOT NULL)')
export class Token {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'network_id', type: 'uuid', nullable: false })
  networkId!: string;

  @Column({ name: 'contract_address', type: 'varchar', length: 100, nullable: true })
  contractAddress?: string;

  @Column({ type: 'varchar', length: 20, nullable: false })
  symbol!: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  name!: string;

  @Column({ type: 'integer', default: 18, nullable: false })
  decimals!: number;

  @Column({ name: 'is_native', type: 'boolean', default: false })
  isNative!: boolean;

  @Column({ name: 'is_stablecoin', type: 'boolean', default: false })
  isStablecoin!: boolean;

  @Column({ name: 'logo_url', type: 'varchar', length: 500, nullable: true })
  logoUrl?: string;

  @Column({ name: 'price_feed_id', type: 'varchar', length: 100, nullable: true })
  priceFeedId?: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  // Relations
  @ManyToOne(() => BlockchainNetwork, network => network.tokens, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'network_id' })
  network!: BlockchainNetwork;

  @OneToMany(() => Invoice, invoice => invoice.token)
  invoices!: Invoice[];

  @OneToMany(() => Payment, payment => payment.token)
  payments!: Payment[];

  @OneToMany(() => PayrollBatch, batch => batch.token)
  payrollBatches!: PayrollBatch[];

  // Computed properties
  get displayName(): string {
    return `${this.name} (${this.symbol})`;
  }

  get isERC20(): boolean {
    return !this.isNative && !!this.contractAddress;
  }

  get tokenType(): 'native' | 'erc20' {
    return this.isNative ? 'native' : 'erc20'!;
  }

  get decimalsForDisplay(): number {
    // For display purposes, limit decimal places based on token type
    if (this.isStablecoin) return 2;
    if (this.isNative) return 4;
    return Math.min(this.decimals, 6);
  }

  // Methods
  toJSON() {
    return {
      ...this,
      displayName: this.displayName,
      isERC20: this.isERC20,
      tokenType: this.tokenType,
      decimalsForDisplay: this.decimalsForDisplay,
    };
  }

  formatAmount(amount: string | number, maxDecimals?: number): string {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount!;
    const displayDecimals = maxDecimals ?? this.decimalsForDisplay;
    
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: displayDecimals,
    }).format(numAmount);
  }

  formatAmountWithSymbol(amount: string | number, maxDecimals?: number): string {
    return `${this.formatAmount(amount, maxDecimals)} ${this.symbol}`;
  }

  // Parse amount from human-readable string to wei/smallest unit
  parseAmount(amount: string): string {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < 0) {
      throw new Error(`Invalid amount: ${amount}`)!;
    }
    
    // Convert to wei (multiply by 10^decimals)
    const wei = BigInt(Math.floor(numAmount * Math.pow(10, this.decimals)));
    return wei.toString();
  }

  // Format amount from wei/smallest unit to human-readable string
  formatFromWei(weiAmount: string): string {
    const wei = BigInt(weiAmount);
    const divisor = BigInt(Math.pow(10, this.decimals));
    const amount = Number(wei) / Number(divisor);
    return this.formatAmount(amount);
  }

  // Static methods for common tokens
  static getCommonTokens(): Partial<Token>[] {
    return [
      // Ethereum tokens
      {
        symbol: 'ETH',
        name: 'Ethereum',
        decimals: 18,
        isNative: true,
        isStablecoin: false,
        contractAddress: undefined,
      },
      {
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        isNative: false,
        isStablecoin: true,
        contractAddress: '0xA0b86a33E6441E2E65d8b9B65Ed8da8E0b9e5eaa', // Ethereum USDC
      },
      {
        symbol: 'USDT',
        name: 'Tether USD',
        decimals: 6,
        isNative: false,
        isStablecoin: true,
        contractAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7', // Ethereum USDT
      },
      
      // Polygon tokens
      {
        symbol: 'MATIC',
        name: 'Polygon',
        decimals: 18,
        isNative: true,
        isStablecoin: false,
        contractAddress: undefined,
      },
      {
        symbol: 'USDC',
        name: 'USD Coin (Polygon)',
        decimals: 6,
        isNative: false,
        isStablecoin: true,
        contractAddress: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // Polygon USDC
      },
    ];
  }

  static validateContractAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  static validateSymbol(symbol: string): boolean {
    return /^[A-Z][A-Z0-9]{0,19}$/.test(symbol);
  }

  static validateDecimals(decimals: number): boolean {
    return Number.isInteger(decimals) && decimals >= 0 && decimals <= 77;
  }
}