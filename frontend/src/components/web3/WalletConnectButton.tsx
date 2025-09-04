// Re-export the client-only version to avoid hydration mismatches
export { WalletConnectButton } from './ClientOnlyWalletButton';

// Export other components from the original file
export { WalletStatus, NetworkIndicator } from './WalletConnectButtonInternal';