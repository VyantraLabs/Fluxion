'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { OnboardingOverlay } from './OnboardingOverlay';
import { CompleteOnboardingRequest } from '@/types/user';

type OnboardingStep = 'creating' | 'form' | 'welcome' | 'complete';

export const OnboardingManager: React.FC = () => {
  const { state, actions } = useAuth();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('form');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Show onboarding if user needs onboarding OR is in onboarding state (new users)
  const shouldShowOnboarding = state.needsOnboarding || state.isOnboarding;

  const handleCompleteOnboarding = async (data: CompleteOnboardingRequest) => {
    setIsSubmitting(true);
    
    try {
      // Set step to creating while processing
      setCurrentStep('creating');
      
      // Call the API to complete onboarding
      await actions.completeOnboarding(data);
      
      // Show welcome step briefly before closing
      setCurrentStep('welcome');
      
      // Auto-advance to complete step after a short delay
      setTimeout(() => {
        setCurrentStep('complete');
      }, 2000);
      
    } catch (error) {
      // Go back to form step if there's an error
      setCurrentStep('form');
      console.error('Onboarding error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContinue = () => {
    // This will be called when user clicks "Get Started" after completion
    // The overlay will be hidden automatically since needsOnboarding will be false
    console.log('Onboarding complete, user can proceed to dashboard');
  };

  if (!shouldShowOnboarding) {
    return null;
  }

  return (
    <OnboardingOverlay
      isVisible={shouldShowOnboarding}
      currentStep={currentStep}
      userName={state.user?.display_name || state.user?.profile?.display_name}
      onCompleteOnboarding={handleCompleteOnboarding}
      onContinue={handleContinue}
      isSubmitting={isSubmitting}
    />
  );
};