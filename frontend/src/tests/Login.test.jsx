import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// ── Mocks ─────────────────────────────────────────────────────────────────────
vi.mock('../api', () => ({
  authApi: {
    login:              vi.fn(),
    resendVerification: vi.fn(),
  },
}))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ login: vi.fn() }),
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

import Login from '../pages/Login'
import { authApi } from '../api'

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  )
}

function fillAndSubmit(email = 'test@test.com', password = 'motdepasse') {
  fireEvent.change(screen.getByPlaceholderText('votre@email.com'), { target: { value: email } })
  fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: password } })
  // Use submit on the form to bypass jsdom constraint validation
  fireEvent.submit(screen.getByPlaceholderText('votre@email.com').closest('form'))
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('Login — rendu', () => {
  test('affiche le formulaire email + mot de passe', () => {
    renderLogin()
    expect(screen.getByPlaceholderText('votre@email.com')).toBeTruthy()
    expect(screen.getByPlaceholderText('••••••••')).toBeTruthy()
    expect(screen.getByText('Se connecter →')).toBeTruthy()
  })
})

describe('Login — soumission', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNavigate.mockClear()
  })

  test('appelle authApi.login avec les valeurs du formulaire', async () => {
    authApi.login.mockResolvedValueOnce({ user: { role: 'user' }, token: 'tok' })
    renderLogin()
    fillAndSubmit('u@u.com', 'secret')
    await waitFor(() => expect(authApi.login).toHaveBeenCalledWith({
      email: 'u@u.com',
      password: 'secret',
    }))
  })

  test('redirige vers /dashboard pour un utilisateur normal', async () => {
    authApi.login.mockResolvedValueOnce({ user: { role: 'user' }, token: 'tok' })
    renderLogin()
    fillAndSubmit()
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true }))
  })

  test('redirige vers /admin pour un admin', async () => {
    authApi.login.mockResolvedValueOnce({ user: { role: 'admin' }, token: 'tok' })
    renderLogin()
    fillAndSubmit()
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/admin', { replace: true }))
  })

  test("affiche le message d'erreur si le login échoue", async () => {
    authApi.login.mockRejectedValueOnce({ message: 'Identifiants incorrects.' })
    renderLogin()
    fillAndSubmit()
    await waitFor(() =>
      expect(screen.getByText('Identifiants incorrects.')).toBeTruthy()
    )
  })

  test('affiche le bouton renvoi si email non vérifié', async () => {
    authApi.login.mockRejectedValueOnce({
      message: 'Compte non vérifié.',
      email_non_verifie: true,
      email: 'nv@test.com',
    })
    renderLogin()
    fillAndSubmit()
    await waitFor(() =>
      expect(screen.getByText(/Renvoyer le courriel/i)).toBeTruthy()
    )
  })
})
