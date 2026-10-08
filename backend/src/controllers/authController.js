const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { pool, transaction } = require('../database/db');
const { generateToken } = require('../middleware/auth');
const { seedDefaultCategories } = require('../database/init');
const logger = require('../utils/logger');
const { envoyerConfirmationChangement, envoyerVerificationEmail, envoyerResetMotDePasse, createTransporter } = require('../services/emailService');

const register = async (req, res, next) => {
  try {
    const { nom, email, password } = req.body;

    if (!nom?.trim())                     return res.status(400).json({ message: 'Le nom est obligatoire.' });
    if (!email?.trim())                   return res.status(400).json({ message: "L'email est obligatoire." });
    if (!password || password.length < 6) return res.status(400).json({ message: 'Mot de passe minimum 6 caractères.' });

    const emailClean = email.toLowerCase().trim();
    const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [emailClean]);
    if (existing[0]) return res.status(409).json({ message: 'Email déjà utilisé.' });

    const hash = await bcrypt.hash(password, 10);
    const smtpActive = !!createTransporter();

    // Si SMTP configuré → compte non vérifié jusqu'à confirmation par email
    const verificationToken   = smtpActive ? crypto.randomBytes(32).toString('hex') : null;
    const verificationExpires = smtpActive ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null;
    const emailVerified       = smtpActive ? 0 : 1;

    let userId;
    await transaction(async (conn) => {
      const [result] = await conn.execute(
        'INSERT INTO users (nom, email, password_hash, role, email_verified, verification_token, verification_expires) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [nom.trim(), emailClean, hash, 'user', emailVerified, verificationToken, verificationExpires]
      );
      userId = result.insertId;
      await seedDefaultCategories(conn, userId);
    });

    if (smtpActive) {
      const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim();
      const verifyUrl   = `${frontendUrl}/verify-email?token=${verificationToken}`;
      try {
        await envoyerVerificationEmail(emailClean, nom.trim(), verifyUrl);
      } catch (smtpErr) {
        logger.error(`[VERIFY EMAIL] Échec envoi pour userId=${userId}: ${smtpErr.message}`);
        // L'email n'a pas pu être envoyé — on supprime le compte créé et on retourne une erreur
        // claire plutôt que d'auto-vérifier (ce qui contournerait la sécurité)
        await pool.execute('DELETE FROM users WHERE id = ?', [userId]);
        return res.status(502).json({
          message: 'Compte créé mais l\'email de vérification n\'a pas pu être envoyé. Réessayez dans quelques instants.',
          smtp_error: true,
        });
      }
      return res.status(201).json({
        needs_verification: true,
        email: emailClean,
        message: 'Compte créé. Vérifiez votre courriel pour activer votre compte.',
      });
    }

    const [rows] = await pool.execute('SELECT id, nom, email, role, actif, devise, onboarding_complete, created_at FROM users WHERE id = ?', [userId]);
    const user = rows[0];
    const token = generateToken({ id: user.id, nom: user.nom, email: user.email, role: user.role });
    res.status(201).json({ user, token });
  } catch (err) { next(err); }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email et mot de passe requis.' });

    const [rows] = await pool.execute(
      'SELECT id, nom, email, password_hash, role, actif, devise, onboarding_complete, email_verified FROM users WHERE email = ?',
      [email.toLowerCase().trim()]
    );
    const user = rows[0];
    if (!user)       return res.status(401).json({ message: 'Identifiants incorrects.' });
    if (!user.actif) return res.status(403).json({ message: 'Compte désactivé. Contactez un administrateur.' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ message: 'Identifiants incorrects.' });

    if (!user.email_verified && user.role !== 'admin') {
      return res.status(403).json({
        message: 'Compte non vérifié. Vérifiez votre courriel ou demandez un nouveau lien.',
        email_non_verifie: true,
        email: user.email,
      });
    }

    const token = generateToken({ id: user.id, nom: user.nom, email: user.email, role: user.role });
    const { password_hash, email_verified, ...safeUser } = user;
    res.json({ user: safeUser, token });
  } catch (err) { next(err); }
};

const me = async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, nom, email, role, actif, devise, onboarding_complete, email_rappels_actif, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Utilisateur introuvable.' });
    res.json(rows[0]);
  } catch (err) { next(err); }
};

const changePassword = async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;
    if (!new_password || new_password.length < 6)
      return res.status(400).json({ message: 'Nouveau mot de passe minimum 6 caractères.' });

    const [rows] = await pool.execute('SELECT email, nom, password_hash FROM users WHERE id = ?', [req.user.id]);
    const valid = await bcrypt.compare(current_password, rows[0].password_hash);
    if (!valid) return res.status(401).json({ message: 'Mot de passe actuel incorrect.' });

    const hash = await bcrypt.hash(new_password, 10);
    await pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);

    // Confirmation email (non-bloquant)
    if (createTransporter()) {
      envoyerConfirmationChangement(rows[0].email, rows[0].nom, 'password').catch(e =>
        logger.error(`[EMAIL CONFIRM] ${e.message}`)
      );
    }

    res.json({ message: 'Mot de passe modifié. Un email de confirmation a été envoyé.' });
  } catch (err) { next(err); }
};

const completerOnboarding = async (req, res, next) => {
  try {
    await pool.execute('UPDATE users SET onboarding_complete = 1 WHERE id = ?', [req.user.id]);
    res.json({ onboarding_complete: true });
  } catch (err) { next(err); }
};

const updateDevise = async (req, res, next) => {
  try {
    const { devise } = req.body;
    if (!devise || devise.length !== 3) return res.status(400).json({ message: 'Code devise invalide (3 lettres).' });
    await pool.execute('UPDATE users SET devise = ? WHERE id = ?', [devise.toUpperCase(), req.user.id]);

    const [rows] = await pool.execute('SELECT email, nom FROM users WHERE id = ?', [req.user.id]);
    if (createTransporter() && rows[0]) {
      envoyerConfirmationChangement(rows[0].email, rows[0].nom, 'devise').catch(e =>
        logger.error(`[EMAIL CONFIRM] ${e.message}`)
      );
    }

    res.json({ devise: devise.toUpperCase() });
  } catch (err) { next(err); }
};

const toggleEmailRappels = async (req, res, next) => {
  try {
    const { actif } = req.body;
    const val = actif ? 1 : 0;
    await pool.execute('UPDATE users SET email_rappels_actif = ? WHERE id = ?', [val, req.user.id]);

    const [rows] = await pool.execute('SELECT email, nom FROM users WHERE id = ?', [req.user.id]);
    if (createTransporter() && rows[0]) {
      envoyerConfirmationChangement(rows[0].email, rows[0].nom, 'email_rappels').catch(e =>
        logger.error(`[EMAIL CONFIRM] ${e.message}`)
      );
    }

    res.json({ email_rappels_actif: val });
  } catch (err) { next(err); }
};

const testerEmailRappels = async (req, res, next) => {
  try {
    const [users] = await pool.execute('SELECT nom, email FROM users WHERE id = ?', [req.user.id]);
    if (!users[0]) return res.status(404).json({ message: 'Utilisateur introuvable.' });

    const { envoyerRappelDettes } = require('../services/emailService');
    const { createTransporter }   = require('../services/emailService');

    if (!createTransporter()) {
      return res.status(503).json({ message: 'SMTP non configuré. Ajoutez SMTP_HOST, SMTP_USER et SMTP_PASS dans le fichier .env.' });
    }

    const [dettes] = await pool.execute(`
      SELECT d.nom, d.montant_restant, d.date_echeance, d.rappel_jours,
             DATEDIFF(d.date_echeance, CURDATE()) AS jours_restants
      FROM dettes d
      WHERE d.actif = 1 AND d.user_id = ? AND d.date_echeance IS NOT NULL
      ORDER BY d.date_echeance ASC LIMIT 3
    `, [req.user.id]);

    const exemples = dettes.length > 0 ? dettes : [{
      nom: 'Carte Visa (exemple)', montant_restant: 1200, date_echeance: new Date(Date.now() + 5*86400000),
      rappel_jours: 7, jours_restants: 5
    }];

    try {
      await envoyerRappelDettes(users[0].email, users[0].nom, exemples);
    } catch (smtpErr) {
      logger.error(`[EMAIL TEST] ${smtpErr.message}`);
      return res.status(502).json({ message: `Échec SMTP : ${smtpErr.message}` });
    }
    res.json({ message: `Email de test envoyé à ${users[0].email}.` });
  } catch (err) { next(err); }
};

const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email?.trim()) return res.status(400).json({ message: 'Email requis.' });

    const [rows] = await pool.execute(
      'SELECT id, nom, email, actif FROM users WHERE email = ?',
      [email.toLowerCase().trim()]
    );

    // Toujours répondre avec succès pour ne pas divulguer si l'email existe
    if (!rows[0] || !rows[0].actif) {
      return res.json({ message: 'Si cet email est associé à un compte, un lien de réinitialisation a été envoyé.' });
    }

    const token   = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 heure

    await pool.execute(
      'UPDATE users SET password_reset_token = ?, password_reset_expires = ? WHERE id = ?',
      [token, expires, rows[0].id]
    );

    if (!createTransporter()) {
      return res.status(503).json({ message: 'SMTP non configuré. Contactez l\'administrateur.' });
    }

    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim();
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    try {
      await envoyerResetMotDePasse(rows[0].email, rows[0].nom, resetUrl);
    } catch (smtpErr) {
      logger.error(`[FORGOT PASSWORD] SMTP error: ${smtpErr.message}`);
      return res.status(502).json({ message: `Échec SMTP : ${smtpErr.message}` });
    }

    res.json({ message: 'Si cet email est associé à un compte, un lien de réinitialisation a été envoyé.' });
  } catch (err) { next(err); }
};

const resetPassword = async (req, res, next) => {
  try {
    const { token, new_password } = req.body;
    if (!token)                                   return res.status(400).json({ message: 'Token requis.' });
    if (!new_password || new_password.length < 6) return res.status(400).json({ message: 'Mot de passe minimum 6 caractères.' });

    const [rows] = await pool.execute(
      'SELECT id, nom, email FROM users WHERE password_reset_token = ? AND password_reset_expires > NOW() AND actif = 1',
      [token]
    );
    if (!rows[0]) return res.status(400).json({ message: 'Lien invalide ou expiré. Veuillez refaire une demande.' });

    const hash = await bcrypt.hash(new_password, 10);
    await pool.execute(
      'UPDATE users SET password_hash = ?, password_reset_token = NULL, password_reset_expires = NULL WHERE id = ?',
      [hash, rows[0].id]
    );

    // Confirmation email
    if (createTransporter()) {
      envoyerConfirmationChangement(rows[0].email, rows[0].nom, 'password').catch(e =>
        logger.error(`[EMAIL CONFIRM] ${e.message}`)
      );
    }

    res.json({ message: 'Mot de passe réinitialisé avec succès. Vous pouvez maintenant vous connecter.' });
  } catch (err) { next(err); }
};

const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ message: 'Token manquant.' });

    const [rows] = await pool.execute(
      'SELECT id, nom, email FROM users WHERE verification_token = ? AND verification_expires > NOW() AND email_verified = 0',
      [token]
    );
    if (!rows[0]) return res.status(400).json({ message: 'Lien invalide ou expiré. Demandez un nouveau lien de vérification.' });

    await pool.execute(
      'UPDATE users SET email_verified = 1, verification_token = NULL, verification_expires = NULL WHERE id = ?',
      [rows[0].id]
    );

    res.json({ message: 'Courriel confirmé. Vous pouvez maintenant vous connecter.' });
  } catch (err) { next(err); }
};

const resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email?.trim()) return res.status(400).json({ message: 'Email requis.' });

    const [rows] = await pool.execute(
      'SELECT id, nom, email, actif, email_verified FROM users WHERE email = ?',
      [email.toLowerCase().trim()]
    );

    // Réponse générique pour éviter l'énumération des comptes
    const generic = { message: 'Si ce compte existe et n\'est pas encore vérifié, un nouveau lien a été envoyé.' };

    if (!rows[0] || !rows[0].actif || rows[0].email_verified) return res.json(generic);

    if (!createTransporter()) {
      return res.status(503).json({ message: 'SMTP non configuré. Contactez l\'administrateur.' });
    }

    const token   = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await pool.execute(
      'UPDATE users SET verification_token = ?, verification_expires = ? WHERE id = ?',
      [token, expires, rows[0].id]
    );

    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim();
    const verifyUrl   = `${frontendUrl}/verify-email?token=${token}`;

    try {
      await envoyerVerificationEmail(rows[0].email, rows[0].nom, verifyUrl);
    } catch (smtpErr) {
      logger.error(`[RESEND VERIFY] ${smtpErr.message}`);
      return res.status(502).json({ message: `Échec SMTP : ${smtpErr.message}` });
    }

    res.json(generic);
  } catch (err) { next(err); }
};

module.exports = { register, login, me, changePassword, updateDevise, completerOnboarding, toggleEmailRappels, testerEmailRappels, forgotPassword, resetPassword, verifyEmail, resendVerification };
