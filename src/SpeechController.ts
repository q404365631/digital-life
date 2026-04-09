import { CreatureManager } from './creature/CreatureManager';
import { PanelProvider } from './ui/PanelProvider';
import { getPersonality, pickSpeech, SpeechEvent } from './ai/SpeechTemplates';

export class SpeechController {
  readonly speechLang: 'ja' | 'en';
  private lastTimeSlot: string = '';

  constructor(
    private readonly creatureManager: CreatureManager,
    private readonly panelProvider: PanelProvider,
  ) {
    const lang = (typeof process !== 'undefined' && process.env.VSCODE_NLS_CONFIG)
      ? 'en'
      : 'en';
    // speechLang is set externally after construction
    this.speechLang = 'en'; // default, overridden by init()
  }

  static create(
    creatureManager: CreatureManager,
    panelProvider: PanelProvider,
    lang: 'ja' | 'en',
  ): SpeechController {
    const instance = new SpeechController(creatureManager, panelProvider);
    (instance as { speechLang: 'ja' | 'en' }).speechLang = lang;
    return instance;
  }

  /** Broadcast event-driven speech to a random subset of creatures */
  broadcastSpeech(event: SpeechEvent, specificCreatureId?: string): void {
    const all = this.creatureManager.getAll().filter(c => c.stage !== 'egg');
    if (all.length === 0) return;

    if (specificCreatureId) {
      // Targeted speech to one creature
      const creature = this.creatureManager.getById(specificCreatureId);
      if (creature) {
        const personality = getPersonality(creature.dna);
        const text = pickSpeech(event, personality, this.speechLang);
        if (text) {
          this.panelProvider.postMessage({ type: 'creatureSpeech', creatureId: creature.id, text });
        }
      }
      return;
    }

    // Pick 1-2 random creatures to speak
    const speakers = all.sort(() => Math.random() - 0.5).slice(0, Math.min(2, all.length));
    for (const creature of speakers) {
      const personality = getPersonality(creature.dna);
      const text = pickSpeech(event, personality, this.speechLang);
      if (text) {
        this.panelProvider.postMessage({ type: 'creatureSpeech', creatureId: creature.id, text });
      }
    }
  }

  /** Return the appropriate speech event for the current time of day */
  getTimeOfDaySpeechEvent(): SpeechEvent {
    const hour = new Date().getHours();
    if (hour >= 22 || hour < 5) return 'lateNight';
    if (hour < 12) return 'morning';
    if (hour < 18) return 'afternoon';
    return 'evening';
  }

  /** Periodically broadcast time-of-day speech (every 30 minutes) */
  startTimeOfDayTimer(): void {
    setInterval(() => {
      const event = this.getTimeOfDaySpeechEvent();
      if (event !== this.lastTimeSlot) {
        this.lastTimeSlot = event;
        this.broadcastSpeech(event);
      }
    }, 30 * 60 * 1000); // check every 30 minutes
    this.lastTimeSlot = this.getTimeOfDaySpeechEvent();
  }
}
