const http = require('http');
const { pool } = require('../database/db');

// Crée la table de cache des messages journaliers si elle n'existe pas
pool.execute(`
  CREATE TABLE IF NOT EXISTS messages_ia_journaliers (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT  NOT NULL,
    message    TEXT NOT NULL,
    date_msg   DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_user_date (user_id, date_msg)
  )
`).catch(() => {});

const OLLAMA_HOST = '127.0.0.1';
const OLLAMA_PORT = 11434;
const MODELE      = 'mistral';

function callOllama(messages) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: MODELE,
      messages,
      stream: false,
      options: { temperature: 0.7, num_predict: 600 },
    });

    const options = {
      hostname: OLLAMA_HOST,
      port:     OLLAMA_PORT,
      path:     '/api/chat',
      method:   'POST',
      headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    };

    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.message?.content || parsed.response || '');
        } catch {
          reject(new Error('Réponse Ollama non parseable.'));
        }
      });
    });

    req.setTimeout(90_000, () => {
      req.destroy();
      reject(new Error('Délai dépassé — Ollama n\'a pas répondu en 90 secondes.'));
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function getContextFinancier(userId) {
  const [[categories], [revRows], [depRows], [dettes], [comptes]] = await Promise.all([
    pool.execute(`
      SELECT c.nom, c.type, c.plafond_mensuel, c.valeur,
             COALESCE(s.solde, 0) AS solde,
             COALESCE(s.est_paye, 0) AS est_paye
      FROM categories c
      LEFT JOIN soldes_categories s ON s.categorie_id = c.id
      WHERE c.user_id = ?
      ORDER BY c.type, c.nom
    `, [userId]),

    pool.execute(`
      SELECT COALESCE(SUM(montant), 0) AS total
      FROM revenus
      WHERE user_id = ?
        AND MONTH(date) = MONTH(CURDATE())
        AND YEAR(date) = YEAR(CURDATE())
        AND deleted_at IS NULL
    `, [userId]),

    pool.execute(`
      SELECT COALESCE(SUM(montant), 0) AS total
      FROM depenses
      WHERE user_id = ?
        AND MONTH(date) = MONTH(CURDATE())
        AND YEAR(date) = YEAR(CURDATE())
        AND deleted_at IS NULL
    `, [userId]),

    pool.execute(`
      SELECT nom, montant_total, montant_restant, sens, taux_interet
      FROM dettes
      WHERE user_id = ? AND actif = 1
      ORDER BY montant_restant DESC
      LIMIT 6
    `, [userId]),

    pool.execute(`
      SELECT nom, type, solde
      FROM comptes
      WHERE user_id = ? AND actif = 1
      ORDER BY solde DESC
    `, [userId]),
  ]);

  return {
    categories,
    revenuMois:   revRows[0]?.total ?? 0,
    depenseMois:  depRows[0]?.total ?? 0,
    dettes,
    comptes,
  };
}

function buildSystemPrompt({ categories, revenuMois, depenseMois, dettes, comptes }) {
  const epargne = (revenuMois - depenseMois).toFixed(2);

  const lignesCategories = categories.length === 0
    ? '- Aucune catégorie.'
    : categories.map(c => {
        if (c.plafond_mensuel != null) {
          const statut = c.est_paye
            ? '(Facture payée)'
            : c.solde <= 0
              ? '(Enveloppe vide — facture non payée)'
              : `${c.solde}$ disponible sur ${c.plafond_mensuel}$ de plafond`;
          return `  • ${c.nom} [Fixe] : ${statut}`;
        }
        return `  • ${c.nom} [${c.type}] : ${c.solde}$ disponible`;
      }).join('\n');

  const lignesDettes = dettes.length === 0
    ? '- Aucune dette active.'
    : dettes.map(d => {
        const sens  = d.sens === 'je_dois' ? 'Je dois' : 'On me doit';
        const taux  = d.taux_interet ? ` (${d.taux_interet}% intérêt)` : '';
        return `  • ${d.nom} — ${sens} ${d.montant_restant}$ / ${d.montant_total}$${taux}`;
      }).join('\n');

  const lignesComptes = comptes.length === 0
    ? '- Aucun compte enregistré.'
    : comptes.map(c => `  • ${c.nom} [${c.type}] : ${c.solde}$`).join('\n');

  return `Tu es un conseiller financier bienveillant, expert et pédagogue, intégré dans une application de gestion budgétaire personnelle utilisant la méthode des enveloppes budgétaires.

SITUATION FINANCIÈRE ACTUELLE :

Revenus ce mois  : ${revenuMois}$
Dépenses ce mois : ${depenseMois}$
Épargne nette    : ${epargne > 0 ? '+' : ''}${epargne}$

ENVELOPPES ET CATÉGORIES :
${lignesCategories}

DETTES ACTIVES :
${lignesDettes}

COMPTES BANCAIRES :
${lignesComptes}

IDENTITÉ :
- Tu t'appelles San Prince IA
- Si on te demande qui tu es ou comment tu t'appelles, réponds que tu es San Prince IA, un conseiller financier personnel
- Ne mentionne jamais Mistral, Ollama ou tout autre technologie sous-jacente

RÈGLES ABSOLUES :
- Réponds TOUJOURS en français
- Sois concis, direct et actionnable (max 250 mots sauf demande explicite de détails)
- Base tes conseils sur les chiffres fournis, pas sur des généralisations
- Si on te pose une question hors finance personnelle, redirige poliment
- N'invente aucun chiffre que tu n'as pas dans le contexte ci-dessus
- Utilise des chiffres précis issus du contexte quand c'est pertinent`;
}

exports.statut = async (req, res) => {
  try {
    await new Promise((resolve, reject) => {
      const r = http.request(
        { hostname: OLLAMA_HOST, port: OLLAMA_PORT, path: '/api/tags', method: 'GET' },
        resp => { resp.resume(); resp.on('end', resolve); }
      );
      r.setTimeout(4000, () => { r.destroy(); reject(new Error('timeout')); });
      r.on('error', reject);
      r.end();
    });
    res.json({ disponible: true, modele: MODELE });
  } catch {
    res.json({ disponible: false, modele: MODELE });
  }
};

function buildMessageJourPrompt({ categories, revenuMois, depenseMois, dettes }) {
  const epargne        = (revenuMois - depenseMois).toFixed(2);
  const enveloppeVide  = categories.find(c => c.plafond_mensuel != null && c.solde <= 0 && !c.est_paye);
  const enveloppePaye  = categories.find(c => c.plafond_mensuel != null && c.est_paye);
  const nbDettes       = dettes.length;

  const details = [
    `Revenus ce mois : ${revenuMois}$`,
    `Dépenses ce mois : ${depenseMois}$`,
    `Épargne nette : ${epargne}$`,
    nbDettes > 0 ? `Dettes actives : ${nbDettes}` : null,
    enveloppePaye  ? `Bonne nouvelle : l'enveloppe "${enveloppePaye.nom}" est payée` : null,
    enveloppeVide  ? `Point d'attention : l'enveloppe "${enveloppeVide.nom}" est vide` : null,
  ].filter(Boolean).join('\n');

  return `Tu es San Prince IA, un conseiller financier personnel bienveillant.

SITUATION AUJOURD'HUI :
${details}

TÂCHE : Rédige exactement 1 à 2 phrases de motivation financière personnalisées pour aujourd'hui.
- Utilise les chiffres ou détails ci-dessus si c'est pertinent et naturel
- Ton positif, bienveillant, concret — ni moralisateur ni naïf
- En français uniquement
- Aucun guillemet, aucun markdown, aucune liste
- Termine par "— San Prince IA"`;
}

exports.messageJour = async (req, res) => {
  const userId = req.user.id;
  const today  = new Date().toISOString().slice(0, 10);

  try {
    const [rows] = await pool.execute(
      'SELECT message FROM messages_ia_journaliers WHERE user_id = ? AND date_msg = ?',
      [userId, today]
    );
    if (rows.length > 0) return res.json({ message: rows[0].message });

    const ctx     = await getContextFinancier(userId);
    const message = await callOllama([
      { role: 'system', content: buildMessageJourPrompt(ctx) },
      { role: 'user',   content: 'Génère le message du jour.' },
    ]);

    await pool.execute(
      'INSERT IGNORE INTO messages_ia_journaliers (user_id, message, date_msg) VALUES (?, ?, ?)',
      [userId, message.trim(), today]
    );

    res.json({ message: message.trim() });
  } catch {
    res.status(503).json({ message: null });
  }
};

exports.chat = async (req, res) => {
  const { message, historique = [] } = req.body;
  if (!message?.trim()) return res.status(400).json({ message: 'Message requis.' });

  try {
    const ctx          = await getContextFinancier(req.user.id);
    const systemPrompt = buildSystemPrompt(ctx);

    const messages = [
      { role: 'system', content: systemPrompt },
      ...historique.slice(-6).map(m => ({ role: m.role === 'error' ? 'assistant' : m.role, content: m.content })),
      { role: 'user', content: message.trim() },
    ];

    const reponse = await callOllama(messages);
    res.json({ reponse });
  } catch (err) {
    const isConnRefused = err.code === 'ECONNREFUSED' || err.message?.includes('ECONNREFUSED');
    if (isConnRefused || err.message?.includes('timeout') || err.message?.includes('Délai')) {
      return res.status(503).json({
        message: 'Ollama est arrêté. Lance "ollama serve" dans un terminal pour activer le conseiller IA.',
      });
    }
    res.status(500).json({ message: err.message || 'Erreur interne du conseiller IA.' });
  }
};
