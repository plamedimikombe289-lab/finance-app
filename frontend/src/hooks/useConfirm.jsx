import { useState, useCallback } from 'react'

export function useConfirm() {
  const [state, setState] = useState(null)

  const confirm = useCallback((message, options = {}) => {
    return new Promise(resolve => {
      setState({ message, options, resolve })
    })
  }, [])

  const handleConfirm = () => {
    state?.resolve(true)
    setState(null)
  }

  const handleCancel = () => {
    state?.resolve(false)
    setState(null)
  }

  const ConfirmDialog = state ? (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9998] p-4 animate-fade-in"
      onClick={handleCancel}
    >
      <div
        className="rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-slide-up"
        style={{
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.6)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-4">
          {state.options.danger ? (
            <div className="flex-shrink-0 w-9 h-9 rounded-full bg-red-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
          ) : (
            <div className="flex-shrink-0 w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          )}
          <div>
            <h3 className="text-base font-semibold text-gray-900">
              {state.options.title || 'Confirmation'}
            </h3>
            <p className="text-sm text-gray-600 mt-1 leading-relaxed">{state.message}</p>
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            {state.options.cancelLabel || 'Annuler'}
          </button>
          <button
            onClick={handleConfirm}
            className={state.options.danger
              ? 'px-4 py-2 text-sm font-medium text-white rounded-lg bg-red-600 hover:bg-red-700 transition-colors'
              : 'btn-primary'
            }
          >
            {state.options.confirmLabel || 'Confirmer'}
          </button>
        </div>
      </div>
    </div>
  ) : null

  return { confirm, ConfirmDialog }
}
