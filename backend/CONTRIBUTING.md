# Contributing — Finance App Backend

## Setup

```bash
cp .env.example .env   # remplir les variables
npm install
npm run dev            # nodemon — rechargement automatique
```

Prérequis : Node ≥ 18, MySQL 8 (ou XAMPP/MariaDB).

## Structure

```
src/
├── controllers/   Un fichier par domaine (authController, revenusController, …)
├── middleware/    auth.js · validate.js · errorHandler.js · audit.js
├── routes/        Un fichier par domaine, monté dans server.js
├── services/      Logique métier réutilisable (repartitionService, emailService, …)
├── database/      db.js (pool) · init.js (CREATE TABLE + seed)
└── utils/         logger.js · constants.js · envValidator.js
```

## Conventions de code

- **Langue des messages API** : français (l'UI est en français).
- **Validation** : toujours via le middleware `validate(schemas.xxx)` — ne pas redoubler dans le contrôleur.
- **Constantes** : ajouter dans `src/utils/constants.js`, pas de "magic numbers" inline.
- **Logs** : utiliser `logger.error/warn/info` (Winston) — pas `console.log` en production.
- **Erreurs** : laisser remonter via `next(err)` au errorHandler global pour les erreurs inattendues.
- **SQL** : requêtes paramétrées uniquement (`pool.execute('... WHERE id = ?', [id])`), jamais de concaténation.

## Tests

```bash
npm test              # Jest (node environment)
npm run test:coverage # Rapport de couverture (seuil : 60 % lignes)
```

- Tests unitaires dans `tests/unit/` — pas de DB réelle, mocker `../database/db`.
- Tests d'intégration dans `tests/integration/` — supertest sur une app express légère sans `initDatabase`.
- Nommer les fichiers `<domaine>.test.js`.

## Ajouter un endpoint

1. Créer ou modifier le contrôleur dans `controllers/`.
2. Ajouter le schéma Joi dans `middleware/validate.js`.
3. Brancher la route + middleware dans `routes/<domaine>.js`.
4. Ajouter un commentaire `@swagger` sur la route.
5. Écrire un test unitaire ou d'intégration.

## Sécurité

- Ne jamais committer `.env` (il est dans `.gitignore`).
- Les tokens JWT expirent selon `JWT_EXPIRES_IN` (défaut 7j).
- Les mots de passe sont hashés avec bcrypt (10 rounds).
- Rate limiting : 180 req/min global, 10 req/15 min sur `/auth/login` et `/auth/register`.
