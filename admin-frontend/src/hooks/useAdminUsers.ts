'use client'

import { useState, useEffect, useCallback } from 'react'
import { AdminUser, FilterParams, PaginationParams, PaginatedResponse } from '@/types/admin'
import { adminApi } from '@/services/adminApi'

export interface UseAdminUsersReturn {
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

export function useAdminUsers(
  initialPage = 1,
  initialLimit = 20,
  initialFilters: FilterParams = {}
): UseAdminUsersReturn {
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
      const params: FilterParams & PaginationParams = {
        page,
        limit,
        ...filters,
      }

      const response = await adminApi.getUsers(params)
      
      if (response.success && response.data) {
        // Extract users array from API response
        // API returns: { data: { users: [...], pagination: {...} } }
        const usersArray = response.data.users || response.data.data || response.data || []
        const paginationData = response.data.pagination
        
        console.log('Admin users API response:', response.data)
        console.log('Extracted users array:', usersArray)
        
        setUsers(Array.isArray(usersArray) ? usersArray : [])
        
        // Transform pagination data if needed
        if (paginationData) {
          setPagination({
            page: paginationData.offset ? Math.floor(paginationData.offset / (paginationData.limit || 20)) + 1 : 1,
            limit: paginationData.limit || 20,
            total: paginationData.total || 0,
            pages: paginationData.total ? Math.ceil(paginationData.total / (paginationData.limit || 20)) : 1,
            has_next: paginationData.offset ? 
              (paginationData.offset + (paginationData.limit || 20)) < (paginationData.total || 0) : false,
            has_prev: paginationData.offset ? paginationData.offset > 0 : false
          })
        } else {
          setPagination({
            page: 1,
            limit: 20,
            total: Array.isArray(usersArray) ? usersArray.length : 0,
            pages: 1,
            has_next: false,
            has_prev: false
          })
        }
      } else {
        throw new Error(response.error?.message || 'Failed to fetch admin users')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      console.error('Error fetching admin users:', err)
    } finally {
      setIsLoading(false)
    }
  }, [page, limit, filters])

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