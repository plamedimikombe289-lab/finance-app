export const C = {
  brand:   '#6366f1',
  success: '#16a34a',
  warning: '#d97706',
  danger:  '#dc2626',
  info:    '#2563eb',
  neutral: '#9ca3af',
  track:   '#c7d2fe', // arc SVG background track
  orange:  '#f97316',
}

// Score thresholds
export const scoreColor = (score) =>
  score >= 80 ? C.success :
  score >= 60 ? C.info :
  score >= 40 ? C.warning :
                C.danger

// Debt/gauge urgency color
export const urgenceColor = (value, low, mid) =>
  value === null ? C.neutral :
  value < low    ? C.danger :
  value < mid    ? C.warning :
                   C.success
