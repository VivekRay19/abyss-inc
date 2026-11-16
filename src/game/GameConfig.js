// ============================================================================
// ABYSS INC. — MASTER SIMULATION CONFIGURATION & GAME BALANCE PARAMETERS
// Centralised balance definitions for the streamlined 5-10 minute campaign
// ============================================================================

export const GAME_STAGES = {
  SURFACE_INTRO: 'SURFACE_INTRO',
  BUSINESS_SETTINGS: 'BUSINESS_SETTINGS',
  DEPLOYMENT: 'DEPLOYMENT',
  UNDERWATER_MINING: 'UNDERWATER_MINING',
  RULE_CHANGE_1: 'RULE_CHANGE_1',
  ASCENT_TO_SURFACE: 'ASCENT_TO_SURFACE',
  SURFACE_CLEANUP: 'SURFACE_CLEANUP',
  RULE_CHANGE_2: 'RULE_CHANGE_2',
  BUDGET_NEGOTIATION: 'BUDGET_NEGOTIATION',
  DIVE_RESTORATION: 'DIVE_RESTORATION',
  ENDING: 'ENDING',
  DEFEAT: 'DEFEAT'
};

export const IMMUTABLE_ECOLOGICAL_LAWS = [
  'Mining always produces environmental disturbance and sediment plumes.',
  'Sediment damages the seabed and nearby coral reef habitats.',
  'Mineral reserves on the ocean floor are strictly finite.',
  'Pollution cannot be removed by changing financial settings.',
  'Restoration requires direct player interaction and effort.',
  'Extracted minerals cannot be recreated simply by cleaning the ocean.'
];

export const GAME_BALANCE = {
  campaign: {
    startingCredits: 120000,
    totalFiniteSeabedOre: 140, // Finite deposit total across all seabed veins
    surfaceOilPatchesCount: 8,
    surfaceTankCapacity: 40,
    warningMinOre: 20, // Minimum ore mined before environmental warning can trigger
    warningHealthThreshold: 84, // Reef/ocean health below this triggers captain's warning
    bankruptcyThreshold: 0, // Credits < 0 triggers bankruptcy
    collapseHealthThreshold: 10 // Ocean health <= 10% triggers ecological collapse
  },

  // Three Initial Business Settings (NOT counted as the 2 dynamic rule changes)
  businessSettings: {
    capacityOptions: [
      { value: 20, label: 'Compact (20t)', consequence: 'Lighter trips; must return to the boat more often.' },
      { value: 35, label: 'Standard (35t)', consequence: 'Balanced cargo hold for steady extraction.' },
      { value: 50, label: 'Heavy (50t)', consequence: 'More ore carried per trip, fewer ascents.' }
    ],
    priceRange: {
      min: 2000,
      max: 4500,
      step: 500,
      default: 2800
    },
    targetRange: {
      min: 40,
      max: 100,
      step: 10,
      default: 60
    }
  },

  // Budget Negotiation Tiers (Part 9)
  restorationBudgets: {
    small: {
      id: 'small',
      label: 'Small Budget',
      cost: 25000,
      cleaningPower: 1.0,
      coralKits: 3,
      puzzleClues: 1,
      desc: 'Minimal supplies: slower coral scrubbing and 1 puzzle clue.'
    },
    standard: {
      id: 'standard',
      label: 'Standard Budget',
      cost: 50000,
      cleaningPower: 1.5,
      coralKits: 4,
      puzzleClues: 2,
      desc: 'Balanced gear: faster scrubbing and 2 puzzle clues.'
    },
    generous: {
      id: 'generous',
      label: 'Generous Budget',
      cost: 80000,
      cleaningPower: 2.2,
      coralKits: 5,
      puzzleClues: 3,
      desc: 'Full marine lab kit: rapid scrubbing and full puzzle guidance.'
    }
  },

  ecology: {
    baseSedimentFactor: 0.14,
    baseHabitatDamage: 0.085,
    naturalSedimentSettlingRate: 0.004,
    naturalHabitatRecoveryRate: 0.0005,
    healthWeights: {
      habitat: 0.45,
      cleanWater: 0.30,
      biodiversity: 0.25
    },
    sedimentBiodiversityFactor: 0.70
  },

  economy: {
    ecoCertifiedPremium: 1.35, // +35% sale value when Eco-Certified Market is fulfilled
    maxSafePrice: 3500 // Above this, buyers have increasing risk of rejecting/discounting
  },

  // Optional Between-Run Constitution Amendments (separate from the 2 in-campaign rule changes)
  constitutionOptions: [
    {
      id: 'const_capital',
      title: 'Venture Capital Influx',
      shortTitle: '+$40K Starting Credits',
      desc: 'Begin next expedition with +$40,000 credits in the company treasury.',
      apply: (config) => { config.bonusStartingCredits += 40000; }
    },
    {
      id: 'const_subsidies',
      title: 'Mineral Market Price Floor',
      shortTitle: '+15% Base Mineral Price',
      desc: 'Permanently raise baseline mineral selling contracts by +15%.',
      apply: (config) => { config.basePriceBonusMultiplier *= 1.15; }
    },
    {
      id: 'const_turbidity_filters',
      title: 'Hydraulic Plume Dampeners',
      shortTitle: '-20% Mining Turbidity',
      desc: 'Reduces sediment dispersal rate by 20% (mining still disturbs the seabed).',
      apply: (config) => { config.pollutionBonusMultiplier *= 0.80; }
    },
    {
      id: 'const_crawler_chassis',
      title: 'Reinforced Crawler Tracks',
      shortTitle: '+20% Crawler Speed',
      desc: 'Increases mining machine navigation speed by 20%.',
      apply: (config) => { config.crawlerSpeedBonus *= 1.20; }
    }
  ]
};
