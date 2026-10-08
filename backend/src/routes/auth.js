/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentification et gestion du compte utilisateur
 *
 * /auth/register:
 *   post:
 *     summary: Créer un compte
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nom, email, password]
 *             properties:
 *               nom:      { type: string, minLength: 2 }
 *               email:    { type: string, format: email }
 *               password: { type: string, minLength: 6 }
 *     responses:
 *       201: { description: Compte créé }
 *       400: { description: Validation échouée }
 *       409: { description: Email déjà utilisé }
 *
 * /auth/login:
 *   post:
 *     summary: Se connecter
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:    { type: string }
 *               password: { type: string }
 *     responses:
 *       200: { description: Token JWT retourné }
 *       401: { description: Identifiants incorrects }
 *
 * /auth/me:
 *   get:
 *     summary: Profil de l'utilisateur connecté
 *     tags: [Auth]
 *     responses:
 *       200: { description: Données utilisateur }
 *
 * /auth/forgot-password:
 *   post:
 *     summary: Demander un lien de réinitialisation
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200: { description: Email envoyé (réponse générique) }
 */
const express = require('express');
const router  = express.Router();
const {
  register, login, me, changePassword, updateDevise,
  completerOnboarding, toggleEmailRappels, testerEmailRappels,
  forgotPassword, resetPassword, verifyEmail, resendVerification,
} = require('../controllers/authController');
const { auth } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');

// Public
router.post('/register',            validate(schemas.register),            register);
router.post('/login',               validate(schemas.login),               login);
router.post('/forgot-password',     validate(schemas.forgotPassword),      forgotPassword);
router.post('/reset-password',      validate(schemas.resetPassword),       resetPassword);
router.get('/verify-email',         verifyEmail);
router.post('/resend-verification', validate(schemas.resendVerification),  resendVerification);

// Protected
router.get('/me',                  auth, me);
router.put('/password',            auth, validate(schemas.changePassword), changePassword);
router.put('/devise',              auth, validate(schemas.updateDevise),   updateDevise);
router.post('/onboarding',         auth, completerOnboarding);
router.patch('/email-rappels',     auth, toggleEmailRappels);
router.post('/email-rappels/test', auth, testerEmailRappels);

module.exports = router;
