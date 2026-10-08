import { describe, test, expect } from 'vitest'
import {
  formatMontant,
  formatMontantParts,
  getCurrencySymbol,
  CURRENCIES,
} from '../utils/format'

describe('getCurrencySymbol', () => {
  test('retourne le symbole pour CAD', () => {
    expect(getCurrencySymbol('CAD')).toBe('$')
  })

  test('retourne le symbole pour EUR', () => {
    expect(getCurrencySymbol('EUR')).toBe('€')
  })

  test('retourne le symbole pour GBP', () => {
    expect(getCurrencySymbol('GBP')).toBe('£')
  })

  test('retourne le code lui-même si devise inconnue', () => {
    expect(getCurrencySymbol('XYZ')).toBe('XYZ')
  })
})

describe('formatMontant', () => {
  test('formate un montant positif en CAD', () => {
    expect(formatMontant(1234.5, 'CAD')).toBe('1234.50 $')
  })

  test('formate un montant négatif', () => {
    expect(formatMontant(-50, 'EUR')).toBe('-50.00 €')
  })

  test('formate zéro', () => {
    expect(formatMontant(0, 'CAD')).toBe('0.00 $')
  })

  test('gère les valeurs non numériques (fallback à 0)', () => {
    expect(formatMontant(null, 'CAD')).toBe('0.00 $')
    expect(formatMontant(undefined, 'CAD')).toBe('0.00 $')
    expect(formatMontant('abc', 'CAD')).toBe('0.00 $')
  })

  test('utilise CAD par défaut', () => {
    expect(formatMontant(100)).toBe('100.00 $')
  })

  test('affiche toujours 2 décimales', () => {
    expect(formatMontant(1.1, 'CAD')).toBe('1.10 $')
    expect(formatMontant(1.99, 'CAD')).toBe('1.99 $')
    expect(formatMontant(1000, 'CAD')).toBe('1000.00 $')
  })
})

describe('formatMontantParts', () => {
  test('décompose correctement un montant positif', () => {
    const parts = formatMontantParts(1234.56, 'EUR')
    expect(parts.integer).toBeDefined()
    expect(parts.decimal).toBe('56')
    expect(parts.symbol).toBe('€')
    expect(parts.negative).toBe(false)
  })

  test('détecte les montants négatifs', () => {
    const parts = formatMontantParts(-100, 'CAD')
    expect(parts.negative).toBe(true)
  })

  test('gère zéro correctement', () => {
    const parts = formatMontantParts(0, 'CAD')
    expect(parts.decimal).toBe('00')
    expect(parts.negative).toBe(false)
  })

  test('formate les grands nombres avec séparateur', () => {
    const parts = formatMontantParts(1000000, 'CAD')
    // fr-FR utilise l'espace insécable comme séparateur de milliers
    expect(parts.integer).toContain('000')
  })
})

describe('CURRENCIES', () => {
  test('contient les devises communes', () => {
    const codes = CURRENCIES.map(c => c.code)
    expect(codes).toContain('CAD')
    expect(codes).toContain('EUR')
    expect(codes).toContain('USD')
    expect(codes).toContain('GBP')
  })

  test('chaque devise a un code, symbole et nom', () => {
    CURRENCIES.forEach(c => {
      expect(c.code).toBeTruthy()
      expect(c.symbol).toBeTruthy()
      expect(c.name).toBeTruthy()
    })
  })

  test('les codes font exactement 3 caractères', () => {
    CURRENCIES.forEach(c => {
      expect(c.code).toHaveLength(3)
    })
  })
})
