const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  const ts = new Date().toISOString();

  // Violation de contrainte MySQL (CHECK, NOT NULL, UNIQUE, FK)
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ message: 'Cette entrée existe déjà.' });
  }
  if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_ROW_IS_REFERENCED_2') {
    return res.status(400).json({ message: 'Référence invalide ou entrée utilisée ailleurs.' });
  }
  if (err.code === 'ER_DATA_TOO_LONG') {
    return res.status(400).json({ message: 'Valeur trop longue pour ce champ.' });
  }
  if (err.code === 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD') {
    return res.status(400).json({ message: 'Valeur invalide pour ce champ.' });
  }
  if (err.code?.startsWith('ER_CHECK_CONSTRAINT')) {
    return res.status(400).json({ message: 'Valeur hors limites (contrainte de validation).' });
  }

  // Erreur CORS
  if (err.message?.startsWith('Origine non autorisée')) {
    return res.status(403).json({ message: err.message });
  }

  // Erreur de validation métier (levée manuellement avec err.status)
  if (err.status === 400) {
    return res.status(400).json({ message: err.message });
  }

  logger.error(`[${req.method} ${req.path}] ${err.message}`, {
    stack: err.stack,
    userId: req.user?.id ?? null,
    ip: req.ip,
  });
  res.status(500).json({ message: 'Erreur serveur interne.' });
};

module.exports = errorHandler;
