import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Token } from './Token';
import { SmartContract } from './SmartContract';
import { Invoice } from './Invoice';
import { Payment } from './Payment';
import { PayrollBatch } from './PayrollBatch';

@Entity('blockchain_networks')
@Index(['chainId'], { unique: true })
@Index(['isActive'])
export class BlockchainNetwork {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'chain_id', type: 'integer', unique: true, nullable: false })
  chainId!: number;

  @Column({ type: 'varchar', length: 100, nullable: false })
  name!: string;

  @Column({ type: 'varchar', length: 10, nullable: false })
  symbol!: string;

  @Column({ name: 'rpc_url', type: 'varchar', length: 500, nullable: false })
  rpcUrl!: string;

  @Column({ name: 'explorer_url', type: 'varchar', length: 500, nullable: true })
  explorerUrl?: string;

  @Column({ name: 'is_testnet', type: 'boolean', default: false })
  isTestnet!: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'gas_settings', type: 'jsonb', default: {} })
  gasSettings!: {
    gasPrice?: string;
    gasLimit?: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
    type?: 'legacy' | 'eip1559';
  };

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  // Relations
  @OneToMany(() => Token, token => token.network, { cascade: true })
  tokens!: Token[];

  @OneToMany(() => SmartContract, contract => contract.network, { cascade: true })
  smartContracts!: SmartContract[];

  @OneToMany(() => Invoice, invoice => invoice.network)
  invoices!: Invoice[];

  @OneToMany(() => Payment, payment => payment.network)
  payments!: Payment[];

  @OneToMany(() => PayrollBatch, batch => batch.network)
  payrollBatches!: PayrollBatch[];

  // Computed properties
  get networkType(): 'mainnet' | 'testnet' {
    return this.isTestnet ? 'testnet' : 'mainnet'!;
  }

  get explorerTxUrl(): string | null {
    if (!this.explorerUrl) return null;
    return `${this.explorerUrl}/tx/`;
  }

  get explorerAddressUrl(): string | null {
    if (!this.explorerUrl) return null;
    return `${this.explorerUrl}/address/`;
  }

  get hasEIP1559Support(): boolean {
    return this.gasSettings.type === 'eip1559';
  }

  // Methods
  toJSON() {
    return {
      ...this,
      networkType: this.networkType,
      explorerTxUrl: this.explorerTxUrl,
      explorerAddressUrl: this.explorerAddressUrl,
      hasEIP1559Support: this.hasEIP1559Support,
    };
  }

  getTransactionUrl(txHash: string): string | null {
    const baseUrl = this.explorerTxUrl;
    return baseUrl ? `${baseUrl}${txHash}` : null!;
  }

  getAddressUrl(address: string): string | null {
    const baseUrl = this.explorerAddressUrl;
    return baseUrl ? `${baseUrl}${address}` : null!;
  }

  // Static methods for common networks
  static getMainnetNetworks(): Partial<BlockchainNetwork>[] {
    return [
      {
        chainId: 1,
        name: 'Ethereum',
        symbol: 'ETH',
        rpcUrl: 'https://mainnet.infura.io/v3/',
        explorerUrl: 'https://etherscan.io',
        isTestnet: false,
        gasSettings: { type: 'eip1559' },
      },
      {
        chainId: 137,
        name: 'Polygon',
        symbol: 'MATIC',
        rpcUrl: 'https://polygon-mainnet.g.alchemy.com/v2/',
        explorerUrl: 'https://polygonscan.com',
        isTestnet: false,
        gasSettings: { type: 'eip1559' },
      },
      {
        chainId: 42161,
        name: 'Arbitrum One',
        symbol: 'ETH',
        rpcUrl: 'https://arb1.arbitrum.io/rpc',
        explorerUrl: 'https://arbiscan.io',
        isTestnet: false,
        gasSettings: { type: 'eip1559' },
      },
      {
        chainId: 10,
        name: 'Optimism',
        symbol: 'ETH',
        rpcUrl: 'https://mainnet.optimism.io',
        explorerUrl: 'https://optimistic.etherscan.io',
        isTestnet: false,
        gasSettings: { type: 'eip1559' },
      },
    ];
  }

  static getTestnetNetworks(): Partial<BlockchainNetwork>[] {
    return [
      {
        chainId: 11155111,
        name: 'Sepolia',
        symbol: 'SepoliaETH',
        rpcUrl: 'https://sepolia.infura.io/v3/',
        explorerUrl: 'https://sepolia.etherscan.io',
        isTestnet: true,
        gasSettings: { type: 'eip1559' },
      },
      {
        chainId: 80001,
        name: 'Mumbai',
        symbol: 'MATIC',
        rpcUrl: 'https://polygon-mumbai.g.alchemy.com/v2/',
        explorerUrl: 'https://mumbai.polygonscan.com',
        isTestnet: true,
        gasSettings: { type: 'eip1559' },
      },
    ];
  }

  static validateChainId(chainId: number): boolean {
    return Number.isInteger(chainId) && chainId > 0;
  }

  static validateRpcUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'wss:';
    } catch {
      return false;
    }
  }
}