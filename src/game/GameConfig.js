// ============================================================================
// ABYSS INC. — MASTER SIMULATION CONFIGURATION & GAME BALANCE PARAMETERS
// Single-player environmental strategy, 4 starting parameters & 2 dynamic rules
// ============================================================================

export const GAME_STAGES = {
  SURFACE_INTRO: 'SURFACE_INTRO',
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
    startingCredits: 120000, // Fixed starting company credits grant ($120K)
    totalFiniteSeabedOre: 240, // 8 finite seabed deposits totaling 240T
    surfaceOilPatchesCount: 6,
    surfaceTankCapacity: 30,
    warningMinOre: 20,
    warningHealthThreshold: 86,
    bankruptcyThreshold: 0,
    collapseHealthThreshold: 10
  },

  // Four Functional Starting Parameters (Separate from the 2 in-campaign rule changes)
  businessSettings: {
    capacityOptions: [
      { value: 20, label: '20T', consequence: 'Lighter hold: carries up to 20T per trip.' },
      { value: 35, label: '35T', consequence: 'Balanced hold: carries up to 35T per trip.' },
      { value: 50, label: '50T', consequence: 'Heavy hold: carries up to 50T per trip.' }
    ],
    workshopCapacityOptions: [
      { value: 50, label: '50T', consequence: 'Compact workshop: stores up to 50T of ore before selling.' },
      { value: 100, label: '100T', consequence: 'Standard workshop: stores up to 100T of ore before selling.' },
      { value: 150, label: '150T', consequence: 'Large workshop: stores up to 150T of ore before selling.' }
    ],
    priceRange: {
      min: 2000,
      max: 4500,
      step: 500,
      default: 2800
    },
    targetRange: {
      min: 40,
      max: 120,
      step: 10,
      default: 50
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
    ecoCertifiedPremium: 1.35
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
