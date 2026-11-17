// ============================================================================
// ABYSS INC. — CHARTER & CONSTITUTION PERSISTENCE SYSTEM
// Safe, versioned localStorage persistence with migrations, validation & reset
// ============================================================================

const STORAGE_KEY = 'abyss_inc_charter_save_v1';

export class ConstitutionPersistence {
  static getDefaultCharter() {
    return {
      version: 1,
      charterNumber: 1,
      ratifiedDate: new Date().toISOString(),
      activePermanentAmendments: [], // max 2 IDs chosen upon defeat
      charterHistory: [
        {
          charterNumber: 1,
          date: new Date().toISOString(),
          amendments: [],
          reason: 'Initial Foundation Charter'
        }
      ],
      runModifiers: {
        bonusStartingCredits: 0,
        bonusStartingOre: 0,
        basePriceBonusMultiplier: 1.0,
        pollutionBonusMultiplier: 1.0,
        bonusRestorationBounty: 0,
        crawlerSpeedBonus: 1.0,
        crawlerHopperBonus: 0
      }
    };
  }

  static loadCharter() {
    if (typeof localStorage === 'undefined') return this.getDefaultCharter();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return this.getDefaultCharter();
      const parsed = JSON.parse(raw);
      // Validate schema
      if (!parsed || typeof parsed !== 'object' || !parsed.version) {
        return this.getDefaultCharter();
      }
      return parsed;
    } catch (e) {
      console.warn('ABYSS INC: Failed to load charter from storage. Using default.', e);
      return this.getDefaultCharter();
    }
  }

  static saveCharter(charterData) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(charterData));
      return true;
    } catch (e) {
      console.error('ABYSS INC: Failed to save charter to storage.', e);
      return false;
    }
  }

  static ratifyNewCharter(selectedAmendmentIds, allOptionsPool, reason = 'Defeat') {
    const charter = this.loadCharter();
    charter.charterNumber = (charter.charterNumber || 1) + 1;
    charter.ratifiedDate = new Date().toISOString();
    charter.activePermanentAmendments = selectedAmendmentIds.slice(0, 2);

    // Reset runtime modifiers and re-accumulate
    charter.runModifiers = {
      bonusStartingCredits: 0,
      bonusStartingOre: 0,
      basePriceBonusMultiplier: 1.0,
      pollutionBonusMultiplier: 1.0,
      bonusRestorationBounty: 0,
      crawlerSpeedBonus: 1.0,
      crawlerHopperBonus: 0
    };

    const chosenTitles = [];
    selectedAmendmentIds.forEach((id) => {
      const opt = allOptionsPool.find((o) => o.id === id);
      if (opt && opt.apply) {
        opt.apply(charter.runModifiers);
        chosenTitles.push(opt.shortTitle || opt.title);
      }
    });

    charter.charterHistory.push({
      charterNumber: charter.charterNumber,
      date: charter.ratifiedDate,
      amendments: chosenTitles,
      reason
    });

    this.saveCharter(charter);
    return charter;
  }

  static resetCharter() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      return this.getDefaultCharter();
    } catch (e) {
      return this.getDefaultCharter();
    }
  }
}
