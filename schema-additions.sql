-- Database Indexes and Performance Optimization
CREATE INDEX idx_users_organization_email ON users(organization_id, email);
CREATE INDEX idx_users_wallet_address ON users(wallet_address) WHERE wallet_address IS NOT NULL;
CREATE INDEX idx_invoices_organization_status ON invoices(organization_id, status);
CREATE INDEX idx_invoices_client_email ON invoices(client_email);
CREATE INDEX idx_invoices_due_date ON invoices(due_date) WHERE status IN ('sent', 'overdue');
CREATE INDEX idx_payments_organization_status ON payments(organization_id, status);
CREATE INDEX idx_payments_tx_hash ON payments(tx_hash);
CREATE INDEX idx_payments_invoice_id ON payments(invoice_id) WHERE invoice_id IS NOT NULL;
CREATE INDEX idx_payroll_batches_organization ON payroll_batches(organization_id, status);
CREATE INDEX idx_payroll_recipients_batch ON payroll_recipients(batch_id);
CREATE INDEX idx_blockchain_networks_chain_id ON blockchain_networks(chain_id);
CREATE INDEX idx_tokens_network_symbol ON tokens(network_id, symbol);
CREATE INDEX idx_audit_logs_organization_table ON audit_logs(organization_id, table_name);

-- Enable Row Level Security
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Example for invoices - similar patterns for other tables)
CREATE POLICY invoices_tenant_isolation ON invoices
    USING (organization_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY payments_tenant_isolation ON payments
    USING (organization_id = current_setting('app.current_tenant_id')::UUID);

-- Functions for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payroll_batches_updated_at BEFORE UPDATE ON payroll_batches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_organization_settings_updated_at BEFORE UPDATE ON organization_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed default blockchain networks
INSERT INTO blockchain_networks (chain_id, name, symbol, rpc_url, explorer_url, is_testnet, gas_settings) VALUES
(1, 'Ethereum Mainnet', 'ETH', 'https://eth-mainnet.alchemyapi.io/v2/YOUR_KEY', 'https://etherscan.io', false, '{"maxGas": 21000, "priorityFee": "2000000000"}'),
(137, 'Polygon Mainnet', 'MATIC', 'https://polygon-mainnet.alchemyapi.io/v2/YOUR_KEY', 'https://polygonscan.com', false, '{"maxGas": 21000, "priorityFee": "30000000000"}'),
(42161, 'Arbitrum One', 'ETH', 'https://arb-mainnet.alchemyapi.io/v2/YOUR_KEY', 'https://arbiscan.io', false, '{"maxGas": 21000, "priorityFee": "100000000"}'),
(8453, 'Base Mainnet', 'ETH', 'https://base-mainnet.alchemyapi.io/v2/YOUR_KEY', 'https://basescan.org', false, '{"maxGas": 21000, "priorityFee": "1000000000"}'),
(11155111, 'Ethereum Sepolia', 'ETH', 'https://eth-sepolia.alchemyapi.io/v2/YOUR_KEY', 'https://sepolia.etherscan.io', true, '{"maxGas": 21000, "priorityFee": "2000000000"}');

-- Seed default tokens for each network
INSERT INTO tokens (network_id, contract_address, symbol, name, decimals, is_native, is_stablecoin) 
SELECT n.id, NULL, n.symbol, n.name || ' Native Token', 18, true, false
FROM blockchain_networks n;

-- Add USDC for major networks
INSERT INTO tokens (network_id, contract_address, symbol, name, decimals, is_native, is_stablecoin) VALUES
((SELECT id FROM blockchain_networks WHERE chain_id = 1), '0xA0b86a33E6417eFf81fd769077e5b59a3B1d0C8d', 'USDC', 'USD Coin', 6, false, true),
((SELECT id FROM blockchain_networks WHERE chain_id = 137), '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', 'USDC', 'USD Coin', 6, false, true),
((SELECT id FROM blockchain_networks WHERE chain_id = 42161), '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', 'USDC', 'USD Coin', 6, false, true),
((SELECT id FROM blockchain_networks WHERE chain_id = 8453), '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', 'USDC', 'USD Coin', 6, false, true);