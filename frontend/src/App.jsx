import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom'
import { Component, lazy, Suspense } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { PrivateRoute, AdminRoute } from './components/PrivateRoute'
import Layout from './components/Layout'
import BackgroundLayer from './components/BackgroundLayer'
import { ToastProvider } from './components/Toast'

// ── Lazy-loaded pages ──────────────────────────────────────────────────────
const Login          = lazy(() => import('./pages/Login'))
const Register       = lazy(() => import('./pages/Register'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword  = lazy(() => import('./pages/ResetPassword'))
const VerifyEmail    = lazy(() => import('./pages/VerifyEmail'))

const Dashboard    = lazy(() => import('./pages/Dashboard'))
const Revenus      = lazy(() => import('./pages/Revenus'))
const Dettes       = lazy(() => import('./pages/Dettes'))
const Categories   = lazy(() => import('./pages/Categories'))
const Depenses     = lazy(() => import('./pages/Depenses'))
const Rapports     = lazy(() => import('./pages/Rapports'))
const Parametres   = lazy(() => import('./pages/Parametres'))
const Onboarding   = lazy(() => import('./pages/Onboarding'))
const RapportFiscal = lazy(() => import('./pages/RapportFiscal'))
const Comptes      = lazy(() => import('./pages/Comptes'))
const Export       = lazy(() => import('./pages/Export'))
const Corbeille    = lazy(() => import('./pages/Corbeille'))
const ConseillerIA = lazy(() => import('./pages/ConseillerIA'))

const AdminDashboard  = lazy(() => import('./pages/admin/AdminDashboard'))
const AdminUsers      = lazy(() => import('./pages/admin/AdminUsers'))
const AdminUserDetail = lazy(() => import('./pages/admin/AdminUserDetail'))

// ── Page loader skeleton ───────────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-48">
      <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
    </div>
  )
}

// ── Error boundary ─────────────────────────────────────────────────────────
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '2rem', fontFamily: 'monospace' }}>
          <h2 style={{ color: '#dc2626' }}>Erreur — {this.state.error.message}</h2>
          <pre style={{ fontSize: 12, whiteSpace: 'pre-wrap', color: '#374151', marginTop: '1rem' }}>
            {this.state.error.stack}
          </pre>
          <button onClick={() => this.setState({ error: null })} style={{ marginTop: '1rem', padding: '0.5rem 1rem', cursor: 'pointer' }}>
            Réessayer
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function OnboardingGate() {
  const { user, isAuth } = useAuth()
  if (!isAuth || user?.onboarding_complete) return null
  return (
    <Suspense fallback={null}>
      <Onboarding />
    </Suspense>
  )
}

function RootLayout() {
  return (
    <>
      <BackgroundLayer />
      <div style={{ position: 'relative', zIndex: 1, height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <OnboardingGate />
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </div>
    </>
  )
}

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/login',           element: <Login /> },
      { path: '/register',        element: <Register /> },
      { path: '/forgot-password', element: <ForgotPassword /> },
      { path: '/reset-password',  element: <ResetPassword /> },
      { path: '/verify-email',    element: <VerifyEmail /> },
      { path: '/',                element: <Navigate to="/dashboard" replace /> },

      {
        element: <AdminRoute />,
        children: [{
          element: <Layout admin />,
          children: [
            { path: '/admin',               element: <AdminDashboard /> },
            { path: '/admin/users',         element: <AdminUsers /> },
            { path: '/admin/users/:userId', element: <AdminUserDetail /> },
          ],
        }],
      },

      {
        element: <PrivateRoute />,
        children: [{
          element: <Layout />,
          children: [
            { path: '/dashboard',      element: <Dashboard /> },
            { path: '/revenus',        element: <Revenus /> },
            { path: '/dettes',         element: <Dettes /> },
            { path: '/categories',     element: <Categories /> },
            { path: '/depenses',       element: <Depenses /> },
            { path: '/rapports',       element: <Rapports /> },
            { path: '/rapport-fiscal', element: <RapportFiscal /> },
            { path: '/comptes',        element: <Comptes /> },
            { path: '/export',         element: <Export /> },
            { path: '/corbeille',      element: <Corbeille /> },
            { path: '/conseiller-ia',  element: <ConseillerIA /> },
            { path: '/parametres',     element: <Parametres /> },
          ],
        }],
      },

      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </ThemeProvider>
    </AuthProvider>
  )
}
