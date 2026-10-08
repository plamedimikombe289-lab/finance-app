require('dotenv').config();
const { validateEnv } = require('./utils/envValidator');
validateEnv();
const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const compression  = require('compression');
const rateLimit    = require('express-rate-limit');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi    = require('swagger-ui-express');
const { initDatabase }  = require('./database/init');
const { startCronJobs } = require('./services/cronJobs');
const { auth, admin }       = require('./middleware/auth');
const errorHandler          = require('./middleware/errorHandler');
const { auditMiddleware }   = require('./middleware/audit');
const logger                = require('./utils/logger');

const app = express();

// ── Swagger / OpenAPI ─────────────────────────────────────────────────────
const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Finance App API',
      version: '2.0.0',
      description: 'API de gestion financière personnelle — revenus, catégories, dépenses, dettes.',
    },
    servers: [{ url: '/api', description: 'Serveur local' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/routes/*.js'],
});
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { explorer: true }));
app.get('/api/docs.json', (req, res) => res.json(swaggerSpec));

// ── Compression gzip ──────────────────────────────────────────────────────
app.use(compression({ threshold: 1024 }));

// ── Sécurité : headers HTTP ───────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // pour servir les fichiers uploadés
}));

// ── CORS ──────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: (origin, cb) => {
    // Autorise les requêtes sans origine (Postman, mobile apps)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`Origine non autorisée: ${origin}`));
  },
  credentials: true,
}));

app.use(express.json({ limit: '2mb' }));
app.set('trust proxy', 1);

// ── Rate limiting global ───────────────────────────────────────────────────
app.use('/api', rateLimit({
  windowMs: 60 * 1000,
  max: 180,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Trop de requêtes. Réessayez dans une minute.' },
}));

// ── Rate limiting strict sur l'authentification (anti brute-force) ────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.' },
  skipSuccessfulRequests: true,
});
app.use('/api/auth/login',    authLimiter);
app.use('/api/auth/register', authLimiter);

// ── Routes publiques ───────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));

// ── Routes protégées (JWT requis) ─────────────────────────────────────────
// auth + auditMiddleware run once for all /api/* routes after /api/auth
const protected_ = [auth, auditMiddleware];
app.use('/api/revenus',          ...protected_, require('./routes/revenus'));
app.use('/api/modeles',          ...protected_, require('./routes/modeles'));
app.use('/api/categories',       ...protected_, require('./routes/categories'));
app.use('/api/dettes',           ...protected_, require('./routes/dettes'));
app.use('/api/depenses',         ...protected_, require('./routes/depenses'));
app.use('/api/rapports',         ...protected_, require('./routes/rapports'));
app.use('/api/actifs',           ...protected_, require('./routes/actifs'));
app.use('/api/modeles-depenses', ...protected_, require('./routes/modeles-depenses'));
app.use('/api/comptes',          ...protected_, require('./routes/comptes'));
app.use('/api/corbeille',        ...protected_, require('./routes/corbeille'));
app.use('/api/motivations',      ...protected_, require('./routes/motivations'));
app.use('/api/ia',               ...protected_, require('./routes/ia'));

// ── Routes admin (JWT + rôle admin) ───────────────────────────────────────
app.use('/api/admin', ...protected_, admin, require('./routes/admin'));

// ── Racine & healthcheck ───────────────────────────────────────────────────
app.get('/', (req, res) => res.json({ message: 'Finance App API v2.0', status: 'ok' }));
app.get('/api/health', async (req, res) => {
  try {
    await require('./database/db').pool.execute('SELECT 1');
    res.json({ status: 'ok', db: 'up', uptime: Math.floor(process.uptime()), ts: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'error', db: 'down', ts: new Date().toISOString() });
  }
});

app.use((req, res) => res.status(404).json({ message: 'Route introuvable.' }));
app.use(errorHandler);

const PORT = process.env.PORT || 5001;

initDatabase()
  .then(() => {
    app.listen(PORT, () => logger.info(`Finance API v2 démarrée sur le port ${PORT}`));
    startCronJobs();
  })
  .catch(err => { logger.error(`Erreur init DB: ${err.message}`); process.exit(1); });
