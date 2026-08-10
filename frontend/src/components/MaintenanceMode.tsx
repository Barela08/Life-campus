import React from 'react'
import { useBranding } from '../store/branding'
import { Shield, Wrench } from 'lucide-react'

export default function MaintenanceMode() {
  const { systemName } = useBranding()
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100 dark:from-slate-900 dark:via-gray-900 dark:to-slate-800">
      <div className="text-center p-8 max-w-md">
        <div className="w-20 h-20 mx-auto rounded-2xl bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center mb-6">
          <Wrench size={40} className="text-amber-500" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          SYSTEM MAINTENANCE
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mb-2">
          {systemName} is temporarily unavailable.
        </p>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
          Please try again later. Admin access remains available.
        </p>
        <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
          <Shield size={14} />
          <span>Scheduled maintenance in progress</span>
        </div>
      </div>
    </div>
  )
}
