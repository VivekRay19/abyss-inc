// ============================================================================
// ABYSS INC. — MASTER SIMULATION CONFIGURATION & GAME BALANCE PARAMETERS
// Single-player environmental strategy, repeatable diving & ongoing operations
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
  TUTORIAL_COMPLETE: 'TUTORIAL_COMPLETE',
  ONGOING_OPERATIONS: 'ONGOING_OPERATIONS',
  DEFEAT: 'DEFEAT'
};

export const PLAYER_LOCATIONS = {
  SURFACE: 'SURFACE',
  DIVING: 'DIVING',
  UNDERWATER: 'UNDERWATER',
  SURFACING: 'SURFACING'
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
    totalFiniteSeabedOre: 240, // 8 finite seabed deposits totaling 240t
    surfaceOilPatchesCount: 8,
    surfaceTankCapacity: 40,
    warningMinOre: 20,
    warningHealthThreshold: 84,
    bankruptcyThreshold: 0,
    collapseHealthThreshold: 10
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

  // Restoration Budget Tiers (Single-Player Resource Allocation)
  restorationBudgets: {
    small: {
      id: 'small',
      label: 'Small Budget',
      cost: 25000,
      cleaningPower: 1.0,
      coralKits: 3,
      puzzleClues: 1,
      desc: 'Essential diving kit: standard coral scrubbing speed and 1 puzzle clue.'
    },
    standard: {
      id: 'standard',
      label: 'Standard Budget',
      cost: 50000,
      cleaningPower: 1.5,
      coralKits: 4,
      puzzleClues: 2,
      desc: 'Recommended marine kit: 1.5x faster scrubbing and 2 puzzle clues.'
    },
    generous: {
      id: 'generous',
      label: 'Generous Budget',
      cost: 80000,
      cleaningPower: 2.2,
      coralKits: 5,
      puzzleClues: 3,
      desc: 'Full restoration suite: 2.2x rapid scrubbing and complete puzzle guidance.'
    }
  },

  // Equipment Upgrades for Ongoing Operations
  upgrades: {
    hopper: { cost: 35000, capacityBonus: 15, label: '+15t Cargo Hopper' },
    drill: { cost: 40000, speedBonus: 1.25, label: '+25% Mining Speed' }
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
    ecoCertifiedPremium: 1.35,
    maxSafePrice: 3500
  },

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
