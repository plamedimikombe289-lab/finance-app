import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function PrivateRoute() {
  const { isAuth } = useAuth()
  return isAuth ? <Outlet /> : <Navigate to="/login" replace />
}

export function AdminRoute() {
  const { isAuth, isAdmin } = useAuth()
  if (!isAuth)  return <Navigate to="/login"     replace />
  if (!isAdmin) return <Navigate to="/dashboard" replace />
  return <Outlet />
}
