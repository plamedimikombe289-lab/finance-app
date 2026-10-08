const router = require('express').Router();
const { statut, chat, messageJour } = require('../controllers/iaController');

router.get('/statut',       statut);
router.get('/message-jour', messageJour);
router.post('/chat',        chat);

module.exports = router;
