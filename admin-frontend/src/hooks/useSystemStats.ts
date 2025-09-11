// Hook for fetching and managing system statistics

import { useState, useEffect, useCallback } from 'react'
import { SystemStats, SystemHealth } from '@/types/admin'
import adminApi from '@/services/adminApi'

export function useSystemStats() {
  const [stats, setStats] = useState<SystemStats | null>(null)
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    try {
      setError(null)
      const [statsResponse, healthResponse] = await Promise.all([
        adminApi.getSystemStats(),
        adminApi.getSystemHealth()
      ])

      if (statsResponse.success && statsResponse.data) {
        setStats(statsResponse.data)
      }

      if (healthResponse.success && healthResponse.data) {
        setHealth(healthResponse.data)
      }
    } catch (err: any) {
      console.error('Error fetching system stats:', err)
      setError(err.message || 'Failed to fetch system statistics')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const refresh = useCallback(() => {
    setIsLoading(true)
    fetchStats()
  }, [fetchStats])

  useEffect(() => {
    fetchStats()

    // Set up auto-refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000)
    return () => clearInterval(interval)
  }, [fetchStats])

  return {
    stats,
    health,
    isLoading,
    error,
    refresh,
  }
}