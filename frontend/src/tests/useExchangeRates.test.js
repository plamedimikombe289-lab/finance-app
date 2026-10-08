import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useExchangeRates } from '../hooks/useExchangeRates'

const FAKE_RATES = {
  cad: {
    cad: 1,
    usd: 0.73,
    eur: 0.68,
    gbp: 0.58,
    jpy: 110.5,
  }
}

function mockFetch(data = FAKE_RATES, ok = true) {
  global.fetch = vi.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(data),
  })
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useExchangeRates — chargement', () => {
  test('démarre en état loading=true et rates=null', async () => {
    mockFetch()
    const { result } = renderHook(() => useExchangeRates())
    expect(result.current.loading).toBe(true)
    expect(result.current.rates).toBeNull()
    await waitFor(() => expect(result.current.loading).toBe(false))
  })

  test('charge les taux depuis l\'API et normalise en majuscules', async () => {
    mockFetch()
    const { result } = renderHook(() => useExchangeRates())
    await waitFor(() => expect(result.current.rates).not.toBeNull())
    expect(result.current.rates['CAD']).toBe(1)
    expect(result.current.rates['USD']).toBe(0.73)
    expect(result.current.rates['EUR']).toBe(0.68)
  })

  test('set lastUpdated après chargement réussi', async () => {
    mockFetch()
    const { result } = renderHook(() => useExchangeRates())
    await waitFor(() => expect(result.current.lastUpdated).not.toBeNull())
    expect(result.current.lastUpdated).toBeInstanceOf(Date)
  })

  test('set error si fetch échoue', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))
    const { result } = renderHook(() => useExchangeRates())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('Network error')
    expect(result.current.rates).toBeNull()
  })
})

describe('useExchangeRates — cache', () => {
  test('utilise le cache si encore valide (pas de fetch)', async () => {
    // Pré-remplir le cache
    localStorage.setItem('fx_rates_cache', JSON.stringify({
      rates: { CAD: 1, USD: 0.73, EUR: 0.68 },
      ts: Date.now(),
    }))

    global.fetch = vi.fn()
    const { result } = renderHook(() => useExchangeRates())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(global.fetch).not.toHaveBeenCalled()
    expect(result.current.rates['USD']).toBe(0.73)
  })

  test('ignore le cache expiré et re-fetch', async () => {
    // Cache expiré (> 24h)
    localStorage.setItem('fx_rates_cache', JSON.stringify({
      rates: { CAD: 1, USD: 0.5 },
      ts: Date.now() - 25 * 60 * 60 * 1000,
    }))
    mockFetch()
    const { result } = renderHook(() => useExchangeRates())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(global.fetch).toHaveBeenCalled()
    expect(result.current.rates['USD']).toBe(0.73)  // depuis le mock, pas le cache
  })

  test('écrit dans le cache après un fetch réussi', async () => {
    mockFetch()
    const { result } = renderHook(() => useExchangeRates())
    await waitFor(() => expect(result.current.rates).not.toBeNull())
    const cached = JSON.parse(localStorage.getItem('fx_rates_cache'))
    expect(cached).not.toBeNull()
    expect(cached.rates['CAD']).toBe(1)
    expect(cached.ts).toBeGreaterThan(0)
  })
})

describe('useExchangeRates — convert()', () => {
  test('retourne le montant tel quel si rates non chargés', () => {
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}))  // never resolves
    const { result } = renderHook(() => useExchangeRates())
    // Quand rates=null, convert retourne parseFloat(amount) pour éviter NaN
    expect(result.current.convert(100, 'USD', 'EUR')).toBe(100)
    expect(result.current.convert(0, 'USD', 'EUR')).toBe(0)
  })

  test('retourne le montant inchangé si from === to', async () => {
    mockFetch()
    const { result } = renderHook(() => useExchangeRates())
    await waitFor(() => expect(result.current.rates).not.toBeNull())
    expect(result.current.convert(100, 'CAD', 'CAD')).toBe(100)
    expect(result.current.convert(50, 'USD', 'USD')).toBe(50)
  })

  test('convertit CAD → USD correctement', async () => {
    mockFetch()
    const { result } = renderHook(() => useExchangeRates())
    await waitFor(() => expect(result.current.rates).not.toBeNull())
    const res = result.current.convert(100, 'CAD', 'USD')
    expect(res).toBeCloseTo(73, 0)  // 100 * 0.73
  })

  test('convertit USD → EUR via base CAD', async () => {
    mockFetch()
    const { result } = renderHook(() => useExchangeRates())
    await waitFor(() => expect(result.current.rates).not.toBeNull())
    // 100 USD → en CAD: 100 / 0.73 = 136.99 → en EUR: 136.99 * 0.68 ≈ 93.15
    const res = result.current.convert(100, 'USD', 'EUR')
    expect(res).toBeCloseTo(93.15, 0)
  })

  test('gère les montants négatifs', async () => {
    mockFetch()
    const { result } = renderHook(() => useExchangeRates())
    await waitFor(() => expect(result.current.rates).not.toBeNull())
    const res = result.current.convert(-100, 'CAD', 'USD')
    expect(res).toBeCloseTo(-73, 0)
  })
})

describe('useExchangeRates — refresh()', () => {
  test('efface le cache et re-fetch', async () => {
    // Cache valide → pas de fetch initial
    localStorage.setItem('fx_rates_cache', JSON.stringify({
      rates: { CAD: 1, USD: 0.5 },
      ts: Date.now(),
    }))
    mockFetch()
    const { result } = renderHook(() => useExchangeRates())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(global.fetch).not.toHaveBeenCalled()  // chargé depuis cache

    act(() => result.current.refresh())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(global.fetch).toHaveBeenCalledTimes(1)  // uniquement le refresh
    expect(result.current.rates['USD']).toBe(0.73)
  })
})
