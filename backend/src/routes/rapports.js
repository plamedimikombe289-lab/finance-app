const express = require('express');
const router  = express.Router();
const { getDashboard, getBudgetMensuel, getHistorique, getRapportRevenu, getEvolution, getRapportFiscal, getValeurNette, sauvegarderScore, getScoresHistoriques } = require('../controllers/rapportsController');

router.get('/dashboard',        getDashboard);
router.get('/budget-mensuel',   getBudgetMensuel);
router.get('/historique',       getHistorique);
router.get('/evolution',        getEvolution);
router.get('/fiscal',           getRapportFiscal);
router.get('/valeur-nette',     getValeurNette);
router.get('/scores',           getScoresHistoriques);
router.post('/scores',          sauvegarderScore);
router.get('/revenus/:id',      getRapportRevenu);

module.exports = router;
