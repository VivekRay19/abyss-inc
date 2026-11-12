// ============================================================================
// ABYSS INC. — MASTER SIMULATION CONFIGURATION & GAME BALANCE PARAMETERS
// Centralised balance definitions for economic, ecological, machine & campaign mechanics
// ============================================================================

export const GAME_BALANCE = {
  // --- CAMPAIGN CONFIGURATION ---
  campaign: {
    totalRounds: 12,
    secondsPerRound: 40,
    startingTreasury: 434000,
    startingTargetMineTons: 50,
    startingTargetRestoreZones: 2,
    actTransitions: {
      act2Trigger: { round: 5, healthBelow: 75, orMinedTons: 60 },
      act3Trigger: { round: 8, healthBelow: 50, orMinedTons: 120 }
    }
  },

  // --- ECOLOGICAL SIMULATION ---
  ecology: {
    // Damage scaling factors
    baseSedimentFactor: 0.08,    // Sediment load increase per ton mined
    baseHabitatDamage: 0.045,    // Habitat integrity loss per ton mined
    depthFactorDefault: 1.0,     // Scaling for deep waters
    cleanTechModifier: 0.60,     // When clean extraction is active

    // Regional ecological sensitivity multipliers
    zoneSensitivities: {
      riser_hub: 0.5,
      nodule_fields: 1.0,
      the_scar: 1.2,
      abyssal_trench: 1.35,
      vent_gardens: 1.6,
      coral_sanctuary: 2.2,
      outer_abyss: 1.8
    },

    // Natural recovery rates (per second)
    naturalSedimentSettlingRate: 0.008, // Sediment gradually disperses/settles slowly
    naturalHabitatRecoveryRate: 0.001,  // Very slow natural habitat regrowth without active intervention

    // Formula weights for Regional Ocean Health:
    // localOceanHealth = 100 * (0.45 * habitatIntegrity + 0.30 * (1 - sedimentLoad) + 0.25 * biodiversityIndex)
    healthWeights: {
      habitat: 0.45,
      cleanWater: 0.30,
      biodiversity: 0.25
    },

    // Sediment impact on biodiversity: biodiversityIndex = habitatIntegrity * (1 - 0.7 * sedimentLoad)
    sedimentBiodiversityFactor: 0.70
  },

  // --- ECONOMIC SIMULATION & FORMULAS ---
  economy: {
    baseMineralPrice: 2800, // Credits per ton baseline

    // Ore grade calculation: oreGrade = clamp(0.65 + 0.35 * (localHealth / 100), 0.55, 1.0)
    oreGrade: {
      base: 0.65,
      scale: 0.35,
      min: 0.55,
      max: 1.0
    },

    // Extraction yield piecewise function based on local health
    yieldMultipliers: [
      { minHealth: 80, calc: (h) => 1.0 },
      { minHealth: 50, calc: (h) => 0.55 + 1.5 * (h / 100 - 0.5) },
      { minHealth: 30, calc: (h) => 0.15 + 2.0 * (h / 100 - 0.3) },
      { minHealth: 0,  calc: (h) => 0.10 + 0.05 * (h / 30) }
    ],

    // Eco-Rating global market multiplier:
    // 80-100: 1.15
    // 50: 1.00
    // 35: 0.60
    // Below 35: 0.60 down to 0.40 in severe crisis
    ecoRatingTiers: [
      { health: 80, mult: 1.15 },
      { health: 50, mult: 1.00 },
      { health: 35, mult: 0.60 },
      { health: 0,  mult: 0.40 }
    ],

    restorationBountyBase: 65000,
    scientificGrantBase: 25000,
    ecoCertificationBonus: 0.08
  },

  // --- UPGRADES ---
  upgrades: {
    cutter: { baseCost: 75000, maxLevel: 4, speedBonus: 1.25, crawlerSpeedBonus: 1.10 },
    hopper: { baseCost: 65000, maxLevel: 4, capacityBonus: 50 },
    biolaser: { baseCost: 70000, maxLevel: 4, restoreBonus: 1.35, droneSpeedBonus: 1.15 }
  },

  // --- CONSTITUTION PERMANENT AMENDMENT POOL ---
  constitutionOptions: [
    {
      id: 'const_capital',
      title: 'Venture Capital Influx',
      shortTitle: '+100K Starting Capital',
      desc: 'Ratify extra corporate runway: Begin next expedition with +$100,000 credits in the corporate treasury.',
      apply: (config) => { config.bonusStartingCredits += 100000; }
    },
    {
      id: 'const_nodule_survey',
      title: 'Geological Reserve Survey',
      shortTitle: '+120t Initial Reserves',
      desc: 'Pre-mapped high-density nodule beds: Boost starting ore deposits by +120 tons across accessible fields.',
      apply: (config) => { config.bonusStartingOre += 120; }
    },
    {
      id: 'const_subsidies',
      title: 'Mineral Market Price Floor',
      shortTitle: '+20% Base Mineral Price',
      desc: 'Government guaranteed pricing: Permanently raise baseline mineral selling contracts by +20%.',
      apply: (config) => { config.basePriceBonusMultiplier *= 1.20; }
    },
    {
      id: 'const_turbidity_filters',
      title: 'Hydraulic Plume Dampeners',
      shortTitle: '-30% Mining Turbidity',
      desc: 'Factory-retrofitted sediment shroud on mining crawlers: Reduces sediment dispersal rate by 30%.',
      apply: (config) => { config.pollutionBonusMultiplier *= 0.70; }
    },
    {
      id: 'const_green_endowment',
      title: 'Ecological Restoration Charter',
      shortTitle: '+$35K / Restored Site',
      desc: 'Global Marine Fund grant endowment: Increases payouts for every certified habitat restoration by $35,000.',
      apply: (config) => { config.bonusRestorationBounty += 35000; }
    },
    {
      id: 'const_crawler_chassis',
      title: 'Heavy Titanium Crawler Tracks',
      shortTitle: '+25% Crawler Speed & Cargo',
      desc: 'Reinforced industrial chassis: Increases crawler navigation speed by 25% and expands starting hopper by +25t.',
      apply: (config) => { config.crawlerSpeedBonus *= 1.25; config.crawlerHopperBonus += 25; }
    }
  ]
};
