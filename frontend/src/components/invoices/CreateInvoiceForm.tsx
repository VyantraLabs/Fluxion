'use client';

import { useState, useEffect } from 'react';
import { CreateInvoiceRequest, InvoiceFormData } from '@/types/invoice';
import { useAuth } from '@/contexts/AuthContext';
import { useWeb3 } from '@/contexts/Web3Context';
import { useConfig, useNetworks, useTokens } from '@/contexts/ConfigContext';
import toast from 'react-hot-toast';

interface CreateInvoiceFormProps {
  onSubmit: (data: CreateInvoiceRequest) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function CreateInvoiceForm({ 
  onSubmit, 
  onCancel, 
  isLoading = false
}: CreateInvoiceFormProps) {
  // Context hooks
  const { state: authState } = useAuth();
  const web3Context = useWeb3();
  const { config } = useConfig();
  const networks = useNetworks();
  const tokens = useTokens();
  const [formData, setFormData] = useState<InvoiceFormData>({
    title: '',
    description: '',
    clientName: '',
    clientEmail: '',
    amount: '',
    dueDate: '',
    networkId: web3Context?.chainId ? web3Context.chainId.toString() : config.defaultNetworkId.toString(),
    tokenId: ''
  });

  const [filteredTokens, setFilteredTokens] = useState<typeof tokens>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Filter tokens based on selected network
  useEffect(() => {
    if (formData.networkId && tokens.length > 0) {
      // Find the selected network to get its ID format for filtering
      const selectedNetwork = networks.find(n => 
        n.chainId.toString() === formData.networkId || 
        n.id === formData.networkId
      );
      
      if (selectedNetwork) {
        // Filter tokens by the network's UUID, not chainId
        const networkTokens = tokens.filter(token => 
          token.networkId === selectedNetwork.id
        );
        setFilteredTokens(networkTokens);
        console.log('Filtered tokens for network', selectedNetwork.name, ':', networkTokens.length);
      } else {
        setFilteredTokens([]);
        console.log('No network found for networkId:', formData.networkId);
      }
    } else {
      setFilteredTokens([]);
    }
  }, [formData.networkId, tokens, networks]);

  // Set default network when config loads
  useEffect(() => {
    if (config.isLoaded && !formData.networkId) {
      setFormData(prev => ({
        ...prev,
        networkId: config.defaultNetworkId.toString()
      }));
    }
  }, [config.isLoaded, config.defaultNetworkId, formData.networkId]);

  // Authentication check
  useEffect(() => {
    if (!authState.isAuthenticated) {
      toast.error('Please connect your wallet and authenticate to create invoices');
      onCancel();
    }
  }, [authState.isAuthenticated, onCancel]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!formData.clientName.trim()) {
      newErrors.clientName = 'Client name is required';
    }

    if (!formData.clientEmail.trim()) {
      newErrors.clientEmail = 'Client email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.clientEmail)) {
      newErrors.clientEmail = 'Please enter a valid email address';
    }

    if (!formData.amount.trim()) {
      newErrors.amount = 'Amount is required';
    } else if (isNaN(parseFloat(formData.amount)) || parseFloat(formData.amount) <= 0) {
      newErrors.amount = 'Please enter a valid amount greater than 0';
    }

    if (!formData.networkId) {
      newErrors.networkId = 'Please select a network';
    }

    if (!formData.tokenId) {
      newErrors.tokenId = 'Please select a token';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      const submitData: CreateInvoiceRequest = {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        clientName: formData.clientName.trim() || undefined,
        clientEmail: formData.clientEmail.trim() || undefined,
        amount: parseFloat(formData.amount.trim()),
        dueDate: formData.dueDate || undefined,
        networkId: parseInt(formData.networkId),
        tokenId: formData.tokenId
      };

      await onSubmit(submitData);
      
      // Reset form on success
      setFormData({
        title: '',
        description: '',
        clientName: '',
        clientEmail: '',
        amount: '',
        dueDate: '',
        networkId: config.defaultNetworkId.toString(),
        tokenId: ''
      });
      
      toast.success('Invoice created successfully!');
    } catch (error: any) {
      console.error('Error creating invoice:', error);
      const errorMessage = error.message || 'Failed to create invoice';
      toast.error(errorMessage);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Create Invoice</h2>
        <button
          type="button"
          onClick={onCancel}
          className="text-gray-500 hover:text-gray-700"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
            Invoice Title *
          </label>
          <input
            type="text"
            id="title"
            name="title"
            value={formData.title}
            onChange={handleInputChange}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.title ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="e.g., Website Development Services"
          />
          {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title}</p>}
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            value={formData.description}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Optional description of the work performed..."
          />
        </div>

        {/* Client Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="clientName" className="block text-sm font-medium text-gray-700 mb-1">
              Client Name *
            </label>
            <input
              type="text"
              id="clientName"
              name="clientName"
              value={formData.clientName}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.clientName ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="John Doe"
            />
            {errors.clientName && <p className="mt-1 text-sm text-red-600">{errors.clientName}</p>}
          </div>

          <div>
            <label htmlFor="clientEmail" className="block text-sm font-medium text-gray-700 mb-1">
              Client Email *
            </label>
            <input
              type="email"
              id="clientEmail"
              name="clientEmail"
              value={formData.clientEmail}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.clientEmail ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="john@example.com"
            />
            {errors.clientEmail && <p className="mt-1 text-sm text-red-600">{errors.clientEmail}</p>}
          </div>
        </div>

        {/* Payment Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">
              Amount *
            </label>
            <input
              type="number"
              step="0.000001"
              id="amount"
              name="amount"
              value={formData.amount}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.amount ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="1000.50"
            />
            {errors.amount && <p className="mt-1 text-sm text-red-600">{errors.amount}</p>}
          </div>

          <div>
            <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700 mb-1">
              Due Date
            </label>
            <input
              type="date"
              id="dueDate"
              name="dueDate"
              value={formData.dueDate}
              onChange={handleInputChange}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Blockchain Settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="networkId" className="block text-sm font-medium text-gray-700 mb-1">
              Network *
            </label>
            <select
              id="networkId"
              name="networkId"
              value={formData.networkId}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.networkId ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">Select Network</option>
              {networks.map(network => (
                <option key={network.id} value={network.chainId.toString()}>
                  {network.name} (Chain ID: {network.chainId})
                </option>
              ))}
            </select>
            {errors.networkId && <p className="mt-1 text-sm text-red-600">{errors.networkId}</p>}
          </div>

          <div>
            <label htmlFor="tokenId" className="block text-sm font-medium text-gray-700 mb-1">
              Token *
            </label>
            <select
              id="tokenId"
              name="tokenId"
              value={formData.tokenId}
              onChange={handleInputChange}
              disabled={!formData.networkId}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 ${
                errors.tokenId ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">Select Token</option>
              {filteredTokens.map(token => (
                <option key={token.id} value={token.id}>
                  {token.symbol} - {token.name} {token.isStablecoin ? '(Stablecoin)' : ''}
                </option>
              ))}
            </select>
            {errors.tokenId && <p className="mt-1 text-sm text-red-600">{errors.tokenId}</p>}
          </div>
        </div>

        {/* Submit Buttons */}
        <div className="flex justify-end space-x-4 pt-6">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Creating...
              </>
            ) : (
              'Create Invoice'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}