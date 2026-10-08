const express = require('express');
const router  = express.Router();
const { listerActifs, creerActif, modifierActif, supprimerActif } = require('../controllers/actifsController');

router.get('/',       listerActifs);
router.post('/',      creerActif);
router.put('/:id',    modifierActif);
router.delete('/:id', supprimerActif);

module.exports = router;
