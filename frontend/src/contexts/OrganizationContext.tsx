'use client';

import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import {
  Organization,
  OrganizationUser,
  ActivityLog,
  InviteUserRequest,
  UpdateUserRolesRequest,
  RemoveUserRequest,
  OrganizationContextState,
  OrganizationContextActions,
  UserPermissionContext,
  GlobalStats,
} from '@/types/user';
import { useAuth } from './AuthContext';
import { apiRequest, handleApiResponse } from '@/utils/api';
import toast from 'react-hot-toast';

// Initial state
const initialState: OrganizationContextState = {
  organizations: [],
  activeOrganization: null,
  isLoading: false,
  error: null,
  isGlobalView: true, // Start with global view by default
  globalStats: null,
  globalStatsLoading: false,
};

// Action types
type OrganizationAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ORGANIZATIONS'; payload: Organization[] }
  | { type: 'SET_ACTIVE_ORGANIZATION'; payload: Organization | null }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'UPDATE_ORGANIZATION'; payload: Organization }
  | { type: 'SET_GLOBAL_VIEW'; payload: boolean }
  | { type: 'SET_GLOBAL_STATS_LOADING'; payload: boolean }
  | { type: 'SET_GLOBAL_STATS'; payload: GlobalStats | null }
  | { type: 'CLEAR_STATE' };

// Reducer
const organizationReducer = (
  state: OrganizationContextState,
  action: OrganizationAction
): OrganizationContextState => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'SET_ORGANIZATIONS':
      return {
        ...state,
        organizations: action.payload,
        isLoading: false,
        error: null,
      };

    case 'SET_ACTIVE_ORGANIZATION':
      return {
        ...state,
        activeOrganization: action.payload,
      };

    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };

    case 'UPDATE_ORGANIZATION':
      return {
        ...state,
        organizations: state.organizations.map(org =>
          org.id === action.payload.id ? action.payload : org
        ),
        activeOrganization:
          state.activeOrganization?.id === action.payload.id
            ? action.payload
            : state.activeOrganization,
      };

    case 'SET_GLOBAL_VIEW':
      return {
        ...state,
        isGlobalView: action.payload,
      };

    case 'SET_GLOBAL_STATS_LOADING':
      return {
        ...state,
        globalStatsLoading: action.payload,
      };

    case 'SET_GLOBAL_STATS':
      return {
        ...state,
        globalStats: action.payload,
        globalStatsLoading: false,
      };

    case 'CLEAR_STATE':
      return initialState;

    default:
      return state;
  }
};

// Context
const OrganizationContext = createContext<{
  state: OrganizationContextState;
  actions: OrganizationContextActions;
} | null>(null);

// Provider component
export const OrganizationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(organizationReducer, initialState);
  const { state: authState } = useAuth();

  const refreshOrganizations = useCallback(async () => {
    if (!authState.isAuthenticated || !authState.user) return;

    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      const response = await apiRequest.get('/organizations');
      const data = handleApiResponse(response);
      
      // Backend returns organizations directly in data field (not nested in data.data)
      // Ensure we always have an array
      const organizationsArray = Array.isArray(data) ? data : (Array.isArray(data?.organizations) ? data.organizations : []);
      dispatch({ type: 'SET_ORGANIZATIONS', payload: organizationsArray });
    } catch (error: any) {
      console.error('Failed to fetch organizations:', error);
      dispatch({ type: 'SET_ERROR', payload: error.message || 'Failed to fetch organizations' });
    }
  }, [authState.isAuthenticated, authState.user]);

  const setActiveOrganization = useCallback((org: Organization | null) => {
    dispatch({ type: 'SET_ACTIVE_ORGANIZATION', payload: org });
    dispatch({ type: 'SET_GLOBAL_VIEW', payload: org === null });
    
    // Store in localStorage for persistence
    if (org) {
      localStorage.setItem('activeOrganizationId', org.id);
    } else {
      localStorage.removeItem('activeOrganizationId');
    }
  }, []);

  const setGlobalView = useCallback((isGlobal: boolean) => {
    dispatch({ type: 'SET_GLOBAL_VIEW', payload: isGlobal });
    if (isGlobal) {
      dispatch({ type: 'SET_ACTIVE_ORGANIZATION', payload: null });
      localStorage.removeItem('activeOrganizationId');
    }
  }, []);

  const getGlobalStatistics = useCallback(async (): Promise<GlobalStats> => {
    if (!authState.isAuthenticated || !authState.user) {
      throw new Error('Not authenticated');
    }

    dispatch({ type: 'SET_GLOBAL_STATS_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      const response = await apiRequest.get('/dashboard');
      const data = handleApiResponse(response);
      
      dispatch({ type: 'SET_GLOBAL_STATS', payload: data });
      return data;
    } catch (error: any) {
      console.error('Failed to fetch global statistics:', error);
      dispatch({ type: 'SET_ERROR', payload: error.message || 'Failed to fetch global statistics' });
      dispatch({ type: 'SET_GLOBAL_STATS_LOADING', payload: false });
      throw error;
    }
  }, [authState.isAuthenticated, authState.user]);

  // Load organizations when user authenticates
  useEffect(() => {
    if (authState.isAuthenticated && authState.user) {
      refreshOrganizations();
    } else {
      dispatch({ type: 'CLEAR_STATE' });
    }
  }, [authState.isAuthenticated, refreshOrganizations]);

  // Load global statistics when in global view
  useEffect(() => {
    if (authState.isAuthenticated && authState.user && state.isGlobalView) {
      getGlobalStatistics();
    }
  }, [authState.isAuthenticated, state.isGlobalView, getGlobalStatistics]);

  const getOrganizationUsers = async (orgId?: string): Promise<OrganizationUser[]> => {
    try {
      const targetOrgId = orgId || state.activeOrganization?.id;
      if (!targetOrgId) {
        throw new Error('No organization specified');
      }

      const response = await apiRequest.get(`/organizations/${targetOrgId}/users`);
      const data = handleApiResponse(response);
      
      return data.data || data.users || [];
    } catch (error: any) {
      console.error('Failed to fetch organization users:', error);
      throw error;
    }
  };

  const inviteUser = async (data: InviteUserRequest): Promise<void> => {
    try {
      const response = await apiRequest.post(`/organizations/${data.organization_id}/users/invite`, {
        email: data.email,
        wallet_address: data.wallet_address,
        roles: data.roles,
        message: data.message,
      });

      handleApiResponse(response);
      toast.success('User invitation sent successfully');
    } catch (error: any) {
      console.error('Failed to invite user:', error);
      const errorMessage = error.message || 'Failed to send invitation';
      toast.error(errorMessage);
      throw error;
    }
  };

  const updateUserRoles = async (data: UpdateUserRolesRequest): Promise<void> => {
    try {
      const response = await apiRequest.put(
        `/organizations/${data.organization_id}/users/${data.user_id}/roles`,
        { roles: data.roles }
      );

      handleApiResponse(response);
      toast.success('User roles updated successfully');
    } catch (error: any) {
      console.error('Failed to update user roles:', error);
      const errorMessage = error.message || 'Failed to update user roles';
      toast.error(errorMessage);
      throw error;
    }
  };

  const removeUser = async (data: RemoveUserRequest): Promise<void> => {
    try {
      const response = await apiRequest.delete(
        `/organizations/${data.organization_id}/users/${data.user_id}`
      );

      handleApiResponse(response);
      toast.success('User removed from organization');
    } catch (error: any) {
      console.error('Failed to remove user:', error);
      const errorMessage = error.message || 'Failed to remove user';
      toast.error(errorMessage);
      throw error;
    }
  };

  const getActivityLogs = async (
    orgId?: string,
    filters?: any
  ): Promise<ActivityLog[]> => {
    try {
      const targetOrgId = orgId || state.activeOrganization?.id;
      if (!targetOrgId) {
        throw new Error('No organization specified');
      }

      const params = new URLSearchParams();
      if (filters?.type) params.append('type', filters.type);
      if (filters?.actor_id) params.append('actor_id', filters.actor_id);
      if (filters?.limit) params.append('limit', filters.limit.toString());
      if (filters?.offset) params.append('offset', filters.offset.toString());

      const queryString = params.toString();
      const url = `/organizations/${targetOrgId}/activity${queryString ? `?${queryString}` : ''}`;
      
      const response = await apiRequest.get(url);
      const data = handleApiResponse(response);
      
      return data.data || data.activity || [];
    } catch (error: any) {
      console.error('Failed to fetch activity logs:', error);
      throw error;
    }
  };

  const actions: OrganizationContextActions = {
    setActiveOrganization,
    refreshOrganizations,
    getOrganizationUsers,
    inviteUser,
    updateUserRoles,
    removeUser,
    getActivityLogs,
    getGlobalStatistics,
    setGlobalView,
  };

  return (
    <OrganizationContext.Provider value={{ state, actions }}>
      {children}
    </OrganizationContext.Provider>
  );
};

// Hook to use Organization context
export const useOrganization = () => {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
};

// Utility hooks
export const useActiveOrganization = () => {
  const { state } = useOrganization();
  return state.activeOrganization;
};

export const useOrganizations = () => {
  const { state } = useOrganization();
  return state.organizations;
};

export const useOrganizationLoading = () => {
  const { state } = useOrganization();
  return state.isLoading;
};

// Permission hooks (simplified for single role system)
export const useUserPermissions = (): UserPermissionContext | null => {
  const { state: authState } = useAuth();
  const { state: orgState } = useOrganization();

  if (!authState.user) return null;

  const user = authState.user;
  const organization = orgState.activeOrganization;
  
  // Import permission utilities for single role system
  const { 
    checkUserPermissions,
    hasRole, 
    hasMinRole,
    canViewAllOrganizations 
  } = require('@/utils/permissions');
  
  const permissions = checkUserPermissions(user);
  if (!permissions) return null;

  const isOwner = permissions.isOwner();
  const isSystemAdmin = permissions.isSystemAdmin();
  const isOrgAdmin = permissions.isAdmin();

  return {
    user,
    organization,
    isOwner,
    isSystemAdmin,
    isOrgAdmin,
    canManageUsers: permissions.canManageUsers(),
    canInviteUsers: permissions.canManageUsers(), // Same permission as managing users
    canRemoveUsers: permissions.canManageUsers(), // Same permission as managing users
    canChangeRoles: permissions.canManageUsers(), // Same permission as managing users
    canViewActivity: permissions.canViewAnalytics() || isSystemAdmin,
    canManageSettings: permissions.canManageSettings(),
    canViewAllOrganizations: permissions.canViewAllOrganizations(),
  };
};

export const useOrganizationPermissions = (orgId?: string) => {
  const { state: authState } = useAuth();
  const { state: orgState } = useOrganization();

  const user = authState.user;
  const targetOrg = orgId
    ? orgState.organizations.find(org => org.id === orgId)
    : orgState.activeOrganization;

  if (!user || !targetOrg) return null;

  // Use simplified single role system
  const { checkUserPermissions } = require('@/utils/permissions');
  const permissions = checkUserPermissions(user);
  
  if (!permissions) return null;

  const isSystemAdmin = permissions.isSystemAdmin();
  const isOwner = permissions.isOwner();
  const isOrgAdmin = permissions.isAdmin();

  return {
    canView: true, // All authenticated users can view basic org info
    canManageUsers: permissions.canManageUsers(),
    canInviteUsers: permissions.canManageUsers(),
    canRemoveUsers: permissions.canManageUsers(),
    canChangeRoles: permissions.canManageUsers(),
    canViewActivity: permissions.canViewAnalytics() || isSystemAdmin,
    canManageSettings: permissions.canManageSettings(),
  };
};

// Multi-organization hooks
export const useMultiOrganizationData = () => {
  const { state: authState } = useAuth();
  const { state: orgState, actions: orgActions } = useOrganization();

  const getAllOrganizationUsers = async (): Promise<OrganizationUser[]> => {
    if (!authState.user || orgState.organizations.length === 0) return [];

    // Use single role system permissions
    const { checkUserPermissions } = require('@/utils/permissions');
    const permissions = checkUserPermissions(authState.user);
    
    if (!permissions?.canViewAllOrganizations()) {
      // User can only see users from their active organization
      if (orgState.activeOrganization) {
        return await orgActions.getOrganizationUsers(orgState.activeOrganization.id);
      }
      return [];
    }

    // System admin/owner can see users from all their organizations
    try {
      const allUsers: OrganizationUser[] = [];
      for (const org of orgState.organizations) {
        const orgUsers = await orgActions.getOrganizationUsers(org.id);
        allUsers.push(...orgUsers);
      }
      return allUsers;
    } catch (error) {
      console.error('Failed to fetch all organization users:', error);
      return [];
    }
  };

  const getOrganizationSummary = () => {
    if (!orgState.organizations.length) {
      return {
        totalOrganizations: 0,
        totalUsers: 0,
        activeOrganizations: 0,
      };
    }

    return {
      totalOrganizations: orgState.organizations.length,
      totalUsers: orgState.organizations.reduce((sum, org) => sum + org.stats.user_count, 0),
      activeOrganizations: orgState.organizations.length, // Assume all are active
    };
  };

  return {
    getAllOrganizationUsers,
    getOrganizationSummary,
  };
};