import { useEffect, useState } from 'react'
import { setToastHandler, clearToastHandler } from '../lib/toast'

interface ToastData {
  message: string
  type: 'success' | 'error' | 'warning'
}

export function Toast() {
  const [toast, setToast] = useState<ToastData | null>(null)

  useEffect(() => {
    setToastHandler(setToast)
    return () => clearToastHandler()
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  if (!toast) return null

  const colors = {
    success: 'border-primary text-primary',
    error: 'border-red-500 text-red-500',
    warning: 'border-amber-500 text-amber-500',
  }

  return (
    <div className={`fixed bottom-6 right-6 z-50 px-4 py-2 bg-dark-card border-l-4 rounded shadow-lg
      ${colors[toast.type]}`}
    >
      {toast.message}
    </div>
  )
}
