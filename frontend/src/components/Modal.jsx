import { useEffect, useRef } from 'react'

export default function Modal({ open, onClose, maxWidth = 'max-w-md', className = '', label, children }) {
  const dialogRef = useRef(null)
  const previousFocus = useRef(null)

  useEffect(() => {
    if (!open) return

    previousFocus.current = document.activeElement

    const el = dialogRef.current
    if (el) {
      const focusable = el.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      focusable[0]?.focus()
    }

    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab' && el) {
        const focusable = [...el.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )]
        if (!focusable.length) { e.preventDefault(); return }
        const first = focusable[0]
        const last  = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault(); last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); first.focus()
        }
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('keydown', handleKey)
      previousFocus.current?.focus()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={onClose}
      aria-hidden="true"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={`glass-modal w-full ${maxWidth} animate-slide-up ${className}`}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
