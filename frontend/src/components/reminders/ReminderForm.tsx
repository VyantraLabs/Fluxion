'use client';

import React, { useState, useEffect } from 'react';
import {
  Bell,
  AlertCircle,
  Mail,
  Clock,
  Save,
  X,
  Loader2,
} from 'lucide-react';
import { reminderApi, handleApiResponse } from '@/utils/api';
import { cn } from '@/utils/helpers';
import toast from 'react-hot-toast';

interface Reminder {
  id: string;
  name: string;
  description: string;
  type: 'payment_reminder' | 'payment_overdue' | 'follow_up';
  status: 'active' | 'paused' | 'completed';
  triggerDays: number;
  emailTemplate?: string;
  webhookUrl?: string;
}

interface ReminderFormProps {
  reminder?: Reminder | null;
  onSave?: (reminder: Reminder) => void;
  onCancel?: () => void;
  className?: string;
}

interface FormData {
  name: string;
  description: string;
  type: 'payment_reminder' | 'payment_overdue' | 'follow_up';
  triggerDays: number;
  emailTemplate: string;
  webhookUrl: string;
}

const REMINDER_TYPES = [
  {
    value: 'payment_reminder',
    label: 'Payment Reminder',
    description: 'Send reminders before payment due date',
    icon: Bell,
  },
  {
    value: 'payment_overdue',
    label: 'Payment Overdue',
    description: 'Send notifications for overdue payments',
    icon: AlertCircle,
  },
  {
    value: 'follow_up',
    label: 'Follow Up',
    description: 'Send follow-up messages to clients',
    icon: Mail,
  },
] as const;

export const ReminderForm: React.FC<ReminderFormProps> = ({
  reminder,
  onSave,
  onCancel,
  className = '',
}) => {
  const [formData, setFormData] = useState<FormData>({
    name: reminder?.name || '',
    description: reminder?.description || '',
    type: reminder?.type || 'payment_reminder',
    triggerDays: reminder?.triggerDays || 3,
    emailTemplate: reminder?.emailTemplate || '',
    webhookUrl: reminder?.webhookUrl || '',
  });
  
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const handleInputChange = (field: keyof FormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear field error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };
  
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Reminder name is required';
    }
    
    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }
    
    if (formData.triggerDays < 1 || formData.triggerDays > 365) {
      newErrors.triggerDays = 'Trigger days must be between 1 and 365';
    }
    
    if (formData.webhookUrl && !isValidUrl(formData.webhookUrl)) {
      newErrors.webhookUrl = 'Please enter a valid webhook URL';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    try {
      setLoading(true);
      
      const requestData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        type: formData.type,
        triggerDays: formData.triggerDays,
        emailTemplate: formData.emailTemplate.trim() || undefined,
        webhookUrl: formData.webhookUrl.trim() || undefined,
      };
      
      let response;
      if (reminder?.id) {
        response = await reminderApi.update(reminder.id, requestData);
      } else {
        response = await reminderApi.create(requestData);
      }
      
      const savedReminder = handleApiResponse(response);
      
      toast.success(
        reminder?.id 
          ? 'Reminder updated successfully'
          : 'Reminder created successfully'
      );
      
      if (onSave) {
        onSave(savedReminder);
      }
    } catch (err: any) {
      console.error('Failed to save reminder:', err);
      toast.error(err.message || 'Failed to save reminder');
      
      // Handle validation errors from backend
      if (err.details && Array.isArray(err.details)) {
        const newErrors: Record<string, string> = {};
        err.details.forEach((detail: any) => {
          if (detail.field) {
            newErrors[detail.field] = detail.message;
          }
        });
        setErrors(newErrors);
      }
    } finally {
      setLoading(false);
    }
  };
  
  const renderFormField = (
    field: keyof FormData,
    label: string,
    type: 'text' | 'number' | 'textarea' | 'select' = 'text',
    placeholder?: string,
    options?: { value: string; label: string }[],
    required = false
  ) => (
    <div className="mb-4">
      <label className="block text-sm font-medium text-secondary-700 mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      
      {type === 'textarea' ? (
        <textarea
          value={formData[field] as string}
          onChange={(e) => handleInputChange(field, e.target.value)}
          placeholder={placeholder}
          rows={3}
          className={cn(
            'w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors resize-none',
            errors[field] ? 'border-red-300' : 'border-secondary-300'
          )}
        />
      ) : type === 'select' && options ? (
        <select
          value={formData[field] as string}
          onChange={(e) => handleInputChange(field, e.target.value)}
          className={cn(
            'w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors',
            errors[field] ? 'border-red-300' : 'border-secondary-300'
          )}
        >
          {options.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          value={formData[field] as string | number}
          onChange={(e) => handleInputChange(
            field, 
            type === 'number' ? parseInt(e.target.value) || 0 : e.target.value
          )}
          placeholder={placeholder}
          className={cn(
            'w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors',
            errors[field] ? 'border-red-300' : 'border-secondary-300'
          )}
          min={type === 'number' ? 1 : undefined}
          max={type === 'number' ? 365 : undefined}
        />
      )}
      
      {errors[field] && (
        <p className="mt-1 text-sm text-red-600 flex items-center">
          <AlertCircle className="w-4 h-4 mr-1 flex-shrink-0" />
          {errors[field]}
        </p>
      )}
    </div>
  );
  
  return (
    <div className={`bg-white rounded-lg border border-secondary-200 ${className}`}>
      <div className="p-6 border-b border-secondary-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-secondary-900">
              {reminder?.id ? 'Edit Reminder' : 'Create Reminder'}
            </h2>
            <p className="text-secondary-600 text-sm mt-1">
              Set up automated reminders for your invoices
            </p>
          </div>
          {onCancel && (
            <button
              onClick={onCancel}
              className="text-secondary-400 hover:text-secondary-600"
            >
              <X className="w-6 h-6" />
            </button>
          )}
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-secondary-900">Basic Information</h3>
          
          {renderFormField(
            'name',
            'Reminder Name',
            'text',
            'e.g., 3-day payment reminder',
            undefined,
            true
          )}
          
          {renderFormField(
            'description',
            'Description',
            'textarea',
            'Describe what this reminder does...',
            undefined,
            true
          )}
        </div>
        
        {/* Reminder Type */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-secondary-900">Reminder Type</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {REMINDER_TYPES.map((type) => (
              <label
                key={type.value}
                className={cn(
                  'relative flex flex-col p-4 border rounded-lg cursor-pointer transition-colors',
                  formData.type === type.value
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-secondary-300 hover:border-secondary-400'
                )}
              >
                <input
                  type="radio"
                  name="type"
                  value={type.value}
                  checked={formData.type === type.value}
                  onChange={(e) => handleInputChange('type', e.target.value)}
                  className="sr-only"
                />
                <div className="flex items-center space-x-3">
                  <type.icon className={cn(
                    'w-5 h-5',
                    formData.type === type.value ? 'text-primary-600' : 'text-secondary-400'
                  )} />
                  <div>
                    <p className={cn(
                      'font-medium text-sm',
                      formData.type === type.value ? 'text-primary-900' : 'text-secondary-900'
                    )}>
                      {type.label}
                    </p>
                    <p className={cn(
                      'text-xs mt-1',
                      formData.type === type.value ? 'text-primary-700' : 'text-secondary-600'
                    )}>
                      {type.description}
                    </p>
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>
        
        {/* Timing */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-secondary-900">Timing</h3>
          
          <div className="max-w-xs">
            {renderFormField(
              'triggerDays',
              'Trigger Days',
              'number',
              '3',
              undefined,
              true
            )}
            <p className="text-xs text-secondary-500 mt-1">
              {formData.type === 'payment_overdue' 
                ? 'Days after due date to send reminder'
                : 'Days before due date to send reminder'
              }
            </p>
          </div>
        </div>
        
        {/* Advanced Settings */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-secondary-900">Advanced Settings</h3>
          
          {renderFormField(
            'emailTemplate',
            'Custom Email Template',
            'textarea',
            'Leave empty to use default template...'
          )}
          
          {renderFormField(
            'webhookUrl',
            'Webhook URL',
            'text',
            'https://your-app.com/webhook'
          )}
          
          <p className="text-xs text-secondary-500">
            Optional: Receive webhook notifications when reminders are sent
          </p>
        </div>
        
        {/* Actions */}
        <div className="flex items-center justify-end space-x-3 pt-6 border-t border-secondary-200">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="btn-secondary"
            >
              Cancel
            </button>
          )}
          
          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                {reminder?.id ? 'Update Reminder' : 'Create Reminder'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};