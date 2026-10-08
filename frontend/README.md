# FinanceApp — Frontend

Interface React pour l'application de gestion financière personnelle par enveloppes budgétaires.

## Stack technique

- **Framework** : React 19 + Vite 8
- **Routing** : React Router v7 (data router — `createBrowserRouter`)
- **Styles** : Tailwind CSS v4
- **Graphiques** : Recharts
- **HTTP** : Axios
- **Tests** : Vitest + Testing Library

## Installation

```bash
npm install
npm run dev       # serveur de développement (http://localhost:5173)
npm run build     # build de production
npm run preview   # prévisualisation du build
```

## Tests

```bash
npm test                  # tous les tests (mode watch)
npm run test:coverage     # rapport de couverture HTML
```

Structure des tests :
```
src/tests/
├── setup.js                      # @testing-library/jest-dom
├── format.test.js                # Tests utilitaires formatMontant, getCurrencySymbol
└── useExchangeRates.test.js      # Tests hook de taux de change (fetch mocké)
```

## Structure des dossiers

```
src/
├── App.jsx                  # Router + providers (createBrowserRouter + React.lazy)
├── main.jsx                 # Point d'entrée React
├── index.css                # Design system (btn-primary, card-primary, input-field…)
│
├── context/
│   ├── AuthContext.jsx      # État utilisateur, login/logout, devise
│   └── ThemeContext.jsx     # Dark mode (localStorage)
│
├── components/              # Composants réutilisables
│   ├── Layout.jsx           # Sidebar + nav + mobile header
│   ├── Modal.jsx            # Modal a11y (focus trap, Escape, backdrop)
│   ├── Toast.jsx            # Notifications (success/error/warning/info)
│   ├── BackgroundLayer.jsx  # Animation de fond
│   ├── Breadcrumb.jsx       # Fil d'ariane
│   ├── EmptyState.jsx       # État vide illustré
│   └── SkeletonLoader.jsx   # Squelettes de chargement
│
├── hooks/
│   ├── useConfirm.jsx       # Dialog de confirmation (Promise-based)
│   ├── useEscape.js         # Fermer sur touche Escape
│   ├── useExchangeRates.js  # Taux de change (cache 24h, API fawazahmed0)
│   └── useUnsavedChanges.js # Bloquer navigation si formulaire dirty
│
├── pages/                   # Pages (lazy-loaded via React.lazy)
│   ├── Login.jsx / Register.jsx / ForgotPassword.jsx …
│   ├── Dashboard.jsx / Revenus.jsx / Depenses.jsx …
│   └── admin/
│       ├── AdminDashboard.jsx
│       ├── AdminUsers.jsx
│       └── AdminUserDetail.jsx
│
├── api/
│   └── index.js             # Instance Axios + tous les appels API groupés
│
└── utils/
    ├── format.js            # formatMontant, formatMontantParts, CURRENCIES
    └── apiCache.js          # Cache mémoire pour les appels API
```

## Design System

Classes utilitaires définies dans `src/index.css` :

| Classe | Usage |
|--------|-------|
| `btn-primary` | Bouton principal (gradient indigo → violet) |
| `btn-secondary` | Bouton secondaire (fond blanc, bordure) |
| `card-primary` | Carte glassmorphism (backdrop-blur) |
| `card-hoverable` | Carte interactive avec lift au survol |
| `input-field` | Champ de formulaire standardisé |
| `text-label` | Label de formulaire (11px, uppercase) |

Toutes les classes ont une variante `.dark:*` pour le mode sombre.

## Authentification

Le token JWT est stocké dans `localStorage`. Le contexte `AuthContext` :
- Auto-injecte le token dans chaque requête Axios
- Redirige vers `/login` sur une réponse 401
- Expose `user`, `isAuth`, `login()`, `logout()`, `updateDevise()`

## Variables d'environnement

Créer un fichier `.env` à la racine du dossier `frontend/` :

```env
VITE_API_URL=http://localhost:5001/api
```
