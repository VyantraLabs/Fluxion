'use client';

import React, { useState } from 'react';
import {
  Search,
  Filter,
  Calendar,
  DollarSign,
  User,
  X,
  ChevronDown,
  SlidersHorizontal,
} from 'lucide-react';
import { InvoiceFilters as IInvoiceFilters, InvoiceStatus } from '@/types/invoice';
import { formatInput } from '@/utils/format';

interface InvoiceFiltersProps {
  filters: IInvoiceFilters;
  onFiltersChange: (filters: IInvoiceFilters) => void;
  totalCount: number;
  filteredCount: number;
  className?: string;
}

const STATUS_OPTIONS: { value: InvoiceStatus; label: string; color: string }[] = [
  { value: 'draft', label: 'Draft', color: 'bg-secondary-100 text-secondary-800' },
  { value: 'sent', label: 'Sent', color: 'bg-blue-100 text-blue-800' },
  { value: 'paid', label: 'Paid', color: 'bg-success-100 text-success-800' },
  { value: 'overdue', label: 'Overdue', color: 'bg-danger-100 text-danger-800' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-secondary-100 text-secondary-800' },
  { value: 'partial', label: 'Partially Paid', color: 'bg-warning-100 text-warning-800' },
];

export const InvoiceFilters: React.FC<InvoiceFiltersProps> = ({
  filters,
  onFiltersChange,
  totalCount,
  filteredCount,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const updateFilter = <K extends keyof IInvoiceFilters>(
    key: K,
    value: IInvoiceFilters[K]
  ) => {
    onFiltersChange({
      ...filters,
      [key]: value,
    });
  };

  const clearFilter = <K extends keyof IInvoiceFilters>(key: K) => {
    const newFilters = { ...filters };
    delete newFilters[key];
    onFiltersChange(newFilters);
  };

  const clearAllFilters = () => {
    onFiltersChange({});
  };

  const hasActiveFilters = Object.keys(filters).length > 0;
  const isFiltered = filteredCount < totalCount;

  return (
    <div className={`bg-white border border-secondary-200 rounded-lg ${className}`}>
      {/* Main Filter Bar */}
      <div className="p-4">
        <div className="flex items-center space-x-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-secondary-400" />
            <input
              type="text"
              placeholder="Search invoices by title, client, or invoice number..."
              value={filters.search || ''}
              onChange={(e) => updateFilter('search', e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-secondary-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            {filters.search && (
              <button
                onClick={() => clearFilter('search')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-secondary-400 hover:text-secondary-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select
              value={filters.status || ''}
              onChange={(e) =>
                e.target.value
                  ? updateFilter('status', e.target.value as InvoiceStatus)
                  : clearFilter('status')
              }
              className="appearance-none bg-white border border-secondary-300 rounded-lg px-4 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">All Statuses</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-secondary-400 pointer-events-none" />
          </div>

          {/* Advanced Filters Toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`flex items-center px-3 py-2 border rounded-lg transition-colors ${
              showAdvanced || hasActiveFilters
                ? 'border-primary-300 bg-primary-50 text-primary-700'
                : 'border-secondary-300 text-secondary-600 hover:bg-secondary-50'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4 mr-2" />
            Filters
            {hasActiveFilters && (
              <span className="ml-2 bg-primary-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {Object.keys(filters).length}
              </span>
            )}
          </button>
        </div>

        {/* Results Summary */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-secondary-200">
          <div className="text-sm text-secondary-600">
            {isFiltered ? (
              <span>
                Showing <strong>{filteredCount}</strong> of{' '}
                <strong>{totalCount}</strong> invoices
              </span>
            ) : (
              <span>
                <strong>{totalCount}</strong> total invoices
              </span>
            )}
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="text-sm text-primary-600 hover:text-primary-700 flex items-center"
            >
              <X className="w-3 h-3 mr-1" />
              Clear all filters
            </button>
          )}
        </div>
      </div>

      {/* Advanced Filters */}
      {showAdvanced && (
        <div className="border-t border-secondary-200 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Client Name */}
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-1">
                Client Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-secondary-400" />
                <input
                  type="text"
                  placeholder="Filter by client"
                  value={filters.client_name || ''}
                  onChange={(e) => updateFilter('client_name', e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-secondary-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>

            {/* Amount Range */}
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-1">
                Amount Range
              </label>
              <div className="flex space-x-2">
                <div className="relative flex-1">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-secondary-400" />
                  <input
                    type="text"
                    placeholder="Min"
                    value={filters.amount_min?.toString() || ''}
                    onChange={(e) => {
                      const value = formatInput.currency(e.target.value);
                      updateFilter('amount_min', value ? parseFloat(value) : undefined);
                    }}
                    className="w-full pl-10 pr-3 py-2 border border-secondary-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div className="relative flex-1">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-secondary-400" />
                  <input
                    type="text"
                    placeholder="Max"
                    value={filters.amount_max?.toString() || ''}
                    onChange={(e) => {
                      const value = formatInput.currency(e.target.value);
                      updateFilter('amount_max', value ? parseFloat(value) : undefined);
                    }}
                    className="w-full pl-10 pr-3 py-2 border border-secondary-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>
            </div>

            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-1">
                Created Date
              </label>
              <div className="flex space-x-2">
                <div className="relative flex-1">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-secondary-400" />
                  <input
                    type="date"
                    value={filters.date_from || ''}
                    onChange={(e) => updateFilter('date_from', e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-secondary-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div className="relative flex-1">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-secondary-400" />
                  <input
                    type="date"
                    value={filters.date_to || ''}
                    onChange={(e) => updateFilter('date_to', e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-secondary-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>
            </div>

            {/* Quick Date Filters */}
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-1">
                Quick Filters
              </label>
              <div className="space-y-2">
                <button
                  onClick={() => {
                    const today = new Date();
                    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
                    updateFilter('date_from', thirtyDaysAgo.toISOString().split('T')[0]);
                    updateFilter('date_to', today.toISOString().split('T')[0]);
                  }}
                  className="w-full text-left px-3 py-1 text-sm text-secondary-600 hover:bg-secondary-50 rounded"
                >
                  Last 30 days
                </button>
                <button
                  onClick={() => {
                    const today = new Date();
                    const ninetyDaysAgo = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
                    updateFilter('date_from', ninetyDaysAgo.toISOString().split('T')[0]);
                    updateFilter('date_to', today.toISOString().split('T')[0]);
                  }}
                  className="w-full text-left px-3 py-1 text-sm text-secondary-600 hover:bg-secondary-50 rounded"
                >
                  Last 90 days
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active Filter Pills */}
      {hasActiveFilters && (
        <div className="border-t border-secondary-200 p-4">
          <div className="flex flex-wrap gap-2">
            {filters.status && (
              <div className="flex items-center bg-primary-100 text-primary-800 px-3 py-1 rounded-full text-sm">
                <Filter className="w-3 h-3 mr-1" />
                Status: {STATUS_OPTIONS.find(s => s.value === filters.status)?.label}
                <button
                  onClick={() => clearFilter('status')}
                  className="ml-2 hover:text-primary-900"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            
            {filters.client_name && (
              <div className="flex items-center bg-primary-100 text-primary-800 px-3 py-1 rounded-full text-sm">
                <User className="w-3 h-3 mr-1" />
                Client: {filters.client_name}
                <button
                  onClick={() => clearFilter('client_name')}
                  className="ml-2 hover:text-primary-900"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            
            {(filters.amount_min || filters.amount_max) && (
              <div className="flex items-center bg-primary-100 text-primary-800 px-3 py-1 rounded-full text-sm">
                <DollarSign className="w-3 h-3 mr-1" />
                Amount: {filters.amount_min || 0} - {filters.amount_max || '∞'}
                <button
                  onClick={() => {
                    clearFilter('amount_min');
                    clearFilter('amount_max');
                  }}
                  className="ml-2 hover:text-primary-900"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            
            {(filters.date_from || filters.date_to) && (
              <div className="flex items-center bg-primary-100 text-primary-800 px-3 py-1 rounded-full text-sm">
                <Calendar className="w-3 h-3 mr-1" />
                Date: {filters.date_from || '...'} to {filters.date_to || '...'}
                <button
                  onClick={() => {
                    clearFilter('date_from');
                    clearFilter('date_to');
                  }}
                  className="ml-2 hover:text-primary-900"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};