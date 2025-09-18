import 'reflect-metadata';
import { AppDataSource } from '../data-source';
import { BlockchainNetwork } from '../entities/BlockchainNetwork';
import { Token } from '../entities/Token';
import { Logger } from '../../shared/utils/logger';

const logger = new Logger('DatabaseSeeder');

interface NetworkSeedData {
  chainId: number;
  name: string;
  symbol: string;
  rpcUrl: string;
  explorerUrl: string;
  isTestnet: boolean;
  gasSettings: any;
  tokens: TokenSeedData[];
}

interface TokenSeedData {
  contractAddress?: string;
  symbol: string;
  name: string;
  decimals: number;
  isNative: boolean;
  isStablecoin: boolean;
  logoUrl?: string;
}

const seedData: NetworkSeedData[] = [
  // ========== ETHEREUM MAINNET ==========
  {
    chainId: 1,
    name: 'Ethereum',
    symbol: 'ETH',
    rpcUrl: 'https://mainnet.infura.io/v3/YOUR_API_KEY',
    explorerUrl: 'https://etherscan.io',
    isTestnet: false,
    gasSettings: {
      type: 'eip1559',
      gasLimit: '21000',
      maxFeePerGas: '30000000000', // 30 Gwei
      maxPriorityFeePerGas: '2000000000' // 2 Gwei
    },
    tokens: [
      {
        symbol: 'ETH',
        name: 'Ethereum',
        decimals: 18,
        isNative: true,
        isStablecoin: false,
        logoUrl: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
      },
      {
        contractAddress: '0xA0b86a33E6441E2E65d8b9B65Ed8da8E0b9e5eaa',
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        isNative: false,
        isStablecoin: true,
        logoUrl: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png',
      },
      {
        contractAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        symbol: 'USDT',
        name: 'Tether USD',
        decimals: 6,
        isNative: false,
        isStablecoin: true,
        logoUrl: 'https://cryptologos.cc/logos/tether-usdt-logo.png',
      },
      {
        contractAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        symbol: 'DAI',
        name: 'Dai Stablecoin',
        decimals: 18,
        isNative: false,
        isStablecoin: true,
        logoUrl: 'https://cryptologos.cc/logos/multi-collateral-dai-dai-logo.png',
      },
      {
        contractAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        symbol: 'WETH',
        name: 'Wrapped Ethereum',
        decimals: 18,
        isNative: false,
        isStablecoin: false,
        logoUrl: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
      },
      {
        contractAddress: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
        symbol: 'LINK',
        name: 'Chainlink',
        decimals: 18,
        isNative: false,
        isStablecoin: false,
        logoUrl: 'https://cryptologos.cc/logos/chainlink-link-logo.png',
      },
      {
        contractAddress: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
        symbol: 'UNI',
        name: 'Uniswap',
        decimals: 18,
        isNative: false,
        isStablecoin: false,
        logoUrl: 'https://cryptologos.cc/logos/uniswap-uni-logo.png',
      },
    ],
  },

  // ========== POLYGON MAINNET ==========
  {
    chainId: 137,
    name: 'Polygon',
    symbol: 'MATIC',
    rpcUrl: 'https://polygon-mainnet.g.alchemy.com/v2/YOUR_API_KEY',
    explorerUrl: 'https://polygonscan.com',
    isTestnet: false,
    gasSettings: {
      type: 'eip1559',
      gasLimit: '21000',
      maxFeePerGas: '50000000000', // 50 Gwei
      maxPriorityFeePerGas: '30000000000' // 30 Gwei
    },
    tokens: [
      {
        symbol: 'MATIC',
        name: 'Polygon',
        decimals: 18,
        isNative: true,
        isStablecoin: false,
        logoUrl: 'https://cryptologos.cc/logos/polygon-matic-logo.png',
      },
      {
        symbol: 'POL',
        name: 'Polygon Ecosystem Token',
        decimals: 18,
        isNative: true,
        isStablecoin: false,
        logoUrl: 'https://cryptologos.cc/logos/polygon-matic-logo.png',
      },
      {
        contractAddress: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
        symbol: 'USDC',
        name: 'USD Coin (Polygon)',
        decimals: 6,
        isNative: false,
        isStablecoin: true,
        logoUrl: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png',
      },
      {
        contractAddress: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
        symbol: 'USDT',
        name: 'Tether USD (Polygon)',
        decimals: 6,
        isNative: false,
        isStablecoin: true,
        logoUrl: 'https://cryptologos.cc/logos/tether-usdt-logo.png',
      },
      {
        contractAddress: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
        symbol: 'DAI',
        name: 'Dai Stablecoin (Polygon)',
        decimals: 18,
        isNative: false,
        isStablecoin: true,
        logoUrl: 'https://cryptologos.cc/logos/multi-collateral-dai-dai-logo.png',
      },
      {
        contractAddress: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
        symbol: 'WETH',
        name: 'Wrapped Ethereum (Polygon)',
        decimals: 18,
        isNative: false,
        isStablecoin: false,
        logoUrl: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
      },
    ],
  },

  // ========== BASE MAINNET ==========
  {
    chainId: 8453,
    name: 'Base',
    symbol: 'ETH',
    rpcUrl: 'https://mainnet.base.org',
    explorerUrl: 'https://basescan.org',
    isTestnet: false,
    gasSettings: {
      type: 'eip1559',
      gasLimit: '21000',
      maxFeePerGas: '1000000000', // 1 Gwei
      maxPriorityFeePerGas: '100000000' // 0.1 Gwei
    },
    tokens: [
      {
        symbol: 'ETH',
        name: 'Ethereum (Base)',
        decimals: 18,
        isNative: true,
        isStablecoin: false,
        logoUrl: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
      },
      {
        contractAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        symbol: 'USDC',
        name: 'USD Coin (Base)',
        decimals: 6,
        isNative: false,
        isStablecoin: true,
        logoUrl: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png',
      },
      {
        contractAddress: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
        symbol: 'DAI',
        name: 'Dai Stablecoin (Base)',
        decimals: 18,
        isNative: false,
        isStablecoin: true,
        logoUrl: 'https://cryptologos.cc/logos/multi-collateral-dai-dai-logo.png',
      },
    ],
  },

  // ========== ARBITRUM ONE ==========
  {
    chainId: 42161,
    name: 'Arbitrum One',
    symbol: 'ETH',
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    explorerUrl: 'https://arbiscan.io',
    isTestnet: false,
    gasSettings: {
      type: 'eip1559',
      gasLimit: '21000',
      maxFeePerGas: '500000000', // 0.5 Gwei
      maxPriorityFeePerGas: '100000000' // 0.1 Gwei
    },
    tokens: [
      {
        symbol: 'ETH',
        name: 'Ethereum (Arbitrum)',
        decimals: 18,
        isNative: true,
        isStablecoin: false,
        logoUrl: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
      },
      {
        contractAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
        symbol: 'USDC',
        name: 'USD Coin (Arbitrum)',
        decimals: 6,
        isNative: false,
        isStablecoin: true,
        logoUrl: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png',
      },
      {
        contractAddress: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
        symbol: 'USDT',
        name: 'Tether USD (Arbitrum)',
        decimals: 6,
        isNative: false,
        isStablecoin: true,
        logoUrl: 'https://cryptologos.cc/logos/tether-usdt-logo.png',
      },
      {
        contractAddress: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
        symbol: 'DAI',
        name: 'Dai Stablecoin (Arbitrum)',
        decimals: 18,
        isNative: false,
        isStablecoin: true,
        logoUrl: 'https://cryptologos.cc/logos/multi-collateral-dai-dai-logo.png',
      },
    ],
  },

  // ========== OPTIMISM ==========
  {
    chainId: 10,
    name: 'Optimism',
    symbol: 'ETH',
    rpcUrl: 'https://mainnet.optimism.io',
    explorerUrl: 'https://optimistic.etherscan.io',
    isTestnet: false,
    gasSettings: {
      type: 'eip1559',
      gasLimit: '21000',
      maxFeePerGas: '500000000', // 0.5 Gwei
      maxPriorityFeePerGas: '100000000' // 0.1 Gwei
    },
    tokens: [
      {
        symbol: 'ETH',
        name: 'Ethereum (Optimism)',
        decimals: 18,
        isNative: true,
        isStablecoin: false,
        logoUrl: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
      },
      {
        contractAddress: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
        symbol: 'USDC',
        name: 'USD Coin (Optimism)',
        decimals: 6,
        isNative: false,
        isStablecoin: true,
        logoUrl: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png',
      },
      {
        contractAddress: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
        symbol: 'USDT',
        name: 'Tether USD (Optimism)',
        decimals: 6,
        isNative: false,
        isStablecoin: true,
        logoUrl: 'https://cryptologos.cc/logos/tether-usdt-logo.png',
      },
      {
        contractAddress: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
        symbol: 'DAI',
        name: 'Dai Stablecoin (Optimism)',
        decimals: 18,
        isNative: false,
        isStablecoin: true,
        logoUrl: 'https://cryptologos.cc/logos/multi-collateral-dai-dai-logo.png',
      },
    ],
  },

  // ========== BITCOIN MAINNET ==========
  {
    chainId: 0, // Special case for Bitcoin
    name: 'Bitcoin',
    symbol: 'BTC',
    rpcUrl: 'https://bitcoin-mainnet.public-node.com',
    explorerUrl: 'https://blockstream.info',
    isTestnet: false,
    gasSettings: {
      type: 'legacy',
      gasPrice: '10000', // 10 sat/byte
      gasLimit: '300'
    },
    tokens: [
      {
        symbol: 'BTC',
        name: 'Bitcoin',
        decimals: 8,
        isNative: true,
        isStablecoin: false,
        logoUrl: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png',
      },
    ],
  },

  // ========== SOLANA MAINNET ==========
  {
    chainId: 101, // Solana mainnet-beta
    name: 'Solana',
    symbol: 'SOL',
    rpcUrl: 'https://api.mainnet-beta.solana.com',
    explorerUrl: 'https://solscan.io',
    isTestnet: false,
    gasSettings: {
      type: 'legacy',
      gasPrice: '5000', // 5000 lamports
      gasLimit: '200000'
    },
    tokens: [
      {
        symbol: 'SOL',
        name: 'Solana',
        decimals: 9,
        isNative: true,
        isStablecoin: false,
        logoUrl: 'https://cryptologos.cc/logos/solana-sol-logo.png',
      },
      {
        contractAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        symbol: 'USDC',
        name: 'USD Coin (Solana)',
        decimals: 6,
        isNative: false,
        isStablecoin: true,
        logoUrl: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png',
      },
      {
        contractAddress: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
        symbol: 'USDT',
        name: 'Tether USD (Solana)',
        decimals: 6,
        isNative: false,
        isStablecoin: true,
        logoUrl: 'https://cryptologos.cc/logos/tether-usdt-logo.png',
      },
    ],
  },

  // ========== TESTNETS ==========
  
  // ETHEREUM SEPOLIA TESTNET
  {
    chainId: 11155111,
    name: 'Sepolia',
    symbol: 'SepoliaETH',
    rpcUrl: 'https://sepolia.infura.io/v3/YOUR_API_KEY',
    explorerUrl: 'https://sepolia.etherscan.io',
    isTestnet: true,
    gasSettings: {
      type: 'eip1559',
      gasLimit: '21000',
      maxFeePerGas: '20000000000', // 20 Gwei
      maxPriorityFeePerGas: '1000000000' // 1 Gwei
    },
    tokens: [
      {
        symbol: 'SepoliaETH',
        name: 'Sepolia Ethereum',
        decimals: 18,
        isNative: true,
        isStablecoin: false,
        logoUrl: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
      },
      {
        contractAddress: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
        symbol: 'USDC',
        name: 'USD Coin (Sepolia)',
        decimals: 6,
        isNative: false,
        isStablecoin: true,
        logoUrl: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png',
      },
    ],
  },

  // POLYGON MUMBAI TESTNET
  {
    chainId: 80001,
    name: 'Mumbai',
    symbol: 'MATIC',
    rpcUrl: 'https://polygon-mumbai.g.alchemy.com/v2/YOUR_API_KEY',
    explorerUrl: 'https://mumbai.polygonscan.com',
    isTestnet: true,
    gasSettings: {
      type: 'eip1559',
      gasLimit: '21000',
      maxFeePerGas: '30000000000', // 30 Gwei
      maxPriorityFeePerGas: '30000000000' // 30 Gwei
    },
    tokens: [
      {
        symbol: 'MATIC',
        name: 'Polygon (Mumbai)',
        decimals: 18,
        isNative: true,
        isStablecoin: false,
        logoUrl: 'https://cryptologos.cc/logos/polygon-matic-logo.png',
      },
      {
        contractAddress: '0x9999f7fea5938fd3b1e26a12c3f2fb024e194f97',
        symbol: 'USDC',
        name: 'USD Coin (Mumbai)',
        decimals: 6,
        isNative: false,
        isStablecoin: true,
        logoUrl: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png',
      },
    ],
  },

  // BASE SEPOLIA TESTNET
  {
    chainId: 84532,
    name: 'Base Sepolia',
    symbol: 'ETH',
    rpcUrl: 'https://sepolia.base.org',
    explorerUrl: 'https://sepolia.basescan.org',
    isTestnet: true,
    gasSettings: {
      type: 'eip1559',
      gasLimit: '21000',
      maxFeePerGas: '1000000000', // 1 Gwei
      maxPriorityFeePerGas: '100000000' // 0.1 Gwei
    },
    tokens: [
      {
        symbol: 'ETH',
        name: 'Ethereum (Base Sepolia)',
        decimals: 18,
        isNative: true,
        isStablecoin: false,
        logoUrl: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
      },
    ],
  },

  // BITCOIN TESTNET
  {
    chainId: 1, // Special case for Bitcoin testnet
    name: 'Bitcoin Testnet',
    symbol: 'tBTC',
    rpcUrl: 'https://bitcoin-testnet.public-node.com',
    explorerUrl: 'https://blockstream.info/testnet',
    isTestnet: true,
    gasSettings: {
      type: 'legacy',
      gasPrice: '1000', // 1 sat/byte
      gasLimit: '300'
    },
    tokens: [
      {
        symbol: 'tBTC',
        name: 'Bitcoin Testnet',
        decimals: 8,
        isNative: true,
        isStablecoin: false,
        logoUrl: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png',
      },
    ],
  },

  // SOLANA DEVNET
  {
    chainId: 103, // Solana devnet
    name: 'Solana Devnet',
    symbol: 'SOL',
    rpcUrl: 'https://api.devnet.solana.com',
    explorerUrl: 'https://solscan.io',
    isTestnet: true,
    gasSettings: {
      type: 'legacy',
      gasPrice: '5000', // 5000 lamports
      gasLimit: '200000'
    },
    tokens: [
      {
        symbol: 'SOL',
        name: 'Solana (Devnet)',
        decimals: 9,
        isNative: true,
        isStablecoin: false,
        logoUrl: 'https://cryptologos.cc/logos/solana-sol-logo.png',
      },
    ],
  },
];

async function seedBlockchainNetworks(): Promise<void> {
  logger.info('Seeding blockchain networks and tokens...');

  const networkRepository = AppDataSource.getRepository(BlockchainNetwork);
  const tokenRepository = AppDataSource.getRepository(Token);

  for (const networkData of seedData) {
    logger.info(`Processing network: ${networkData.name} (Chain ID: ${networkData.chainId})`);

    // Check if network already exists
    let network = await networkRepository.findOne({
      where: { chainId: networkData.chainId },
    });

    if (!network) {
      // Create network
      network = networkRepository.create({
        chainId: networkData.chainId,
        name: networkData.name,
        symbol: networkData.symbol,
        rpcUrl: networkData.rpcUrl,
        explorerUrl: networkData.explorerUrl,
        isTestnet: networkData.isTestnet,
        gasSettings: networkData.gasSettings,
        isActive: true,
      });

      network = await networkRepository.save(network);
      logger.info(`Created network: ${network.name} (Chain ID: ${network.chainId})`);
    } else {
      logger.info(`Network already exists: ${network.name} (Chain ID: ${network.chainId})`);
    }

    // Process tokens for this network
    for (const tokenData of networkData.tokens) {
      // Check if token already exists for this network
      const existingToken = await tokenRepository.findOne({
        where: {
          chainId: network.chainId,
          symbol: tokenData.symbol,
          ...(tokenData.contractAddress ? { contractAddress: tokenData.contractAddress } : {}),
        },
      });

      if (!existingToken) {
        const token = tokenRepository.create({
          chainId: network.chainId,
          contractAddress: tokenData.contractAddress,
          symbol: tokenData.symbol,
          name: tokenData.name,
          decimals: tokenData.decimals,
          isNative: tokenData.isNative,
          isStablecoin: tokenData.isStablecoin,
          logoUrl: tokenData.logoUrl,
          isActive: true,
        });

        await tokenRepository.save(token);
        logger.info(`Created token: ${token.name} (${token.symbol}) on ${network.name}`);
      } else {
        logger.info(`Token already exists: ${existingToken.name} (${existingToken.symbol})`);
      }
    }
  }

  logger.info('Blockchain networks and tokens seeding completed');
}

async function seedOrganizations(): Promise<void> {
  logger.info('Seeding organizations...');

  const queryRunner = AppDataSource.createQueryRunner();
  
  try {
    // Check if default organization with specific UUID already exists
    const defaultOrgId = '00000000-0000-0000-0000-000000000000';
    const existingOrg = await queryRunner.query(
      'SELECT id, name FROM organizations WHERE id = $1',
      [defaultOrgId]
    );

    if (!existingOrg || existingOrg.length === 0) {
      // Insert default organization with specific UUID using raw query
      await queryRunner.query(`
        INSERT INTO organizations (
          id,
          name, 
          slug,
          plan,
          settings,
          created_at,
          updated_at
        ) VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          NOW(),
          NOW()
        ) ON CONFLICT (id) DO NOTHING;
      `, [
        defaultOrgId,
        'Default Organization',
        'default',
        'basic',
        JSON.stringify({
          timezone: 'UTC',
          currency: 'USD',
          invoiceNumberPrefix: 'INV',
          paymentTerms: 30,
          features: {
            multiCurrency: false,
            customBranding: false,
            advancedReporting: false
          }
        })
      ]);

      logger.info(`Created default organization with ID: ${defaultOrgId}`);
    } else {
      logger.info(`Default organization already exists: ${existingOrg[0].name} (ID: ${existingOrg[0].id})`);
    }
  } catch (error) {
    logger.error('Error seeding organizations', { error });
    throw error;
  } finally {
    await queryRunner.release();
  }

  logger.info('Organizations seeding completed');
}

async function seedDatabase(): Promise<void> {
  try {
    logger.info('Starting database seeding...');

    // Initialize database connection
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      logger.info('Database connection initialized');
    }

    // Run seeders in order
    await seedOrganizations();
    await seedBlockchainNetworks();

    logger.info('Database seeding completed successfully');
  } catch (error: any) {
    logger.error('Database seeding failed', { error: error.message });
    throw error;
  }
}

// Run seeder if called directly
if (require.main === module) {
  seedDatabase()
    .then(() => {
      logger.info('Seeding process finished');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Seeding process failed', { error });
      process.exit(1);
    });
}

export { seedDatabase, seedBlockchainNetworks, seedOrganizations };