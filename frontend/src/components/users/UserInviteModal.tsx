'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Mail,
  User,
  Send,
  AlertCircle,
  Check,
  UserPlus,
  Building2,
  Shield,
} from 'lucide-react';
import { Organization, InviteUserRequest } from '@/types/user';
import { useOrganization, useUserPermissions } from '@/contexts/OrganizationContext';
import { cn } from '@/utils/helpers';
import toast from 'react-hot-toast';

interface UserInviteModalProps {
  organization?: Organization;
  isOpen: boolean;
  onClose: () => void;
  onInvite?: (data: InviteUserRequest) => Promise<void>;
}

interface InviteForm {
  email: string;
  wallet_address: string;
  organization_id: string;
  roles: string[];
  message: string;
  invite_type: 'email' | 'wallet';
}

const ROLE_OPTIONS = [
  {
    id: 'member',
    name: 'Member',
    description: 'Create and manage own invoices',
    recommended: true,
  },
  {
    id: 'viewer',
    name: 'Viewer',
    description: 'Read-only access to invoices and organization data',
    recommended: false,
  },
  {
    id: 'client',
    name: 'Client',
    description: 'Limited access to view and pay own invoices',
    recommended: false,
  },
  {
    id: 'manager',
    name: 'Manager',
    description: 'Create and manage invoices, view team activity',
    recommended: false,
  },
  {
    id: 'org_admin',
    name: 'Organization Admin',
    description: 'Manage users and organization settings',
    recommended: false,
  },
];

export const UserInviteModal: React.FC<UserInviteModalProps> = ({
  organization,
  isOpen,
  onClose,
  onInvite,
}) => {
  const { state, actions } = useOrganization();
  const permissions = useUserPermissions();
  
  const [form, setForm] = useState<InviteForm>({
    email: '',
    wallet_address: '',
    organization_id: '',
    roles: ['member'], // Default role
    message: '',
    invite_type: 'email',
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'details' | 'roles' | 'message'>('details');

  const currentOrg = organization || state.activeOrganization;

  useEffect(() => {
    if (isOpen && currentOrg) {
      setForm(prev => ({
        ...prev,
        organization_id: currentOrg.id,
        roles: ['member'],
        message: `Hi! You've been invited to join ${currentOrg.name} on Fluxion. Click the link below to accept your invitation and get started with Web3 invoicing.`,
      }));
      setStep('details');
      setError(null);
    }
  }, [isOpen, currentOrg]);

  if (!isOpen || !currentOrg || !permissions?.canInviteUsers) return null;

  const handleInputChange = (field: keyof InviteForm, value: string | string[]) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleRoleToggle = (roleId: string) => {
    setForm(prev => ({
      ...prev,
      roles: prev.roles.includes(roleId)
        ? prev.roles.filter(r => r !== roleId)
        : [...prev.roles, roleId]
    }));
  };

  const validateStep = (currentStep: string): boolean => {
    switch (currentStep) {
      case 'details':
        if (form.invite_type === 'email') {
          return form.email.trim() !== '' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
        } else {
          return form.wallet_address.trim() !== '' && /^0x[a-fA-F0-9]{40}$/.test(form.wallet_address);
        }
      case 'roles':
        return form.roles.length > 0;
      case 'message':
        return true; // Message is optional
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (!validateStep(step)) {
      if (step === 'details') {
        setError(form.invite_type === 'email' 
          ? 'Please enter a valid email address'
          : 'Please enter a valid wallet address (0x...)'
        );
      } else if (step === 'roles') {
        setError('Please select at least one role');
      }
      return;
    }

    setError(null);
    
    if (step === 'details') {
      setStep('roles');
    } else if (step === 'roles') {
      setStep('message');
    }
  };

  const handlePrevious = () => {
    if (step === 'roles') {
      setStep('details');
    } else if (step === 'message') {
      setStep('roles');
    }
  };

  const handleSubmit = async () => {
    if (isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const inviteData: InviteUserRequest = {
        organization_id: currentOrg.id,
        roles: form.roles,
        message: form.message || undefined,
      };

      if (form.invite_type === 'email') {
        inviteData.email = form.email;
      } else {
        inviteData.wallet_address = form.wallet_address;
      }

      if (onInvite) {
        await onInvite(inviteData);
      } else {
        await actions.inviteUser(inviteData);
      }

      toast.success('User invitation sent successfully!');
      onClose();
    } catch (err: any) {
      console.error('Failed to send invitation:', err);
      setError(err.message || 'Failed to send invitation');
    } finally {
      setIsLoading(false);
    }
  };

  const canAccessRole = (roleId: string): boolean => {
    if (permissions?.isSystemAdmin) return true;
    if (permissions?.isOwner && roleId !== 'owner') return true;
    if (permissions?.isOrgAdmin && !['owner', 'org_admin'].includes(roleId)) return true;
    return ['member', 'viewer', 'client'].includes(roleId);
  };

  const getStepTitle = () => {
    switch (step) {
      case 'details': return 'Invitation Details';
      case 'roles': return 'Assign Roles';
      case 'message': return 'Invitation Message';
      default: return 'Invite User';
    }
  };

  const isFormValid = validateStep(step);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <UserPlus className="w-5 h-5 mr-2" />
                {getStepTitle()}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Invite a user to {currentOrg.name}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex items-center">
              {['details', 'roles', 'message'].map((stepName, index) => (
                <React.Fragment key={stepName}>
                  <div className={cn(
                    'flex items-center justify-center w-8 h-8 rounded-full text-xs font-medium',
                    step === stepName 
                      ? 'bg-primary-600 text-white' 
                      : index < ['details', 'roles', 'message'].indexOf(step)
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 text-gray-500'
                  )}>
                    {index < ['details', 'roles', 'message'].indexOf(step) ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      index + 1
                    )}
                  </div>
                  {index < 2 && (
                    <div className={cn(
                      'flex-1 h-1 mx-2',
                      index < ['details', 'roles', 'message'].indexOf(step)
                        ? 'bg-green-500'
                        : 'bg-gray-200'
                    )} />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="px-6 py-3 bg-red-50 border-b border-red-200">
            <div className="flex items-center text-red-700">
              <AlertCircle className="w-4 h-4 mr-2" />
              <span className="text-sm">{error}</span>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="px-6 py-6">
          {step === 'details' && (
            <div className="space-y-4">
              {/* Organization Info */}
              <div className="p-3 bg-gray-50 rounded-lg border">
                <div className="flex items-center space-x-2">
                  <Building2 className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-900">
                    Inviting to: {currentOrg.name}
                  </span>
                </div>
              </div>

              {/* Invitation Type */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-3 block">
                  How would you like to invite this user?
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleInputChange('invite_type', 'email')}
                    className={cn(
                      'p-3 border rounded-lg text-left transition-colors',
                      form.invite_type === 'email'
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <Mail className="w-5 h-5 text-gray-600 mb-2" />
                    <div className="font-medium text-sm">Email Address</div>
                    <div className="text-xs text-gray-500">Send invitation via email</div>
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => handleInputChange('invite_type', 'wallet')}
                    className={cn(
                      'p-3 border rounded-lg text-left transition-colors',
                      form.invite_type === 'wallet'
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <User className="w-5 h-5 text-gray-600 mb-2" />
                    <div className="font-medium text-sm">Wallet Address</div>
                    <div className="text-xs text-gray-500">Invite by wallet address</div>
                  </button>
                </div>
              </div>

              {/* Input Field */}
              <div>
                {form.invite_type === 'email' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      placeholder="user@example.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Wallet Address
                    </label>
                    <input
                      type="text"
                      value={form.wallet_address}
                      onChange={(e) => handleInputChange('wallet_address', e.target.value)}
                      placeholder="0x..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono text-sm"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 'roles' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-3">Select Roles</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Choose the roles you want to assign to this user. You can change these later.
                </p>
              </div>

              <div className="space-y-3">
                {ROLE_OPTIONS.filter(role => canAccessRole(role.id)).map((role) => {
                  const isSelected = form.roles.includes(role.id);
                  
                  return (
                    <div
                      key={role.id}
                      onClick={() => handleRoleToggle(role.id)}
                      className={cn(
                        'border rounded-lg p-4 cursor-pointer transition-colors',
                        isSelected ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <h4 className="font-medium text-gray-900">{role.name}</h4>
                            {role.recommended && (
                              <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                                Recommended
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{role.description}</p>
                        </div>
                        
                        <div className="ml-3">
                          {isSelected ? (
                            <div className="w-5 h-5 bg-primary-600 rounded-full flex items-center justify-center">
                              <Check className="w-3 h-3 text-white" />
                            </div>
                          ) : (
                            <div className="w-5 h-5 border border-gray-300 rounded-full" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {step === 'message' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-2">Invitation Message</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Customize the message that will be sent with the invitation (optional).
                </p>
              </div>

              <div>
                <textarea
                  value={form.message}
                  onChange={(e) => handleInputChange('message', e.target.value)}
                  rows={4}
                  placeholder="Add a personal message to the invitation..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              {/* Preview */}
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="text-xs text-gray-500 mb-2">INVITATION PREVIEW</div>
                <div className="text-sm text-gray-700">
                  <div className="font-medium mb-2">
                    You're invited to join {currentOrg.name}!
                  </div>
                  {form.message && (
                    <div className="mb-2">{form.message}</div>
                  )}
                  <div className="text-xs text-gray-500">
                    Roles: {form.roles.map(r => r.replace('_', ' ')).join(', ')}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500">
              Step {['details', 'roles', 'message'].indexOf(step) + 1} of 3
            </div>
            <div className="flex space-x-3">
              {step !== 'details' && (
                <button
                  onClick={handlePrevious}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  Previous
                </button>
              )}
              
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                Cancel
              </button>
              
              {step === 'message' ? (
                <button
                  onClick={handleSubmit}
                  disabled={isLoading}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Send Invitation
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  disabled={!isFormValid}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};