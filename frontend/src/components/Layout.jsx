import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import Breadcrumb from './Breadcrumb'
import {
  LayoutDashboard, TrendingUp, CreditCard, FolderKanban, ShoppingCart,
  BarChart2, FileText, Landmark, Download, Trash2, Settings,
  Home, Users, User, LogOut, Sun, Moon, Crown, AlertTriangle, Sparkles,
} from './Icons'

function ImpersonationBanner() {
  const { user, isImpersonating, exitImpersonation } = useAuth()
  const navigate = useNavigate()

  if (!isImpersonating) return null

  const handleExit = () => {
    exitImpersonation()
    navigate('/admin/users', { replace: true })
  }

  return (
    <div className="flex-shrink-0 bg-amber-500 dark:bg-amber-600 text-white px-4 py-2 flex items-center justify-between gap-3 text-sm font-medium shadow-md z-30">
      <span className="flex items-center gap-2">
        <AlertTriangle size={16} />
        Mode admin — vous consultez le compte de <strong>{user?.nom}</strong> ({user?.email})
      </span>
      <button
        onClick={handleExit}
        className="flex-shrink-0 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-xs font-semibold border border-white/30"
      >
        Quitter ce compte
      </button>
    </div>
  )
}

const userNav = [
  { to: '/dashboard',      label: 'Tableau de bord', Icon: LayoutDashboard },
  { to: '/revenus',        label: 'Revenus',          Icon: TrendingUp      },
  { to: '/dettes',         label: 'Dettes',           Icon: CreditCard      },
  { to: '/categories',     label: 'Catégories',       Icon: FolderKanban    },
  { to: '/depenses',       label: 'Dépenses',         Icon: ShoppingCart    },
  { to: '/rapports',       label: 'Rapports',         Icon: BarChart2       },
  { to: '/rapport-fiscal', label: 'Rapport fiscal',   Icon: FileText        },
  { to: '/comptes',        label: 'Comptes',          Icon: Landmark        },
  { to: '/conseiller-ia',  label: 'San Prince IA',    Icon: Sparkles        },
  { to: '/export',         label: 'Export données',   Icon: Download        },
  { to: '/corbeille',      label: 'Corbeille',        Icon: Trash2          },
  { to: '/parametres',     label: 'Paramètres',       Icon: Settings        },
]

const adminNav = [
  { to: '/admin',       label: 'Dashboard',    Icon: Home  },
  { to: '/admin/users', label: 'Utilisateurs', Icon: Users },
]

function HamburgerIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}

function BriefcaseLogo({ size = 16 }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="14" x="2" y="7" rx="2"/>
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
    </svg>
  )
}

export default function Layout({ admin = false }) {
  const { user, logout } = useAuth()
  const { dark, toggleDark: onToggleDark } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const navItems = admin ? adminNav : userNav
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [pageKey, setPageKey] = useState(location.pathname)

  useEffect(() => {
    setSidebarOpen(false)
    setPageKey(location.pathname)
  }, [location.pathname])

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex h-screen text-gray-900 dark:text-gray-100 overflow-hidden" style={{ background: 'transparent' }}>

      {/* Skip navigation for keyboard/screen reader users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-white focus:rounded-lg focus:text-sm focus:font-medium"
      >
        Aller au contenu principal
      </a>

      {/* Mobile backdrop overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 flex flex-col
        border-r border-gray-200 dark:border-gray-700
        transition-transform duration-300 ease-in-out will-change-transform
        md:relative md:translate-x-0 md:flex-shrink-0
        ${sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'}
      `} style={{
        background: dark ? 'rgba(17,24,39,0.80)' : 'rgba(255,255,255,0.75)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}>

        {/* Logo + mobile close */}
        <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-sm shadow-indigo-500/30">
              <BriefcaseLogo size={16} />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-gray-900 dark:text-white leading-none">FinanceApp</h1>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 font-medium">
                {admin ? 'Administration' : 'Gestion personnelle'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Fermer le menu"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/admin'}
              className={({ isActive }) =>
                `nav-link flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                  isActive
                    ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'
                }`
              }
            >
              <span className="nav-link-icon flex-shrink-0">
                <item.Icon size={17} strokeWidth={1.75} />
              </span>
              {item.label}
            </NavLink>
          ))}

          {admin && (
            <NavLink
              to="/dashboard"
              className="nav-link flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200 mt-3 border-t border-gray-100 dark:border-gray-800 pt-3"
            >
              <span className="nav-link-icon flex-shrink-0">
                <User size={17} strokeWidth={1.75} />
              </span>
              Mon espace
            </NavLink>
          )}
        </nav>

        {/* Bottom: user info + dark toggle + logout */}
        <div className="p-3 border-t border-gray-200 dark:border-gray-700 space-y-1">
          {user && (
            <div className="px-3 py-2 rounded-lg bg-black/5 dark:bg-white/5 mb-2">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center flex-shrink-0">
                  <User size={14} className="text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate leading-tight">{user.nom}</p>
                  <p className="text-xs text-gray-400 truncate leading-tight">{user.email}</p>
                </div>
              </div>
              <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium ${
                user.role === 'admin'
                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                  : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
              }`}>
                {user.role === 'admin'
                  ? <><Crown size={10} /> Admin</>
                  : <><User size={10} /> Utilisateur</>
                }
              </span>
            </div>
          )}

          <button
            onClick={onToggleDark}
            aria-label={dark ? 'Activer le mode clair' : 'Activer le mode sombre'}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            {dark
              ? <><Sun size={15} className="text-amber-500" /> Mode clair</>
              : <><Moon size={15} className="text-indigo-400" /> Mode sombre</>
            }
          </button>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <LogOut size={15} />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0" style={{
        background: dark ? 'rgba(3,7,18,0.45)' : 'rgba(248,250,252,0.45)',
      }}>

        {/* Mobile top bar */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 shadow-sm" style={{
          background: dark ? 'rgba(17,24,39,0.80)' : 'rgba(255,255,255,0.75)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}>
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors active:scale-95"
            aria-label="Ouvrir le menu"
          >
            <HamburgerIcon />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center">
              <BriefcaseLogo size={12} />
            </div>
            <h1 className="text-base font-bold tracking-tight text-gray-900 dark:text-white">FinanceApp</h1>
          </div>
          <button
            onClick={onToggleDark}
            aria-label={dark ? 'Activer le mode clair' : 'Activer le mode sombre'}
            className="ml-auto p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
          >
            {dark ? <Sun size={16} className="text-amber-500" /> : <Moon size={16} className="text-indigo-400" />}
          </button>
        </header>

        <ImpersonationBanner />

        <main id="main-content" className="flex-1 overflow-y-auto">
          <div key={pageKey} className="max-w-5xl mx-auto p-4 md:p-6 page-enter">
            <Breadcrumb />
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
