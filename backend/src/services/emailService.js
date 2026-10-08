const nodemailer = require('nodemailer');

function createTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    tls:  { rejectUnauthorized: process.env.NODE_ENV === 'production' },
  });
}

async function envoyerRappelDettes(email, nom, dettes) {
  const transporter = createTransporter();
  if (!transporter) return false;

  const lignes = dettes.map(d => {
    const restant = parseFloat(d.montant_restant).toFixed(2);
    const echeance = d.date_echeance
      ? new Date(d.date_echeance).toLocaleDateString('fr-FR')
      : 'N/A';
    const jours = d.jours_restants !== null ? `${d.jours_restants}j` : '';
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${d.nom}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${restant} $</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${echeance}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:${d.jours_restants <= 3 ? '#dc2626' : '#d97706'};">${jours}</td>
    </tr>`;
  }).join('');

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#111827;">
  <div style="background:#4f46e5;padding:20px 24px;border-radius:8px 8px 0 0;">
    <h1 style="color:white;margin:0;font-size:20px;">💳 Rappel de dettes — FinanceApp</h1>
  </div>
  <div style="background:#f9fafb;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb;border-top:none;">
    <p>Bonjour <strong>${nom}</strong>,</p>
    <p>Voici les dettes dont l'échéance approche :</p>
    <table style="width:100%;border-collapse:collapse;background:white;border-radius:6px;overflow:hidden;border:1px solid #e5e7eb;">
      <thead>
        <tr style="background:#f3f4f6;">
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;">Dette</th>
          <th style="padding:10px 12px;text-align:right;font-size:12px;color:#6b7280;">Restant</th>
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;">Échéance</th>
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;">Délai</th>
        </tr>
      </thead>
      <tbody>${lignes}</tbody>
    </table>
    <p style="margin-top:20px;font-size:13px;color:#6b7280;">
      Connectez-vous à FinanceApp pour gérer vos paiements.<br>
      Pour désactiver ces rappels : Paramètres → Rappels par email.
    </p>
  </div>
</body>
</html>`;

  await transporter.sendMail({
    from:    process.env.SMTP_FROM || process.env.SMTP_USER,
    to:      email,
    subject: `💳 ${dettes.length} dette(s) à échéance proche — FinanceApp`,
    html,
  });
  return true;
}

async function envoyerConfirmationChangement(email, nom, typeChangement) {
  const transporter = createTransporter();
  if (!transporter) return false;

  const messages = {
    // Compte
    password:        { titre: '🔒 Mot de passe modifié',              corps: 'Votre mot de passe a été modifié avec succès.' },
    devise:          { titre: '💱 Devise mise à jour',                 corps: 'Votre devise d\'affichage a été modifiée.' },
    email_rappels:   { titre: '🔔 Préférences email mises à jour',     corps: 'Vos préférences de rappels par email ont été modifiées.' },
    profil:          { titre: '👤 Profil mis à jour',                  corps: 'Les informations de votre profil ont été mises à jour.' },
    // Opérations financières — aucune donnée sensible dans le corps
    revenu_ajoute:   { titre: '💰 Nouveau revenu enregistré',          corps: 'Un nouveau revenu a été ajouté à votre compte.' },
    revenu_supprime: { titre: '💰 Revenu supprimé',                    corps: 'Un revenu a été supprimé de votre compte.' },
    depense_ajoutee: { titre: '🛒 Nouvelle dépense enregistrée',       corps: 'Une nouvelle dépense a été ajoutée à votre compte.' },
    depense_supprimee:{ titre:'🛒 Dépense supprimée',                  corps: 'Une dépense a été supprimée de votre compte.' },
    dette_ajoutee:   { titre: '💳 Nouvelle dette enregistrée',         corps: 'Une nouvelle dette a été ajoutée à votre compte.' },
    dette_modifiee:  { titre: '💳 Dette modifiée',                     corps: 'Une dette de votre compte a été modifiée.' },
    dette_supprimee: { titre: '💳 Dette supprimée',                    corps: 'Une dette a été supprimée de votre compte.' },
    paiement_dette:  { titre: '✅ Paiement enregistré',                corps: 'Un paiement a été enregistré sur votre compte.' },
    compte_modifie:  { titre: '🏦 Compte bancaire modifié',            corps: 'Un compte bancaire a été modifié sur votre profil.' },
  };

  const { titre, corps } = messages[typeChangement] || messages.profil;
  const ts = new Date().toLocaleString('fr-FR', { timeZone: 'America/Toronto' });

  // Les actions sur le compte (sécurité) affichent un avertissement plus fort
  const estActionSecurite = ['password', 'devise', 'email_rappels', 'profil'].includes(typeChangement);

  const avertissement = estActionSecurite
    ? `<p style="color:#dc2626;font-size:13px;">
        Si vous n'êtes pas à l'origine de cette modification, changez immédiatement votre mot de passe et contactez le support.
      </p>`
    : `<p style="font-size:13px;color:#6b7280;">
        Si vous n'êtes pas à l'origine de cette action, connectez-vous à votre compte et signalez-le.
      </p>`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#111827;">
  <div style="background:#4f46e5;padding:20px 24px;border-radius:8px 8px 0 0;">
    <h1 style="color:white;margin:0;font-size:20px;">💼 FinanceApp — Notification</h1>
  </div>
  <div style="background:#f9fafb;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb;border-top:none;">
    <p>Bonjour <strong>${nom}</strong>,</p>
    <p>${corps}</p>
    <div style="background:white;border:1px solid #e5e7eb;border-radius:6px;padding:16px;margin:16px 0;">
      <p style="margin:0;font-size:13px;color:#6b7280;">
        <strong>Action :</strong> ${titre}<br>
        <strong>Date :</strong> ${ts}<br>
        <strong>Compte :</strong> ${email}
      </p>
    </div>
    ${avertissement}
    <p style="font-size:12px;color:#9ca3af;margin-top:20px;">
      Cet email a été envoyé automatiquement par FinanceApp. Ne pas répondre.
    </p>
  </div>
</body>
</html>`;

  await transporter.sendMail({
    from:    process.env.SMTP_FROM || process.env.SMTP_USER,
    to:      email,
    subject: `${titre} — FinanceApp`,
    html,
  });
  return true;
}

async function envoyerVerificationEmail(email, nom, verifyUrl) {
  const transporter = createTransporter();
  if (!transporter) return false;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#111827;">
  <div style="background:#4f46e5;padding:20px 24px;border-radius:8px 8px 0 0;">
    <h1 style="color:white;margin:0;font-size:20px;">💼 FinanceApp — Confirmez votre adresse email</h1>
  </div>
  <div style="background:#f9fafb;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb;border-top:none;">
    <p>Bonjour <strong>${nom}</strong>,</p>
    <p>Merci de vous être inscrit sur FinanceApp. Pour activer votre compte, veuillez confirmer votre adresse email en cliquant sur le bouton ci-dessous :</p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${verifyUrl}"
         style="background:#4f46e5;color:white;text-decoration:none;padding:13px 32px;border-radius:8px;font-weight:600;font-size:15px;display:inline-block;">
        ✅ Confirmer mon email
      </a>
    </div>
    <p style="font-size:13px;color:#6b7280;">
      Ce lien est valide pendant <strong>24 heures</strong>. Après ce délai, vous devrez faire une nouvelle demande de vérification.
    </p>
    <p style="font-size:12px;color:#6b7280;word-break:break-all;">
      Ou copiez ce lien dans votre navigateur :<br>${verifyUrl}
    </p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;">
    <p style="font-size:12px;color:#9ca3af;">
      Si vous n'avez pas créé de compte sur FinanceApp, ignorez cet email.
    </p>
  </div>
</body>
</html>`;

  await transporter.sendMail({
    from:    process.env.SMTP_FROM || process.env.SMTP_USER,
    to:      email,
    subject: '✅ Confirmez votre adresse email — FinanceApp',
    html,
  });
  return true;
}

async function envoyerResetMotDePasse(email, nom, resetUrl) {
  const transporter = createTransporter();
  if (!transporter) return false;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#111827;">
  <div style="background:#4f46e5;padding:20px 24px;border-radius:8px 8px 0 0;">
    <h1 style="color:white;margin:0;font-size:20px;">💼 FinanceApp — Réinitialisation du mot de passe</h1>
  </div>
  <div style="background:#f9fafb;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb;border-top:none;">
    <p>Bonjour <strong>${nom}</strong>,</p>
    <p>Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous :</p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${resetUrl}"
         style="background:#4f46e5;color:white;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px;display:inline-block;">
        Réinitialiser mon mot de passe
      </a>
    </div>
    <p style="font-size:13px;color:#6b7280;">
      Ce lien est valide pendant <strong>1 heure</strong>. Après ce délai, vous devrez faire une nouvelle demande.
    </p>
    <p style="font-size:12px;color:#6b7280;word-break:break-all;">
      Ou copiez ce lien dans votre navigateur :<br>${resetUrl}
    </p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;">
    <p style="font-size:12px;color:#9ca3af;">
      Si vous n'avez pas demandé cette réinitialisation, ignorez cet email. Votre mot de passe ne sera pas modifié.
    </p>
  </div>
</body>
</html>`;

  await transporter.sendMail({
    from:    process.env.SMTP_FROM || process.env.SMTP_USER,
    to:      email,
    subject: '🔑 Réinitialisation de votre mot de passe — FinanceApp',
    html,
  });
  return true;
}

/**
 * Envoie une notification non-bloquante. N'attend pas la réponse SMTP.
 * Aucune donnée financière sensible ne doit être passée ici.
 */
function notifier(pool, userId, typeChangement) {
  if (!createTransporter()) return; // SMTP non configuré, on passe silencieusement
  const logger = require('../utils/logger');
  pool.execute('SELECT email, nom FROM users WHERE id = ? AND actif = 1', [userId])
    .then(([rows]) => {
      if (!rows[0]) return;
      envoyerConfirmationChangement(rows[0].email, rows[0].nom, typeChangement)
        .catch(e => logger.error(`[NOTIF EMAIL] ${typeChangement}: ${e.message}`));
    })
    .catch(() => {});
}

module.exports = { envoyerRappelDettes, envoyerConfirmationChangement, envoyerVerificationEmail, envoyerResetMotDePasse, createTransporter, notifier };
