// Development-only mock wallet for testing wallet connection without MetaMask
// This is only for debugging purposes and should not be used in production

export const createMockEthereum = () => {
  if (process.env.NODE_ENV !== 'development') {
    console.warn('Mock wallet should only be used in development');
    return null;
  }

  const mockEthereum = {
    isMetaMask: true,
    chainId: '0x89', // Polygon mainnet
    selectedAddress: null as string | null,
    
    isConnected: () => !!mockEthereum.selectedAddress,
    
    request: async ({ method, params }: { method: string; params?: any[] }) => {
      console.log('Mock wallet request:', method, params);
      
      switch (method) {
        case 'eth_accounts':
          return mockEthereum.selectedAddress ? [mockEthereum.selectedAddress] : [];
          
        case 'eth_requestAccounts':
          // Simulate user approval
          const mockAddress = '0x1234567890123456789012345678901234567890';
          mockEthereum.selectedAddress = mockAddress;
          console.log('Mock wallet connected:', mockAddress);
          return [mockAddress];
          
        case 'eth_chainId':
          return mockEthereum.chainId;
          
        case 'personal_sign':
          const [message, address] = params || [];
          console.log('Mock signing message:', message, 'from:', address);
          // Return a mock signature
          return '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b';
          
        case 'wallet_switchEthereumChain':
          const [{ chainId }] = params || [];
          mockEthereum.chainId = chainId;
          console.log('Mock switched to chain:', chainId);
          return null;
          
        default:
          console.warn('Mock wallet: Unsupported method:', method);
          throw new Error(`Mock wallet: Unsupported method: ${method}`);
      }
    },
    
    on: (event: string, handler: (...args: any[]) => void) => {
      console.log('Mock wallet: Added event listener for:', event);
      // In a real implementation, we'd store these handlers and call them
      // For testing, we'll just log that they were registered
    },
    
    removeListener: (event: string, handler: (...args: any[]) => void) => {
      console.log('Mock wallet: Removed event listener for:', event);
    },
  };
  
  return mockEthereum;
};

// Function to enable mock wallet for testing (call in browser console)
export const enableMockWallet = () => {
  if (typeof window !== 'undefined') {
    const mockEthereum = createMockEthereum();
    if (mockEthereum) {
      (window as any).ethereum = mockEthereum;
      console.log('Mock wallet enabled for testing');
      console.log('You can now test wallet connection without MetaMask');
    }
  }
};

// Auto-enable mock wallet in development if no real wallet is detected
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  // Wait a bit for real MetaMask to load
  setTimeout(() => {
    if (!window.ethereum) {
      console.log('No wallet detected, enabling mock wallet for development');
      enableMockWallet();
    } else if (window.ethereum && !window.ethereum.isMetaMask) {
      console.log('Non-MetaMask wallet detected, mock wallet not enabled');
    }
  }, 1000);
}