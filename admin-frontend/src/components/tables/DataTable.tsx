'use client'

import React from 'react'
import clsx from 'clsx'

export interface Column<T> {
  key: string
  title: string
  width?: string
  render?: (value: any, item: T, index: number) => React.ReactNode
  sortable?: boolean
  className?: string
}

export interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyExtractor: (item: T, index: number) => string
  loading?: boolean
  emptyMessage?: string
  onRowClick?: (item: T, index: number) => void
  selectedRows?: Set<string>
  onRowSelect?: (keys: Set<string>) => void
  className?: string
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  loading = false,
  emptyMessage = 'No data available',
  onRowClick,
  selectedRows,
  onRowSelect,
  className,
}: DataTableProps<T>) {
  // Add null/undefined checks for required props
  if (!columns || !Array.isArray(columns)) {
    console.error('DataTable: columns prop is required and must be an array')
    return (
      <div className={clsx('admin-card overflow-hidden', className)}>
        <div className="p-6 text-center text-red-600">
          Error: DataTable columns not properly configured
        </div>
      </div>
    )
  }

  if (!data || !Array.isArray(data)) {
    console.error('DataTable: data prop is required and must be an array')
    return (
      <div className={clsx('admin-card overflow-hidden', className)}>
        <div className="p-6 text-center text-red-600">
          Error: DataTable data not properly provided
        </div>
      </div>
    )
  }

  if (!keyExtractor || typeof keyExtractor !== 'function') {
    console.error('DataTable: keyExtractor prop is required and must be a function')
    return (
      <div className={clsx('admin-card overflow-hidden', className)}>
        <div className="p-6 text-center text-red-600">
          Error: DataTable keyExtractor not properly configured
        </div>
      </div>
    )
  }
  const handleSelectAll = (checked: boolean) => {
    if (!onRowSelect) return
    
    if (checked) {
      const allKeys = new Set(data.map(keyExtractor))
      onRowSelect(allKeys)
    } else {
      onRowSelect(new Set())
    }
  }

  const handleRowSelect = (key: string, checked: boolean) => {
    if (!onRowSelect || !selectedRows) return
    
    const newSelection = new Set(selectedRows)
    if (checked) {
      newSelection.add(key)
    } else {
      newSelection.delete(key)
    }
    onRowSelect(newSelection)
  }

  const isAllSelected = selectedRows && data.length > 0 && selectedRows.size === data.length
  const isIndeterminate = selectedRows && selectedRows.size > 0 && selectedRows.size < data.length

  if (loading) {
    return (
      <div className={clsx('admin-card overflow-hidden', className)}>
        <div className="animate-pulse">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          </div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="px-6 py-4 border-b border-gray-100">
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={clsx('admin-card overflow-hidden', className)}>
      <div className="overflow-x-auto">
        <table className="admin-table">
          <thead className="bg-gray-50">
            <tr>
              {onRowSelect && (
                <th className="admin-table-header w-12">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    checked={isAllSelected}
                    ref={(input) => {
                      if (input) input.indeterminate = !!isIndeterminate
                    }}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                  />
                </th>
              )}
              
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={clsx(
                    'admin-table-header',
                    column.width && `w-${column.width}`,
                    column.className
                  )}
                >
                  <div className="flex items-center space-x-1">
                    <span>{column.title}</span>
                    {column.sortable && (
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                      </svg>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          
          <tbody className="bg-white divide-y divide-gray-200">
            {data.length === 0 ? (
              <tr>
                <td 
                  colSpan={columns.length + (onRowSelect ? 1 : 0)} 
                  className="px-6 py-12 text-center text-gray-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((item, index) => {
                try {
                  const key = keyExtractor(item, index)
                  const isSelected = selectedRows?.has(key) || false
                  
                  return (
                    <tr
                      key={key}
                      className={clsx(
                        'hover:bg-gray-50',
                        isSelected && 'bg-primary-50',
                        onRowClick && 'cursor-pointer'
                      )}
                      onClick={() => onRowClick?.(item, index)}
                    >
                      {onRowSelect && (
                        <td className="admin-table-cell">
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            checked={isSelected}
                            onChange={(e) => {
                              e.stopPropagation()
                              handleRowSelect(key, e.target.checked)
                            }}
                          />
                        </td>
                      )}
                      
                      {columns.map((column) => {
                        try {
                          const value = (item as any)?.[column.key]
                          const rendered = column.render 
                            ? column.render(value, item, index)
                            : (value !== undefined && value !== null ? String(value) : '')
                          
                          return (
                            <td
                              key={column.key}
                              className={clsx(
                                'admin-table-cell',
                                column.className
                              )}
                            >
                              {rendered}
                            </td>
                          )
                        } catch (columnError) {
                          console.error('Error rendering column:', column.key, columnError)
                          return (
                            <td
                              key={column.key}
                              className={clsx(
                                'admin-table-cell',
                                column.className
                              )}
                            >
                              <span className="text-red-500 text-sm">Error</span>
                            </td>
                          )
                        }
                      })}
                    </tr>
                  )
                } catch (rowError) {
                  console.error('Error rendering row:', index, rowError)
                  return (
                    <tr key={`error-row-${index}`}>
                      <td 
                        colSpan={columns.length + (onRowSelect ? 1 : 0)} 
                        className="px-6 py-4 text-center text-red-500"
                      >
                        Error rendering row {index + 1}
                      </td>
                    </tr>
                  )
                }
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}