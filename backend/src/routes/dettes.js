const express = require('express');
const router = express.Router();
const { listerDettes, listerRappels, obtenirDette, creerDette, modifierDette, enregistrerPaiement, supprimerDette, supprimerDefinitivement, planifierRemboursement, listerPlans, sauvegarderPlan, mettreAJourPlan, supprimerPlan } = require('../controllers/dettesController');

router.get('/rappels',           listerRappels);
router.post('/planifier',        planifierRemboursement);
router.get('/plans',             listerPlans);
router.post('/plans',            sauvegarderPlan);
router.put('/plans/:planId',     mettreAJourPlan);
router.delete('/plans/:planId',  supprimerPlan);
router.get('/',                  listerDettes);
router.post('/',                 creerDette);
router.get('/:id',               obtenirDette);
router.put('/:id',               modifierDette);
router.delete('/:id',            supprimerDette);
router.delete('/:id/force',      supprimerDefinitivement);
router.post('/:id/paiement',     enregistrerPaiement);

module.exports = router;
