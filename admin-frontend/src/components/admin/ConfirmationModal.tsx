'use client'

import React, { useState } from 'react'
import { ExclamationTriangleIcon, ShieldExclamationIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

interface ConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (reason?: string) => Promise<void> | void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'info'
  requireReason?: boolean
  loading?: boolean
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  requireReason = false,
  loading = false
}) => {
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen) return null

  const handleConfirm = async () => {
    if (requireReason && !reason.trim()) {
      return
    }

    setIsSubmitting(true)
    try {
      await onConfirm(reason || undefined)
      setReason('')
      onClose()
    } catch (error) {
      // Error handling will be done by the parent component
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (isSubmitting || loading) return
    setReason('')
    onClose()
  }

  const getIcon = () => {
    switch (variant) {
      case 'danger':
        return <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
      case 'warning':
        return <ShieldExclamationIcon className="h-6 w-6 text-yellow-600" />
      case 'info':
        return <ShieldExclamationIcon className="h-6 w-6 text-blue-600" />
      default:
        return <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
    }
  }

  const getConfirmButtonClasses = () => {
    switch (variant) {
      case 'danger':
        return 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
      case 'warning':
        return 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500'
      case 'info':
        return 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
      default:
        return 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <div className="flex items-center mb-4">
          <div className="flex-shrink-0 mr-4">
            {getIcon()}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-medium text-gray-900">
              {title}
            </h3>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-sm text-gray-600">
            {message}
          </p>
        </div>

        {requireReason && (
          <div className="mb-6">
            <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-2">
              Reason (required):
            </label>
            <textarea
              id="reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Please provide a reason for this action..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
              disabled={isSubmitting || loading}
            />
            {requireReason && !reason.trim() && (
              <p className="mt-1 text-xs text-red-600">
                A reason is required for this action.
              </p>
            )}
          </div>
        )}

        <div className="flex items-center justify-end space-x-3">
          <button
            onClick={handleClose}
            disabled={isSubmitting || loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={isSubmitting || loading || (requireReason && !reason.trim())}
            className={clsx(
              'px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',
              getConfirmButtonClasses()
            )}
          >
            {isSubmitting || loading ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2 inline-block" />
                Processing...
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmationModal