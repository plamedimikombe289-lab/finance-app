import { useState, useEffect } from 'react'

const CACHE_KEY = 'fx_rates_cache'
const TTL = 24 * 60 * 60 * 1000
const BASE = 'CAD'

const API_PRIMARY = `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/cad.json`
const API_BACKUP  = `https://latest.currency-api.pages.dev/v1/currencies/cad.json`

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { rates, ts } = JSON.parse(raw)
    if (Date.now() - ts > TTL) { localStorage.removeItem(CACHE_KEY); return null }
    return { rates, ts }
  } catch { return null }
}

function writeCache(rates) {
  localStorage.setItem(CACHE_KEY, JSON.stringify({ rates, ts: Date.now() }))
}

async function fetchRates() {
  const res = await fetch(API_PRIMARY).catch(() => fetch(API_BACKUP))
  const data = await res.json()
  const raw = data[BASE.toLowerCase()]
  const rates = {}
  for (const [k, v] of Object.entries(raw)) rates[k.toUpperCase()] = v
  return rates
}

export function useExchangeRates() {
  const [rates, setRates]         = useState(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  useEffect(() => {
    const cached = readCache()
    if (cached) {
      setRates(cached.rates)
      setLastUpdated(new Date(cached.ts))
      setLoading(false)
      return
    }

    fetchRates()
      .then(r => {
        writeCache(r)
        setRates(r)
        setLastUpdated(new Date())
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  function convert(amount, from, to) {
    if (!rates || from === to) return parseFloat(amount) || 0
    const inBase = from === BASE ? parseFloat(amount) : parseFloat(amount) / (rates[from] || 1)
    return to === BASE ? inBase : inBase * (rates[to] || 1)
  }

  function refresh() {
    localStorage.removeItem(CACHE_KEY)
    setLoading(true)
    setError(null)
    fetchRates()
      .then(r => {
        writeCache(r)
        setRates(r)
        setLastUpdated(new Date())
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  return { rates, loading, error, lastUpdated, convert, refresh }
}
