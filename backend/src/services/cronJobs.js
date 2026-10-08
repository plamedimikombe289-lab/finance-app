const cron   = require('node-cron');
const { pool } = require('../database/db');
const { envoyerRappelDettes } = require('./emailService');
const logger = require('../utils/logger');

function startCronJobs() {
  cron.schedule('0 8 * * *', async () => {
    logger.info('[CRON] Envoi des rappels de dettes...');
    try {
      const [users] = await pool.execute(
        'SELECT id, nom, email FROM users WHERE actif = 1 AND email_rappels_actif = 1'
      );

      let totalEnvoyes = 0;
      for (const user of users) {
        const [dettes] = await pool.execute(`
          SELECT d.nom, d.montant_restant, d.date_echeance, d.rappel_jours,
                 DATEDIFF(d.date_echeance, CURDATE()) AS jours_restants
          FROM dettes d
          WHERE d.actif = 1
            AND d.user_id = ?
            AND d.date_echeance IS NOT NULL
            AND DATEDIFF(d.date_echeance, CURDATE()) <= d.rappel_jours
            AND DATEDIFF(d.date_echeance, CURDATE()) >= 0
          ORDER BY d.date_echeance ASC
        `, [user.id]);

        if (dettes.length === 0) continue;

        try {
          const sent = await envoyerRappelDettes(user.email, user.nom, dettes);
          if (sent) totalEnvoyes++;
        } catch (emailErr) {
          logger.error(`[CRON] Erreur envoi email pour ${user.email}: ${emailErr.message}`);
        }
      }
      logger.info(`[CRON] Rappels envoyés à ${totalEnvoyes}/${users.length} utilisateur(s).`);
    } catch (err) {
      logger.error(`[CRON] Erreur cron dettes: ${err.message}`);
    }
  });

  logger.info('[CRON] Tâches planifiées démarrées (rappels dettes à 8h00 chaque jour).');
}

module.exports = { startCronJobs };
