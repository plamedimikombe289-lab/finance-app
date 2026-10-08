// Constantes globales — centralise tous les "magic numbers" de l'application

const BCRYPT_ROUNDS        = 10
const MAX_FILE_SIZE        = 10 * 1024 * 1024   // 10 MB
const CATEGORY_TYPES       = ['fixe', 'pourcentage']
const MAX_PERCENTAGE       = 100
const DEFAULT_DEVISE       = 'CAD'
const DEVISE_CODE_LENGTH   = 3

const VERIFICATION_TOKEN_TTL = 24 * 60 * 60 * 1000  // 24 h
const RESET_TOKEN_TTL        = 60 * 60 * 1000        // 1 h

const RATE_LIMIT_WINDOW     = 60 * 1000        // 1 min
const RATE_LIMIT_MAX        = 180
const AUTH_RATE_LIMIT_WINDOW = 15 * 60 * 1000  // 15 min
const AUTH_RATE_LIMIT_MAX   = 10

const PAGINATION_DEFAULT_LIMIT = 20
const PAGINATION_MAX_LIMIT     = 100

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']

// Codes ISO 4217 supportés par l'application
const VALID_CURRENCY_CODES = [
  'CAD','USD','EUR','GBP','CHF','JPY','CNY','BRL','MXN','AUD','INR','ZAR','NGN','KES',
]

module.exports = {
  BCRYPT_ROUNDS,
  MAX_FILE_SIZE,
  CATEGORY_TYPES,
  MAX_PERCENTAGE,
  DEFAULT_DEVISE,
  DEVISE_CODE_LENGTH,
  VERIFICATION_TOKEN_TTL,
  RESET_TOKEN_TTL,
  RATE_LIMIT_WINDOW,
  RATE_LIMIT_MAX,
  AUTH_RATE_LIMIT_WINDOW,
  AUTH_RATE_LIMIT_MAX,
  PAGINATION_DEFAULT_LIMIT,
  PAGINATION_MAX_LIMIT,
  ALLOWED_MIME_TYPES,
  VALID_CURRENCY_CODES,
}
