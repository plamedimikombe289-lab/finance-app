export const CURRENCIES = [
  { code: 'CAD', symbol: '$',  name: 'Dollar canadien' },
  { code: 'USD', symbol: '$',  name: 'Dollar américain' },
  { code: 'EUR', symbol: '€',  name: 'Euro' },
  { code: 'GBP', symbol: '£',  name: 'Livre sterling' },
  { code: 'CHF', symbol: 'Fr', name: 'Franc suisse' },
  { code: 'JPY', symbol: '¥',  name: 'Yen japonais' },
  { code: 'CNY', symbol: '¥',  name: 'Yuan chinois' },
  { code: 'BRL', symbol: 'R$', name: 'Réal brésilien' },
  { code: 'MXN', symbol: '$',  name: 'Peso mexicain' },
  { code: 'AUD', symbol: '$',  name: 'Dollar australien' },
  { code: 'INR', symbol: '₹',  name: 'Roupie indienne' },
  { code: 'ZAR', symbol: 'R',  name: 'Rand sud-africain' },
  { code: 'NGN', symbol: '₦',  name: 'Naira nigérian' },
  { code: 'KES', symbol: 'KSh',name: 'Shilling kényan' },
]

export function getCurrencySymbol(code) {
  return CURRENCIES.find(c => c.code === code)?.symbol ?? code
}

export function formatMontant(amount, devise = 'CAD') {
  const num = parseFloat(amount) || 0
  const symbol = getCurrencySymbol(devise)
  return `${num.toFixed(2)} ${symbol}`
}

export function formatMontantParts(amount, devise = 'CAD') {
  const num = parseFloat(amount) || 0
  const symbol = getCurrencySymbol(devise)
  const [integer, decimal] = num.toFixed(2).split('.')
  const intFormatted = parseInt(integer, 10).toLocaleString('fr-FR')
  return { integer: intFormatted, decimal, symbol, negative: num < 0 }
}
