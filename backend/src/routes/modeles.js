const express = require('express');
const router = express.Router();
const { listerModeles, creerModele, utiliserModele, supprimerModele } = require('../controllers/modelesController');

router.get('/',                  listerModeles);
router.post('/',                 creerModele);
router.post('/:id/utiliser',     utiliserModele);
router.delete('/:id',            supprimerModele);

module.exports = router;
