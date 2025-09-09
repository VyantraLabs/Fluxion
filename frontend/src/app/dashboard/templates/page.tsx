'use client';

import React, { useState } from 'react';
import { TemplateGallery } from '@/components/templates/TemplateGallery';
import { FileText, Plus, Settings } from 'lucide-react';

export default function TemplatesPage() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  const handleCreateTemplate = () => {
    // TODO: Implement template creation
    setShowCreateForm(true);
    console.log('Create template functionality to be implemented');
  };
  
  const handleTemplateSelect = (template: any) => {
    // TODO: Implement template selection (e.g., redirect to invoice creation)
    console.log('Selected template:', template);
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      {/* Page header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-secondary-900">Invoice Templates</h1>
            <p className="mt-2 text-secondary-600">
              Manage and create professional invoice templates for your business
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => console.log('Template settings')}
              className="btn-secondary"
            >
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </button>
          </div>
        </div>
      </div>

      {/* Templates gallery */}
      <TemplateGallery
        onTemplateSelect={handleTemplateSelect}
        onCreateNew={handleCreateTemplate}
        allowSelection={true}
        showCreateButton={true}
        layout="gallery"
      />
      
      {/* TODO: Add template creation/edit forms */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-secondary-900">Create New Template</h3>
              <button
                onClick={() => setShowCreateForm(false)}
                className="text-secondary-400 hover:text-secondary-600"
              >
                ×
              </button>
            </div>
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-secondary-400 mx-auto mb-4" />
              <p className="text-secondary-600">
                Template creation form will be implemented in Week 2
              </p>
              <button
                onClick={() => setShowCreateForm(false)}
                className="btn-primary mt-4"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}