'use client';

import React, { useState, useEffect } from 'react';
import { templateApi, handleApiResponse } from '@/utils/api';
import { config, apiEndpoints } from '@/utils/config';

export const TemplateTest: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [apiUrl, setApiUrl] = useState<string>('');

  useEffect(() => {
    setApiUrl(config.api.baseUrl);
    console.log('API Base URL:', config.api.baseUrl);
    loadData();
  }, []);

  const loadData = async () => {
    console.log('Starting template API test...');
    setLoading(true);
    setError(null);
    
    try {
      console.log('Making API calls to:', config.api.baseUrl);
      
      // Test direct fetch first (using unified endpoint)
      console.log('Testing direct fetch...');
      const directResponse = await fetch(config.api.baseUrl + apiEndpoints.templates.base);
      console.log('Direct fetch response status:', directResponse.status);
      const directData = await directResponse.json();
      console.log('Direct fetch data:', directData);
      
      // Test using templateApi (unified endpoint)
      console.log('Testing templateApi.getAll (unified)...');
      const templatesResponse = await templateApi.getAll({ limit: 5 });
      console.log('Templates API response:', templatesResponse);
      
      const templatesData = handleApiResponse<any>(templatesResponse);
      console.log('Processed templates data:', templatesData);
      
      // Test categories (unified endpoint)
      console.log('Testing categories (unified)...');
      const categoriesResponse = await templateApi.getCategories();
      console.log('Categories API response:', categoriesResponse);
      
      const categoriesData = handleApiResponse<any>(categoriesResponse);
      console.log('Processed categories data:', categoriesData);
      
      // Set data
      const templateItems = templatesData?.items || templatesData?.templates || [];
      const categoryItems = categoriesData?.categories || [];
      
      console.log('Final template items:', templateItems);
      console.log('Final category items:', categoryItems);
      
      setTemplates(templateItems);
      setCategories(categoryItems);
      
    } catch (err: any) {
      console.error('API test failed:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg border">
      <h3 className="text-lg font-medium mb-4">Template API Test</h3>
      
      <div className="mb-4">
        <p><strong>API URL:</strong> {apiUrl}</p>
      </div>
      
      <button 
        onClick={loadData}
        className="btn-primary mb-4"
        disabled={loading}
      >
        {loading ? 'Testing...' : 'Test API'}
      </button>
      
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <h4 className="text-red-800 font-medium">Error:</h4>
          <p className="text-red-700">{error}</p>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h4 className="font-medium mb-2">Templates ({templates.length})</h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {templates.map((template, index) => (
              <div key={template.id || index} className="p-2 bg-gray-50 rounded">
                <div className="font-medium">{template.name}</div>
                <div className="text-sm text-gray-600">{template.description}</div>
                <div className="text-xs text-gray-500">Category: {template.category?.name || 'N/A'}</div>
              </div>
            ))}
          </div>
        </div>
        
        <div>
          <h4 className="font-medium mb-2">Categories ({categories.length})</h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {categories.map((category, index) => (
              <div key={category.id || index} className="p-2 bg-gray-50 rounded">
                <div className="font-medium">{category.name}</div>
                <div className="text-sm text-gray-600">{category.description}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};