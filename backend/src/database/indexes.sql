-- Indexes de performance — à exécuter une seule fois en production
-- Ces indexes couvrent les requêtes les plus fréquentes de l'application

-- ── users ────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_email       ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role_actif  ON users(role, actif);

-- ── revenus ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_revenus_user_date        ON revenus(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_revenus_user_deleted     ON revenus(user_id, deleted_at);

-- ── repartitions ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_repartitions_revenu      ON repartitions(revenu_id);
CREATE INDEX IF NOT EXISTS idx_repartitions_categorie   ON repartitions(categorie_id);

-- ── categories ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_categories_user_actif    ON categories(user_id, actif);
CREATE INDEX IF NOT EXISTS idx_categories_user_ordre    ON categories(user_id, ordre);

-- ── soldes_categories ────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_soldes_categorie         ON soldes_categories(categorie_id);

-- ── depenses ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_depenses_user_date       ON depenses(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_depenses_user_deleted    ON depenses(user_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_depenses_categorie       ON depenses(categorie_id);
CREATE INDEX IF NOT EXISTS idx_depenses_deductible      ON depenses(user_id, is_deductible, date);

-- ── dettes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_dettes_user_actif        ON dettes(user_id, actif);
CREATE INDEX IF NOT EXISTS idx_dettes_echeance          ON dettes(user_id, date_echeance);

-- ── audit_logs ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_audit_user_ts            ON audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_table_record       ON audit_logs(table_name, record_id);
