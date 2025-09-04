import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  JoinColumn,
} from 'typeorm';
import { BlockchainNetwork } from './BlockchainNetwork';

export type ContractType = 'payment' | 'escrow' | 'subscription' | 'payroll' | 'multisig';

@Entity('smart_contracts')
@Index(['contractAddress', 'networkId'], { unique: true })
@Index(['networkId'])
@Index(['contractType'])
@Index(['isActive'])
export class SmartContract {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'network_id', type: 'uuid', nullable: false })
  networkId!: string;

  @Column({ name: 'contract_address', type: 'varchar', length: 42, nullable: false })
  contractAddress!: string;

  @Column({
    name: 'contract_type',
    type: 'varchar',
    length: 50,
    nullable: false,
  })
  contractType!: ContractType;

  @Column({ type: 'jsonb', nullable: false })
  abi!: any[];

  @Column({ type: 'varchar', length: 20, default: '1.0.0' })
  version!: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'deployed_at', type: 'timestamptz', nullable: true })
  deployedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt?: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt?: Date;

  // Relations
  @ManyToOne(() => BlockchainNetwork, network => network.smartContracts, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'network_id' })
  network!: BlockchainNetwork;

  // Computed properties
  get displayName(): string {
    return `${this.contractType.charAt(0).toUpperCase() + this.contractType.slice(1)} Contract`;
  }

  get shortAddress(): string {
    return `${this.contractAddress.slice(0, 6)}...${this.contractAddress.slice(-4)}`;
  }

  get isDeployed(): boolean {
    return !!this.deployedAt;
  }

  get age(): number | null {
    if (!this.deployedAt) return null;
    return Date.now() - this.deployedAt.getTime();
  }

  // Methods
  toJSON() {
    return {
      ...this,
      displayName: this.displayName,
      shortAddress: this.shortAddress,
      isDeployed: this.isDeployed,
      age: this.age,
    };
  }

  getFunctionSelector(functionName: string): string | null {
    const functionAbi = this.abi.find(
      (item: any) => item.type === 'function' && item.name === functionName
    );
    
    if (!functionAbi) return null;
    
    // Create function signature
    const inputs = functionAbi.inputs?.map((input: any) => input.type).join(',') || '';
    const signature = `${functionName}(${inputs})`;
    
    // Calculate keccak256 hash (first 4 bytes)
    // Note: In production, you'd use a proper keccak256 implementation
    return signature; // Simplified for this example
  }

  getFunction(functionName: string): any | null {
    return this.abi.find(
      (item: any) => item.type === 'function' && item.name === functionName
    ) || null;
  }

  getEvent(eventName: string): any | null {
    return this.abi.find(
      (item: any) => item.type === 'event' && item.name === eventName
    ) || null;
  }

  getFunctions(): any[] {
    return this.abi.filter((item: any) => item.type === 'function');
  }

  getEvents(): any[] {
    return this.abi.filter((item: any) => item.type === 'event');
  }

  // Static methods for common contract types
  static getPaymentContractABI(): any[] {
    return [
      {
        type: 'function',
        name: 'pay',
        inputs: [
          { name: 'recipient', type: 'address' },
          { name: 'amount', type: 'uint256' },
          { name: 'token', type: 'address' },
        ],
        outputs: [],
        stateMutability: 'payable',
      },
      {
        type: 'function',
        name: 'batchPay',
        inputs: [
          { name: 'recipients', type: 'address[]' },
          { name: 'amounts', type: 'uint256[]' },
          { name: 'token', type: 'address' },
        ],
        outputs: [],
        stateMutability: 'payable',
      },
      {
        type: 'event',
        name: 'Payment',
        inputs: [
          { name: 'from', type: 'address', indexed: true },
          { name: 'to', type: 'address', indexed: true },
          { name: 'amount', type: 'uint256', indexed: false },
          { name: 'token', type: 'address', indexed: true },
        ],
      },
    ];
  }

  static getEscrowContractABI(): any[] {
    return [
      {
        type: 'function',
        name: 'createEscrow',
        inputs: [
          { name: 'recipient', type: 'address' },
          { name: 'amount', type: 'uint256' },
          { name: 'token', type: 'address' },
          { name: 'releaseTime', type: 'uint256' },
        ],
        outputs: [{ name: 'escrowId', type: 'uint256' }],
        stateMutability: 'payable',
      },
      {
        type: 'function',
        name: 'releaseEscrow',
        inputs: [{ name: 'escrowId', type: 'uint256' }],
        outputs: [],
        stateMutability: 'nonpayable',
      },
      {
        type: 'event',
        name: 'EscrowCreated',
        inputs: [
          { name: 'escrowId', type: 'uint256', indexed: true },
          { name: 'sender', type: 'address', indexed: true },
          { name: 'recipient', type: 'address', indexed: true },
          { name: 'amount', type: 'uint256', indexed: false },
        ],
      },
    ];
  }

  static validateContractAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  static validateContractType(type: string): type is ContractType {
    return ['payment', 'escrow', 'subscription', 'payroll', 'multisig'].includes(type);
  }

  static validateABI(abi: any): boolean {
    if (!Array.isArray(abi)) return false;
    
    return abi.every((item: any) => {
      return (
        item &&
        typeof item === 'object' &&
        ['function', 'event', 'constructor', 'fallback', 'receive'].includes(item.type)
      );
    });
  }
}