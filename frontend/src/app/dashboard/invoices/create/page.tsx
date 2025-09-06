'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { UnifiedInvoiceForm } from '@/components/invoices/UnifiedInvoiceForm';
import { Loader2 } from 'lucide-react';

const CreateInvoicePageContent: React.FC = () => {
  const searchParams = useSearchParams();
  const templateId = searchParams.get('template');
  const quickTemplate = searchParams.get('template') === 'quick';

  // If using quick template, provide some initial data
  const initialData = quickTemplate ? {
    title: '',
    description: 'Quick invoice for services rendered',
    clientName: '',
    clientEmail: '',
    amount: '',
    dueDate: '',
    networkId: '',
    tokenId: '',
  } : undefined;

  return (
    <UnifiedInvoiceForm
      layout="wizard"
      templateId={templateId || undefined}
      initialData={initialData}
      showHeader={true}
      autoSave={true}
      showSendOption={true}
      allowDraft={true}
    />
  );
};

const LoadingSpinner: React.FC = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="text-center">
      <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary-600 mb-4" />
      <p className="text-secondary-600">Loading invoice creation form...</p>
    </div>
  </div>
);

export default function CreateInvoicePage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <CreateInvoicePageContent />
    </Suspense>
  );
}