'use client';

import React from 'react';
import { FileText, Star, Calendar, Users, Eye } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  isPublic: boolean;
  previewData: any;
  usageCount: number;
  rating?: number;
  thumbnail?: string;
  createdAt: string;
  updatedAt: string;
}

interface TemplatePreviewProps {
  template: Template;
  onUse?: (template: Template) => void;
  onClose?: () => void;
  className?: string;
}

export const TemplatePreview: React.FC<TemplatePreviewProps> = ({
  template,
  onUse,
  onClose,
  className = '',
}) => {
  const handleUseTemplate = () => {
    if (onUse) {
      onUse(template);
    }
  };

  return (
    <div className={`bg-white rounded-lg border border-secondary-200 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-secondary-200">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              <div className="w-12 h-12 bg-gradient-to-br from-primary-50 to-secondary-50 rounded-lg flex items-center justify-center">
                {template.thumbnail ? (
                  <img
                    src={template.thumbnail}
                    alt={template.name}
                    className="w-full h-full object-cover rounded-lg"
                  />
                ) : (
                  <FileText className="w-6 h-6 text-primary-500" />
                )}
              </div>
              <div>
                <h2 className="text-xl font-semibold text-secondary-900">{template.name}</h2>
                <p className="text-secondary-600">{template.description}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-6 text-sm text-secondary-500">
              <div className="flex items-center space-x-1">
                <span className="px-2 py-1 bg-secondary-100 rounded-full text-xs">
                  {template.category}
                </span>
              </div>
              
              {template.rating && (
                <div className="flex items-center space-x-1">
                  <Star className="w-4 h-4 text-yellow-400 fill-current" />
                  <span>{template.rating}</span>
                </div>
              )}
              
              <div className="flex items-center space-x-1">
                <Users className="w-4 h-4" />
                <span>{template.usageCount} uses</span>
              </div>
              
              <div className="flex items-center space-x-1">
                <Calendar className="w-4 h-4" />
                <span>{new Date(template.updatedAt).toLocaleDateString()}</span>
              </div>
              
              {template.isPublic && (
                <div className="flex items-center space-x-1">
                  <Eye className="w-4 h-4" />
                  <span>Public</span>
                </div>
              )}
            </div>
          </div>
          
          {onClose && (
            <button
              onClick={onClose}
              className="ml-4 text-secondary-400 hover:text-secondary-600 text-2xl leading-none"
            >
              ×
            </button>
          )}
        </div>
      </div>
      
      {/* Preview Content */}
      <div className="p-6">
        <h3 className="text-lg font-medium text-secondary-900 mb-4">Template Preview</h3>
        
        {/* Mock invoice preview */}
        <div className="bg-secondary-50 rounded-lg p-6 space-y-4">
          <div className="border-b border-secondary-200 pb-4">
            <h4 className="text-lg font-semibold text-secondary-900 mb-2">
              Sample Invoice Title
            </h4>
            <div className="text-sm text-secondary-600 space-y-1">
              <p><strong>From:</strong> Your Company Name</p>
              <p><strong>To:</strong> Client Company</p>
              <p><strong>Invoice #:</strong> INV-001</p>
              <p><strong>Date:</strong> {new Date().toLocaleDateString()}</p>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="text-sm">
              <p className="text-secondary-700 mb-2">
                <strong>Description:</strong>
              </p>
              <p className="text-secondary-600">
                This is a sample description showing how your invoice content will appear 
                when using this template. The template includes professional formatting 
                and layout optimized for clarity and payment conversion.
              </p>
            </div>
            
            <div className="border-t border-secondary-200 pt-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-secondary-700">Amount:</span>
                <span className="font-semibold text-secondary-900">$1,000.00 USDC</span>
              </div>
              <div className="flex justify-between items-center text-sm mt-1">
                <span className="text-secondary-700">Network:</span>
                <span className="text-secondary-600">Polygon</span>
              </div>
              <div className="flex justify-between items-center text-sm mt-1">
                <span className="text-secondary-700">Due Date:</span>
                <span className="text-secondary-600">
                  {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Template features */}
        <div className="mt-6">
          <h4 className="text-md font-medium text-secondary-900 mb-3">Template Features</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center space-x-2 text-sm text-secondary-600">
              <div className="w-2 h-2 bg-primary-500 rounded-full"></div>
              <span>Professional formatting</span>
            </div>
            <div className="flex items-center space-x-2 text-sm text-secondary-600">
              <div className="w-2 h-2 bg-primary-500 rounded-full"></div>
              <span>Payment instructions</span>
            </div>
            <div className="flex items-center space-x-2 text-sm text-secondary-600">
              <div className="w-2 h-2 bg-primary-500 rounded-full"></div>
              <span>QR code integration</span>
            </div>
            <div className="flex items-center space-x-2 text-sm text-secondary-600">
              <div className="w-2 h-2 bg-primary-500 rounded-full"></div>
              <span>Mobile-responsive design</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Actions */}
      {onUse && (
        <div className="p-6 border-t border-secondary-200 bg-secondary-50">
          <div className="flex items-center justify-end space-x-3">
            {onClose && (
              <button onClick={onClose} className="btn-secondary">
                Close
              </button>
            )}
            <button onClick={handleUseTemplate} className="btn-primary">
              Use This Template
            </button>
          </div>
        </div>
      )}
    </div>
  );
};