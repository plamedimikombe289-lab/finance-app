const express = require('express');
const router  = express.Router();
const { listerCorbeille } = require('../controllers/corbeilleController');

router.get('/', listerCorbeille);

module.exports = router;
