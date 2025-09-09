'use client';

import React, { useState } from 'react';
import { ReminderDashboard } from '@/components/reminders/ReminderDashboard';
import { ReminderForm } from '@/components/reminders/ReminderForm';
import { Bell, Settings, BarChart3 } from 'lucide-react';

export default function RemindersPage() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [selectedReminder, setSelectedReminder] = useState<any>(null);
  
  const handleCreateReminder = () => {
    setSelectedReminder(null);
    setShowCreateForm(true);
  };
  
  const handleEditReminder = (reminder: any) => {
    setSelectedReminder(reminder);
    setShowEditForm(true);
  };
  
  const handleSaveReminder = (reminder: any) => {
    console.log('Reminder saved:', reminder);
    setShowCreateForm(false);
    setShowEditForm(false);
    setSelectedReminder(null);
    // Refresh the dashboard
    window.location.reload();
  };
  
  const handleCancel = () => {
    setShowCreateForm(false);
    setShowEditForm(false);
    setSelectedReminder(null);
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      {/* Page header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-secondary-900">Payment Reminders</h1>
            <p className="mt-2 text-secondary-600">
              Automate payment reminders and follow-ups for your invoices
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => console.log('Reminder analytics')}
              className="btn-secondary"
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Analytics
            </button>
            <button
              onClick={() => console.log('Reminder settings')}
              className="btn-secondary"
            >
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </button>
          </div>
        </div>
      </div>

      {/* Reminders dashboard */}
      {!showCreateForm && !showEditForm && (
        <ReminderDashboard />
      )}
      
      {/* Create reminder form */}
      {showCreateForm && (
        <div className="max-w-4xl mx-auto">
          <ReminderForm
            onSave={handleSaveReminder}
            onCancel={handleCancel}
          />
        </div>
      )}
      
      {/* Edit reminder form */}
      {showEditForm && selectedReminder && (
        <div className="max-w-4xl mx-auto">
          <ReminderForm
            reminder={selectedReminder}
            onSave={handleSaveReminder}
            onCancel={handleCancel}
          />
        </div>
      )}
    </div>
  );
}