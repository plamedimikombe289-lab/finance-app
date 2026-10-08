const express = require('express');
const router  = express.Router();
const upload  = require('../middleware/upload');
const { listerDepenses, creerDepense, supprimerDepense, restaurerDepense, supprimerDepenseDefinitif, getFichier, suggererCategorie } = require('../controllers/depensesController');

router.get('/suggestion',       suggererCategorie);
router.get('/',                 listerDepenses);
router.post('/',                upload.single('fichier'), creerDepense);
router.delete('/:id',           supprimerDepense);
router.post('/:id/restaurer',   restaurerDepense);
router.delete('/:id/definitif', supprimerDepenseDefinitif);
router.get('/:id/fichier',      getFichier);

module.exports = router;
