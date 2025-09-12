'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronDown,
  Check,
  Building2,
  Users,
  Globe,
  Settings,
  Plus,
} from 'lucide-react';
import { Organization } from '@/types/user';
import { useOrganization, useUserPermissions } from '@/contexts/OrganizationContext';
import { cn } from '@/utils/helpers';

interface OrganizationSwitcherProps {
  className?: string;
  showAllOption?: boolean;
  onOrgChange?: (org: Organization | null) => void;
}

export const OrganizationSwitcher: React.FC<OrganizationSwitcherProps> = ({
  className,
  showAllOption = false,
  onOrgChange,
}) => {
  const { state, actions } = useOrganization();
  const permissions = useUserPermissions();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { organizations = [], activeOrganization, isLoading } = state;
  
  // Safety check: ensure organizations is an array
  const safeOrganizations = Array.isArray(organizations) ? organizations : [];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOrganizationSelect = (org: Organization | null) => {
    actions.setActiveOrganization(org);
    setIsOpen(false);
    onOrgChange?.(org);
  };

  const getOrganizationDisplayName = (org: Organization) => {
    return org.name.length > 25 ? `${org.name.substring(0, 25)}...` : org.name;
  };

  const getCurrentDisplayName = () => {
    if (!activeOrganization && showAllOption) {
      return 'All Organizations';
    }
    return activeOrganization ? getOrganizationDisplayName(activeOrganization) : 'Select Organization';
  };

  if (isLoading) {
    return (
      <div className={cn('animate-pulse', className)}>
        <div className="flex items-center space-x-2 px-3 py-2 bg-gray-100 rounded-lg">
          <div className="w-5 h-5 bg-gray-300 rounded"></div>
          <div className="w-32 h-4 bg-gray-300 rounded"></div>
        </div>
      </div>
    );
  }

  if (safeOrganizations.length === 0) {
    return null;
  }

  // If user only has access to one organization and can't view all, don't show switcher
  if (safeOrganizations.length === 1 && !permissions?.canViewAllOrganizations) {
    return (
      <div className={cn('flex items-center space-x-2 px-3 py-2 text-sm text-gray-700', className)}>
        <Building2 className="w-4 h-4" />
        <span className="font-medium">{getOrganizationDisplayName(safeOrganizations[0])}</span>
      </div>
    );
  }

  return (
    <div className={cn('relative', className)} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
      >
        <div className="flex items-center space-x-2">
          <Building2 className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">{getCurrentDisplayName()}</span>
          {activeOrganization && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-800">
              {activeOrganization.stats.user_count}
            </span>
          )}
        </div>
        <ChevronDown className={cn('w-4 h-4 flex-shrink-0 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
          {/* All Organizations Option (for owners/system admins) */}
          {showAllOption && permissions?.canViewAllOrganizations && (
            <>
              <button
                onClick={() => handleOrganizationSelect(null)}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center justify-between group transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <Globe className="w-4 h-4 text-primary-600" />
                  <div>
                    <div className="font-medium text-gray-900">All Organizations</div>
                    <div className="text-xs text-gray-500">
                      View data across all {safeOrganizations.length} organizations
                    </div>
                  </div>
                </div>
                {!activeOrganization && (
                  <Check className="w-4 h-4 text-primary-600" />
                )}
              </button>
              <div className="border-t border-gray-200"></div>
            </>
          )}

          {/* Organization List */}
          <div className="py-1">
            {safeOrganizations.map((org) => (
              <button
                key={org.id}
                onClick={() => handleOrganizationSelect(org)}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center justify-between group transition-colors"
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    {org.logo_url ? (
                      <img 
                        src={org.logo_url} 
                        alt={org.name}
                        className="w-6 h-6 rounded object-cover"
                      />
                    ) : (
                      <span className="text-primary-600 font-semibold text-sm">
                        {org.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-gray-900 truncate">
                      {org.name}
                    </div>
                    <div className="flex items-center space-x-3 text-xs text-gray-500">
                      <span className="flex items-center">
                        <Users className="w-3 h-3 mr-1" />
                        {org.stats.user_count} users
                      </span>
                      {org.stats.active_invoices > 0 && (
                        <span>{org.stats.active_invoices} active invoices</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {activeOrganization?.id === org.id && (
                    <Check className="w-4 h-4 text-primary-600" />
                  )}
                  <Settings className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </button>
            ))}
          </div>

          {/* Create Organization Option (for system admins) */}
          {permissions?.isSystemAdmin && (
            <>
              <div className="border-t border-gray-200"></div>
              <button
                onClick={() => {
                  setIsOpen(false);
                  // TODO: Implement create organization modal
                  console.log('Create new organization');
                }}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center space-x-3 text-primary-600 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span className="font-medium">Create Organization</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// Compact version for mobile/smaller spaces
export const CompactOrganizationSwitcher: React.FC<OrganizationSwitcherProps> = ({
  className,
  showAllOption = false,
  onOrgChange,
}) => {
  const { state, actions } = useOrganization();
  const permissions = useUserPermissions();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { organizations = [], activeOrganization, isLoading } = state;
  
  // Safety check: ensure organizations is an array
  const safeOrganizations = Array.isArray(organizations) ? organizations : [];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOrganizationSelect = (org: Organization | null) => {
    actions.setActiveOrganization(org);
    setIsOpen(false);
    onOrgChange?.(org);
  };

  if (isLoading || safeOrganizations.length === 0) {
    return null;
  }

  return (
    <div className={cn('relative', className)} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-2 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
      >
        <div className="w-5 h-5 bg-primary-100 rounded flex items-center justify-center">
          {activeOrganization ? (
            activeOrganization.logo_url ? (
              <img 
                src={activeOrganization.logo_url} 
                alt={activeOrganization.name}
                className="w-4 h-4 rounded object-cover"
              />
            ) : (
              <span className="text-primary-600 font-semibold text-xs">
                {activeOrganization.name.charAt(0).toUpperCase()}
              </span>
            )
          ) : (
            <Globe className="w-3 h-3 text-primary-600" />
          )}
        </div>
        <ChevronDown className={cn('w-3 h-3 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 min-w-48 max-h-60 overflow-y-auto">
          {showAllOption && permissions?.canViewAllOrganizations && (
            <button
              onClick={() => handleOrganizationSelect(null)}
              className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center justify-between text-sm"
            >
              <div className="flex items-center space-x-2">
                <Globe className="w-3 h-3 text-primary-600" />
                <span>All Organizations</span>
              </div>
              {!activeOrganization && <Check className="w-3 h-3 text-primary-600" />}
            </button>
          )}

          {safeOrganizations.map((org) => (
            <button
              key={org.id}
              onClick={() => handleOrganizationSelect(org)}
              className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center justify-between text-sm"
            >
              <div className="flex items-center space-x-2 min-w-0">
                <div className="w-4 h-4 bg-primary-100 rounded flex items-center justify-center flex-shrink-0">
                  {org.logo_url ? (
                    <img 
                      src={org.logo_url} 
                      alt={org.name}
                      className="w-3 h-3 rounded object-cover"
                    />
                  ) : (
                    <span className="text-primary-600 font-semibold text-xs">
                      {org.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <span className="truncate">{org.name}</span>
              </div>
              {activeOrganization?.id === org.id && (
                <Check className="w-3 h-3 text-primary-600" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};