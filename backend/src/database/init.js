const mysql  = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { pool } = require('./db');
const logger = require('../utils/logger');

async function initDatabase() {
  const tempConn = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '3306'),
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || ''
  });
  await tempConn.execute(
    `CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME || 'finance_db'}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await tempConn.end();

  const conn = await pool.getConnection();
  try {
    // ── Users (must be created first — referenced by FK) ──────────────────
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        nom           VARCHAR(100)  NOT NULL,
        email         VARCHAR(150)  NOT NULL UNIQUE,
        password_hash VARCHAR(255)  NOT NULL,
        role          ENUM('admin','user') NOT NULL DEFAULT 'user',
        actif         TINYINT(1)    NOT NULL DEFAULT 1,
        created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ── Comptes bancaires (liquid accounts) ───────────────────────────────
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS comptes (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        user_id    INT           NOT NULL,
        nom        VARCHAR(150)  NOT NULL,
        type       ENUM('cheque','epargne','credit','autre') NOT NULL DEFAULT 'cheque',
        solde      DECIMAL(12,2) NOT NULL DEFAULT 0,
        limite     DECIMAL(12,2) DEFAULT NULL,
        couleur    VARCHAR(20)   NOT NULL DEFAULT '#6366f1',
        actif      TINYINT(1)   NOT NULL DEFAULT 1,
        created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // ── Core tables ────────────────────────────────────────────────────────
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS categories (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        user_id    INT            NOT NULL,
        nom        VARCHAR(100)   NOT NULL,
        type       ENUM('pourcentage','fixe') NOT NULL,
        valeur     DECIMAL(10,2)  NOT NULL CHECK(valeur >= 0),
        couleur    VARCHAR(20)    NOT NULL DEFAULT '#6366f1',
        icone      VARCHAR(10)    NOT NULL DEFAULT '💰',
        ordre      INT            NOT NULL DEFAULT 0,
        actif      TINYINT(1)     NOT NULL DEFAULT 1,
        created_at DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS revenus (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        user_id     INT            NOT NULL,
        montant     DECIMAL(10,2)  NOT NULL CHECK(montant > 0),
        commentaire TEXT           NOT NULL,
        type        VARCHAR(50)    NOT NULL DEFAULT 'salaire',
        date        DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS dettes (
        id               INT AUTO_INCREMENT PRIMARY KEY,
        user_id          INT            NOT NULL,
        nom              VARCHAR(150)   NOT NULL,
        type             VARCHAR(50)    NOT NULL DEFAULT 'autre',
        montant_total    DECIMAL(10,2)  NOT NULL CHECK(montant_total > 0),
        montant_restant  DECIMAL(10,2)  NOT NULL CHECK(montant_restant >= 0),
        paiement_minimum DECIMAL(10,2)  NOT NULL DEFAULT 0,
        priorite         TINYINT        NOT NULL DEFAULT 2,
        actif            TINYINT(1)     NOT NULL DEFAULT 1,
        created_at       DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS soldes_categories (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        categorie_id INT           NOT NULL UNIQUE,
        solde        DECIMAL(10,2) NOT NULL DEFAULT 0,
        updated_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (categorie_id) REFERENCES categories(id) ON DELETE CASCADE
      )
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS repartitions (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        revenu_id    INT           NOT NULL,
        categorie_id INT           NOT NULL,
        montant      DECIMAL(10,2) NOT NULL,
        date         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (revenu_id)    REFERENCES revenus(id)    ON DELETE CASCADE,
        FOREIGN KEY (categorie_id) REFERENCES categories(id) ON DELETE RESTRICT
      )
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS paiements_dettes (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        dette_id    INT           NOT NULL,
        montant     DECIMAL(10,2) NOT NULL CHECK(montant > 0),
        commentaire TEXT,
        revenu_id   INT           DEFAULT NULL,
        date        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (dette_id)  REFERENCES dettes(id)  ON DELETE RESTRICT,
        FOREIGN KEY (revenu_id) REFERENCES revenus(id) ON DELETE SET NULL
      )
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS depenses (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        user_id      INT           NOT NULL,
        categorie_id INT           DEFAULT NULL,
        montant      DECIMAL(10,2) NOT NULL CHECK(montant > 0),
        commentaire  TEXT          NOT NULL,
        date         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id)      REFERENCES users(id)      ON DELETE CASCADE,
        FOREIGN KEY (categorie_id) REFERENCES categories(id) ON DELETE SET NULL
      )
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS modeles_revenus (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        user_id       INT           NOT NULL,
        montant       DECIMAL(10,2) NOT NULL CHECK(montant > 0),
        commentaire   VARCHAR(255)  NOT NULL,
        type          VARCHAR(50)   NOT NULL DEFAULT 'salaire',
        recurrence    ENUM('mensuel','bi-mensuel','hebdomadaire') NOT NULL DEFAULT 'mensuel',
        prochaine_date DATE         NOT NULL,
        actif         TINYINT(1)   NOT NULL DEFAULT 1,
        created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS modeles_depenses (
        id                INT AUTO_INCREMENT PRIMARY KEY,
        user_id           INT           NOT NULL,
        montant           DECIMAL(10,2) NOT NULL CHECK(montant > 0),
        commentaire       VARCHAR(255)  NOT NULL,
        categorie_id      INT           DEFAULT NULL,
        recurrence        ENUM('mensuel','bi-mensuel','hebdomadaire') NOT NULL DEFAULT 'mensuel',
        prochaine_date    DATE          NOT NULL,
        is_deductible     TINYINT(1)    NOT NULL DEFAULT 0,
        deductible_pct    DECIMAL(5,2)  NOT NULL DEFAULT 100,
        categorie_fiscale VARCHAR(50)   DEFAULT NULL,
        actif             TINYINT(1)    NOT NULL DEFAULT 1,
        created_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id)      REFERENCES users(id)      ON DELETE CASCADE,
        FOREIGN KEY (categorie_id) REFERENCES categories(id) ON DELETE SET NULL
      )
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS actifs (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        user_id    INT           NOT NULL,
        nom        VARCHAR(150)  NOT NULL,
        type       ENUM('compte_bancaire','investissement','immobilier','vehicule','autre') NOT NULL DEFAULT 'autre',
        valeur     DECIMAL(12,2) NOT NULL DEFAULT 0,
        date_maj   DATE          NOT NULL DEFAULT (CURRENT_DATE),
        actif      TINYINT(1)    NOT NULL DEFAULT 1,
        created_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS scores_historiques (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        user_id    INT            NOT NULL,
        score      TINYINT UNSIGNED NOT NULL,
        mois       CHAR(7)        NOT NULL,
        created_at DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_user_mois (user_id, mois),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS virements_comptes (
        id              INT AUTO_INCREMENT PRIMARY KEY,
        user_id         INT           NOT NULL,
        from_compte_id  INT           NOT NULL,
        to_compte_id    INT           NOT NULL,
        montant         DECIMAL(12,2) NOT NULL CHECK(montant > 0),
        commentaire     VARCHAR(255)  DEFAULT NULL,
        date            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id)        REFERENCES users(id)   ON DELETE CASCADE,
        FOREIGN KEY (from_compte_id) REFERENCES comptes(id) ON DELETE CASCADE,
        FOREIGN KEY (to_compte_id)   REFERENCES comptes(id) ON DELETE CASCADE
      )
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS virements_categories (
        id                INT AUTO_INCREMENT PRIMARY KEY,
        user_id           INT           NOT NULL,
        from_categorie_id INT           NOT NULL,
        to_categorie_id   INT           NOT NULL,
        montant           DECIMAL(10,2) NOT NULL CHECK(montant > 0),
        commentaire       VARCHAR(255)  DEFAULT NULL,
        date              DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id)           REFERENCES users(id)      ON DELETE CASCADE,
        FOREIGN KEY (from_categorie_id) REFERENCES categories(id) ON DELETE CASCADE,
        FOREIGN KEY (to_categorie_id)   REFERENCES categories(id) ON DELETE CASCADE
      )
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        user_id    INT          DEFAULT NULL,
        action     VARCHAR(100) NOT NULL,
        table_name VARCHAR(50)  DEFAULT NULL,
        record_id  INT          DEFAULT NULL,
        payload    JSON         DEFAULT NULL,
        ip         VARCHAR(45)  DEFAULT NULL,
        created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_audit_user (user_id),
        INDEX idx_audit_created (created_at)
      )
    `);

    // ── Index pour les performances ────────────────────────────────────────
    const indexes = [
      { name: 'idx_revenus_user_deleted',   sql: 'CREATE INDEX idx_revenus_user_deleted   ON revenus  (user_id, deleted_at)' },
      { name: 'idx_revenus_user_date',      sql: 'CREATE INDEX idx_revenus_user_date      ON revenus  (user_id, date)' },
      { name: 'idx_depenses_user_deleted',  sql: 'CREATE INDEX idx_depenses_user_deleted  ON depenses (user_id, deleted_at)' },
      { name: 'idx_depenses_user_cat',      sql: 'CREATE INDEX idx_depenses_user_cat      ON depenses (user_id, categorie_id)' },
      { name: 'idx_depenses_user_date',     sql: 'CREATE INDEX idx_depenses_user_date     ON depenses (user_id, date)' },
      { name: 'idx_dettes_user_actif',      sql: 'CREATE INDEX idx_dettes_user_actif      ON dettes   (user_id, actif)' },
      { name: 'idx_dettes_echeance',        sql: 'CREATE INDEX idx_dettes_echeance        ON dettes   (date_echeance)' },
      { name: 'idx_categories_user_actif',  sql: 'CREATE INDEX idx_categories_user_actif  ON categories (user_id, actif)' },
      { name: 'idx_repartitions_revenu',    sql: 'CREATE INDEX idx_repartitions_revenu    ON repartitions (revenu_id)' },
      { name: 'idx_repartitions_categorie', sql: 'CREATE INDEX idx_repartitions_categorie ON repartitions (categorie_id)' },
    ];
    for (const idx of indexes) {
      try { await conn.execute(idx.sql); } catch { /* index already exists */ }
    }

    // ── Migration : add user_id to legacy tables that may not have it ──────
    const migrations = [
      { col: 'user_id', table: 'categories', sql: 'ALTER TABLE categories ADD COLUMN user_id INT NOT NULL DEFAULT 1' },
      { col: 'user_id', table: 'revenus',    sql: 'ALTER TABLE revenus    ADD COLUMN user_id INT NOT NULL DEFAULT 1' },
      { col: 'user_id', table: 'dettes',     sql: 'ALTER TABLE dettes     ADD COLUMN user_id INT NOT NULL DEFAULT 1' },
      { col: 'user_id', table: 'depenses',   sql: 'ALTER TABLE depenses   ADD COLUMN user_id INT NOT NULL DEFAULT 1' },
      { col: 'devise',        table: 'users',  sql: "ALTER TABLE users ADD COLUMN devise VARCHAR(3) NOT NULL DEFAULT 'CAD'" },
      { col: 'sens',          table: 'dettes', sql: "ALTER TABLE dettes ADD COLUMN sens ENUM('je_dois','on_me_doit') NOT NULL DEFAULT 'je_dois'" },
      { col: 'date_echeance', table: 'dettes', sql: 'ALTER TABLE dettes ADD COLUMN date_echeance DATE NULL' },
      { col: 'rappel_jours',        table: 'dettes',      sql: 'ALTER TABLE dettes ADD COLUMN rappel_jours INT NOT NULL DEFAULT 7' },
      { col: 'seuil_alerte',        table: 'categories',  sql: 'ALTER TABLE categories ADD COLUMN seuil_alerte DECIMAL(10,2) DEFAULT NULL' },
      { col: 'objectif',            table: 'categories',  sql: 'ALTER TABLE categories ADD COLUMN objectif DECIMAL(10,2) DEFAULT NULL' },
      { col: 'onboarding_complete', table: 'users',       sql: 'ALTER TABLE users ADD COLUMN onboarding_complete TINYINT(1) NOT NULL DEFAULT 0' },
      { col: 'fichier_nom',         table: 'depenses',    sql: 'ALTER TABLE depenses ADD COLUMN fichier_nom       VARCHAR(255)  DEFAULT NULL' },
      { col: 'fichier_stocke',      table: 'depenses',    sql: 'ALTER TABLE depenses ADD COLUMN fichier_stocke    VARCHAR(255)  DEFAULT NULL' },
      { col: 'is_deductible',       table: 'depenses',    sql: 'ALTER TABLE depenses ADD COLUMN is_deductible     TINYINT(1)   NOT NULL DEFAULT 0' },
      { col: 'deductible_pct',      table: 'depenses',    sql: 'ALTER TABLE depenses ADD COLUMN deductible_pct    DECIMAL(5,2) NOT NULL DEFAULT 100' },
      { col: 'categorie_fiscale',   table: 'depenses',    sql: 'ALTER TABLE depenses ADD COLUMN categorie_fiscale VARCHAR(50)   DEFAULT NULL' },
      { col: 'source',              table: 'revenus',     sql: 'ALTER TABLE revenus  ADD COLUMN source            VARCHAR(150)  DEFAULT NULL' },
      { col: 'taux_interet',  table: 'dettes',   sql: 'ALTER TABLE dettes   ADD COLUMN taux_interet  DECIMAL(5,2)  DEFAULT NULL' },
      { col: 'compte_id',    table: 'revenus',  sql: 'ALTER TABLE revenus  ADD COLUMN compte_id    INT           DEFAULT NULL' },
      { col: 'compte_id',    table: 'depenses', sql: 'ALTER TABLE depenses ADD COLUMN compte_id    INT           DEFAULT NULL' },
      { col: 'compte_id',    table: 'dettes',   sql: 'ALTER TABLE dettes   ADD COLUMN compte_id    INT           DEFAULT NULL' },
      { col: 'limite',          table: 'comptes',    sql: 'ALTER TABLE comptes    ADD COLUMN limite          DECIMAL(12,2) DEFAULT NULL' },
      { col: 'plafond_mensuel', table: 'categories', sql: 'ALTER TABLE categories ADD COLUMN plafond_mensuel DECIMAL(10,2) DEFAULT NULL' },
      { col: 'deleted_at', table: 'revenus',  sql: 'ALTER TABLE revenus  ADD COLUMN deleted_at DATETIME DEFAULT NULL' },
      { col: 'deleted_at', table: 'depenses', sql: 'ALTER TABLE depenses ADD COLUMN deleted_at DATETIME DEFAULT NULL' },
      { col: 'email_rappels_actif',   table: 'users', sql: 'ALTER TABLE users ADD COLUMN email_rappels_actif   TINYINT(1)   NOT NULL DEFAULT 0' },
      { col: 'password_reset_token',   table: 'users', sql: 'ALTER TABLE users ADD COLUMN password_reset_token   VARCHAR(64)  DEFAULT NULL' },
      { col: 'password_reset_expires', table: 'users', sql: 'ALTER TABLE users ADD COLUMN password_reset_expires DATETIME     DEFAULT NULL' },
      { col: 'email_verified',         table: 'users', sql: 'ALTER TABLE users ADD COLUMN email_verified         TINYINT(1)   NOT NULL DEFAULT 0' },
      { col: 'verification_token',     table: 'users', sql: 'ALTER TABLE users ADD COLUMN verification_token     VARCHAR(64)  DEFAULT NULL' },
      { col: 'verification_expires',   table: 'users', sql: 'ALTER TABLE users ADD COLUMN verification_expires   DATETIME     DEFAULT NULL' },
    ];
    for (const m of migrations) {
      try { await conn.execute(m.sql); } catch { /* column already exists */ }
    }

    // ── Seed default admin if no users exist ──────────────────────────────
    const [users] = await conn.execute('SELECT COUNT(*) as n FROM users');
    if (users[0].n === 0) {
      const hash = await bcrypt.hash('Admin123!', 10);
      const [result] = await conn.execute(
        "INSERT INTO users (nom, email, password_hash, role, email_verified) VALUES ('Administrateur', 'admin@finance.local', ?, 'admin', 1)",
        [hash]
      );
      const adminId = result.insertId;

      // Assign any pre-existing rows to admin
      await conn.execute('UPDATE categories SET user_id = ? WHERE user_id = 1 OR user_id IS NULL', [adminId]);
      await conn.execute('UPDATE revenus    SET user_id = ? WHERE user_id = 1 OR user_id IS NULL', [adminId]);
      await conn.execute('UPDATE dettes     SET user_id = ? WHERE user_id = 1 OR user_id IS NULL', [adminId]);
      await conn.execute('UPDATE depenses   SET user_id = ? WHERE user_id = 1 OR user_id IS NULL', [adminId]);

      // Seed default categories for admin if none exist
      const [cats] = await conn.execute('SELECT COUNT(*) as n FROM categories WHERE user_id = ?', [adminId]);
      if (cats[0].n === 0) {
        await seedDefaultCategories(conn, adminId);
      }

      logger.info('Compte admin créé → admin@finance.local / Admin123!');
    }

    logger.info('Base de données MySQL initialisée.');
  } finally {
    conn.release();
  }
}

async function seedDefaultCategories(conn, userId) {
  const defaults = [
    ['Loyer',           'fixe',        800,  '#ef4444', '🏠', 1],
    ['Dettes',          'pourcentage',  20,  '#f97316', '💳', 2],
    ['Épargne',         'pourcentage',  10,  '#22c55e', '🏦', 3],
    ['Provisions',      'pourcentage',  10,  '#3b82f6', '🛒', 4],
    ['Imprévus',        'pourcentage',   5,  '#a855f7', '🆘', 5],
    ['Argent de poche', 'pourcentage',  15,  '#eab308', '👜', 6],
  ];
  for (const d of defaults) {
    await conn.execute(
      'INSERT INTO categories (user_id, nom, type, valeur, couleur, icone, ordre) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userId, ...d]
    );
  }
}

module.exports = { initDatabase, seedDefaultCategories };
