import { useEffect } from 'react'
import { useBlocker } from 'react-router-dom'

export function useUnsavedChanges(isDirty) {
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    isDirty && currentLocation.pathname !== nextLocation.pathname
  )

  useEffect(() => {
    if (blocker.state !== 'blocked') return
    const confirmed = window.confirm(
      'Vous avez des modifications non sauvegardées. Quitter sans sauvegarder ?'
    )
    if (confirmed) blocker.proceed()
    else blocker.reset()
  }, [blocker])

  // Block browser tab close / reload
  useEffect(() => {
    if (!isDirty) return
    const handler = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])
}
