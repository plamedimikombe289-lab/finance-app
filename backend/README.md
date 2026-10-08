# FinanceApp — Backend API

API REST Express.js pour l'application de gestion financière personnelle par enveloppes budgétaires.

## Stack technique

- **Runtime** : Node.js 18+
- **Framework** : Express 4
- **Base de données** : MySQL 8
- **Auth** : JWT (jsonwebtoken) + bcrypt
- **Logs** : Winston
- **Tests** : Jest + Supertest

## Installation

```bash
npm install
cp .env.example .env   # puis remplir les variables
npm run dev            # serveur de développement (nodemon)
npm start              # production
```

## Variables d'environnement

| Variable | Obligatoire | Défaut | Description |
|----------|-------------|--------|-------------|
| `DB_HOST` | ✅ | — | Hôte MySQL |
| `DB_USER` | ✅ | — | Utilisateur MySQL |
| `DB_PASSWORD` | ✅ | — | Mot de passe MySQL |
| `DB_NAME` | ✅ | — | Nom de la base de données |
| `JWT_SECRET` | ✅ | — | Clé secrète JWT (min. 32 caractères) |
| `JWT_EXPIRES_IN` | ❌ | `7d` | Durée de validité du token |
| `PORT` | ❌ | `5001` | Port d'écoute |
| `FRONTEND_URL` | ❌ | `http://localhost:5173` | Origine(s) CORS autorisée(s), séparées par virgule |
| `SMTP_HOST` | ❌ | — | Serveur SMTP pour les emails |
| `SMTP_PORT` | ❌ | `587` | Port SMTP |
| `SMTP_USER` | ❌ | — | Utilisateur SMTP |
| `SMTP_PASS` | ❌ | — | Mot de passe SMTP |
| `SMTP_FROM` | ❌ | — | Adresse d'expéditeur |
| `NODE_ENV` | ❌ | `development` | Environnement (`development` / `production`) |

> Si SMTP n'est pas configuré, la vérification d'email est désactivée et les comptes sont auto-vérifiés à la création.

## Architecture

```
src/
├── server.js              # Point d'entrée — Express, middlewares, routes
├── controllers/           # Logique métier par domaine
│   ├── authController.js
│   ├── revenusController.js
│   ├── categoriesController.js
│   ├── depensesController.js
│   ├── dettesController.js
│   └── adminController.js
├── routes/                # Définition des routes HTTP
│   ├── auth.js
│   ├── revenus.js
│   ├── categories.js
│   ├── depenses.js
│   ├── dettes.js
│   └── admin.js
├── services/              # Logique réutilisable
│   ├── repartitionService.js   # Algorithme de répartition des revenus
│   ├── emailService.js         # Envoi d'emails (SMTP)
│   └── cronJobs.js             # Tâches planifiées (rappels dettes)
├── middleware/
│   ├── auth.js            # Vérification JWT + rôle admin
│   ├── audit.js           # Log automatique de toutes les mutations
│   └── errorHandler.js    # Gestionnaire d'erreurs centralisé
├── database/
│   ├── db.js              # Pool de connexions MySQL
│   ├── init.js            # Initialisation du schéma + catégories par défaut
│   └── indexes.sql        # Indexes de performance (à exécuter une fois)
└── utils/
    ├── logger.js          # Winston logger
    └── envValidator.js    # Validation des variables d'environnement
```

## Algorithme de répartition (cœur métier)

Quand un revenu est ajouté, `repartitionService.repartirRevenu()` :

1. **Catégories fixes** (type `fixe`) — servies en premier, dans l'ordre `ordre ASC`
   - Alloue `min(valeur, montant_restant)`
   - Si `plafond_mensuel` défini, respecte le plafond sur le mois courant
2. **Catégories pourcentage** (type `pourcentage`) — appliquées sur le reste
   - Alloue `base_restante × pourcentage / 100`
3. `non_reparti` = ce qui reste après toutes les allocations

## Tests

```bash
npm test                  # tous les tests
npm run test:watch        # mode watch
npm run test:coverage     # rapport de couverture
```

Structure des tests :
```
tests/
├── setup.js                          # Variables d'env pour les tests
├── unit/
│   ├── auth.middleware.test.js       # Tests middleware JWT + admin
│   └── repartition.test.js          # Tests algorithme de répartition
└── integration/
    └── auth.routes.test.js          # Tests routes /api/auth via supertest
```

## Endpoints principaux

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| POST | `/api/auth/register` | — | Création de compte |
| POST | `/api/auth/login` | — | Connexion |
| GET | `/api/auth/me` | JWT | Profil utilisateur |
| GET | `/api/revenus` | JWT | Liste des revenus |
| POST | `/api/revenus` | JWT | Ajouter un revenu (déclenche répartition) |
| GET | `/api/categories` | JWT | Liste des catégories avec soldes |
| GET | `/api/depenses` | JWT | Liste des dépenses (paginée) |
| POST | `/api/depenses` | JWT | Ajouter une dépense |
| GET | `/api/admin/users` | JWT+Admin | Liste des utilisateurs |
| POST | `/api/admin/users/:id/verify` | JWT+Admin | Vérifier manuellement un compte |
| POST | `/api/admin/users/:id/impersonate` | JWT+Admin | Se connecter en tant qu'utilisateur |

## Sécurité

- Rate limiting : 180 req/min global, 10 tentatives/15min sur login/register
- Helmet pour les headers HTTP (CSP, HSTS, X-Frame-Options)
- CORS strict avec whitelist d'origines
- Mots de passe hashés bcrypt (rounds=10)
- Tokens JWT avec expiration configurable
- Logs d'audit sur toutes les mutations (POST/PUT/DELETE)
- Requêtes SQL paramétrées (protection injection SQL)
