const ICONS = {
  inbox: (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="14" width="48" height="36" rx="4" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/>
      <path d="M8 38h13l4 6h14l4-6h13" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/>
      <path d="M22 26h20M26 32h12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  ),
  chart: (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="34" width="10" height="18" rx="2" stroke="currentColor" strokeWidth="2.5"/>
      <rect x="27" y="24" width="10" height="28" rx="2" stroke="currentColor" strokeWidth="2.5"/>
      <rect x="44" y="14" width="10" height="38" rx="2" stroke="currentColor" strokeWidth="2.5"/>
      <path d="M8 56h48" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  ),
  folder: (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 20a4 4 0 014-4h12l4 6h24a4 4 0 014 4v22a4 4 0 01-4 4H12a4 4 0 01-4-4V20z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/>
      <path d="M24 36h16M32 30v12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  ),
  wallet: (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="20" width="48" height="32" rx="4" stroke="currentColor" strokeWidth="2.5"/>
      <path d="M8 28h48" stroke="currentColor" strokeWidth="2.5"/>
      <path d="M44 38a2 2 0 100 4 2 2 0 000-4z" fill="currentColor"/>
      <path d="M16 12h28a4 4 0 014 4v4H12v-4a4 4 0 014-4z" stroke="currentColor" strokeWidth="2.5"/>
    </svg>
  ),
  trash: (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 20h40M26 20v-6h12v6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M16 20l3 34h26l3-34" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/>
      <path d="M26 28v18M32 28v18M38 28v18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  ),
  tag: (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 10h20l24 24-20 20L10 30V10z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/>
      <circle cx="21" cy="21" r="3" stroke="currentColor" strokeWidth="2.5"/>
    </svg>
  ),
  card: (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="16" width="48" height="32" rx="4" stroke="currentColor" strokeWidth="2.5"/>
      <path d="M8 26h48" stroke="currentColor" strokeWidth="2.5"/>
      <rect x="14" y="34" width="12" height="6" rx="2" stroke="currentColor" strokeWidth="2"/>
    </svg>
  ),
}

export default function EmptyState({
  icon = 'inbox',
  title,
  description,
  action,
  onAction,
  className = '',
}) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 px-6 text-center ${className}`}>
      <div className="w-16 h-16 text-indigo-300 dark:text-indigo-600 mb-5">
        {ICONS[icon] || ICONS.inbox}
      </div>
      <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-gray-400 dark:text-gray-500 max-w-xs mb-5">
          {description}
        </p>
      )}
      {action && onAction && (
        <button
          onClick={onAction}
          className="btn-primary text-sm px-5 py-2"
        >
          {action}
        </button>
      )}
    </div>
  )
}
