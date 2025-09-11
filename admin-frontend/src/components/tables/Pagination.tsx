'use client'

import React from 'react'
import clsx from 'clsx'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'

interface PaginationProps {
  page: number
  limit: number
  total: number
  pages: number
  hasNext: boolean
  hasPrev: boolean
  onPageChange: (page: number) => void
  onLimitChange?: (limit: number) => void
  className?: string
}

export function Pagination({
  page,
  limit,
  total,
  pages,
  hasNext,
  hasPrev,
  onPageChange,
  onLimitChange,
  className,
}: PaginationProps) {
  const startItem = Math.min((page - 1) * limit + 1, total)
  const endItem = Math.min(page * limit, total)

  const getVisiblePages = () => {
    const delta = 2
    const range = []
    const rangeWithDots = []

    for (let i = Math.max(2, page - delta); i <= Math.min(pages - 1, page + delta); i++) {
      range.push(i)
    }

    if (page - delta > 2) {
      rangeWithDots.push(1, '...')
    } else {
      rangeWithDots.push(1)
    }

    rangeWithDots.push(...range)

    if (page + delta < pages - 1) {
      rangeWithDots.push('...', pages)
    } else if (pages > 1) {
      rangeWithDots.push(pages)
    }

    return rangeWithDots
  }

  const visiblePages = getVisiblePages()

  return (
    <div className={clsx('flex items-center justify-between', className)}>
      <div className="flex items-center space-x-4">
        <div className="text-sm text-gray-700">
          Showing <span className="font-medium">{startItem}</span> to{' '}
          <span className="font-medium">{endItem}</span> of{' '}
          <span className="font-medium">{total}</span> results
        </div>
        
        {onLimitChange && (
          <div className="flex items-center space-x-2">
            <label htmlFor="page-limit" className="text-sm text-gray-700">
              Show:
            </label>
            <select
              id="page-limit"
              value={limit}
              onChange={(e) => onLimitChange(Number(e.target.value))}
              className="admin-input py-1 text-sm"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        )}
      </div>

      <div className="flex items-center space-x-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPrev}
          className={clsx(
            'relative inline-flex items-center px-2 py-2 text-sm font-medium rounded-md',
            hasPrev
              ? 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50'
              : 'text-gray-300 bg-white border border-gray-300 cursor-not-allowed'
          )}
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </button>

        {visiblePages.map((pageNum, index) => (
          <React.Fragment key={index}>
            {pageNum === '...' ? (
              <span className="relative inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300">
                ...
              </span>
            ) : (
              <button
                onClick={() => onPageChange(pageNum as number)}
                className={clsx(
                  'relative inline-flex items-center px-4 py-2 text-sm font-medium rounded-md',
                  pageNum === page
                    ? 'z-10 bg-primary-50 border-primary-500 text-primary-600'
                    : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50'
                )}
              >
                {pageNum}
              </button>
            )}
          </React.Fragment>
        ))}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNext}
          className={clsx(
            'relative inline-flex items-center px-2 py-2 text-sm font-medium rounded-md',
            hasNext
              ? 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50'
              : 'text-gray-300 bg-white border border-gray-300 cursor-not-allowed'
          )}
        >
          <ChevronRightIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}