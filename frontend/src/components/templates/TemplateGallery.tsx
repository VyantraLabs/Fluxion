'use client';

import React, { useState, useEffect } from 'react';
import {
  Eye,
  FileText,
  Star,
  Filter,
  Search,
  Grid,
  List,
  Loader2,
  AlertCircle,
  TrendingUp,
  Users,
  Calendar,
  Plus,
} from 'lucide-react';
import { templateApi, handleApiResponse } from '@/utils/api';
import { config } from '@/utils/config';
import { cn } from '@/utils/helpers';
import toast from 'react-hot-toast';

interface Template {
  id: string;
  name: string;
  description: string;
  category?: any;
  categoryName?: string;
  isPublic: boolean;
  content: any;
  previewImageUrl?: string;
  fullPreviewImageUrl?: string;
  templateType: string;
  tags: string[];
  rating?: number;
  thumbnail?: string;
  createdAt: string;
  updatedAt: string;
}

interface TemplateGalleryProps {
  onTemplateSelect?: (template: Template) => void;
  onCreateNew?: () => void;
  allowSelection?: boolean;
  showCreateButton?: boolean;
  layout?: 'gallery' | 'list';
  containerClassName?: string;
}

export const TemplateGallery: React.FC<TemplateGalleryProps> = ({
  onTemplateSelect,
  onCreateNew,
  allowSelection = true,
  showCreateButton = true,
  layout: initialLayout = 'gallery',
  containerClassName = '',
}) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [layout, setLayout] = useState(initialLayout);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [showPublicOnly, setShowPublicOnly] = useState(false);
  
  // Load templates and categories
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Load templates and categories in parallel using unified endpoints
        const [templatesResponse, categoriesResponse] = await Promise.all([
          templateApi.getAll({
            search: searchQuery || undefined,
            category: selectedCategory || undefined,
            limit: 50,
          }),
          templateApi.getCategories(),
        ]);
        
        const templatesData = handleApiResponse<any>(templatesResponse);
        const categoriesData = handleApiResponse<any>(categoriesResponse);
        
        // Handle templates data - extract from nested structure
        const templates = templatesData?.items || templatesData?.templates || [];
        setTemplates(templates);
        
        // Handle categories data - extract names from category objects
        const categories = categoriesData?.categories?.map((cat: any) => cat.name || cat) || [];
        setCategories(categories);
      } catch (err: any) {
        console.error('Failed to load templates:', err);
        setError(err.message || 'Failed to load templates');
        toast.error('Failed to load templates');
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [searchQuery, selectedCategory, showPublicOnly]);
  
  const handleTemplateClick = (template: Template) => {
    if (allowSelection && onTemplateSelect) {
      onTemplateSelect(template);
    } else {
      setSelectedTemplate(template);
      setShowPreview(true);
    }
  };
  
  const handlePreviewTemplate = (template: Template) => {
    setSelectedTemplate(template);
    setShowPreview(true);
  };
  
  const handleUseTemplate = (template: Template) => {
    if (onTemplateSelect) {
      onTemplateSelect(template);
    }
    setShowPreview(false);
  };
  
  // Filter templates based on search and category
  const filteredTemplates = templates.filter(template => {
    const matchesSearch = searchQuery === '' || 
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategory === '' || 
      template.category?.name === selectedCategory || 
      template.categoryName === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });
  
  const renderTemplateCard = (template: Template) => {
    const isSelected = selectedTemplate?.id === template.id;
    
    return (
      <div
        key={template.id}
        className={cn(
          'bg-white rounded-lg border transition-all duration-200 cursor-pointer hover:shadow-md',
          isSelected 
            ? 'border-primary-500 ring-2 ring-primary-200' 
            : 'border-secondary-200 hover:border-secondary-300',
          layout === 'list' ? 'p-4' : 'p-6'
        )}
        onClick={() => handleTemplateClick(template)}
      >
        {layout === 'gallery' ? (
          <div className="space-y-4">
            {/* Template thumbnail or icon */}
            <div className="w-full h-32 bg-gradient-to-br from-primary-50 to-secondary-50 rounded-lg flex items-center justify-center">
              {template.fullPreviewImageUrl || template.previewImageUrl || template.thumbnail ? (
                <img
                  src={template.fullPreviewImageUrl || template.previewImageUrl || template.thumbnail}
                  alt={template.name}
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : (
                <FileText className="w-12 h-12 text-primary-500" />
              )}
            </div>
            
            {/* Template info */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-secondary-900 truncate">{template.name}</h3>
                {template.rating && (
                  <div className="flex items-center space-x-1">
                    <Star className="w-4 h-4 text-yellow-400 fill-current" />
                    <span className="text-sm text-secondary-600">{template.rating}</span>
                  </div>
                )}
              </div>
              
              <p className="text-sm text-secondary-600 line-clamp-2">{template.description}</p>
              
              <div className="flex items-center justify-between text-xs text-secondary-500">
                <span className="px-2 py-1 bg-secondary-100 rounded-full">
                  {template.category?.name || template.categoryName || 'Template'}
                </span>
                <div className="flex items-center space-x-3">
                  {template.tags?.length > 0 && (
                    <div className="flex items-center space-x-1">
                      <span className="text-xs text-secondary-400">#{template.tags[0]}</span>
                    </div>
                  )}
                  {template.isPublic && (
                    <div className="flex items-center space-x-1">
                      <TrendingUp className="w-3 h-3" />
                      <span>Public</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex items-center space-x-2 pt-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePreviewTemplate(template);
                }}
                className="flex-1 btn-secondary text-sm py-2"
              >
                <Eye className="w-4 h-4 mr-1" />
                Preview
              </button>
              {allowSelection && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTemplateClick(template);
                  }}
                  className="flex-1 btn-primary text-sm py-2"
                >
                  Use Template
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center space-x-4">
            {/* Template icon */}
            <div className="w-16 h-16 bg-gradient-to-br from-primary-50 to-secondary-50 rounded-lg flex items-center justify-center flex-shrink-0">
              <FileText className="w-8 h-8 text-primary-500" />
            </div>
            
            {/* Template info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-secondary-900 truncate">{template.name}</h3>
                {template.rating && (
                  <div className="flex items-center space-x-1 ml-2">
                    <Star className="w-4 h-4 text-yellow-400 fill-current" />
                    <span className="text-sm text-secondary-600">{template.rating}</span>
                  </div>
                )}
              </div>
              
              <p className="text-sm text-secondary-600 mt-1 line-clamp-1">{template.description}</p>
              
              <div className="flex items-center space-x-4 mt-2 text-xs text-secondary-500">
                <span className="px-2 py-1 bg-secondary-100 rounded-full">
                  {template.category?.name || template.categoryName || 'Template'}
                </span>
                {template.tags?.length > 0 && (
                  <div className="flex items-center space-x-1">
                    <span className="text-xs">#{template.tags[0]}</span>
                  </div>
                )}
                <div className="flex items-center space-x-1">
                  <Calendar className="w-3 h-3" />
                  <span>{new Date(template.updatedAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex items-center space-x-2 flex-shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePreviewTemplate(template);
                }}
                className="btn-secondary text-sm px-3 py-1"
              >
                <Eye className="w-4 h-4" />
              </button>
              {allowSelection && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTemplateClick(template);
                  }}
                  className="btn-primary text-sm px-4 py-1"
                >
                  Use
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };
  
  const renderFilters = () => (
    <div className="bg-white rounded-lg border border-secondary-200 p-4 mb-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
        {/* Search and filters */}
        <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 flex-1">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-secondary-400" />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-secondary-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          
          {/* Category filter */}
          <div className="relative">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="appearance-none bg-white border border-secondary-300 rounded-lg px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            <Filter className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-secondary-400 pointer-events-none" />
          </div>
          
          {/* Public only toggle */}
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showPublicOnly}
              onChange={(e) => setShowPublicOnly(e.target.checked)}
              className="rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-secondary-700">Public only</span>
          </label>
        </div>
        
        {/* Layout toggle and create button */}
        <div className="flex items-center space-x-3">
          {/* Layout toggle */}
          <div className="flex items-center bg-secondary-100 rounded-lg p-1">
            <button
              onClick={() => setLayout('gallery')}
              className={cn(
                'p-2 rounded-md transition-colors',
                layout === 'gallery' 
                  ? 'bg-white text-primary-600 shadow-sm' 
                  : 'text-secondary-600 hover:text-secondary-900'
              )}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setLayout('list')}
              className={cn(
                'p-2 rounded-md transition-colors',
                layout === 'list' 
                  ? 'bg-white text-primary-600 shadow-sm' 
                  : 'text-secondary-600 hover:text-secondary-900'
              )}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          
          {/* Create new template button */}
          {showCreateButton && onCreateNew && (
            <button
              onClick={onCreateNew}
              className="btn-primary"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Template
            </button>
          )}
        </div>
      </div>
    </div>
  );
  
  if (loading) {
    return (
      <div className={`${containerClassName}`}>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600 mx-auto mb-4" />
            <p className="text-secondary-600">Loading templates...</p>
          </div>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className={`${containerClassName}`}>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-4" />
            <p className="text-red-800 font-medium">Failed to load templates</p>
            <p className="text-red-600 text-sm mt-1">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="btn-secondary mt-4"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`${containerClassName}`}>
      {renderFilters()}
      
      {filteredTemplates.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-secondary-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-secondary-900 mb-2">No templates found</h3>
          <p className="text-secondary-600 mb-6">
            {searchQuery || selectedCategory
              ? 'Try adjusting your search criteria or filters'
              : 'Get started by creating your first template'
            }
          </p>
          {showCreateButton && onCreateNew && (
            <button onClick={onCreateNew} className="btn-primary">
              <Plus className="w-4 h-4 mr-2" />
              Create First Template
            </button>
          )}
        </div>
      ) : (
        <div className={cn(
          'grid gap-6',
          layout === 'gallery' 
            ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
            : 'grid-cols-1'
        )}>
          {filteredTemplates.map(template => renderTemplateCard(template))}
        </div>
      )}
      
      {/* Template preview modal would go here */}
      {showPreview && selectedTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-secondary-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-secondary-900">{selectedTemplate.name}</h3>
                  <p className="text-secondary-600">{selectedTemplate.description}</p>
                </div>
                <button
                  onClick={() => setShowPreview(false)}
                  className="text-secondary-400 hover:text-secondary-600"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto max-h-96">
              {/* Template preview content would go here */}
              <div className="bg-secondary-50 rounded-lg p-8 text-center">
                <FileText className="w-16 h-16 text-secondary-400 mx-auto mb-4" />
                <p className="text-secondary-600">Template preview coming soon...</p>
              </div>
            </div>
            <div className="p-6 border-t border-secondary-200 flex items-center justify-end space-x-3">
              <button
                onClick={() => setShowPreview(false)}
                className="btn-secondary"
              >
                Close
              </button>
              {allowSelection && (
                <button
                  onClick={() => handleUseTemplate(selectedTemplate)}
                  className="btn-primary"
                >
                  Use This Template
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};