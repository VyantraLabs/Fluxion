'use client';

import React, { useState, useEffect } from 'react';
import {
  Bell,
  Clock,
  Play,
  Pause,
  Settings,
  Plus,
  Edit,
  Trash2,
  AlertCircle,
  CheckCircle,
  Calendar,
  Mail,
  BarChart3,
  Users,
  TrendingUp,
  Filter,
  Search,
  Loader2,
  Eye,
} from 'lucide-react';
import { reminderApi, handleApiResponse } from '@/utils/api';
import { cn } from '@/utils/helpers';
import { config } from '@/utils/config';
import toast from 'react-hot-toast';

interface Reminder {
  id: string;
  name: string;
  description: string;
  type: 'payment_reminder' | 'payment_overdue' | 'follow_up';
  status: 'active' | 'paused' | 'completed';
  triggerDays: number;
  emailTemplate?: string;
  webhookUrl?: string;
  lastExecuted?: string;
  nextExecution?: string;
  executionCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ReminderStats {
  total: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  effectiveness: {
    paymentRate: number;
    avgResponseTime: number;
  };
  scheduled: number;
  overdue: number;
}

interface ReminderDashboardProps {
  className?: string;
}

export const ReminderDashboard: React.FC<ReminderDashboardProps> = ({ className = '' }) => {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [stats, setStats] = useState<ReminderStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedReminder, setSelectedReminder] = useState<Reminder | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  
  // Load reminders and stats
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const [remindersResponse, statsResponse] = await Promise.all([
          reminderApi.getAll({
            status: statusFilter || undefined,
            type: typeFilter || undefined,
            limit: 50,
          }),
          reminderApi.getStats(),
        ]);
        
        const remindersData = handleApiResponse(remindersResponse);
        const statsData = handleApiResponse(statsResponse);
        
        // Handle reminders data - extract from nested structure and validate
        const remindersArray = remindersData?.reminders;
        const validatedReminders = Array.isArray(remindersArray) ? remindersArray : [];
        setReminders(validatedReminders);
        
        // Handle stats data with proper validation and defaults
        if (config.debug?.enabled) {
          console.log('Raw stats data:', statsData);
        }
        
        const validatedStats: ReminderStats = {
          total: statsData?.total ?? 0,
          byStatus: statsData?.byStatus ?? {},
          byType: statsData?.byType ?? {},
          effectiveness: {
            paymentRate: statsData?.effectiveness?.paymentRate ?? 0,
            avgResponseTime: statsData?.effectiveness?.avgResponseTime ?? 0,
          },
          scheduled: statsData?.scheduled ?? 0,
          overdue: statsData?.overdue ?? 0,
        };
        
        if (config.debug?.enabled) {
          console.log('Validated stats:', validatedStats);
        }
        
        setStats(validatedStats);
      } catch (err: any) {
        console.error('Failed to load reminders:', err);
        
        // Provide more specific error messages
        let errorMessage = 'Failed to load reminders';
        if (err.message) {
          errorMessage = err.message;
        } else if (err.status === 401) {
          errorMessage = 'Authentication failed. Please log in again.';
        } else if (err.status === 403) {
          errorMessage = 'Access denied. You don\'t have permission to view reminders.';
        } else if (err.status === 500) {
          errorMessage = 'Server error. Please try again later.';
        } else if (!navigator.onLine) {
          errorMessage = 'Network error. Please check your connection.';
        }
        
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [statusFilter, typeFilter]);
  
  const handleCreateReminder = () => {
    setSelectedReminder(null);
    setShowCreateForm(true);
  };
  
  const handleEditReminder = (reminder: Reminder) => {
    setSelectedReminder(reminder);
    setShowEditForm(true);
  };
  
  const handleDeleteReminder = async (reminder: Reminder) => {
    if (!confirm(`Are you sure you want to delete "${reminder.name}"?`)) {
      return;
    }
    
    try {
      await reminderApi.delete(reminder.id);
      setReminders(prev => prev.filter(r => r.id !== reminder.id));
      toast.success('Reminder deleted successfully');
    } catch (err: any) {
      console.error('Failed to delete reminder:', err);
      toast.error('Failed to delete reminder');
    }
  };
  
  const handleToggleStatus = async (reminder: Reminder) => {
    try {
      const newStatus = reminder.status === 'active' ? 'paused' : 'active';
      
      if (newStatus === 'active') {
        await reminderApi.resume(reminder.id);
      } else {
        await reminderApi.pause(reminder.id);
      }
      
      setReminders(prev => 
        prev.map(r => 
          r.id === reminder.id 
            ? { ...r, status: newStatus }
            : r
        )
      );
      
      toast.success(`Reminder ${newStatus === 'active' ? 'resumed' : 'paused'} successfully`);
    } catch (err: any) {
      console.error('Failed to toggle reminder status:', err);
      toast.error('Failed to update reminder status');
    }
  };
  
  const handleExecuteReminder = async (reminder: Reminder) => {
    try {
      await reminderApi.execute(reminder.id);
      toast.success('Reminder executed successfully');
      
      // Refresh data
      window.location.reload();
    } catch (err: any) {
      console.error('Failed to execute reminder:', err);
      toast.error('Failed to execute reminder');
    }
  };
  
  // Filter reminders based on search
  const filteredReminders = reminders.filter(reminder => {
    // Safely access properties with fallbacks
    const name = reminder?.name || '';
    const description = reminder?.description || '';
    const status = reminder?.status || '';
    const type = reminder?.type || '';
    
    return (
      (searchQuery === '' || 
       name.toLowerCase().includes(searchQuery.toLowerCase()) ||
       description.toLowerCase().includes(searchQuery.toLowerCase())) &&
      (statusFilter === '' || status === statusFilter) &&
      (typeFilter === '' || type === typeFilter)
    );
  });
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'paused':
        return <Pause className="w-4 h-4 text-yellow-600" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-blue-600" />;
      default:
        return <AlertCircle className="w-4 h-4 text-secondary-400" />;
    }
  };
  
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'payment_reminder':
        return <Bell className="w-4 h-4 text-blue-600" />;
      case 'payment_overdue':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'follow_up':
        return <Mail className="w-4 h-4 text-green-600" />;
      default:
        return <Clock className="w-4 h-4 text-secondary-400" />;
    }
  };
  
  const renderStatsCards = () => {
    if (!stats) return null;
    
    // Safely extract values with defaults
    const total = stats.total ?? 0;
    const activeCount = stats.byStatus?.active ?? 0;
    const sentCount = stats.byStatus?.sent ?? 0;
    const paymentRate = stats.effectiveness?.paymentRate ?? 0;
    
    const statCards = [
      {
        title: 'Total Reminders',
        value: total.toString(),
        icon: Bell,
        color: 'text-blue-600',
        bg: 'bg-blue-50',
      },
      {
        title: 'Active',
        value: activeCount.toString(),
        icon: CheckCircle,
        color: 'text-green-600',
        bg: 'bg-green-50',
      },
      {
        title: 'Sent',
        value: sentCount.toString(),
        icon: TrendingUp,
        color: 'text-purple-600',
        bg: 'bg-purple-50',
      },
      {
        title: 'Payment Rate',
        value: `${(paymentRate * 100).toFixed(1)}%`,
        icon: BarChart3,
        color: 'text-orange-600',
        bg: 'bg-orange-50',
      },
    ];
    
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat, index) => (
          <div key={index} className="bg-white rounded-lg border border-secondary-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-secondary-600 mb-1">{stat.title}</p>
                <p className="text-2xl font-bold text-secondary-900">{stat.value}</p>
              </div>
              <div className={`${stat.bg} p-3 rounded-lg`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };
  
  const renderFilters = () => (
    <div className="bg-white rounded-lg border border-secondary-200 p-4 mb-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
        {/* Search and filters */}
        <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 flex-1">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-secondary-400" />
            <input
              type="text"
              placeholder="Search reminders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-secondary-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          
          {/* Status filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none bg-white border border-secondary-300 rounded-lg px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
            </select>
            <Filter className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-secondary-400 pointer-events-none" />
          </div>
          
          {/* Type filter */}
          <div className="relative">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="appearance-none bg-white border border-secondary-300 rounded-lg px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">All Types</option>
              <option value="payment_reminder">Payment Reminder</option>
              <option value="payment_overdue">Payment Overdue</option>
              <option value="follow_up">Follow Up</option>
            </select>
            <Filter className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-secondary-400 pointer-events-none" />
          </div>
        </div>
        
        {/* Create button */}
        <div className="flex items-center space-x-3">
          <button
            onClick={handleCreateReminder}
            className="btn-primary"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Reminder
          </button>
        </div>
      </div>
    </div>
  );
  
  const renderReminderCard = (reminder: Reminder) => {
    // Safely extract properties with fallbacks
    const id = reminder?.id || '';
    const name = reminder?.name || 'Unnamed Reminder';
    const description = reminder?.description || 'No description';
    const type = reminder?.type || '';
    const status = reminder?.status || '';
    const triggerDays = reminder?.triggerDays ?? 0;
    const executionCount = reminder?.executionCount ?? 0;
    const lastExecuted = reminder?.lastExecuted;
    const nextExecution = reminder?.nextExecution;

    return (
      <div
        key={id}
        className="bg-white rounded-lg border border-secondary-200 p-6 hover:shadow-md transition-shadow"
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start space-x-3 flex-1">
            <div className="flex-shrink-0">
              {getTypeIcon(type)}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-medium text-secondary-900 mb-1">
                {name}
              </h3>
              <p className="text-sm text-secondary-600 line-clamp-2">
                {description}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 ml-4">
            {getStatusIcon(status)}
            <span className={cn(
              'px-2 py-1 text-xs font-medium rounded-full',
              status === 'active' 
                ? 'bg-green-100 text-green-800'
                : status === 'paused'
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-blue-100 text-blue-800'
            )}>
              {status || 'Unknown'}
            </span>
          </div>
        </div>
        
        {/* Reminder details */}
        <div className="grid grid-cols-2 gap-4 mb-4 text-sm text-secondary-600">
          <div>
            <span className="font-medium">Type:</span> {type ? type.replace('_', ' ') : 'Unknown'}
          </div>
          <div>
            <span className="font-medium">Trigger:</span> {triggerDays} days
          </div>
          <div>
            <span className="font-medium">Executions:</span> {executionCount}
          </div>
          <div>
            <span className="font-medium">Last run:</span>{' '}
            {lastExecuted 
              ? new Date(lastExecuted).toLocaleDateString()
              : 'Never'
            }
          </div>
        </div>
      
      {/* Next execution */}
      {nextExecution && status === 'active' && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <div className="flex items-center space-x-2 text-sm text-blue-800">
            <Clock className="w-4 h-4" />
            <span>
              Next execution: {new Date(nextExecution).toLocaleDateString()}
            </span>
          </div>
        </div>
      )}
      
      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-secondary-200">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleToggleStatus(reminder)}
            className={cn(
              'btn-secondary text-sm px-3 py-1',
              status === 'active' 
                ? 'text-yellow-700 hover:bg-yellow-50' 
                : 'text-green-700 hover:bg-green-50'
            )}
          >
            {status === 'active' ? (
              <>
                <Pause className="w-4 h-4 mr-1" />
                Pause
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-1" />
                Resume
              </>
            )}
          </button>
          
          {status === 'active' && (
            <button
              onClick={() => handleExecuteReminder(reminder)}
              className="btn-secondary text-sm px-3 py-1 text-blue-700 hover:bg-blue-50"
            >
              <Play className="w-4 h-4 mr-1" />
              Run Now
            </button>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleEditReminder(reminder)}
            className="btn-secondary text-sm px-3 py-1"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDeleteReminder(reminder)}
            className="btn-secondary text-sm px-3 py-1 text-red-700 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
    );
  };
  
  if (loading) {
    return (
      <div className={`${className}`}>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600 mx-auto mb-4" />
            <p className="text-secondary-600">Loading reminders...</p>
          </div>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className={`${className}`}>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-4" />
            <p className="text-red-800 font-medium">Failed to load reminders</p>
            <p className="text-red-600 text-sm mt-1">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="btn-secondary mt-4"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`space-y-6 ${className}`}>
      {/* Stats cards */}
      {renderStatsCards()}
      
      {/* Filters */}
      {renderFilters()}
      
      {/* Reminders list */}
      {filteredReminders.length === 0 ? (
        <div className="text-center py-12">
          <Bell className="w-12 h-12 text-secondary-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-secondary-900 mb-2">No reminders found</h3>
          <p className="text-secondary-600 mb-6">
            {searchQuery || statusFilter || typeFilter
              ? 'Try adjusting your search criteria or filters'
              : 'Get started by creating your first reminder'
            }
          </p>
          <button onClick={handleCreateReminder} className="btn-primary">
            <Plus className="w-4 h-4 mr-2" />
            Create First Reminder
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredReminders.map((reminder, index) => {
            // Add safety check for each reminder object
            if (!reminder || typeof reminder !== 'object') {
              console.warn('Invalid reminder object at index:', index, reminder);
              return null;
            }
            return renderReminderCard(reminder);
          }).filter(Boolean)}
        </div>
      )}
    </div>
  );
};