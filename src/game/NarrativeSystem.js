// ============================================================================
// ABYSS INC. — NARRATIVE SYSTEM: DR. MAREN VOSS & BOARD MEMOS
// Context-sensitive dialogue, tutorial guidance, and corporate notifications
// ============================================================================

export class NarrativeSystem {
  constructor(game, uiCallbacks) {
    this.game = game;
    this.ui = uiCallbacks;

    this.tutorialActive = false;
    this.tutorialStep = 0;
    this.tutorialCompleted = false;

    this.triggeredMemos = new Set();
    this.currentDialogue = null;
    this.history = [];
    this.silentBloomTriggered = false;
  }

  // --- TUTORIAL PROGRESSION (5-7 MINUTE REAL GAMEPLAY STEPPED TUTORIAL) ---
  static get TUTORIAL_STEPS() {
    return [
      {
        id: 'intro',
        speaker: 'Dr. Maren Voss',
        role: 'Chief Marine Biologist, ABYSS INC.',
        portrait: 'maren-neutral',
        text: 'Welcome to Riser Hub, Director. The Board expects significant returns from the Meridian Basin. As chief marine biologist, my mandate is to ensure our operations stay within projected biological variances.',
        instruction: 'Click Next to review the extraction infrastructure.',
        checkCompleted: () => true
      },
      {
        id: 'select_crawler',
        speaker: 'Dr. Maren Voss',
        role: 'Chief Marine Biologist, ABYSS INC.',
        portrait: 'maren-neutral',
        text: 'First, select our primary extraction asset: the TRITON-IX heavy crawler. Use key [1] or click the machine switcher on your right panel.',
        instruction: 'Select TRITON-IX Crawler (Key 1 or click unit 1)',
        checkCompleted: (game) => game.selectedMachineId === 'crawler'
      },
      {
        id: 'mine_nodule',
        speaker: 'Dr. Maren Voss',
        role: 'Chief Marine Biologist, ABYSS INC.',
        portrait: 'maren-focused',
        text: 'Polymetallic nodules resting on the sediment contain copper, cobalt, and nickel. Click a glowing nodule deposit in the Nodule Fields, or press the yellow MINE button.',
        instruction: 'Extract ore from nearest deposit (Press MINE or click deposit)',
        checkCompleted: (game) => game.totalTonsMined > 0 || (game.fleet.crawler && game.fleet.crawler.capacity > 0)
      },
      {
        id: 'sediment_plume_warning',
        speaker: 'Dr. Maren Voss',
        role: 'Chief Marine Biologist, ABYSS INC.',
        portrait: 'maren-concerned',
        text: 'Watch the cutter head. The hydraulic extraction stirs up benthic sediment. Notice the particulate cloud — it reduces water visibility and stresses filter-feeding fauna.',
        instruction: 'Observe the sediment plume and wait for the hopper to fill.',
        checkCompleted: (game) => game.fleet.crawler && game.fleet.crawler.capacity >= 10
      },
      {
        id: 'sell_ore',
        speaker: 'Dr. Maren Voss',
        role: 'Chief Marine Biologist, ABYSS INC.',
        portrait: 'maren-neutral',
        text: 'Your hopper contains high-grade polymetallic nodules. Click the blue SELL ORE button or navigate the crawler near Riser Hub to offload cargo for corporate treasury credits.',
        instruction: 'Sell your collected cargo (Click SELL ORE)',
        checkCompleted: (game) => game.totalTonsSold > 0
      },
      {
        id: 'rule_amendment_intro',
        speaker: 'Dr. Maren Voss',
        role: 'Chief Marine Biologist, ABYSS INC.',
        portrait: 'maren-thoughtful',
        text: 'The ISA charter grants you exactly TWO corporate Rule Amendments per campaign. You have executive power to boost mineral sale pricing or mandate cleaner extraction filtration.',
        instruction: 'Review Rule Changes in the right panel.',
        checkCompleted: (game) => true
      },
      {
        id: 'ocean_health_check',
        speaker: 'Dr. Maren Voss',
        role: 'Chief Marine Biologist, ABYSS INC.',
        portrait: 'maren-solemn',
        text: 'Remember: You can rewrite corporate regulations, but you cannot rewrite the laws of benthic ecology. If Ocean Health collapses below 10%, the ecosystem crashes and the operation will be shut down.',
        instruction: 'Tutorial complete! Explore, mine, or restore as you see fit.',
        checkCompleted: () => true
      }
    ];
  }

  startTutorial() {
    this.tutorialActive = true;
    this.tutorialStep = 0;
    this.showCurrentTutorialStep();
  }

  skipTutorial() {
    this.tutorialActive = false;
    this.tutorialCompleted = true;
    if (this.ui.onTutorialDismiss) this.ui.onTutorialDismiss();
    this.postBoardMemo(
      'OPERATION COMMENCED',
      'Operations Director has assumed autonomous control of Meridian Basin subsea extraction.',
      'info'
    );
  }

  showCurrentTutorialStep() {
    const steps = NarrativeSystem.TUTORIAL_STEPS;
    if (this.tutorialStep >= steps.length) {
      this.tutorialActive = false;
      this.tutorialCompleted = true;
      if (this.ui.onTutorialDismiss) this.ui.onTutorialDismiss();
      return;
    }

    const step = steps[this.tutorialStep];
    this.currentDialogue = {
      speaker: step.speaker,
      role: step.role,
      portrait: step.portrait,
      text: step.text,
      instruction: step.instruction,
      stepNum: this.tutorialStep + 1,
      totalSteps: steps.length
    };

    if (this.ui.onDialogueUpdate) {
      this.ui.onDialogueUpdate(this.currentDialogue);
    }
  }

  advanceTutorialIfConditionMet() {
    if (!this.tutorialActive) return;
    const steps = NarrativeSystem.TUTORIAL_STEPS;
    const current = steps[this.tutorialStep];
    if (current && current.checkCompleted(this.game)) {
      this.tutorialStep++;
      if (this.tutorialStep < steps.length) {
        this.showCurrentTutorialStep();
      } else {
        this.tutorialActive = false;
        this.tutorialCompleted = true;
        if (this.ui.onTutorialDismiss) this.ui.onTutorialDismiss();
      }
    }
  }

  // --- CONTEXT-SENSITIVE DIALOGUE & BOARD NOTIFICATIONS ---
  update(dt, elapsed) {
    this.advanceTutorialIfConditionMet();

    // Check Narrative Milestones based on actual game simulation state:
    const health = this.game.getGlobalOceanHealth();
    const tons = this.game.totalTonsMined;
    const round = this.game.round;

    // 1. First Significant Mining Plume Reaction
    if (tons >= 25 && !this.triggeredMemos.has('first_plume')) {
      this.triggeredMemos.add('first_plume');
      this.triggerMarenComment(
        'Sediment density in the central sector is exceeding our baseline projections. The Board classified it as an acceptable operational variance, but local hexacorals are already choking.',
        'maren-concerned'
      );
    }

    // 2. Coral Sanctuary Boundary Contamination Event
    // "The plume doesn't read the boundary lines on your map."
    if (this.checkSanctuaryPlumeSpread() && !this.triggeredMemos.has('sanctuary_plume')) {
      this.triggeredMemos.add('sanctuary_plume');
      this.triggerMarenComment(
        'Director, the sediment drift has crossed 200 meters into the Coral Sanctuary. The plume doesn’t read the boundary lines on your map.',
        'maren-solemn'
      );
      this.postBoardMemo(
        'COMPLIANCE INQUIRY',
        'Regulatory observers report turbidity drift near protected Coral Sanctuary. Eco-rating under review.',
        'warning'
      );
    }

    // 3. Signature Environmental Event: THE SILENT BLOOM
    if (health <= 55 && tons >= 60 && !this.silentBloomTriggered) {
      this.silentBloomTriggered = true;
      this.triggerSilentBloomEvent();
    }

    // 4. Middle Game Economic Pressure
    if (health < 45 && !this.triggeredMemos.has('buyer_scrutiny')) {
      this.triggeredMemos.add('buyer_scrutiny');
      this.triggerMarenComment(
        'You can change the contract price of ore, Director. You cannot change what that ore costs the ocean.',
        'maren-solemn'
      );
      this.postBoardMemo(
        'BUYER CAUTION NOTICE',
        'International green-energy buyers have downgraded procurement confidence due to abyssal turbidity reports.',
        'warning'
      );
    }

    // 5. Successful Restoration Milestone
    const restoredSites = this.game.ecosystem.damagedSites.filter((s) => s.restored).length;
    if (restoredSites >= 2 && !this.triggeredMemos.has('restoration_milestone')) {
      this.triggeredMemos.add('restoration_milestone');
      this.triggerMarenComment(
        'The deep-sea sponges and octocorals are repopulating the reclaimed site. Recovery down here takes decades, but this is real, measurable life coming back.',
        'maren-pleased'
      );
      this.postBoardMemo(
        'GLOBAL MARINE ENDOWMENT',
        'ABYSS INC. awarded $65K scientific habitat restoration grant for benthic recovery work.',
        'success'
      );
    }
  }

  checkSanctuaryPlumeSpread() {
    // Check if sector health near the Coral Sanctuary (-22, 13) has dropped or turbidity has drifted
    const sanctuarySector = this.game.oceanEnv.getSectorAt(-22, 13);
    return sanctuarySector && (sanctuarySector.turbidity > 25 || sanctuarySector.health < 82);
  }

  triggerSilentBloomEvent() {
    this.triggerMarenComment(
      'The Silent Bloom has begun. The bioluminescent reef in the canyon has gone completely dark under the silt. Tens of thousands of years of evolutionary luminescence, extinguished.',
      'maren-solemn'
    );
    this.postBoardMemo(
      'ECOLOGICAL MILESTONE: THE SILENT BLOOM',
      'Bioluminescent flora index has collapsed. Market Eco-Rating downgraded to 0.60x.',
      'danger'
    );
    // Dim bioluminescent corals in the ecosystem
    if (this.game.ecosystem && this.game.ecosystem.dimBioluminescentOrganisms) {
      this.game.ecosystem.dimBioluminescentOrganisms(0.25);
    }
  }

  triggerMarenComment(text, portrait = 'maren-neutral') {
    this.currentDialogue = {
      speaker: 'Dr. Maren Voss',
      role: 'Chief Marine Biologist',
      portrait,
      text,
      instruction: null,
      isStoryEvent: true
    };
    if (this.ui.onDialogueUpdate) {
      this.ui.onDialogueUpdate(this.currentDialogue);
    }
  }

  postBoardMemo(title, body, type = 'info') {
    const memo = {
      id: `memo-${Date.now()}`,
      title,
      body,
      type,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    this.history.unshift(memo);
    if (this.ui.onBoardMemo) {
      this.ui.onBoardMemo(memo);
    }
  }
}
