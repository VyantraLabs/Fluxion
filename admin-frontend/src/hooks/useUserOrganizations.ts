'use client'

import { useState, useEffect, useCallback } from 'react'
import { Organization } from '@/components/admin/OrganizationSelector'
import { adminApi } from '@/services/adminApi'

export interface UseUserOrganizationsReturn {
  organizations: Organization[]
  selectedOrganizationId: string | null
  isLoading: boolean
  error: string | null
  
  // Actions
  refresh: () => Promise<void>
  selectOrganization: (organizationId: string) => void
  clearSelection: () => void
}

export function useUserOrganizations(
  initialSelectedId?: string
): UseUserOrganizationsReturn {
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(
    initialSelectedId || null
  )
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchOrganizations = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Check if user is authenticated
      const token = localStorage.getItem('jwt_token')
      if (!token) {
        throw new Error('User not authenticated. Please log in again.')
      }

      // Use the direct API call to the backend
      const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/users/organizations`
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (response.status === 401) {
        throw new Error('Session expired. Please log in again.')
      }

      if (response.status === 403) {
        throw new Error('You do not have permission to view organization users. Please contact your administrator.')
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error?.message || errorData.message || `HTTP ${response.status}: ${response.statusText}`
        throw new Error(errorMessage)
      }

      const data = await response.json()
      
      if (data.success && data.data?.organizations) {
        const orgs = data.data.organizations as Organization[]
        
        // Filter organizations to only show those user can manage
        const manageableOrgs = orgs.filter(org => org.canManageUsers)
        
        setOrganizations(manageableOrgs)
        
        // Auto-select first organization if none selected and organizations exist
        if (!selectedOrganizationId && manageableOrgs.length > 0) {
          setSelectedOrganizationId(manageableOrgs[0].id)
        }
        
        // Clear selection if selected org no longer exists or user can't manage it
        if (selectedOrganizationId && !manageableOrgs.find(org => org.id === selectedOrganizationId)) {
          setSelectedOrganizationId(manageableOrgs.length > 0 ? manageableOrgs[0].id : null)
        }
        
        console.log('User organizations loaded:', manageableOrgs)
      } else if (data.success && data.data && !data.data.organizations) {
        // Handle case where user has no organizations
        setOrganizations([])
        setSelectedOrganizationId(null)
        throw new Error('You do not have access to manage users in any organizations.')
      } else {
        throw new Error('Invalid response format from server.')
      }
    } catch (err) {
      let errorMessage = 'Failed to fetch organizations'
      
      if (err instanceof Error) {
        errorMessage = err.message
      } else if (typeof err === 'string') {
        errorMessage = err
      }
      
      // Handle network errors
      if (errorMessage.includes('fetch')) {
        errorMessage = 'Network error. Please check your connection and try again.'
      }
      
      setError(errorMessage)
      console.error('Error fetching user organizations:', err)
      
      // Clear organizations on error
      setOrganizations([])
      setSelectedOrganizationId(null)
    } finally {
      setIsLoading(false)
    }
  }, [selectedOrganizationId])

  const refresh = useCallback(async () => {
    await fetchOrganizations()
  }, [fetchOrganizations])

  const selectOrganization = useCallback((organizationId: string) => {
    setSelectedOrganizationId(organizationId)
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedOrganizationId(null)
  }, [])

  // Initial load
  useEffect(() => {
    fetchOrganizations()
  }, []) // Only run on mount

  // Update selected organization when initialSelectedId changes
  useEffect(() => {
    if (initialSelectedId && initialSelectedId !== selectedOrganizationId) {
      setSelectedOrganizationId(initialSelectedId)
    }
  }, [initialSelectedId]) // Don't include selectedOrganizationId to avoid loops

  return {
    organizations,
    selectedOrganizationId,
    isLoading,
    error,
    refresh,
    selectOrganization,
    clearSelection,
  }
}