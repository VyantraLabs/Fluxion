'use client'

import { useState, useEffect, useCallback } from 'react'
import { AdminUser, FilterParams, PaginationParams, PaginatedResponse } from '@/types/admin'
import { adminApi } from '@/services/adminApi'

export interface UseOrganizationUsersReturn {
  users: AdminUser[]
  pagination: PaginatedResponse<AdminUser>['pagination'] | null
  isLoading: boolean
  error: string | null
  
  // Current state
  page: number
  limit: number
  filters: FilterParams
  
  // Actions
  refresh: () => Promise<void>
  changePage: (page: number) => void
  changeLimit: (limit: number) => void
  updateFilters: (filters: FilterParams) => void
  clearFilters: () => void
}

export function useOrganizationUsers(
  organizationId: string | undefined,
  initialPage = 1,
  initialLimit = 20,
  initialFilters: FilterParams = {}
): UseOrganizationUsersReturn {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [pagination, setPagination] = useState<PaginatedResponse<AdminUser>['pagination'] | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [page, setPage] = useState(initialPage)
  const [limit, setLimit] = useState(initialLimit)
  const [filters, setFilters] = useState<FilterParams>(initialFilters)

  const fetchUsers = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Don't fetch if no organization is selected
      if (!organizationId) {
        setUsers([])
        setPagination(null)
        setError('No organization selected')
        return
      }

      const params: FilterParams & PaginationParams = {
        page,
        limit,
        ...filters,
      }

      const response = await adminApi.getOrganizationUsers(organizationId, params)
      
      if (response.success && response.data) {
        // Handle PaginatedResponse<AdminUser> format
        const usersArray = response.data.data || response.data || []
        const paginationData = response.data.pagination || null
        
        // Validate users array
        if (Array.isArray(usersArray)) {
          setUsers(usersArray)
          setPagination(paginationData)
          setError(null) // Clear any previous errors
          
          console.log('Organization users API response:', response.data)
          console.log('Extracted users:', usersArray)
        } else {
          throw new Error('Invalid users data format received from server')
        }
      } else {
        const errorMsg = response.error?.message || 'Failed to fetch organization users'
        throw new Error(errorMsg)
      }
    } catch (err) {
      let errorMessage = 'Failed to load users'
      
      if (err instanceof Error) {
        const msg = err.message.toLowerCase()
        
        // Handle specific error cases
        if (msg.includes('401') || msg.includes('unauthorized')) {
          errorMessage = 'Session expired. Please log in again.'
        } else if (msg.includes('403') || msg.includes('forbidden')) {
          errorMessage = 'You do not have permission to view users in this organization.'
        } else if (msg.includes('404') || msg.includes('not found')) {
          errorMessage = 'Organization not found or no longer exists.'
        } else if (msg.includes('400') || msg.includes('bad request')) {
          errorMessage = 'Invalid organization ID format provided.'
        } else if (msg.includes('network') || msg.includes('fetch')) {
          errorMessage = 'Network error. Please check your connection and try again.'
        } else if (msg.includes('timeout')) {
          errorMessage = 'Request timed out. Please try again.'
        } else {
          errorMessage = err.message
        }
      }
      
      setError(errorMessage)
      setUsers([])
      setPagination(null)
      console.error('Error fetching organization users:', err)
    } finally {
      setIsLoading(false)
    }
  }, [page, limit, filters, organizationId])

  const refresh = useCallback(async () => {
    await fetchUsers()
  }, [fetchUsers])

  const changePage = useCallback((newPage: number) => {
    setPage(newPage)
  }, [])

  const changeLimit = useCallback((newLimit: number) => {
    setLimit(newLimit)
    setPage(1) // Reset to first page when changing limit
  }, [])

  const updateFilters = useCallback((newFilters: FilterParams) => {
    setFilters(newFilters)
    setPage(1) // Reset to first page when updating filters
  }, [])

  const clearFilters = useCallback(() => {
    setFilters({})
    setPage(1)
  }, [])

  // Initial load and refresh when dependencies change
  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  return {
    users,
    pagination,
    isLoading,
    error,
    page,
    limit,
    filters,
    refresh,
    changePage,
    changeLimit,
    updateFilters,
    clearFilters,
  }
}