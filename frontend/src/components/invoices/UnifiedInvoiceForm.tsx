'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  User,
  CreditCard,
  Eye,
  Save,
  Send,
  Calendar,
  DollarSign,
  Mail,
  AlertCircle,
  CheckCircle,
  Loader2,
  X,
} from 'lucide-react';
import { NetworkTokenSelector } from './NetworkTokenSelector';
import { InvoicePreview } from './InvoicePreview';
import { invoiceApi, handleApiResponse, handleApiError } from '@/utils/api';
import { formatInput } from '@/utils/format';
import { CreateInvoiceRequest, InvoiceFormData } from '@/types/invoice';
import { useAuth } from '@/contexts/AuthContext';
import { useConfig, useNetworks, useTokens } from '@/contexts/ConfigContext';
import toast from 'react-hot-toast';

interface FormStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const FORM_STEPS: FormStep[] = [
  {
    id: 'basic',
    title: 'Basic Information',
    description: 'Invoice details and description',
    icon: <FileText className="w-5 h-5" />,
  },
  {
    id: 'client',
    title: 'Client Details',
    description: 'Client information and contact',
    icon: <User className="w-5 h-5" />,
  },
  {
    id: 'payment',
    title: 'Payment Settings',
    description: 'Amount and payment method',
    icon: <CreditCard className="w-5 h-5" />,
  },
  {
    id: 'review',
    title: 'Review & Send',
    description: 'Preview and send invoice',
    icon: <Eye className="w-5 h-5" />,
  },
];

interface FormErrors {
  title?: string;
  description?: string;
  clientName?: string;
  clientEmail?: string;
  amount?: string;
  dueDate?: string;
  networkId?: string;
  tokenId?: string;
  general?: string;
}

interface UnifiedInvoiceFormProps {
  // Layout control
  layout?: 'wizard' | 'single-page';
  showHeader?: boolean;
  containerClassName?: string;
  
  // Data
  templateId?: string;
  initialData?: Partial<InvoiceFormData>;
  
  // Event handlers
  onSuccess?: (invoiceId: string) => void;
  onCancel?: () => void;
  onSubmit?: (data: CreateInvoiceRequest) => Promise<void>;
  
  // UI customization
  submitButtonText?: string;
  cancelButtonText?: string;
  title?: string;
  subtitle?: string;
  
  // Behavior
  autoSave?: boolean;
  showSendOption?: boolean;
  allowDraft?: boolean;
}

export const UnifiedInvoiceForm: React.FC<UnifiedInvoiceFormProps> = ({
  layout = 'wizard',
  showHeader = true,
  containerClassName = '',
  templateId,
  initialData,
  onSuccess,
  onCancel,
  onSubmit,
  submitButtonText,
  cancelButtonText = 'Cancel',
  title,
  subtitle,
  autoSave = true,
  showSendOption = true,
  allowDraft = true,
}) => {
  const router = useRouter();
  const { state: authState } = useAuth();
  const { config } = useConfig();
  const networks = useNetworks();
  const tokens = useTokens();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  
  const [formData, setFormData] = useState<InvoiceFormData>({
    title: initialData?.title || '',
    description: initialData?.description || '',
    clientName: initialData?.clientName || '',
    clientEmail: initialData?.clientEmail || '',
    amount: initialData?.amount || '',
    dueDate: initialData?.dueDate || '',
    networkId: initialData?.networkId || config.defaultNetworkId?.toString() || '',
    tokenId: initialData?.tokenId || '',
  });

  const [filteredTokens, setFilteredTokens] = useState(tokens);

  // Determine component title
  const componentTitle = title || (templateId ? 'Create from Template' : 'Create New Invoice');
  const componentSubtitle = subtitle || (layout === 'wizard' ? `Step ${currentStep + 1} of ${FORM_STEPS.length}` : '');

  // Auto-save functionality
  useEffect(() => {
    if (!autoSave) return;
    
    const saveTimer = setTimeout(() => {
      if (formData.title || formData.description || formData.clientName) {
        // Auto-save to localStorage
        localStorage.setItem('fluxion_draft_invoice', JSON.stringify(formData));
      }
    }, 2000);

    return () => clearTimeout(saveTimer);
  }, [formData, autoSave]);

  // Load draft from localStorage on mount
  useEffect(() => {
    if (!initialData && !templateId && autoSave) {
      const draft = localStorage.getItem('fluxion_draft_invoice');
      if (draft) {
        try {
          const draftData = JSON.parse(draft);
          setFormData(prev => ({ ...prev, ...draftData }));
        } catch (error) {
          console.error('Failed to parse draft invoice:', error);
        }
      }
    }
  }, [initialData, templateId, autoSave]);

  // Authentication check
  useEffect(() => {
    if (!authState.isAuthenticated) {
      toast.error('Please connect your wallet and authenticate to create invoices');
      if (onCancel) {
        onCancel();
      } else {
        router.push('/');
      }
    }
  }, [authState.isAuthenticated, onCancel, router]);

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
      } else {
        setFilteredTokens([]);
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
        networkId: config.defaultNetworkId?.toString() || '137'
      }));
    }
  }, [config.isLoaded, config.defaultNetworkId, formData.networkId]);

  const updateFormData = useCallback((field: keyof InvoiceFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear field-specific errors
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  }, [errors]);

  const validateStep = useCallback((step: number): boolean => {
    const newErrors: FormErrors = {};
    
    switch (step) {
      case 0: // Basic Information
        if (!formData.title.trim()) {
          newErrors.title = 'Invoice title is required';
        }
        break;
        
      case 1: // Client Details
        if (!formData.clientName.trim()) {
          newErrors.clientName = 'Client name is required';
        }
        if (formData.clientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.clientEmail)) {
          newErrors.clientEmail = 'Please enter a valid email address';
        }
        break;
        
      case 2: // Payment Settings
        if (!formData.amount.trim()) {
          newErrors.amount = 'Invoice amount is required';
        } else if (isNaN(parseFloat(formData.amount)) || parseFloat(formData.amount) <= 0) {
          newErrors.amount = 'Please enter a valid amount greater than 0';
        }
        if (!formData.networkId) {
          newErrors.networkId = 'Please select a blockchain network';
        }
        if (!formData.tokenId) {
          newErrors.tokenId = 'Please select a payment token';
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const validateAllFields = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Invoice title is required';
    }

    if (!formData.clientName.trim()) {
      newErrors.clientName = 'Client name is required';
    }

    if (formData.clientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.clientEmail)) {
      newErrors.clientEmail = 'Please enter a valid email address';
    }

    if (!formData.amount.trim()) {
      newErrors.amount = 'Invoice amount is required';
    } else if (isNaN(parseFloat(formData.amount)) || parseFloat(formData.amount) <= 0) {
      newErrors.amount = 'Please enter a valid amount greater than 0';
    }

    if (!formData.networkId) {
      newErrors.networkId = 'Please select a blockchain network';
    }

    if (!formData.tokenId) {
      newErrors.tokenId = 'Please select a payment token';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleNext = useCallback(() => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, FORM_STEPS.length - 1));
    }
  }, [currentStep, validateStep]);

  const handlePrevious = useCallback(() => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  }, []);

  const buildInvoiceData = useCallback((): CreateInvoiceRequest => {
    return {
      title: formData.title.trim(),
      description: formData.description.trim() || undefined,
      clientName: formData.clientName.trim() || undefined,
      clientEmail: formData.clientEmail.trim() || undefined,
      amount: formData.amount.trim(),
      dueDate: formData.dueDate || undefined,
      networkId: formData.networkId,
      tokenId: formData.tokenId,
    };
  }, [formData]);

  const handleSaveDraft = useCallback(async () => {
    if (!allowDraft) return;
    
    try {
      setIsSaving(true);
      setErrors({});
      
      const invoiceData = buildInvoiceData();

      if (onSubmit) {
        await onSubmit(invoiceData);
      } else {
        let response;
        if (templateId) {
          response = await invoiceApi.createFromTemplate(templateId, invoiceData);
        } else {
          response = await invoiceApi.create(invoiceData);
        }

        const invoice = handleApiResponse(response);
        
        // Clear draft from localStorage
        if (autoSave) {
          localStorage.removeItem('fluxion_draft_invoice');
        }
        
        if (onSuccess) {
          onSuccess(invoice.id);
        } else {
          router.push(`/dashboard/invoices/${invoice.id}`);
        }
      }
    } catch (error: any) {
      console.error('Failed to save draft:', error);
      setErrors({ general: error.message || 'Failed to save invoice' });
    } finally {
      setIsSaving(false);
    }
  }, [allowDraft, buildInvoiceData, onSubmit, templateId, onSuccess, autoSave, router]);

  const handleSubmit = useCallback(async (sendImmediately = false) => {
    // Validate all steps for single page, or just validate specific step for wizard
    const isValid = layout === 'single-page' ? validateAllFields() : (() => {
      let allValid = true;
      for (let i = 0; i < (layout === 'wizard' ? FORM_STEPS.length - 1 : 1); i++) {
        if (!validateStep(i)) {
          allValid = false;
          if (layout === 'wizard') {
            setCurrentStep(i);
          }
          break;
        }
      }
      return allValid;
    })();

    if (!isValid) return;

    try {
      setIsSubmitting(true);
      setErrors({});

      const invoiceData = buildInvoiceData();

      if (onSubmit) {
        await onSubmit(invoiceData);
      } else {
        let response;
        if (templateId) {
          response = await invoiceApi.createFromTemplate(templateId, invoiceData);
        } else {
          response = await invoiceApi.create(invoiceData);
        }

        const invoice = handleApiResponse(response);

        // Send invoice if requested
        if (sendImmediately && formData.clientEmail) {
          try {
            await invoiceApi.send(invoice.id);
            toast.success('Invoice created and sent successfully!');
          } catch (error) {
            console.error('Failed to send invoice:', error);
            toast.success('Invoice created successfully!');
            toast.error('Failed to send email notification');
          }
        } else {
          toast.success('Invoice created successfully!');
        }

        // Clear draft from localStorage
        if (autoSave) {
          localStorage.removeItem('fluxion_draft_invoice');
        }

        if (onSuccess) {
          onSuccess(invoice.id);
        } else {
          router.push(`/dashboard/invoices/${invoice.id}`);
        }
      }
    } catch (error: any) {
      console.error('Failed to create invoice:', error);
      
      if (error.validation_errors) {
        // Handle validation errors from backend
        const newErrors: FormErrors = {};
        error.validation_errors.forEach((validationError: any) => {
          newErrors[validationError.field as keyof FormErrors] = validationError.message;
        });
        setErrors(newErrors);
      } else {
        setErrors({ general: error.message || 'Failed to create invoice' });
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [layout, validateAllFields, validateStep, buildInvoiceData, onSubmit, templateId, formData.clientEmail, onSuccess, autoSave, router]);

  const renderBasicInformation = () => (
    <div className="space-y-6">
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-secondary-700 mb-2">
          Invoice Title *
        </label>
        <input
          type="text"
          id="title"
          value={formData.title}
          onChange={(e) => updateFormData('title', e.target.value)}
          placeholder="e.g., Website Development Services"
          className={`w-full px-3 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors ${
            errors.title ? 'border-red-300' : 'border-secondary-300'
          }`}
        />
        {errors.title && (
          <p className="mt-1 text-sm text-red-600 flex items-center">
            <AlertCircle className="w-4 h-4 mr-1" />
            {errors.title}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-secondary-700 mb-2">
          Description
        </label>
        <textarea
          id="description"
          value={formData.description}
          onChange={(e) => updateFormData('description', e.target.value)}
          placeholder="Detailed description of the work performed or goods provided..."
          rows={4}
          className="w-full px-3 py-3 border border-secondary-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors resize-none"
        />
      </div>
    </div>
  );

  const renderClientDetails = () => (
    <div className="space-y-6">
      <div>
        <label htmlFor="clientName" className="block text-sm font-medium text-secondary-700 mb-2">
          Client Name *
        </label>
        <input
          type="text"
          id="clientName"
          value={formData.clientName}
          onChange={(e) => updateFormData('clientName', e.target.value)}
          placeholder="Client or company name"
          className={`w-full px-3 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors ${
            errors.clientName ? 'border-red-300' : 'border-secondary-300'
          }`}
        />
        {errors.clientName && (
          <p className="mt-1 text-sm text-red-600 flex items-center">
            <AlertCircle className="w-4 h-4 mr-1" />
            {errors.clientName}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="clientEmail" className="block text-sm font-medium text-secondary-700 mb-2">
          Client Email
        </label>
        <input
          type="email"
          id="clientEmail"
          value={formData.clientEmail}
          onChange={(e) => updateFormData('clientEmail', formatInput.email(e.target.value))}
          placeholder="client@example.com (optional)"
          className={`w-full px-3 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors ${
            errors.clientEmail ? 'border-red-300' : 'border-secondary-300'
          }`}
        />
        {errors.clientEmail && (
          <p className="mt-1 text-sm text-red-600 flex items-center">
            <AlertCircle className="w-4 h-4 mr-1" />
            {errors.clientEmail}
          </p>
        )}
        <p className="mt-2 text-sm text-secondary-500">
          Optional: Used to send invoice notifications and payment confirmations
        </p>
      </div>
    </div>
  );

  const renderPaymentSettings = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="amount" className="block text-sm font-medium text-secondary-700 mb-2">
            Invoice Amount *
          </label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-secondary-400" />
            <input
              type="text"
              id="amount"
              value={formData.amount}
              onChange={(e) => updateFormData('amount', formatInput.currencyInput(e.target.value))}
              placeholder="0.00"
              className={`w-full pl-10 pr-3 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors ${
                errors.amount ? 'border-red-300' : 'border-secondary-300'
              }`}
            />
          </div>
          {errors.amount && (
            <p className="mt-1 text-sm text-red-600 flex items-center">
              <AlertCircle className="w-4 h-4 mr-1" />
              {errors.amount}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="dueDate" className="block text-sm font-medium text-secondary-700 mb-2">
            Due Date
          </label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-secondary-400" />
            <input
              type="date"
              id="dueDate"
              value={formData.dueDate}
              onChange={(e) => updateFormData('dueDate', e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full pl-10 pr-3 py-3 border border-secondary-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
            />
          </div>
        </div>
      </div>

      <NetworkTokenSelector
        selectedNetworkId={formData.networkId}
        selectedTokenId={formData.tokenId}
        onNetworkChange={(networkId) => updateFormData('networkId', networkId)}
        onTokenChange={(tokenId) => updateFormData('tokenId', tokenId)}
        error={errors.networkId || errors.tokenId}
      />
    </div>
  );

  const renderReviewPreview = () => (
    <div className="space-y-6">
      <InvoicePreview
        formData={formData}
        showActions={false}
      />
    </div>
  );

  const renderStepContent = () => {
    if (layout === 'single-page') {
      return (
        <div className="space-y-8">
          <div>
            <h3 className="text-lg font-medium text-secondary-900 mb-4">Basic Information</h3>
            {renderBasicInformation()}
          </div>
          <div>
            <h3 className="text-lg font-medium text-secondary-900 mb-4">Client Details</h3>
            {renderClientDetails()}
          </div>
          <div>
            <h3 className="text-lg font-medium text-secondary-900 mb-4">Payment Settings</h3>
            {renderPaymentSettings()}
          </div>
        </div>
      );
    }

    switch (currentStep) {
      case 0:
        return renderBasicInformation();
      case 1:
        return renderClientDetails();
      case 2:
        return renderPaymentSettings();
      case 3:
        return renderReviewPreview();
      default:
        return null;
    }
  };

  const renderWizardProgressBar = () => {
    if (layout !== 'wizard') return null;

    return (
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {FORM_STEPS.map((step, index) => (
            <div
              key={step.id}
              className={`flex-1 ${index < FORM_STEPS.length - 1 ? 'mr-4' : ''}`}
            >
              <div className="flex items-center">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors ${
                  index < currentStep
                    ? 'bg-primary-600 border-primary-600 text-white'
                    : index === currentStep
                    ? 'border-primary-600 text-primary-600'
                    : 'border-secondary-300 text-secondary-400'
                }`}>
                  {index < currentStep ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    step.icon
                  )}
                </div>
                <div className={`ml-3 ${index < FORM_STEPS.length - 1 ? 'flex-1' : ''}`}>
                  <p className={`text-sm font-medium ${
                    index <= currentStep ? 'text-secondary-900' : 'text-secondary-500'
                  }`}>
                    {step.title}
                  </p>
                  <p className={`text-xs ${
                    index <= currentStep ? 'text-secondary-600' : 'text-secondary-400'
                  }`}>
                    {step.description}
                  </p>
                </div>
              </div>
              {index < FORM_STEPS.length - 1 && (
                <div className={`h-0.5 mt-4 transition-colors ${
                  index < currentStep ? 'bg-primary-600' : 'bg-secondary-200'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderNavigationButtons = () => {
    return (
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {layout === 'wizard' && currentStep > 0 && (
            <button
              type="button"
              onClick={handlePrevious}
              disabled={isSubmitting}
              className="btn-secondary"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Previous
            </button>
          )}
          
          {layout === 'wizard' && currentStep < FORM_STEPS.length - 1 && (
            <button
              type="button"
              onClick={handleNext}
              className="btn-primary"
            >
              Next
              <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          )}
        </div>

        <div className="flex items-center space-x-3">
          {/* Save Draft */}
          {allowDraft && (
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={isSaving || !formData.title}
              className="btn-secondary"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Draft
            </button>
          )}

          {/* Final Actions */}
          {(layout === 'single-page' || currentStep === FORM_STEPS.length - 1) && (
            <>
              <button
                type="button"
                onClick={() => handleSubmit(false)}
                disabled={isSubmitting}
                className="btn-secondary"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4 mr-2" />
                )}
                {submitButtonText || 'Create Invoice'}
              </button>
              
              {showSendOption && formData.clientEmail && (
                <button
                  type="button"
                  onClick={() => handleSubmit(true)}
                  disabled={isSubmitting}
                  className="btn-primary"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  Create & Send
                </button>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`max-w-4xl mx-auto ${containerClassName}`}>
      {/* Header */}
      {showHeader && (
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="btn-secondary mr-4"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                {cancelButtonText}
              </button>
            )}
            <div>
              <h1 className="text-2xl font-bold text-secondary-900">
                {componentTitle}
              </h1>
              {componentSubtitle && (
                <p className="text-sm text-secondary-500 mt-1">
                  {componentSubtitle}
                </p>
              )}
            </div>
          </div>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="text-secondary-500 hover:text-secondary-700"
            >
              <X className="w-6 h-6" />
            </button>
          )}
        </div>
      )}

      {/* Progress Bar for Wizard */}
      {renderWizardProgressBar()}

      {/* Error Message */}
      {errors.general && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
            <p className="text-sm text-red-800">{errors.general}</p>
          </div>
        </div>
      )}

      {/* Form Content */}
      <div className="bg-white rounded-lg shadow-sm border border-secondary-200 p-6 mb-6">
        {renderStepContent()}
      </div>

      {/* Navigation */}
      {renderNavigationButtons()}
    </div>
  );
};