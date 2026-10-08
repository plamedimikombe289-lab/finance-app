const express = require('express');
const router  = express.Router();
const {
  getStats, listUsers, getUserData,
  updateUser, deleteUser,
  patchUserRevenu, deleteUserRevenu,
  patchUserDette, impersonateUser, verifyUser,
} = require('../controllers/adminController');

// All routes here already have auth + admin applied in server.js

router.get('/stats',                              getStats);
router.get('/users',                              listUsers);
router.get('/users/:userId',                      getUserData);
router.put('/users/:userId',                      updateUser);
router.delete('/users/:userId',                   deleteUser);

router.patch('/users/:userId/revenus/:revenuId',  patchUserRevenu);
router.delete('/users/:userId/revenus/:revenuId', deleteUserRevenu);

router.patch('/users/:userId/dettes/:detteId',    patchUserDette);

router.post('/users/:userId/impersonate',         impersonateUser);
router.post('/users/:userId/verify',             verifyUser);

module.exports = router;
