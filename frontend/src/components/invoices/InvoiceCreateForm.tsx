'use client';

import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { NetworkTokenSelector } from './NetworkTokenSelector';
import { InvoicePreview } from './InvoicePreview';
import { invoiceApi, handleApiResponse, handleApiError } from '@/utils/api';
import { formatInput } from '@/utils/format';
import { CreateInvoiceRequest, InvoiceFormData, BlockchainNetwork, Token } from '@/types/invoice';

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

interface InvoiceCreateFormProps {
  templateId?: string;
  initialData?: Partial<InvoiceFormData>;
  onSuccess?: (invoiceId: string) => void;
  onCancel?: () => void;
}

export const InvoiceCreateForm: React.FC<InvoiceCreateFormProps> = ({
  templateId,
  initialData,
  onSuccess,
  onCancel,
}) => {
  const router = useRouter();
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
    networkId: initialData?.networkId || '',
    tokenId: initialData?.tokenId || '',
  });

  // Auto-save functionality
  useEffect(() => {
    const saveTimer = setTimeout(() => {
      if (formData.title || formData.description || formData.clientName) {
        // Auto-save to localStorage
        localStorage.setItem('fluxion_draft_invoice', JSON.stringify(formData));
      }
    }, 2000);

    return () => clearTimeout(saveTimer);
  }, [formData]);

  // Load draft from localStorage on mount
  useEffect(() => {
    if (!initialData && !templateId) {
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
  }, []);

  const updateFormData = (field: keyof InvoiceFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear field-specific errors
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const validateStep = (step: number): boolean => {
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
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, FORM_STEPS.length - 1));
    }
  };

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  const handleSaveDraft = async () => {
    try {
      setIsSaving(true);
      
      const draftData: CreateInvoiceRequest = {
        title: formData.title || 'Untitled Draft',
        description: formData.description,
        clientName: formData.clientName,
        clientEmail: formData.clientEmail,
        amount: parseFloat(formData.amount) || 0,
        dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : undefined,
        networkId: formData.networkId ? parseInt(formData.networkId) : 1,
        tokenId: formData.tokenId,
        status: 'draft'
      };

      let response;
      if (templateId) {
        response = await invoiceApi.createFromTemplate(templateId, draftData);
      } else {
        response = await invoiceApi.saveDraft(draftData);
      }

      const invoice = handleApiResponse(response);
      
      // Clear draft from localStorage
      localStorage.removeItem('fluxion_draft_invoice');
      
      if (onSuccess) {
        onSuccess(invoice.id);
      } else {
        router.push(`/dashboard/invoices/${invoice.id}`);
      }
    } catch (error: any) {
      console.error('Failed to save draft:', error);
      setErrors({ general: error.message || 'Failed to save invoice' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async (sendImmediately = false) => {
    // Validate all steps
    let allValid = true;
    for (let i = 0; i < FORM_STEPS.length - 1; i++) {
      if (!validateStep(i)) {
        allValid = false;
        setCurrentStep(i);
        break;
      }
    }

    if (!allValid) return;

    try {
      setIsSubmitting(true);
      setErrors({});

      const invoiceData: CreateInvoiceRequest = {
        title: formData.title,
        description: formData.description,
        clientName: formData.clientName,
        clientEmail: formData.clientEmail,
        amount: parseFloat(formData.amount) || 0,
        dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : undefined,
        networkId: parseInt(formData.networkId),
        tokenId: formData.tokenId,
        status: sendImmediately && formData.clientEmail ? 'sent' : 'created'
      };

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
        } catch (error) {
          console.error('Failed to send invoice:', error);
          // Don't fail the entire process if send fails
        }
      }

      // Clear draft from localStorage
      localStorage.removeItem('fluxion_draft_invoice');

      if (onSuccess) {
        onSuccess(invoice.id);
      } else {
        router.push(`/dashboard/invoices/${invoice.id}`);
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
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Basic Information
        return (
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
                  errors.title ? 'border-danger-300' : 'border-secondary-300'
                }`}
              />
              {errors.title && (
                <p className="mt-1 text-sm text-danger-600 flex items-center">
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

      case 1: // Client Details
        return (
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
                  errors.clientName ? 'border-danger-300' : 'border-secondary-300'
                }`}
              />
              {errors.clientName && (
                <p className="mt-1 text-sm text-danger-600 flex items-center">
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
                  errors.clientEmail ? 'border-danger-300' : 'border-secondary-300'
                }`}
              />
              {errors.clientEmail && (
                <p className="mt-1 text-sm text-danger-600 flex items-center">
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

      case 2: // Payment Settings
        return (
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
                      errors.amount ? 'border-danger-300' : 'border-secondary-300'
                    }`}
                  />
                </div>
                {errors.amount && (
                  <p className="mt-1 text-sm text-danger-600 flex items-center">
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

      case 3: // Review & Send
        return (
          <div className="space-y-6">
            <InvoicePreview
              formData={formData}
              showActions={false}
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center">
          <button
            type="button"
            onClick={onCancel || (() => router.back())}
            className="btn-secondary mr-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Cancel
          </button>
          <div>
            <h1 className="text-2xl font-bold text-secondary-900">
              {templateId ? 'Create from Template' : 'Create New Invoice'}
            </h1>
            <p className="text-sm text-secondary-500 mt-1">
              Step {currentStep + 1} of {FORM_STEPS.length}
            </p>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
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

      {/* Error Message */}
      {errors.general && (
        <div className="mb-6 p-4 bg-danger-50 border border-danger-200 rounded-lg">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-danger-600 mr-2" />
            <p className="text-sm text-danger-800">{errors.general}</p>
          </div>
        </div>
      )}

      {/* Form Content */}
      <div className="bg-white rounded-lg shadow-sm border border-secondary-200 p-6 mb-6">
        {renderStepContent()}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {currentStep > 0 && (
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
          
          {currentStep < FORM_STEPS.length - 1 && (
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

          {/* Final Actions */}
          {currentStep === FORM_STEPS.length - 1 && (
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
                Create Invoice
              </button>
              
              {formData.clientEmail && (
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
    </div>
  );
};