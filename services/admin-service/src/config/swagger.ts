import swaggerJsdoc from 'swagger-jsdoc';
import { Express } from 'express';
import swaggerUi from 'swagger-ui-express';

/**
 * Swagger configuration for Fluxion API
 */
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Fluxion API',
    version: '2.0.0',
    description: `
      Fluxion is a production-ready Web3 payment platform for crypto-native invoicing and payroll.
      This comprehensive API provides endpoints for invoice management, payment processing, notifications,
      template management, and multi-chain blockchain support.
      
      ## Complete Feature Set
      - **Advanced Invoice Management**: Template-based creation, public client portal, bulk operations
      - **Production Notification System**: Professional email templates with multi-provider delivery
      - **Background Processing**: Automated payment verification and reminder system
      - **Template Management**: Customizable organization-branded invoice templates
      - **Multi-Chain Support**: Dynamic blockchain configuration (Ethereum, Polygon, Arbitrum, Base)
      - **Enterprise Architecture**: Multi-tenant with row-level security and comprehensive audit logging
      - **Real-time Analytics**: Dashboard metrics, payment tracking, and business intelligence
      
      ## Authentication
      Most endpoints require JWT authentication obtained through wallet signature verification.
      Include the token in the Authorization header: \`Bearer <token>\`
      
      ## API Organization
      The API is organized into logical modules with consistent patterns:
      - **Public endpoints** (no auth): Configuration, health checks, public invoice access
      - **User endpoints** (JWT required): Profile management, authentication
      - **Business endpoints** (JWT + tenant): Invoices, payments, templates, notifications
      - **Admin endpoints** (JWT + admin): Network/token management, system configuration
    `,
    contact: {
      name: 'Fluxion API Support',
      url: 'https://fluxion.dev/support',
      email: 'support@fluxion.dev'
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT'
    }
  },
  servers: [
    {
      url: process.env.API_BASE_URL || 'https://api.fluxion.dev',
      description: 'Production server'
    },
    {
      url: 'https://api-staging.fluxion.dev',
      description: 'Staging server'
    },
    {
      url: 'http://localhost:3000',
      description: 'Development server'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token obtained through wallet authentication'
      }
    },
    schemas: {
      // Common schemas
      Error: {
        type: 'object',
        required: ['success', 'error', 'meta'],
        properties: {
          success: {
            type: 'boolean',
            example: false
          },
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: {
                type: 'string',
                enum: ['VALIDATION_ERROR', 'UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'CONFLICT', 'INTERNAL_ERROR', 'RATE_LIMIT_EXCEEDED', 'SERVICE_UNAVAILABLE', 'BLOCKCHAIN_ERROR', 'DATABASE_ERROR'],
                example: 'NOT_FOUND'
              },
              message: {
                type: 'string',
                example: 'Resource not found'
              },
              details: {
                type: 'object',
                description: 'Additional error details'
              }
            }
          },
          meta: {
            $ref: '#/components/schemas/ResponseMeta'
          }
        }
      },
      ResponseMeta: {
        type: 'object',
        required: ['requestId', 'timestamp'],
        properties: {
          requestId: {
            type: 'string',
            format: 'uuid',
            example: '123e4567-e89b-12d3-a456-426614174000'
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            example: '2024-01-15T10:30:00.000Z'
          },
          version: {
            type: 'string',
            example: '2.0.0'
          }
        }
      },
      PaginationMeta: {
        type: 'object',
        properties: {
          hasMore: {
            type: 'boolean',
            example: true
          },
          nextToken: {
            type: 'string',
            example: 'eyJpZCI6IjEyMzQ1NiJ9'
          },
          totalCount: {
            type: 'integer',
            example: 150
          }
        }
      },
      
      // User schemas
      UserProfile: {
        type: 'object',
        properties: {
          display_name: {
            type: 'string',
            maxLength: 50,
            example: 'John Doe'
          },
          avatar_url: {
            type: 'string',
            format: 'uri',
            example: 'https://avatar.example.com/john.jpg'
          },
          bio: {
            type: 'string',
            maxLength: 500,
            example: 'Freelance developer and blockchain enthusiast'
          }
        }
      },
      NotificationPreferences: {
        type: 'object',
        required: ['email_on_payment', 'email_on_invoice_viewed', 'email_on_reminders'],
        properties: {
          email_on_payment: {
            type: 'boolean',
            example: true,
            description: 'Send email notifications when payments are received'
          },
          email_on_invoice_viewed: {
            type: 'boolean',
            example: false,
            description: 'Send email notifications when invoices are viewed'
          },
          email_on_reminders: {
            type: 'boolean',
            example: true,
            description: 'Send email reminders for unpaid invoices'
          }
        }
      },
      UserStats: {
        type: 'object',
        required: ['invoice_count', 'total_received', 'last_active_at'],
        properties: {
          invoice_count: {
            type: 'integer',
            minimum: 0,
            example: 25
          },
          total_received: {
            type: 'number',
            format: 'double',
            minimum: 0,
            example: 1250.50
          },
          last_active_at: {
            type: 'string',
            format: 'date-time',
            example: '2024-01-15T10:30:00.000Z'
          }
        }
      },
      User: {
        type: 'object',
        required: ['id', 'tenant_id', 'wallet_address', 'created_at', 'updated_at'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            example: '123e4567-e89b-12d3-a456-426614174000'
          },
          tenant_id: {
            type: 'string',
            example: 'tenant_123'
          },
          wallet_address: {
            type: 'string',
            pattern: '^0x[a-fA-F0-9]{40}$',
            example: '0x742d35Cc6635C0532925a3b8D0aC0199',
            description: 'Ethereum-compatible wallet address'
          },
          email: {
            type: 'string',
            format: 'email',
            example: 'john@example.com'
          },
          profile: {
            $ref: '#/components/schemas/UserProfile'
          },
          notification_preferences: {
            $ref: '#/components/schemas/NotificationPreferences'
          },
          stats: {
            $ref: '#/components/schemas/UserStats'
          },
          created_at: {
            type: 'string',
            format: 'date-time',
            example: '2024-01-15T10:30:00.000Z'
          },
          updated_at: {
            type: 'string',
            format: 'date-time',
            example: '2024-01-15T10:30:00.000Z'
          }
        }
      },
      
      // Authentication schemas
      AuthenticateRequest: {
        type: 'object',
        required: ['wallet_address', 'signature', 'message'],
        properties: {
          wallet_address: {
            type: 'string',
            pattern: '^0x[a-fA-F0-9]{40}$',
            example: '0x742d35Cc6635C0532925a3b8D0aC0199'
          },
          signature: {
            type: 'string',
            example: '0x1234567890abcdef...'
          },
          message: {
            type: 'string',
            example: 'Sign this message to authenticate with Fluxion'
          }
        }
      },
      AuthenticationResponse: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: {
            type: 'boolean',
            example: true
          },
          data: {
            type: 'object',
            required: ['token', 'user', 'expires_at'],
            properties: {
              token: {
                type: 'string',
                example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
              },
              user: {
                $ref: '#/components/schemas/User'
              },
              expires_at: {
                type: 'string',
                format: 'date-time',
                example: '2024-01-22T10:30:00.000Z'
              }
            }
          },
          meta: {
            $ref: '#/components/schemas/ResponseMeta'
          }
        }
      },
      
      // Invoice schemas
      LineItem: {
        type: 'object',
        required: ['id', 'description', 'quantity', 'rate', 'amount'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            example: '123e4567-e89b-12d3-a456-426614174000'
          },
          description: {
            type: 'string',
            maxLength: 200,
            example: 'Web development services'
          },
          quantity: {
            type: 'number',
            format: 'double',
            minimum: 0.01,
            maximum: 1000000,
            example: 40
          },
          rate: {
            type: 'number',
            format: 'double',
            minimum: 0.01,
            maximum: 1000000,
            example: 75.00
          },
          amount: {
            type: 'number',
            format: 'double',
            minimum: 0.01,
            example: 3000.00
          }
        }
      },
      ClientInfo: {
        type: 'object',
        required: ['name', 'email'],
        properties: {
          name: {
            type: 'string',
            maxLength: 100,
            example: 'Acme Corporation'
          },
          email: {
            type: 'string',
            format: 'email',
            example: 'billing@acme.com'
          },
          address: {
            type: 'string',
            maxLength: 500,
            example: '123 Main St, Anytown, USA 12345'
          }
        }
      },
      InvoiceAmounts: {
        type: 'object',
        required: ['subtotal', 'total'],
        properties: {
          subtotal: {
            type: 'number',
            format: 'double',
            minimum: 0,
            example: 3000.00
          },
          tax_rate: {
            type: 'number',
            format: 'double',
            minimum: 0,
            maximum: 1,
            example: 0.08
          },
          tax_amount: {
            type: 'number',
            format: 'double',
            minimum: 0,
            example: 240.00
          },
          discount_amount: {
            type: 'number',
            format: 'double',
            minimum: 0,
            example: 100.00
          },
          total: {
            type: 'number',
            format: 'double',
            minimum: 0.01,
            example: 3140.00
          }
        }
      },
      BlockchainData: {
        type: 'object',
        required: ['network', 'token_address', 'recipient_address', 'payment_url'],
        properties: {
          network: {
            type: 'string',
            enum: ['ethereum', 'polygon', 'arbitrum', 'optimism'],
            example: 'polygon'
          },
          token_address: {
            type: 'string',
            pattern: '^0x[a-fA-F0-9]{40}$',
            example: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'
          },
          recipient_address: {
            type: 'string',
            pattern: '^0x[a-fA-F0-9]{40}$',
            example: '0x742d35Cc6635C0532925a3b8D0aC0199'
          },
          payment_url: {
            type: 'string',
            format: 'uri',
            example: 'https://app.fluxion.dev/pay/123e4567-e89b-12d3-a456-426614174000'
          }
        }
      },
      Invoice: {
        type: 'object',
        required: ['id', 'tenant_id', 'user_id', 'client_info', 'line_items', 'amounts', 'status', 'due_date', 'created_at', 'updated_at'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            example: '123e4567-e89b-12d3-a456-426614174000'
          },
          tenant_id: {
            type: 'string',
            example: 'tenant_123'
          },
          user_id: {
            type: 'string',
            format: 'uuid',
            example: '123e4567-e89b-12d3-a456-426614174000'
          },
          client_info: {
            $ref: '#/components/schemas/ClientInfo'
          },
          line_items: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/LineItem'
            },
            minItems: 1
          },
          amounts: {
            $ref: '#/components/schemas/InvoiceAmounts'
          },
          status: {
            type: 'string',
            enum: ['draft', 'pending', 'paid', 'expired', 'cancelled'],
            example: 'pending'
          },
          due_date: {
            type: 'string',
            format: 'date-time',
            example: '2024-02-15T23:59:59.000Z'
          },
          paid_at: {
            type: 'string',
            format: 'date-time',
            example: '2024-01-20T14:30:00.000Z'
          },
          blockchain_data: {
            $ref: '#/components/schemas/BlockchainData'
          },
          metadata: {
            type: 'object',
            properties: {
              pdf_url: {
                type: 'string',
                format: 'uri',
                example: 'https://storage.fluxion.dev/invoices/123.pdf'
              },
              public_url: {
                type: 'string',
                format: 'uri',
                example: 'https://app.fluxion.dev/invoice/123e4567-e89b-12d3-a456-426614174000'
              },
              notes: {
                type: 'string',
                maxLength: 1000,
                example: 'Payment terms: Net 30 days'
              }
            }
          },
          created_at: {
            type: 'string',
            format: 'date-time',
            example: '2024-01-15T10:30:00.000Z'
          },
          updated_at: {
            type: 'string',
            format: 'date-time',
            example: '2024-01-15T10:30:00.000Z'
          }
        }
      },
      CreateInvoiceRequest: {
        type: 'object',
        required: ['client_info', 'line_items', 'amounts', 'due_date'],
        properties: {
          client_info: {
            $ref: '#/components/schemas/ClientInfo'
          },
          line_items: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/LineItem'
            },
            minItems: 1
          },
          amounts: {
            $ref: '#/components/schemas/InvoiceAmounts'
          },
          due_date: {
            type: 'string',
            format: 'date-time',
            example: '2024-02-15T23:59:59.000Z'
          },
          blockchain_data: {
            $ref: '#/components/schemas/BlockchainData'
          },
          metadata: {
            type: 'object',
            properties: {
              notes: {
                type: 'string',
                maxLength: 1000,
                example: 'Payment terms: Net 30 days'
              }
            }
          }
        }
      },
      
      // Configuration schemas
      GasSettings: {
        type: 'object',
        properties: {
          gasPrice: {
            type: 'string',
            example: '30000000000',
            description: 'Gas price in wei (for legacy transactions)'
          },
          gasLimit: {
            type: 'string',
            example: '21000',
            description: 'Maximum gas limit'
          },
          maxFeePerGas: {
            type: 'string',
            example: '30000000000',
            description: 'Maximum fee per gas (EIP-1559)'
          },
          maxPriorityFeePerGas: {
            type: 'string',
            example: '2000000000',
            description: 'Maximum priority fee per gas (EIP-1559)'
          },
          type: {
            type: 'string',
            enum: ['legacy', 'eip1559'],
            example: 'eip1559',
            description: 'Transaction type'
          }
        }
      },
      NetworkConfig: {
        type: 'object',
        required: ['id', 'chainId', 'name', 'symbol', 'rpcUrl', 'isTestnet', 'isActive', 'gasSettings', 'createdAt', 'updatedAt'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            example: '123e4567-e89b-12d3-a456-426614174000'
          },
          chainId: {
            type: 'integer',
            example: 137,
            description: 'Blockchain network chain ID'
          },
          name: {
            type: 'string',
            example: 'Polygon',
            description: 'Network display name'
          },
          symbol: {
            type: 'string',
            example: 'MATIC',
            description: 'Native token symbol'
          },
          rpcUrl: {
            type: 'string',
            format: 'uri',
            example: 'https://polygon-mainnet.g.alchemy.com/v2/demo',
            description: 'RPC endpoint URL'
          },
          explorerUrl: {
            type: 'string',
            format: 'uri',
            example: 'https://polygonscan.com',
            description: 'Block explorer base URL'
          },
          isTestnet: {
            type: 'boolean',
            example: false,
            description: 'Whether this is a testnet'
          },
          isActive: {
            type: 'boolean',
            example: true,
            description: 'Whether this network is currently active'
          },
          gasSettings: {
            $ref: '#/components/schemas/GasSettings'
          },
          networkType: {
            type: 'string',
            enum: ['mainnet', 'testnet'],
            example: 'mainnet'
          },
          explorerTxUrl: {
            type: 'string',
            format: 'uri',
            example: 'https://polygonscan.com/tx/',
            description: 'Transaction explorer URL prefix'
          },
          explorerAddressUrl: {
            type: 'string',
            format: 'uri',
            example: 'https://polygonscan.com/address/',
            description: 'Address explorer URL prefix'
          },
          hasEIP1559Support: {
            type: 'boolean',
            example: true,
            description: 'Whether network supports EIP-1559 transactions'
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            example: '2024-01-15T10:30:00.000Z'
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            example: '2024-01-15T10:30:00.000Z'
          }
        }
      },
      TokenConfig: {
        type: 'object',
        required: ['id', 'networkId', 'symbol', 'name', 'decimals', 'isNative', 'isStablecoin', 'isActive', 'createdAt', 'updatedAt'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            example: '123e4567-e89b-12d3-a456-426614174000'
          },
          networkId: {
            type: 'string',
            format: 'uuid',
            example: '456e7890-e89b-12d3-a456-426614174001'
          },
          contractAddress: {
            type: 'string',
            pattern: '^0x[a-fA-F0-9]{40}$',
            example: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            description: 'Token contract address (null for native tokens)'
          },
          symbol: {
            type: 'string',
            example: 'USDC',
            description: 'Token symbol'
          },
          name: {
            type: 'string',
            example: 'USD Coin',
            description: 'Token full name'
          },
          decimals: {
            type: 'integer',
            example: 6,
            description: 'Number of decimal places'
          },
          isNative: {
            type: 'boolean',
            example: false,
            description: 'Whether this is the native token of the network'
          },
          isStablecoin: {
            type: 'boolean',
            example: true,
            description: 'Whether this is a stablecoin'
          },
          logoUrl: {
            type: 'string',
            format: 'uri',
            example: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png',
            description: 'Token logo image URL'
          },
          priceFeedId: {
            type: 'string',
            example: 'usd-coin',
            description: 'Price feed identifier for external APIs'
          },
          isActive: {
            type: 'boolean',
            example: true,
            description: 'Whether this token is currently active'
          },
          displayName: {
            type: 'string',
            example: 'USD Coin (USDC)',
            description: 'Formatted display name'
          },
          isERC20: {
            type: 'boolean',
            example: true,
            description: 'Whether this is an ERC20 token'
          },
          tokenType: {
            type: 'string',
            enum: ['native', 'erc20'],
            example: 'erc20'
          },
          decimalsForDisplay: {
            type: 'integer',
            example: 2,
            description: 'Recommended decimal places for display'
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            example: '2024-01-15T10:30:00.000Z'
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            example: '2024-01-15T10:30:00.000Z'
          },
          network: {
            $ref: '#/components/schemas/NetworkConfig'
          }
        }
      },
      NetworksResponse: {
        type: 'object',
        required: ['networks', 'count', 'mainnets', 'testnets'],
        properties: {
          networks: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/NetworkConfig'
            }
          },
          count: {
            type: 'integer',
            example: 12
          },
          mainnets: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/NetworkConfig'
            }
          },
          testnets: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/NetworkConfig'
            }
          }
        }
      },
      TokensResponse: {
        type: 'object',
        required: ['tokens', 'count', 'stablecoins', 'nativeTokens', 'erc20Tokens'],
        properties: {
          tokens: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/TokenConfig'
            }
          },
          count: {
            type: 'integer',
            example: 25
          },
          stablecoins: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/TokenConfig'
            }
          },
          nativeTokens: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/TokenConfig'
            }
          },
          erc20Tokens: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/TokenConfig'
            }
          }
        }
      },
      NetworkTokensResponse: {
        type: 'object',
        required: ['networkId', 'network', 'tokens', 'count'],
        properties: {
          networkId: {
            type: 'string',
            format: 'uuid',
            example: '123e4567-e89b-12d3-a456-426614174000'
          },
          network: {
            $ref: '#/components/schemas/NetworkConfig'
          },
          tokens: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/TokenConfig'
            }
          },
          count: {
            type: 'integer',
            example: 8
          }
        }
      },
      AppConfig: {
        type: 'object',
        required: ['supportedNetworks', 'supportedTokenSymbols', 'defaultNetwork', 'defaultTokens', 'features', 'limits', 'ui'],
        properties: {
          supportedNetworks: {
            type: 'array',
            items: {
              type: 'integer'
            },
            example: [1, 137, 8453, 42161, 10],
            description: 'Array of supported chain IDs'
          },
          supportedTokenSymbols: {
            type: 'array',
            items: {
              type: 'string'
            },
            example: ['ETH', 'MATIC', 'USDC', 'USDT', 'DAI'],
            description: 'Array of supported token symbols'
          },
          defaultNetwork: {
            type: 'integer',
            example: 137,
            description: 'Default chain ID for new users'
          },
          defaultTokens: {
            type: 'object',
            additionalProperties: {
              type: 'array',
              items: {
                type: 'string'
              }
            },
            example: {
              '123e4567-e89b-12d3-a456-426614174000': ['MATIC', 'USDC', 'USDT']
            },
            description: 'Default tokens by network ID'
          },
          features: {
            type: 'object',
            required: ['invoicing', 'payroll', 'escrow', 'subscriptions', 'crossChain'],
            properties: {
              invoicing: {
                type: 'boolean',
                example: true,
                description: 'Invoice creation and management'
              },
              payroll: {
                type: 'boolean',
                example: true,
                description: 'Batch payroll payments'
              },
              escrow: {
                type: 'boolean',
                example: false,
                description: 'Escrow and milestone payments'
              },
              subscriptions: {
                type: 'boolean',
                example: false,
                description: 'Recurring payment subscriptions'
              },
              crossChain: {
                type: 'boolean',
                example: false,
                description: 'Cross-chain payment routing'
              }
            }
          },
          limits: {
            type: 'object',
            required: ['maxInvoiceAmount', 'minInvoiceAmount', 'maxPayrollRecipients', 'rateLimitPerHour'],
            properties: {
              maxInvoiceAmount: {
                type: 'string',
                example: '1000000',
                description: 'Maximum invoice amount in USD'
              },
              minInvoiceAmount: {
                type: 'string',
                example: '1',
                description: 'Minimum invoice amount in USD'
              },
              maxPayrollRecipients: {
                type: 'integer',
                example: 1000,
                description: 'Maximum recipients per payroll batch'
              },
              rateLimitPerHour: {
                type: 'integer',
                example: 1000,
                description: 'API rate limit per hour per user'
              }
            }
          },
          ui: {
            type: 'object',
            required: ['defaultCurrency', 'theme', 'showTestnets'],
            properties: {
              defaultCurrency: {
                type: 'string',
                enum: ['USD', 'ETH', 'BTC'],
                example: 'USD',
                description: 'Default display currency'
              },
              theme: {
                type: 'string',
                enum: ['light', 'dark', 'auto'],
                example: 'light',
                description: 'Default UI theme'
              },
              showTestnets: {
                type: 'boolean',
                example: false,
                description: 'Whether to show testnet options'
              }
            }
          }
        }
      },
      ConfigResponse: {
        type: 'object',
        required: ['networks', 'tokens', 'appConfig', 'meta'],
        properties: {
          networks: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/NetworkConfig'
            }
          },
          tokens: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/TokenConfig'
            }
          },
          appConfig: {
            $ref: '#/components/schemas/AppConfig'
          },
          meta: {
            type: 'object',
            required: ['networksCount', 'tokensCount', 'lastUpdated', 'cacheExpiry'],
            properties: {
              networksCount: {
                type: 'integer',
                example: 12
              },
              tokensCount: {
                type: 'integer',
                example: 25
              },
              lastUpdated: {
                type: 'string',
                format: 'date-time',
                example: '2024-01-15T10:30:00.000Z'
              },
              cacheExpiry: {
                type: 'integer',
                example: 1705316400000,
                description: 'Cache expiry timestamp'
              }
            }
          }
        }
      },

      // Payment schemas
      Payment: {
        type: 'object',
        required: ['id', 'tenant_id', 'invoice_id', 'transaction_hash', 'amount', 'token_address', 'network', 'from_address', 'to_address', 'status', 'created_at', 'updated_at'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            example: '123e4567-e89b-12d3-a456-426614174000'
          },
          tenant_id: {
            type: 'string',
            example: 'tenant_123'
          },
          invoice_id: {
            type: 'string',
            format: 'uuid',
            example: '123e4567-e89b-12d3-a456-426614174000'
          },
          transaction_hash: {
            type: 'string',
            pattern: '^0x[a-fA-F0-9]{64}$',
            example: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
          },
          amount: {
            type: 'number',
            format: 'double',
            minimum: 0.01,
            example: 3140.00
          },
          token_address: {
            type: 'string',
            pattern: '^0x[a-fA-F0-9]{40}$',
            example: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'
          },
          network: {
            type: 'string',
            enum: ['ethereum', 'polygon', 'arbitrum', 'optimism'],
            example: 'polygon'
          },
          from_address: {
            type: 'string',
            pattern: '^0x[a-fA-F0-9]{40}$',
            example: '0x742d35Cc6635C0532925a3b8D0aC0199'
          },
          to_address: {
            type: 'string',
            pattern: '^0x[a-fA-F0-9]{40}$',
            example: '0x742d35Cc6635C0532925a3b8D0aC0199'
          },
          status: {
            type: 'string',
            enum: ['pending', 'confirmed', 'failed'],
            example: 'confirmed'
          },
          confirmations: {
            type: 'integer',
            minimum: 0,
            example: 24
          },
          block_number: {
            type: 'integer',
            minimum: 0,
            example: 52345678
          },
          gas_used: {
            type: 'integer',
            minimum: 0,
            example: 21000
          },
          confirmed_at: {
            type: 'string',
            format: 'date-time',
            example: '2024-01-20T14:35:00.000Z'
          },
          failure_reason: {
            type: 'string',
            example: 'Insufficient gas'
          },
          created_at: {
            type: 'string',
            format: 'date-time',
            example: '2024-01-15T10:30:00.000Z'
          },
          updated_at: {
            type: 'string',
            format: 'date-time',
            example: '2024-01-15T10:30:00.000Z'
          }
        }
      },
      VerifyPaymentRequest: {
        type: 'object',
        required: ['invoice_id', 'transaction_hash', 'from_address'],
        properties: {
          invoice_id: {
            type: 'string',
            format: 'uuid',
            example: '123e4567-e89b-12d3-a456-426614174000'
          },
          transaction_hash: {
            type: 'string',
            pattern: '^0x[a-fA-F0-9]{64}$',
            example: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
          },
          from_address: {
            type: 'string',
            pattern: '^0x[a-fA-F0-9]{40}$',
            example: '0x742d35Cc6635C0532925a3b8D0aC0199'
          }
        }
      },

      // Template schemas
      Template: {
        type: 'object',
        required: ['id', 'organization_id', 'name', 'template_data', 'is_default', 'created_at', 'updated_at'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            example: '123e4567-e89b-12d3-a456-426614174000'
          },
          organization_id: {
            type: 'string',
            format: 'uuid',
            example: '456e7890-e89b-12d3-a456-426614174001'
          },
          name: {
            type: 'string',
            example: 'Professional Services Template'
          },
          description: {
            type: 'string',
            example: 'Template for professional services invoices'
          },
          template_data: {
            type: 'object',
            properties: {
              branding: {
                type: 'object',
                properties: {
                  logo_url: {
                    type: 'string',
                    format: 'uri',
                    example: 'https://example.com/logo.png'
                  },
                  company_name: {
                    type: 'string',
                    example: 'Acme Corporation'
                  },
                  primary_color: {
                    type: 'string',
                    example: '#007bff'
                  }
                }
              },
              default_payment_terms: {
                type: 'string',
                example: 'Net 30 days'
              },
              default_notes: {
                type: 'string',
                example: 'Thank you for your business'
              }
            }
          },
          is_default: {
            type: 'boolean',
            example: false
          },
          usage_count: {
            type: 'integer',
            minimum: 0,
            example: 15
          },
          created_at: {
            type: 'string',
            format: 'date-time',
            example: '2024-01-15T10:30:00.000Z'
          },
          updated_at: {
            type: 'string',
            format: 'date-time',
            example: '2024-01-15T10:30:00.000Z'
          }
        }
      },
      CreateTemplateRequest: {
        type: 'object',
        required: ['name', 'template_data'],
        properties: {
          name: {
            type: 'string',
            maxLength: 100,
            example: 'Professional Services Template'
          },
          description: {
            type: 'string',
            maxLength: 500,
            example: 'Template for professional services invoices'
          },
          template_data: {
            type: 'object',
            description: 'Template configuration and branding data'
          },
          is_default: {
            type: 'boolean',
            example: false
          }
        }
      },

      // Access Token schemas
      InvoiceAccessToken: {
        type: 'object',
        required: ['id', 'invoice_id', 'token', 'expires_at', 'created_at'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            example: '123e4567-e89b-12d3-a456-426614174000'
          },
          invoice_id: {
            type: 'string',
            format: 'uuid',
            example: '456e7890-e89b-12d3-a456-426614174001'
          },
          token: {
            type: 'string',
            example: 'tok_1234567890abcdef'
          },
          expires_at: {
            type: 'string',
            format: 'date-time',
            example: '2024-02-15T10:30:00.000Z'
          },
          accessed_at: {
            type: 'string',
            format: 'date-time',
            example: '2024-01-20T14:15:00.000Z'
          },
          access_count: {
            type: 'integer',
            minimum: 0,
            example: 3
          },
          created_at: {
            type: 'string',
            format: 'date-time',
            example: '2024-01-15T10:30:00.000Z'
          }
        }
      },

      // Notification schemas
      NotificationQueue: {
        type: 'object',
        required: ['id', 'organization_id', 'type', 'recipient_email', 'status', 'created_at'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            example: '123e4567-e89b-12d3-a456-426614174000'
          },
          organization_id: {
            type: 'string',
            format: 'uuid',
            example: '456e7890-e89b-12d3-a456-426614174001'
          },
          type: {
            type: 'string',
            enum: ['invoice_sent', 'payment_received', 'payment_reminder', 'payment_overdue', 'invoice_cancelled'],
            example: 'invoice_sent'
          },
          recipient_email: {
            type: 'string',
            format: 'email',
            example: 'client@example.com'
          },
          template_data: {
            type: 'object',
            description: 'Data for email template rendering'
          },
          status: {
            type: 'string',
            enum: ['pending', 'processing', 'sent', 'failed', 'retry'],
            example: 'sent'
          },
          channels: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['email', 'webhook', 'sms']
            },
            example: ['email']
          },
          priority: {
            type: 'string',
            enum: ['high', 'medium', 'low'],
            example: 'medium'
          },
          retry_count: {
            type: 'integer',
            minimum: 0,
            example: 0
          },
          sent_at: {
            type: 'string',
            format: 'date-time',
            example: '2024-01-15T10:35:00.000Z'
          },
          error_message: {
            type: 'string',
            example: 'SMTP connection failed'
          },
          created_at: {
            type: 'string',
            format: 'date-time',
            example: '2024-01-15T10:30:00.000Z'
          }
        }
      },

      // Background Job schemas
      PaymentVerificationJob: {
        type: 'object',
        required: ['id', 'organization_id', 'invoice_id', 'job_type', 'job_data', 'status', 'created_at'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            example: '123e4567-e89b-12d3-a456-426614174000'
          },
          organization_id: {
            type: 'string',
            format: 'uuid',
            example: '456e7890-e89b-12d3-a456-426614174001'
          },
          invoice_id: {
            type: 'string',
            format: 'uuid',
            example: '789e1234-e89b-12d3-a456-426614174002'
          },
          job_type: {
            type: 'string',
            enum: ['payment_verification', 'scheduled_notification', 'reminder_escalation'],
            example: 'payment_verification'
          },
          job_data: {
            type: 'object',
            properties: {
              transaction_hash: {
                type: 'string',
                pattern: '^0x[a-fA-F0-9]{64}$',
                example: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
              },
              network_id: {
                type: 'integer',
                example: 137
              },
              expected_amount: {
                type: 'string',
                example: '1000.00'
              }
            }
          },
          status: {
            type: 'string',
            enum: ['pending', 'processing', 'completed', 'failed', 'retry'],
            example: 'completed'
          },
          retry_count: {
            type: 'integer',
            minimum: 0,
            example: 0
          },
          scheduled_at: {
            type: 'string',
            format: 'date-time',
            example: '2024-01-15T10:30:00.000Z'
          },
          processed_at: {
            type: 'string',
            format: 'date-time',
            example: '2024-01-15T10:32:00.000Z'
          },
          result: {
            type: 'object',
            description: 'Job execution result data'
          },
          error_message: {
            type: 'string',
            example: 'Transaction not found on blockchain'
          },
          created_at: {
            type: 'string',
            format: 'date-time',
            example: '2024-01-15T10:30:00.000Z'
          }
        }
      }
    },
    parameters: {
      LimitParam: {
        name: 'limit',
        in: 'query',
        description: 'Maximum number of items to return (1-100)',
        required: false,
        schema: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          default: 50
        }
      },
      NextTokenParam: {
        name: 'nextToken',
        in: 'query',
        description: 'Token for pagination - get next page of results',
        required: false,
        schema: {
          type: 'string'
        }
      },
      ChainIdParam: {
        name: 'chainId',
        in: 'path',
        description: 'Blockchain network chain ID',
        required: true,
        schema: {
          type: 'integer',
          minimum: 0,
          example: 137
        }
      },
      ActiveParam: {
        name: 'active',
        in: 'query',
        description: 'Filter by active status',
        required: false,
        schema: {
          type: 'string',
          enum: ['true', 'false']
        }
      },
      TestnetParam: {
        name: 'testnet',
        in: 'query',
        description: 'Filter by network type (mainnet/testnet)',
        required: false,
        schema: {
          type: 'string',
          enum: ['true', 'false']
        }
      },
      ChainIdsParam: {
        name: 'chainIds',
        in: 'query',
        description: 'Comma-separated list of chain IDs to filter by',
        required: false,
        schema: {
          type: 'string',
          example: '1,137,42161'
        }
      },
      SymbolsParam: {
        name: 'symbols',
        in: 'query',
        description: 'Comma-separated list of token symbols to filter by',
        required: false,
        schema: {
          type: 'string',
          example: 'ETH,USDC,USDT'
        }
      },
      StablecoinParam: {
        name: 'stablecoin',
        in: 'query',
        description: 'Filter by stablecoin status',
        required: false,
        schema: {
          type: 'string',
          enum: ['true', 'false']
        }
      },
      NativeParam: {
        name: 'native',
        in: 'query',
        description: 'Filter by native token status',
        required: false,
        schema: {
          type: 'string',
          enum: ['true', 'false']
        }
      },
      NetworkIdParam: {
        name: 'networkId',
        in: 'query',
        description: 'Filter by specific network UUID',
        required: false,
        schema: {
          type: 'string',
          format: 'uuid'
        }
      },
      IncludeNetworkParam: {
        name: 'includeNetwork',
        in: 'query',
        description: 'Include network details in token response',
        required: false,
        schema: {
          type: 'string',
          enum: ['true', 'false'],
          default: 'false'
        }
      },
      InvoiceIdParam: {
        name: 'invoiceId',
        in: 'path',
        description: 'Unique identifier for the invoice',
        required: true,
        schema: {
          type: 'string',
          format: 'uuid'
        }
      },
      PaymentIdParam: {
        name: 'paymentId',
        in: 'path',
        description: 'Unique identifier for the payment',
        required: true,
        schema: {
          type: 'string',
          format: 'uuid'
        }
      },
      UserIdParam: {
        name: 'userId',
        in: 'path',
        description: 'Unique identifier for the user',
        required: true,
        schema: {
          type: 'string',
          format: 'uuid'
        }
      },
      TemplateIdParam: {
        name: 'templateId',
        in: 'path',
        description: 'Unique identifier for the template',
        required: true,
        schema: {
          type: 'string',
          format: 'uuid'
        }
      },
      NotificationIdParam: {
        name: 'notificationId',
        in: 'path',
        description: 'Unique identifier for the notification',
        required: true,
        schema: {
          type: 'string',
          format: 'uuid'
        }
      },
      JobIdParam: {
        name: 'jobId',
        in: 'path',
        description: 'Unique identifier for the background job',
        required: true,
        schema: {
          type: 'string',
          format: 'uuid'
        }
      },
      AccessTokenParam: {
        name: 'token',
        in: 'path',
        description: 'Client access token for public invoice viewing',
        required: true,
        schema: {
          type: 'string',
          example: 'tok_1234567890abcdef'
        }
      }
    },
    responses: {
      BadRequest: {
        description: 'Bad Request - Invalid input parameters',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            },
            example: {
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Invalid request parameters',
                details: {
                  field: 'email',
                  message: 'Invalid email format'
                }
              },
              meta: {
                requestId: '123e4567-e89b-12d3-a456-426614174000',
                timestamp: '2024-01-15T10:30:00.000Z'
              }
            }
          }
        }
      },
      Unauthorized: {
        description: 'Unauthorized - Authentication required',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            },
            example: {
              success: false,
              error: {
                code: 'UNAUTHORIZED',
                message: 'Authentication required'
              },
              meta: {
                requestId: '123e4567-e89b-12d3-a456-426614174000',
                timestamp: '2024-01-15T10:30:00.000Z'
              }
            }
          }
        }
      },
      NotFound: {
        description: 'Not Found - Resource does not exist',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            },
            example: {
              success: false,
              error: {
                code: 'NOT_FOUND',
                message: 'Resource not found'
              },
              meta: {
                requestId: '123e4567-e89b-12d3-a456-426614174000',
                timestamp: '2024-01-15T10:30:00.000Z'
              }
            }
          }
        }
      },
      InternalError: {
        description: 'Internal Server Error',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            },
            example: {
              success: false,
              error: {
                code: 'INTERNAL_ERROR',
                message: 'An internal server error occurred'
              },
              meta: {
                requestId: '123e4567-e89b-12d3-a456-426614174000',
                timestamp: '2024-01-15T10:30:00.000Z'
              }
            }
          }
        }
      }
    }
  },
  security: [
    {
      bearerAuth: []
    }
  ],
  tags: [
    {
      name: 'Authentication',
      description: 'Wallet-based authentication with challenge/response flow and JWT token management'
    },
    {
      name: 'Users', 
      description: 'User profile management, statistics, and notification preferences'
    },
    {
      name: 'Invoices',
      description: 'Complete invoice lifecycle: creation, management, payment processing, and analytics'
    },
    {
      name: 'Templates',
      description: 'Invoice template management with organization branding and customization'
    },
    {
      name: 'Payments',
      description: 'Blockchain payment verification, processing, and transaction management'
    },
    {
      name: 'Public',
      description: 'Public endpoints for client invoice access and payment processing (no authentication)'
    },
    {
      name: 'Notifications',
      description: 'Email notification management, preferences, and delivery status'
    },
    {
      name: 'Background Jobs',
      description: 'Background job processing for payment verification and automated tasks'
    },
    {
      name: 'Configuration',
      description: 'Blockchain networks, tokens, and application configuration management',
      externalDocs: {
        description: 'Configuration API Guide',
        url: 'https://docs.fluxion.dev/api/configuration'
      }
    },
    {
      name: 'Admin',
      description: 'Administrative endpoints for network/token management and system configuration'
    },
    {
      name: 'Analytics',
      description: 'Business intelligence, dashboard metrics, and reporting endpoints'
    },
    {
      name: 'Health',
      description: 'System health monitoring, status checks, and service connectivity'
    }
  ]
};

const options = {
  definition: swaggerDefinition,
  apis: [
    './src/modules/**/*.ts', // Path to the API files
    './src/**/*.ts',         // Include all TypeScript files for JSDoc comments
  ],
};

const specs = swaggerJsdoc(options);

/**
 * Setup Swagger documentation middleware
 */
export const setupSwagger = (app: Express, basePath: string = '/docs'): void => {
  // Swagger UI options
  const swaggerUiOptions = {
    customCss: `
      .swagger-ui .topbar { display: none; }
      .swagger-ui .scheme-container { display: none; }
    `,
    customSiteTitle: 'Fluxion Admin API Documentation',
    customfavIcon: '/favicon.ico',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      tryItOutEnabled: true,
      requestInterceptor: (req: any) => {
        // Add request ID header for tracing
        req.headers['X-Request-ID'] = generateRequestId();
        return req;
      }
    }
  };

  // Setup Swagger UI with configurable base path
  app.use(basePath, swaggerUi.serve, swaggerUi.setup(specs, swaggerUiOptions));
  
  // Serve raw OpenAPI spec
  app.get(`${basePath}.json`, (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
  });

  console.log(`📚 Swagger documentation available at ${basePath}`);
  console.log(`📄 OpenAPI spec available at ${basePath}.json`);
};

/**
 * Generate a unique request ID for tracing
 */
function generateRequestId(): string {
  return 'req_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export { specs as swaggerSpecs };
export default swaggerDefinition;