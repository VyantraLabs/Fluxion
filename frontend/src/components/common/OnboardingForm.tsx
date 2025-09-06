'use client';

import React, { useState } from 'react';
import { Building2, User, Mail, CheckCircle2 } from 'lucide-react';
import { CompleteOnboardingRequest } from '@/types/user';

interface OnboardingFormProps {
  onSubmit: (data: CompleteOnboardingRequest) => Promise<void>;
  isLoading?: boolean;
}

interface FormData {
  organizationName: string;
  displayName: string;
  email: string;
}

interface FormErrors {
  organizationName?: string;
  displayName?: string;
  email?: string;
  submit?: string;
}

export const OnboardingForm: React.FC<OnboardingFormProps> = ({
  onSubmit,
  isLoading = false,
}) => {
  const [formData, setFormData] = useState<FormData>({
    organizationName: '',
    displayName: '',
    email: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<{ [key: string]: boolean }>({});

  const validateField = (name: keyof FormData, value: string): string | undefined => {
    switch (name) {
      case 'organizationName':
        if (!value.trim()) {
          return 'Organization name is required';
        }
        if (value.trim().length < 2) {
          return 'Organization name must be at least 2 characters';
        }
        if (value.trim().length > 100) {
          return 'Organization name must be less than 100 characters';
        }
        return undefined;

      case 'displayName':
        if (value.trim() && value.trim().length > 50) {
          return 'Display name must be less than 50 characters';
        }
        return undefined;

      case 'email':
        if (value.trim()) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value.trim())) {
            return 'Please enter a valid email address';
          }
        }
        return undefined;

      default:
        return undefined;
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    let isValid = true;

    Object.keys(formData).forEach((key) => {
      const error = validateField(key as keyof FormData, formData[key as keyof FormData]);
      if (error) {
        newErrors[key as keyof FormErrors] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  const handleInputChange = (name: keyof FormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear field error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: undefined
      }));
    }

    // Clear submit error when user makes changes
    if (errors.submit) {
      setErrors(prev => ({
        ...prev,
        submit: undefined
      }));
    }
  };

  const handleInputBlur = (name: keyof FormData) => {
    setTouched(prev => ({ ...prev, [name]: true }));
    
    const error = validateField(name, formData[name]);
    if (error) {
      setErrors(prev => ({
        ...prev,
        [name]: error
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Mark all fields as touched
    setTouched({
      organizationName: true,
      displayName: true,
      email: true,
    });

    if (!validateForm()) {
      return;
    }

    try {
      setErrors(prev => ({ ...prev, submit: undefined }));
      
      const submitData: CompleteOnboardingRequest = {
        organizationName: formData.organizationName.trim(),
        displayName: formData.displayName.trim() || undefined,
        email: formData.email.trim() || undefined,
      };

      await onSubmit(submitData);
    } catch (error: any) {
      console.error('Onboarding submission error:', error);
      setErrors(prev => ({
        ...prev,
        submit: error.message || 'Failed to complete onboarding. Please try again.',
      }));
    }
  };

  const getFieldError = (name: keyof FormData): string | undefined => {
    return touched[name] ? errors[name] : undefined;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Organization Name */}
      <div>
        <label htmlFor="organizationName" className="block text-sm font-medium text-secondary-700 mb-2">
          <div className="flex items-center">
            <Building2 className="w-4 h-4 mr-2 text-primary-600" />
            Organization Name *
          </div>
        </label>
        <input
          id="organizationName"
          type="text"
          required
          placeholder="Enter your company or organization name"
          value={formData.organizationName}
          onChange={(e) => handleInputChange('organizationName', e.target.value)}
          onBlur={() => handleInputBlur('organizationName')}
          disabled={isLoading}
          className={`w-full px-4 py-3 rounded-lg border transition-all duration-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:opacity-50 disabled:cursor-not-allowed ${
            getFieldError('organizationName')
              ? 'border-red-300 bg-red-50'
              : 'border-secondary-300 bg-white hover:border-secondary-400 focus:bg-white'
          }`}
          maxLength={100}
        />
        {getFieldError('organizationName') && (
          <p className="mt-1 text-sm text-red-600">{getFieldError('organizationName')}</p>
        )}
      </div>

      {/* Display Name */}
      <div>
        <label htmlFor="displayName" className="block text-sm font-medium text-secondary-700 mb-2">
          <div className="flex items-center">
            <User className="w-4 h-4 mr-2 text-primary-600" />
            Display Name <span className="text-secondary-400">(optional)</span>
          </div>
        </label>
        <input
          id="displayName"
          type="text"
          placeholder="How should we display your name?"
          value={formData.displayName}
          onChange={(e) => handleInputChange('displayName', e.target.value)}
          onBlur={() => handleInputBlur('displayName')}
          disabled={isLoading}
          className={`w-full px-4 py-3 rounded-lg border transition-all duration-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:opacity-50 disabled:cursor-not-allowed ${
            getFieldError('displayName')
              ? 'border-red-300 bg-red-50'
              : 'border-secondary-300 bg-white hover:border-secondary-400 focus:bg-white'
          }`}
          maxLength={50}
        />
        {getFieldError('displayName') && (
          <p className="mt-1 text-sm text-red-600">{getFieldError('displayName')}</p>
        )}
      </div>

      {/* Email */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-secondary-700 mb-2">
          <div className="flex items-center">
            <Mail className="w-4 h-4 mr-2 text-primary-600" />
            Email Address <span className="text-secondary-400">(optional)</span>
          </div>
        </label>
        <input
          id="email"
          type="email"
          placeholder="your@email.com"
          value={formData.email}
          onChange={(e) => handleInputChange('email', e.target.value)}
          onBlur={() => handleInputBlur('email')}
          disabled={isLoading}
          className={`w-full px-4 py-3 rounded-lg border transition-all duration-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:opacity-50 disabled:cursor-not-allowed ${
            getFieldError('email')
              ? 'border-red-300 bg-red-50'
              : 'border-secondary-300 bg-white hover:border-secondary-400 focus:bg-white'
          }`}
        />
        {getFieldError('email') && (
          <p className="mt-1 text-sm text-red-600">{getFieldError('email')}</p>
        )}
        <p className="mt-1 text-xs text-secondary-500">
          We'll use this to send you invoice notifications and updates
        </p>
      </div>

      {/* Submit Error */}
      {errors.submit && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">{errors.submit}</p>
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full btn-primary flex items-center justify-center py-4 text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-3" />
            Setting up your account...
          </div>
        ) : (
          <div className="flex items-center">
            <CheckCircle2 className="w-5 h-5 mr-2" />
            Complete Setup
          </div>
        )}
      </button>

      {/* Form Info */}
      <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
        <div className="flex">
          <CheckCircle2 className="w-5 h-5 text-primary-600 mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <h4 className="text-sm font-medium text-primary-900 mb-1">
              Almost done!
            </h4>
            <p className="text-sm text-primary-700">
              This information helps us personalize your invoicing experience and ensure smooth payment processing.
            </p>
          </div>
        </div>
      </div>
    </form>
  );
};