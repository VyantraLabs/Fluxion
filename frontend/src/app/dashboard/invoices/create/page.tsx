'use client';

import React, { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { UnifiedInvoiceForm } from '@/components/invoices/UnifiedInvoiceForm';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Loader2, Building2 } from 'lucide-react';
import Link from 'next/link';

const CreateInvoicePageContent: React.FC = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { state } = useOrganization();
  const { activeOrganization } = state;
  
  const templateId = searchParams.get('template');
  const quickTemplate = searchParams.get('template') === 'quick';

  // Redirect if no organization is selected
  if (!activeOrganization) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <Building2 className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No organization selected</h3>
          <p className="mt-1 text-sm text-gray-500">
            You need to select an organization before creating an invoice.
          </p>
          <div className="mt-6">
            <Link
              href="/dashboard"
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <Building2 className="w-4 h-4 mr-2" />
              Select Organization
            </Link>
          </div>
        </div>
      </div>
    );
  }

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