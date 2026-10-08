const Joi = require('joi')
const { CATEGORY_TYPES, VALID_CURRENCY_CODES } = require('../utils/constants')

// ── Middleware factory ─────────────────────────────────────────────────────

/**
 * Crée un middleware Express qui valide req.body contre un schéma Joi.
 * Retourne 400 avec les messages d'erreur concaténés si invalide.
 * @param {Joi.Schema} schema
 */
function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    })
    if (error) {
      const message = error.details.map(d => d.message).join('. ')
      return res.status(400).json({ message })
    }
    req.body = value  // remplace body par la version nettoyée (stripUnknown)
    next()
  }
}

// ── Schémas Auth ───────────────────────────────────────────────────────────

const schemas = {
  register: Joi.object({
    nom:      Joi.string().min(2).max(100).trim().required()
                .messages({ 'any.required': 'Le nom est obligatoire.', 'string.min': 'Le nom doit faire au moins 2 caractères.' }),
    email:    Joi.string().email({ tlds: { allow: true } }).lowercase().trim().required()
                .messages({ 'any.required': "L'email est obligatoire.", 'string.email': 'Email invalide.' }),
    password: Joi.string().min(6).max(128).required()
                .messages({ 'string.min': 'Mot de passe minimum 6 caractères.' }),
  }),

  login: Joi.object({
    email:    Joi.string().email({ tlds: { allow: true } }).required().messages({ 'any.required': 'Email et mot de passe requis.' }),
    password: Joi.string().required().messages({ 'any.required': 'Email et mot de passe requis.' }),
  }),

  forgotPassword: Joi.object({
    email: Joi.string().email({ tlds: { allow: true } }).trim().required().messages({ 'any.required': 'Email requis.' }),
  }),

  resetPassword: Joi.object({
    token:        Joi.string().required().messages({ 'any.required': 'Token requis.' }),
    new_password: Joi.string().min(6).max(128).required()
                    .messages({ 'string.min': 'Mot de passe minimum 6 caractères.' }),
  }),

  changePassword: Joi.object({
    current_password: Joi.string().required(),
    new_password:     Joi.string().min(6).max(128).required()
                        .messages({ 'string.min': 'Nouveau mot de passe minimum 6 caractères.' }),
  }),

  updateDevise: Joi.object({
    devise: Joi.string().uppercase().length(3)
               .valid(...VALID_CURRENCY_CODES).required()
               .messages({
                 'any.only': `Code devise invalide. Codes acceptés : ${VALID_CURRENCY_CODES.join(', ')}.`,
                 'string.length': 'Le code devise doit faire exactement 3 caractères.',
               }),
  }),

  resendVerification: Joi.object({
    email: Joi.string().email({ tlds: { allow: true } }).trim().required().messages({ 'any.required': 'Email requis.' }),
  }),

  // ── Catégories ─────────────────────────────────────────────────────────

  creerCategorie: Joi.object({
    nom:             Joi.string().min(1).max(100).trim().required(),
    type:            Joi.string().valid(...CATEGORY_TYPES).required()
                       .messages({ 'any.only': 'Type invalide (fixe | pourcentage).' }),
    valeur:          Joi.number().min(0).required(),
    couleur:         Joi.string().max(20).default('#6366f1'),
    icone:           Joi.string().max(10).default('💰'),
    ordre:           Joi.number().integer().default(0),
    seuil_alerte:    Joi.number().min(0).allow(null).default(null),
    objectif:        Joi.number().min(0).allow(null).default(null),
    plafond_mensuel: Joi.number().min(0).allow(null).default(null),
  }),

  // ── Revenus ────────────────────────────────────────────────────────────

  creerRevenu: Joi.object({
    montant:     Joi.number().positive().required().messages({ 'number.positive': 'Le montant doit être positif.' }),
    commentaire: Joi.string().min(1).max(255).trim().required()
                   .messages({ 'any.required': 'Le commentaire est obligatoire.' }),
    type:        Joi.string().valid('salaire','freelance','prime','autre').default('autre'),
    date:        Joi.string().isoDate().allow(null, '').default(null),
  }),

  // ── Dépenses ───────────────────────────────────────────────────────────

  creerDepense: Joi.object({
    montant:       Joi.number().positive().required(),
    description:   Joi.string().min(1).max(255).trim().required(),
    categorie_id:  Joi.number().integer().positive().required(),
    date:          Joi.string().isoDate().allow(null, '').default(null),
    compte_id:     Joi.number().integer().positive().allow(null).default(null),
    is_deductible: Joi.boolean().default(false),
    categorie_fiscale: Joi.string().max(100).allow(null, '').default(null),
    notes:         Joi.string().max(1000).allow(null, '').default(null),
  }),
}

module.exports = { validate, schemas }
