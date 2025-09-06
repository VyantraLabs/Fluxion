'use client';

import React from 'react';
import {
  Loader2,
  UserPlus,
  CheckCircle,
  Sparkles,
  ArrowRight,
  Building2,
} from 'lucide-react';
import { OnboardingForm } from './OnboardingForm';
import { CompleteOnboardingRequest } from '@/types/user';

interface OnboardingOverlayProps {
  isVisible: boolean;
  currentStep?: 'creating' | 'form' | 'welcome' | 'complete';
  userName?: string;
  onCompleteOnboarding?: (data: CompleteOnboardingRequest) => Promise<void>;
  onContinue?: () => void;
  isSubmitting?: boolean;
}

const steps = [
  {
    id: 'creating',
    title: 'Creating Your Profile',
    description: 'Setting up your secure Web3 invoice account...',
    icon: <UserPlus className="w-8 h-8 text-primary-600" />,
  },
  {
    id: 'form',
    title: 'Complete Your Setup',
    description: 'Tell us about your organization to get started',
    icon: <Building2 className="w-8 h-8 text-primary-600" />,
  },
  {
    id: 'welcome',
    title: 'Welcome to Fluxion!',
    description: 'Your crypto-native invoicing platform is ready',
    icon: <Sparkles className="w-8 h-8 text-primary-600" />,
  },
  {
    id: 'complete',
    title: 'Profile Created Successfully',
    description: 'You can now create and send invoices',
    icon: <CheckCircle className="w-8 h-8 text-success-600" />,
  },
];

export const OnboardingOverlay: React.FC<OnboardingOverlayProps> = ({
  isVisible,
  currentStep = 'creating',
  userName,
  onCompleteOnboarding,
  onContinue,
  isSubmitting = false,
}) => {
  if (!isVisible) return null;

  const step = steps.find(s => s.id === currentStep) || steps[0];
  const isFormStep = currentStep === 'form';

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className={`bg-white rounded-2xl shadow-2xl p-8 w-full mx-4 relative overflow-hidden transition-all duration-300 ${
        isFormStep ? 'max-w-lg' : 'max-w-md'
      }`}>
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary-100 to-primary-200 rounded-full -translate-y-16 translate-x-16 opacity-50" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-success-100 to-success-200 rounded-full translate-y-12 -translate-x-12 opacity-50" />
        
        <div className={`relative z-10 ${isFormStep ? 'text-left' : 'text-center'}`}>
          {/* Icon - only show for non-form steps */}
          {!isFormStep && (
            <div className="flex justify-center mb-6">
              <div className="relative">
                {step.icon}
                {currentStep === 'creating' && (
                  <Loader2 className="absolute -right-2 -top-2 w-4 h-4 text-primary-400 animate-spin" />
                )}
              </div>
            </div>
          )}

          {/* Title */}
          <h2 className={`text-2xl font-bold text-secondary-900 mb-3 ${isFormStep ? 'text-center' : ''}`}>
            {step.title}
            {userName && currentStep === 'welcome' && (
              <span className="block text-lg font-normal text-primary-600 mt-1">
                {userName}
              </span>
            )}
          </h2>

          {/* Description - only show for non-form steps */}
          {!isFormStep && (
            <p className="text-secondary-600 mb-8 leading-relaxed">
              {step.description}
            </p>
          )}

          {/* Form Step Content */}
          {isFormStep && (
            <div className="mb-8">
              <p className="text-secondary-600 mb-6 text-center leading-relaxed">
                {step.description}
              </p>
              {onCompleteOnboarding && (
                <OnboardingForm 
                  onSubmit={onCompleteOnboarding}
                  isLoading={isSubmitting}
                />
              )}
            </div>
          )}

          {/* Progress indicator - only show for non-form steps */}
          {!isFormStep && (
            <div className="flex justify-center space-x-2 mb-6">
              {steps.map((s, index) => (
                <div
                  key={s.id}
                  className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                    steps.findIndex(step => step.id === currentStep) >= index
                      ? 'bg-primary-600'
                      : 'bg-secondary-200'
                  }`}
                />
              ))}
            </div>
          )}

          {/* Features preview */}
          {currentStep === 'welcome' && (
            <div className="space-y-3 mb-6">
              <div className="flex items-center text-sm text-secondary-700">
                <CheckCircle className="w-4 h-4 text-success-600 mr-2 flex-shrink-0" />
                Create professional crypto invoices
              </div>
              <div className="flex items-center text-sm text-secondary-700">
                <CheckCircle className="w-4 h-4 text-success-600 mr-2 flex-shrink-0" />
                Accept payments in USDC, ETH, and more
              </div>
              <div className="flex items-center text-sm text-secondary-700">
                <CheckCircle className="w-4 h-4 text-success-600 mr-2 flex-shrink-0" />
                Track payments across multiple networks
              </div>
            </div>
          )}

          {/* Call to action */}
          {currentStep === 'complete' && (
            <button
              className="btn-primary flex items-center mx-auto"
              onClick={onContinue || (() => window.location.href = '/dashboard')}
            >
              Get Started
              <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          )}

          {/* Loading indicator */}
          {currentStep === 'creating' && (
            <div className="flex justify-center">
              <div className="flex items-center space-x-3 text-primary-600">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-sm font-medium">Setting up your account...</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};