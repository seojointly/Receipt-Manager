'use client'
import { useEffect } from 'react'
import { CheckCircle, XCircle, X } from 'lucide-react'

interface ToastProps {
  message: string
  type: 'success' | 'error'
  onClose: () => void
}

export const Toast = ({ message, type, onClose }: ToastProps) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white transition-all
      ${type === 'success' ? 'bg-zinc-900' : 'bg-red-500'}`}>
      {type === 'success'
        ? <CheckCircle className="w-4 h-4 shrink-0" />
        : <XCircle className="w-4 h-4 shrink-0" />}
      <span>{message}</span>
      <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100">
        <X className="w-3 h-3" />
      </button>
    </div>
  )
}
