// Hook for fetching and managing organization data

import { useState, useEffect, useCallback } from 'react'
import { Organization, PaginatedResponse, FilterParams, PaginationParams } from '@/types/admin'
import adminApi from '@/services/adminApi'

interface UseOrganizationsOptions {
  initialPage?: number
  initialLimit?: number
  initialFilters?: FilterParams
}

export function useOrganizations(options: UseOrganizationsOptions = {}) {
  const [organizations, setOrganizations] = useState<PaginatedResponse<Organization> | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [page, setPage] = useState(options.initialPage || 1)
  const [limit, setLimit] = useState(options.initialLimit || 25)
  const [filters, setFilters] = useState<FilterParams>(options.initialFilters || {})

  const fetchOrganizations = useCallback(async (params?: {
    page?: number
    limit?: number
    filters?: FilterParams
  }) => {
    try {
      setError(null)
      setIsLoading(true)
      
      const requestParams = {
        page: params?.page || page,
        limit: params?.limit || limit,
        ...((params?.filters || filters)),
      }
      
      const response = await adminApi.getOrganizations(requestParams)
      
      if (response.success && response.data) {
        // Extract organizations array - API returns { organizations: [...], pagination: {...} }
        const orgsArray = response.data.organizations || response.data.data || response.data || [];
        const paginationData = response.data.pagination;
        
        // Ensure organizations have required fields with defaults
        const sanitizedOrgs = Array.isArray(orgsArray) ? orgsArray.map((org: any) => ({
          ...org,
          status: org.status || 'active',
          user_count: org.userCount || org.user_count || 0,
          invoice_count: org.invoiceCount || org.invoice_count || 0,
          template_count: org.templateCount || org.template_count || 0,
          total_revenue: org.totalPayments || org.total_revenue || '$0.00',
          created_at: org.created_at || org.createdAt || new Date().toISOString()
        })) : [];
        
        // Transform the admin API response to match PaginatedResponse format
        const transformedData = {
          data: sanitizedOrgs,
          pagination: paginationData ? {
            page: paginationData.offset ? Math.floor(paginationData.offset / (paginationData.limit || 25)) + 1 : 1,
            limit: paginationData.limit || 25,
            total: paginationData.total || 0,
            pages: paginationData.total ? Math.ceil(paginationData.total / (paginationData.limit || 25)) : 1,
            has_next: paginationData.offset ? 
              (paginationData.offset + (paginationData.limit || 25)) < (paginationData.total || 0) : false,
            has_prev: paginationData.offset ? paginationData.offset > 0 : false
          } : {
            page: 1,
            limit: 25,
            total: sanitizedOrgs.length,
            pages: 1,
            has_next: false,
            has_prev: false
          }
        }
        
        console.log('Organizations API response:', response.data)
        console.log('Sanitized organizations:', sanitizedOrgs)
        console.log('Transformed data:', transformedData)
        
        setOrganizations(transformedData)
      }
    } catch (err: any) {
      console.error('Error fetching organizations:', err)
      setError(err.message || 'Failed to fetch organizations')
    } finally {
      setIsLoading(false)
    }
  }, [page, limit, filters])

  const refresh = useCallback(() => {
    fetchOrganizations()
  }, [fetchOrganizations])

  const changePage = useCallback((newPage: number) => {
    setPage(newPage)
    fetchOrganizations({ page: newPage })
  }, [fetchOrganizations])

  const changeLimit = useCallback((newLimit: number) => {
    setPage(1) // Reset to first page when changing limit
    setLimit(newLimit)
    fetchOrganizations({ page: 1, limit: newLimit })
  }, [fetchOrganizations])

  const updateFilters = useCallback((newFilters: FilterParams) => {
    setPage(1) // Reset to first page when changing filters
    setFilters(newFilters)
    fetchOrganizations({ page: 1, filters: newFilters })
  }, [fetchOrganizations])

  const clearFilters = useCallback(() => {
    setPage(1)
    setFilters({})
    fetchOrganizations({ page: 1, filters: {} })
  }, [fetchOrganizations])

  useEffect(() => {
    fetchOrganizations()
  }, []) // Only run on mount

  return {
    organizations: organizations?.data || [],
    pagination: organizations?.pagination || null,
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