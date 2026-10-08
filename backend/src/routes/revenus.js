const express = require('express');
const router = express.Router();
const { creerRevenu, listerRevenus, obtenirRevenu, supprimerRevenu, restaurerRevenu, supprimerRevenuDefinitif, redistribuerTout } = require('../controllers/revenusController');

router.get('/',                       listerRevenus);
router.post('/',                      creerRevenu);
router.post('/redistribuer',          redistribuerTout);
router.get('/:id',                    obtenirRevenu);
router.delete('/:id',                 supprimerRevenu);
router.post('/:id/restaurer',         restaurerRevenu);
router.delete('/:id/definitif',       supprimerRevenuDefinitif);

module.exports = router;
