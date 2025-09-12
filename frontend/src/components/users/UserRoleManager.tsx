'use client';

import React, { useState, useEffect } from 'react';
import {
  Shield,
  ShieldCheck,
  Users,
  Check,
  X,
  AlertCircle,
  User,
  Building2,
  Settings,
} from 'lucide-react';
import { OrganizationUser, Organization } from '@/types/user';
import { useOrganization, useUserPermissions } from '@/contexts/OrganizationContext';
import { cn } from '@/utils/helpers';
import toast from 'react-hot-toast';

interface UserRoleManagerProps {
  user: OrganizationUser;
  organization?: Organization;
  isOpen: boolean;
  onClose: () => void;
  onRoleChange?: (userId: string, orgId: string, roles: string[]) => Promise<void>;
}

interface RoleDefinition {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  color: string;
  icon: React.ComponentType<{ className?: string }>;
  level: number; // Higher level = more permissions
}

const ORGANIZATION_ROLES: RoleDefinition[] = [
  {
    id: 'owner',
    name: 'Owner',
    description: 'Full control over the organization, including user management and settings',
    permissions: ['manage_all', 'invite_users', 'remove_users', 'change_roles', 'manage_settings', 'view_analytics'],
    color: 'bg-green-100 text-green-800 border-green-300',
    icon: ShieldCheck,
    level: 100,
  },
  {
    id: 'org_admin',
    name: 'Organization Admin',
    description: 'Manage users and organization-level settings',
    permissions: ['invite_users', 'remove_users', 'change_roles', 'manage_settings', 'view_analytics'],
    color: 'bg-blue-100 text-blue-800 border-blue-300',
    icon: Shield,
    level: 80,
  },
  {
    id: 'manager',
    name: 'Manager',
    description: 'Create and manage invoices, view team activity',
    permissions: ['create_invoices', 'manage_invoices', 'view_team_analytics'],
    color: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    icon: Users,
    level: 60,
  },
  {
    id: 'member',
    name: 'Member',
    description: 'Create and manage own invoices',
    permissions: ['create_invoices', 'manage_own_invoices'],
    color: 'bg-gray-100 text-gray-800 border-gray-300',
    icon: User,
    level: 40,
  },
  {
    id: 'viewer',
    name: 'Viewer',
    description: 'Read-only access to invoices and basic organization data',
    permissions: ['view_invoices'],
    color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    icon: Settings,
    level: 20,
  },
  {
    id: 'client',
    name: 'Client',
    description: 'Limited access to view and pay own invoices',
    permissions: ['view_own_invoices', 'pay_invoices'],
    color: 'bg-pink-100 text-pink-800 border-pink-300',
    icon: Building2,
    level: 10,
  },
];

export const UserRoleManager: React.FC<UserRoleManagerProps> = ({
  user,
  organization,
  isOpen,
  onClose,
  onRoleChange,
}) => {
  const { state, actions } = useOrganization();
  const permissions = useUserPermissions();
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentOrg = organization || state.activeOrganization;

  useEffect(() => {
    if (isOpen && user) {
      setSelectedRoles([...user.organization_roles]);
      setError(null);
    }
  }, [isOpen, user]);

  if (!isOpen || !currentOrg) return null;

  const handleRoleToggle = (roleId: string) => {
    setSelectedRoles(prev => {
      if (prev.includes(roleId)) {
        return prev.filter(r => r !== roleId);
      } else {
        // Remove conflicting roles (e.g., can't be both owner and member)
        const roleLevel = ORGANIZATION_ROLES.find(r => r.id === roleId)?.level || 0;
        const filteredRoles = prev.filter(r => {
          const existingLevel = ORGANIZATION_ROLES.find(role => role.id === r)?.level || 0;
          // Keep roles that are complementary or remove conflicting primary roles
          return Math.abs(existingLevel - roleLevel) < 50; // Allow some role combinations
        });
        return [...filteredRoles, roleId];
      }
    });
  };

  const handleSave = async () => {
    if (!permissions?.canChangeRoles || !currentOrg) return;

    setIsLoading(true);
    setError(null);

    try {
      if (onRoleChange) {
        await onRoleChange(user.id, currentOrg.id, selectedRoles);
      } else {
        await actions.updateUserRoles({
          user_id: user.id,
          organization_id: currentOrg.id,
          roles: selectedRoles,
        });
      }
      
      toast.success('User roles updated successfully');
      onClose();
    } catch (err: any) {
      console.error('Failed to update user roles:', err);
      setError(err.message || 'Failed to update user roles');
      toast.error('Failed to update user roles');
    } finally {
      setIsLoading(false);
    }
  };

  const canModifyRole = (role: RoleDefinition) => {
    if (!permissions) return false;
    
    // System admins can modify any role
    if (permissions.isSystemAdmin) return true;
    
    // Organization owners can modify any role except other owners
    if (permissions.isOwner && role.id !== 'owner') return true;
    
    // Org admins can modify roles below their level
    if (permissions.isOrgAdmin && role.level < 80) return true;
    
    return false;
  };

  const getRoleIcon = (role: RoleDefinition) => {
    const Icon = role.icon;
    return <Icon className="w-4 h-4" />;
  };

  const hasChanges = JSON.stringify(selectedRoles.sort()) !== JSON.stringify(user.organization_roles.sort());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Manage User Roles</h2>
              <p className="text-sm text-gray-600 mt-1">
                Update roles for {user.display_name || user.email} in {currentOrg.name}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* User Info */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-gray-700">
                {user.display_name?.[0] || user.email?.[0]?.toUpperCase() || '?'}
              </span>
            </div>
            <div>
              <h3 className="font-medium text-gray-900">
                {user.display_name || user.first_name || user.email || 'Unknown User'}
              </h3>
              <p className="text-sm text-gray-500">{user.email}</p>
              {user.wallet_address && (
                <p className="text-xs text-gray-400 font-mono">
                  {user.wallet_address.slice(0, 6)}...{user.wallet_address.slice(-4)}
                </p>
              )}
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

        {/* Roles Section */}
        <div className="px-6 py-4 max-h-96 overflow-y-auto">
          <h3 className="text-sm font-medium text-gray-900 mb-4">Organization Roles</h3>
          
          <div className="space-y-3">
            {ORGANIZATION_ROLES.map((role) => {
              const isSelected = selectedRoles.includes(role.id);
              const canModify = canModifyRole(role);
              const isCurrentUserOwner = user.organization_roles.includes('owner') && role.id === 'owner' && user.id === permissions?.user.id;
              const isDisabled = !canModify || isCurrentUserOwner;

              return (
                <div
                  key={role.id}
                  className={cn(
                    'border rounded-lg p-4 transition-all',
                    isSelected ? role.color : 'border-gray-200 bg-white',
                    canModify && !isCurrentUserOwner ? 'cursor-pointer hover:border-gray-300' : 'cursor-not-allowed opacity-60'
                  )}
                  onClick={() => canModify && !isCurrentUserOwner && handleRoleToggle(role.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <div className="mt-0.5">
                        {getRoleIcon(role)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h4 className="font-medium text-gray-900">{role.name}</h4>
                          {isCurrentUserOwner && (
                            <span className="text-xs text-amber-600 font-medium">(Cannot modify own owner role)</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{role.description}</p>
                        
                        {/* Permissions List */}
                        <div className="mt-2">
                          <div className="flex flex-wrap gap-1">
                            {role.permissions.slice(0, 3).map((permission) => (
                              <span
                                key={permission}
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600"
                              >
                                {permission.replace('_', ' ')}
                              </span>
                            ))}
                            {role.permissions.length > 3 && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                                +{role.permissions.length - 3} more
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
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

          {/* System Roles Display (read-only) */}
          {user.system_roles && user.system_roles.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-900 mb-3">System Roles (Read Only)</h3>
              <div className="space-y-2">
                {user.system_roles.map((role) => (
                  <div
                    key={role}
                    className="flex items-center justify-between p-3 border border-purple-200 bg-purple-50 rounded-lg"
                  >
                    <div className="flex items-center space-x-2">
                      <ShieldCheck className="w-4 h-4 text-purple-600" />
                      <span className="text-sm font-medium text-purple-900">
                        {role.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                    <span className="text-xs text-purple-600">System Level</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500">
              {selectedRoles.length} role{selectedRoles.length !== 1 ? 's' : ''} selected
            </div>
            <div className="flex space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isLoading || !hasChanges || !permissions?.canChangeRoles}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};