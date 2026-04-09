import { CreatureManager } from './creature/CreatureManager';
import { PanelProvider } from './ui/PanelProvider';
import { getPersonality, pickSpeech } from './ai/SpeechTemplates';

export class SuggestionEngine {
  private lastSuggestionTime = 0;
  private readonly SUGGESTION_INTERVAL = 120000; // at most one suggestion every 2 min

  constructor(
    private readonly creatureManager: CreatureManager,
    private readonly panelProvider: PanelProvider,
    private readonly speechLang: 'ja' | 'en',
  ) {}

  check(): void {
    const now = Date.now();
    if (now - this.lastSuggestionTime < this.SUGGESTION_INTERVAL) return;

    const candidates = this.creatureManager.getAll().filter(c => {
      if (c.stage === 'egg') return false;
      const h = c.fileHealth;
      const daysSince = (now - h.lastModified) / 864e5;
      return h.bugCount >= 3 || h.lineCount > 400 || daysSince > 5;
    });

    if (candidates.length === 0) return;

    // Pick the worst-off creature
    const worst = candidates.sort((a, b) => {
      const scoreA = a.fileHealth.bugCount * 10 + (a.fileHealth.lineCount > 400 ? 5 : 0);
      const scoreB = b.fileHealth.bugCount * 10 + (b.fileHealth.lineCount > 400 ? 5 : 0);
      return scoreB - scoreA;
    })[0];

    const personality = getPersonality(worst.dna);
    const text = pickSpeech('suggest', personality, this.speechLang);

    const h = worst.fileHealth;
    let action: string;
    let description: string;
    if (h.bugCount >= 3) {
      action = 'cure';
      description = this.speechLang === 'ja'
        ? `バグが${h.bugCount}個...お薬をあげますか？`
        : `${h.bugCount} bugs making them sick... give medicine?`;
    } else if (h.lineCount > 400) {
      action = 'diet';
      description = this.speechLang === 'ja'
        ? `${h.lineCount}行もあって重そう...ダイエットさせますか？`
        : `${h.lineCount} lines — feeling heavy... put on a diet?`;
    } else {
      action = 'wake';
      description = this.speechLang === 'ja'
        ? 'しばらく触ってもらえてなくて寂しそう...起こしますか？'
        : 'hasn\'t been touched in a while... feeling lonely. Wake them up?';
    }

    this.panelProvider.postMessage({
      type: 'creatureSuggestion',
      creatureId: worst.id,
      creatureName: worst.name,
      action,
      description,
    });

    // Also show as speech
    if (text) {
      this.panelProvider.postMessage({ type: 'creatureSpeech', creatureId: worst.id, text });
    }

    this.lastSuggestionTime = now;
  }
}
