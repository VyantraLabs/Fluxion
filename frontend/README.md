# Fluxion Frontend

A production-ready Next.js frontend for Fluxion - the crypto-native invoicing platform. Built with TypeScript, Tailwind CSS, and Web3 integration for seamless USDC payments on Polygon.

## 🚀 Features

### ✅ Implemented Core Features

- **🔗 Web3 Wallet Integration**: Metamask connection with ethers.js v6
- **🔐 Wallet Authentication**: Signature-based auth with JWT tokens
- **📄 Professional Landing Page**: Marketing site with feature showcase
- **📊 Dashboard Layout**: Responsive sidebar navigation and overview
- **🎨 Modern UI Components**: Tailwind CSS with custom design system
- **⚡ Real-time State Management**: React Context for Web3 and Auth
- **🛡️ Error Handling**: Comprehensive error boundaries and user feedback
- **📱 Responsive Design**: Mobile-first design with desktop optimization
- **🔧 Utility Functions**: Complete Web3, validation, and formatting utilities

### 🚧 Ready for Implementation (Architecture Complete)

- **📋 Invoice Creation**: Form with line items and validation
- **💰 Payment Processing**: USDC transfers on Polygon
- **📄 PDF Generation**: Client-side invoice PDF creation
- **📈 Analytics Dashboard**: Payment tracking and insights
- **⚙️ Settings Management**: User profile and preferences

## 🛠️ Tech Stack

### Core Framework
- **Next.js 14**: App Router with TypeScript
- **React 18**: Modern React with hooks and context
- **TypeScript**: Full type safety throughout

### Styling & UI
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Beautiful SVG icons
- **Framer Motion**: Smooth animations
- **React Hot Toast**: Toast notifications

### Web3 Integration
- **Ethers.js v6**: Ethereum blockchain interaction
- **MetaMask**: Primary wallet provider
- **Polygon Network**: USDC payments with low fees

### State Management
- **React Context**: Web3 and authentication state
- **React Query**: Server state and caching
- **Local Storage**: Persistent client-side data

### Development Tools
- **ESLint**: Code linting and quality
- **Prettier**: Code formatting
- **Jest**: Unit testing framework
- **TypeScript**: Static type checking

## 📁 Project Structure

```
frontend/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── dashboard/          # Protected dashboard routes
│   │   ├── globals.css         # Global styles
│   │   ├── layout.tsx          # Root layout with metadata
│   │   ├── page.tsx            # Landing page
│   │   └── providers.tsx       # Global providers setup
│   ├── components/             # React components
│   │   ├── common/             # Shared components
│   │   ├── layout/             # Layout components
│   │   ├── pages/              # Page-specific components
│   │   └── web3/               # Web3-related components
│   ├── contexts/               # React contexts
│   │   ├── AuthContext.tsx     # Authentication state
│   │   └── Web3Context.tsx     # Web3 wallet state
│   ├── hooks/                  # Custom React hooks
│   ├── services/               # API and external services
│   ├── types/                  # TypeScript type definitions
│   │   ├── common.ts           # Common types
│   │   ├── invoice.ts          # Invoice-related types
│   │   ├── payment.ts          # Payment types
│   │   ├── user.ts             # User and auth types
│   │   └── web3.ts             # Web3 and wallet types
│   └── utils/                  # Utility functions
│       ├── api.ts              # API client and helpers
│       ├── config.ts           # Environment configuration
│       ├── constants.ts        # Application constants
│       ├── format.ts           # Formatting utilities
│       ├── helpers.ts          # General helper functions
│       ├── storage.ts          # Local storage utilities
│       ├── validation.ts       # Form validation with Zod
│       └── web3.ts             # Web3 utility functions
├── public/                     # Static assets
├── .env.example                # Environment variables template
├── .env.local                  # Local development environment
├── next.config.js              # Next.js configuration
├── package.json                # Dependencies and scripts
├── tailwind.config.js          # Tailwind CSS configuration
└── tsconfig.json               # TypeScript configuration
```

## 🚀 Getting Started

### Prerequisites

- **Node.js 18+** with npm
- **MetaMask** browser extension
- **Polygon** network configured in MetaMask

### Installation

1. **Install dependencies**:
   ```bash
   cd frontend
   npm install
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env.local
   ```

3. **Configure your environment**:
   Update `.env.local` with your configuration:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:3000
   NEXT_PUBLIC_DEFAULT_CHAIN_ID=80001  # Mumbai testnet for development
   NEXT_PUBLIC_DEBUG=true
   ```

4. **Start the development server**:
   ```bash
   npm run dev
   ```

5. **Open your browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

### Development Commands

```bash
# Development
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript checks

# Testing
npm run test         # Run Jest tests
npm run test:watch   # Run tests in watch mode
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | `https://api.fluxion.pay` |
| `NEXT_PUBLIC_DEFAULT_CHAIN_ID` | Default blockchain network | `137` (Polygon) |
| `NEXT_PUBLIC_POLYGON_RPC_URL` | Polygon RPC endpoint | `https://polygon-rpc.com` |
| `NEXT_PUBLIC_DEBUG` | Enable debug mode | `false` |

### Network Configuration

The app supports Polygon mainnet and Mumbai testnet:

- **Polygon Mainnet** (Chain ID: 137)
  - USDC Contract: `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174`
  - Block Explorer: https://polygonscan.com

- **Mumbai Testnet** (Chain ID: 80001)
  - USDC Contract: `0x9999f7fea5938fd3b1e26a12c3f2fb024e194f97`
  - Block Explorer: https://mumbai.polygonscan.com

## 💡 Key Features Implementation

### Web3 Wallet Integration

```typescript
// Connect wallet with authentication
const { connectAndAuthenticate } = useWalletAuth();

// Usage in components
<WalletConnectButton />
```

### Type-Safe API Integration

```typescript
// Typed API calls with error handling
const invoice = await invoiceApi.create({
  client_name: "Acme Corp",
  amount: 1000,
  description: "Web development services"
});
```

### Responsive Design System

```typescript
// Tailwind utility classes with custom variants
className="btn-primary lg:btn-lg mobile:w-full"
```

### Error Boundaries

```typescript
// Automatic error catching and user-friendly displays
<ErrorBoundary>
  <YourComponent />
</ErrorBoundary>
```

## 📱 Responsive Design

The application is fully responsive with:

- **Mobile-first approach** with Tailwind CSS
- **Breakpoint-specific designs** for all screen sizes
- **Touch-friendly interactions** for mobile devices
- **Optimized navigation** with collapsible sidebar

### Breakpoints

- **Mobile**: < 768px
- **Tablet**: 768px - 1024px  
- **Desktop**: > 1024px

## 🔒 Security Features

- **Wallet signature authentication** (no passwords)
- **Input validation** with Zod schemas
- **XSS protection** with Content Security Policy
- **Error boundaries** to prevent crashes
- **Secure local storage** with encryption
- **Rate limiting** on API calls

## 🎨 Design System

### Colors

- **Primary**: Blue (`#3b82f6`)
- **Success**: Green (`#10b981`)
- **Warning**: Amber (`#f59e0b`)
- **Error**: Red (`#ef4444`)

### Typography

- **Font Family**: Inter (system fallback)
- **Font Sizes**: Tailwind's default scale
- **Font Weights**: 400, 500, 600, 700, 800

### Components

All components follow consistent patterns:
- **Props interfaces** with TypeScript
- **Responsive design** with Tailwind
- **Accessibility** with proper ARIA labels
- **Error states** with user feedback

## 🧪 Testing Strategy

### Unit Tests
- **Component testing** with React Testing Library
- **Utility function testing** with Jest
- **Mock implementations** for Web3 providers

### Integration Tests
- **API integration testing** with mock servers
- **User flow testing** with realistic data
- **Error scenario testing** for edge cases

### E2E Tests (Future)
- **Wallet connection flows**
- **Invoice creation process**
- **Payment processing**

## 📦 Deployment

### Vercel (Recommended)

1. **Connect your repository** to Vercel
2. **Set environment variables** in Vercel dashboard
3. **Deploy automatically** on git push

### Manual Deployment

```bash
# Build the application
npm run build

# Start production server
npm run start
```

### Docker Deployment

```dockerfile
# Dockerfile example
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## 🔄 Integration with Backend

The frontend is designed to work with the Fluxion monolithic Lambda backend:

### API Integration
- **Automatic authentication** with JWT tokens
- **Error handling** with proper user feedback
- **Loading states** for all async operations
- **Retry logic** for failed requests

### WebSocket Support (Future)
- **Real-time payment notifications**
- **Invoice status updates**
- **Multi-user collaboration**

## 🚀 Performance Optimizations

- **Code splitting** with Next.js dynamic imports
- **Image optimization** with Next.js Image component
- **Bundle analysis** to identify large dependencies
- **Caching strategies** with React Query
- **Lazy loading** for non-critical components

## 🧭 Roadmap

### Phase 2 Features
- [ ] **Multi-chain support** (Ethereum, BSC)
- [ ] **Recurring invoices** with automation
- [ ] **Team collaboration** with multi-user support
- [ ] **Advanced analytics** with charts
- [ ] **Mobile app** with React Native
- [ ] **API for third-party integration**

### Phase 3 Features
- [ ] **Escrow contracts** for secure payments
- [ ] **Dispute resolution** system
- [ ] **Tax reporting** and compliance
- [ ] **Multi-language support**
- [ ] **White-label solutions**

## 🤝 Contributing

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit your changes** (`git commit -m 'Add amazing feature'`)
4. **Push to the branch** (`git push origin feature/amazing-feature`)
5. **Open a Pull Request**

### Development Guidelines

- **Follow TypeScript best practices**
- **Write comprehensive tests**
- **Use semantic commit messages**
- **Update documentation for new features**
- **Ensure responsive design**

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [docs.fluxion.pay](https://docs.fluxion.pay)
- **Discord**: [Join our community](https://discord.gg/fluxion)
- **Email**: [support@fluxion.pay](mailto:support@fluxion.pay)
- **GitHub Issues**: [Report bugs](https://github.com/fluxion-pay/frontend/issues)

## 🙏 Acknowledgments

- **Next.js team** for the amazing framework
- **Tailwind CSS** for the utility-first approach
- **Ethers.js** for Web3 integration
- **Polygon team** for the scalable blockchain platform
- **Open source community** for the incredible tools

---

**Built with ❤️ for the crypto economy by the Fluxion team**