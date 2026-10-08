export const CATEGORIES_FISCALES = [
  { value: 'frais_pro',        label: 'Frais professionnels' },
  { value: 'transport',        label: 'Transport & déplacements' },
  { value: 'sante',            label: 'Santé & médicaments' },
  { value: 'formation',        label: 'Formation & éducation' },
  { value: 'don',              label: 'Dons & bienfaisance' },
  { value: 'bureau_domicile',  label: 'Bureau à domicile' },
  { value: 'equipement',       label: 'Équipement & matériel' },
  { value: 'loyer',            label: 'Loyer & logement' },
  { value: 'assurance',        label: 'Assurance' },
  { value: 'autre_deductible', label: 'Autre déductible' },
]

export const ACTIFS_TYPES = [
  { value: 'compte_bancaire', label: 'Compte bancaire / Épargne', icon: '🏦' },
  { value: 'investissement',  label: 'Investissements (REER, CELI, actions)', icon: '📈' },
  { value: 'immobilier',      label: 'Immobilier', icon: '🏠' },
  { value: 'vehicule',        label: 'Véhicule', icon: '🚗' },
  { value: 'autre',           label: 'Autre actif', icon: '💎' },
]

export const catFiscaleLabel = (val) =>
  CATEGORIES_FISCALES.find(c => c.value === val)?.label || val

export const actifTypeIcon = (val) =>
  ACTIFS_TYPES.find(t => t.value === val)?.icon || '💎'
