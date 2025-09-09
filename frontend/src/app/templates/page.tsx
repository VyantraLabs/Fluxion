'use client';

import React, { useState } from 'react';
import { TemplateGallery } from '@/components/templates/TemplateGallery';
import { TemplateTest } from '@/components/templates/TemplateTest';
import { FileText, ArrowLeft, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function PublicTemplatesPage() {
  const router = useRouter();
  
  const handleTemplateSelect = (template: any) => {
    // For public template selection, redirect to dashboard or prompt for authentication
    console.log('Selected template:', template);
    // Store the selected template in localStorage for after authentication
    localStorage.setItem('selectedTemplate', JSON.stringify(template));
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen bg-secondary-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-secondary-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link href="/" className="flex items-center text-secondary-600 hover:text-secondary-900">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/dashboard"
                className="flex items-center text-primary-600 hover:text-primary-700 font-medium"
              >
                <User className="w-4 h-4 mr-2" />
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page header */}
        <div className="mb-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-secondary-900">Invoice Templates</h1>
            <p className="mt-4 text-lg text-secondary-600 max-w-2xl mx-auto">
              Browse our collection of professional invoice templates. Choose a template to get started with your invoicing needs.
            </p>
          </div>
        </div>

        {/* Debug section */}
        <div className="mb-8">
          <TemplateTest />
        </div>

        {/* Templates gallery */}
        <TemplateGallery
          onTemplateSelect={handleTemplateSelect}
          allowSelection={true}
          showCreateButton={false}
          layout="gallery"
          containerClassName="max-w-7xl mx-auto"
        />
        
        {/* Call to action */}
        <div className="mt-12 text-center">
          <div className="bg-white rounded-lg border border-secondary-200 p-8 max-w-2xl mx-auto">
            <FileText className="w-12 h-12 text-primary-500 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-secondary-900 mb-2">
              Ready to create invoices?
            </h3>
            <p className="text-secondary-600 mb-6">
              Connect your wallet to start creating professional invoices with crypto payments.
            </p>
            <Link
              href="/dashboard"
              className="btn-primary"
            >
              Get Started
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-secondary-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-secondary-600">
            <p>&copy; 2025 Fluxion. Professional crypto invoicing made simple.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}