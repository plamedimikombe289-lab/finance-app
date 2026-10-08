import {
  Wallet, Home, CreditCard, Landmark, ShoppingCart, ShoppingBag,
  Plane, Car, Utensils, Zap, Heart, BookOpen, Package, Gift,
  Smartphone, Baby, Dumbbell, Bus, PiggyBank, Music,
  Shield, TrendingUp, BarChart2, Settings, Trash2, Download,
  Bell, FileText, FolderKanban,
} from './Icons'

/**
 * Registre : clé (stockée en DB) → composant Lucide.
 * Permet de migrer progressivement depuis les emojis.
 */
export const CATEGORY_ICONS = {
  wallet:       { Icon: Wallet,       label: 'Portefeuille'  },
  home:         { Icon: Home,         label: 'Maison'        },
  credit_card:  { Icon: CreditCard,   label: 'Carte bancaire'},
  bank:         { Icon: Landmark,     label: 'Banque'        },
  cart:         { Icon: ShoppingCart, label: 'Courses'       },
  bag:          { Icon: ShoppingBag,  label: 'Shopping'      },
  plane:        { Icon: Plane,        label: 'Voyage'        },
  car:          { Icon: Car,          label: 'Transport'     },
  food:         { Icon: Utensils,     label: 'Restaurant'    },
  electricity:  { Icon: Zap,          label: 'Énergie'       },
  health:       { Icon: Heart,        label: 'Santé'         },
  education:    { Icon: BookOpen,     label: 'Éducation'     },
  package:      { Icon: Package,      label: 'Colis'         },
  gift:         { Icon: Gift,         label: 'Cadeaux'       },
  phone:        { Icon: Smartphone,   label: 'Téléphone'     },
  baby:         { Icon: Baby,         label: 'Enfants'       },
  sport:        { Icon: Dumbbell,     label: 'Sport'         },
  transit:      { Icon: Bus,          label: 'Transit'       },
  savings:      { Icon: PiggyBank,    label: 'Épargne'       },
  music:        { Icon: Music,        label: 'Divertissement'},
  insurance:    { Icon: Shield,       label: 'Assurance'     },
  investment:   { Icon: TrendingUp,   label: 'Investissement'},
  reports:      { Icon: BarChart2,    label: 'Rapports'      },
  misc:         { Icon: Settings,     label: 'Divers'        },
  trash:        { Icon: Trash2,       label: 'Autre'         },
  bills:        { Icon: FileText,     label: 'Factures'      },
  subscriptions:{ Icon: Bell,         label: 'Abonnements'   },
  debt:         { Icon: Download,     label: 'Dettes'        },
  budget:       { Icon: FolderKanban, label: 'Budget'        },
}

/**
 * Affiche l'icône SVG si la clé est reconnue, sinon l'emoji en fallback.
 *
 * @param {string} icone   - Clé du registre (ex: "wallet") ou emoji (ex: "💰")
 * @param {number} size
 * @param {string} className
 */
export default function CategoryIcon({ icone, size = 20, className = '' }) {
  const entry = CATEGORY_ICONS[icone]
  if (entry) {
    const { Icon } = entry
    return <Icon size={size} strokeWidth={1.75} className={className} />
  }
  // Fallback : emoji ou caractère quelconque stocké en DB
  return (
    <span className={`leading-none select-none ${className}`} style={{ fontSize: size * 0.9 }}>
      {icone || '📁'}
    </span>
  )
}
