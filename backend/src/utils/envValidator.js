const logger = require('./logger');

// undefined = not set at all; empty string is valid (e.g. DB_PASSWORD)
const REQUIRED = [
  { key: 'DB_HOST',    desc: 'hôte MySQL' },
  { key: 'DB_USER',   desc: 'utilisateur MySQL' },
  { key: 'DB_NAME',   desc: 'nom de la base de données' },
  { key: 'JWT_SECRET', desc: 'secret JWT (min 32 caractères)' },
];

const RECOMMENDED = [
  { key: 'SMTP_HOST', desc: 'hôte SMTP (rappels email)' },
  { key: 'FRONTEND_URL', desc: 'URL du frontend (CORS)' },
];

function validateEnv() {
  const missing = REQUIRED.filter(v => process.env[v.key] === undefined);

  if (missing.length > 0) {
    logger.error('Variables d\'environnement requises manquantes :');
    missing.forEach(v => logger.error(`  ✗ ${v.key} — ${v.desc}`));
    logger.error('Ajoutez ces variables dans votre fichier .env et relancez le serveur.');
    process.exit(1);
  }

  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    logger.error('JWT_SECRET doit faire au moins 32 caractères pour être sécurisé.');
    process.exit(1);
  }

  const missing_rec = RECOMMENDED.filter(v => !process.env[v.key]);
  if (missing_rec.length > 0) {
    missing_rec.forEach(v => logger.warn(`  ⚠ ${v.key} non défini — ${v.desc}`));
  }
}

module.exports = { validateEnv };
