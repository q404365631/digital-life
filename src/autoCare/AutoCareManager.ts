import { CreatureManager } from '../creature/CreatureManager';
import { CreatureData, FileHealth } from '../types';
import {
  LINE_COUNT_HEAVY,
  LINE_COUNT_OBESE,
  NESTING_THRESHOLD,
  FUNCTION_LENGTH_THRESHOLD,
  STALE_DAYS,
  MS_PER_DAY,
} from '../constants';

/** 自動餌やりのアクション種別 */
export type AutoCareAction = 'feed' | 'pet' | 'cure' | 'diet' | 'untangle' | 'split' | 'wake';

/** 自動餌やりのログエントリ */
export interface AutoCareLogEntry {
  /** タイムスタンプ（epoch ms） */
  readonly timestamp: number;
  /** 対象の生き物ID */
  readonly creatureId: string;
  /** 対象の生き物名 */
  readonly creatureName: string;
  /** 実行されたお世話アクション */
  readonly action: AutoCareAction;
  /** お世話前のHP（hunger値） */
  readonly hpBefore: number;
  /** お世話後のHP（hunger値） */
  readonly hpAfter: number;
  /** 説明文 */
  readonly description: string;
}

/** 自動餌やりの設定 */
export interface AutoCareConfig {
  /** 自動餌やりが有効かどうか */
  readonly enabled: boolean;
  /** チェック間隔（分） */
  readonly intervalMinutes: number;
  /** HP閾値（この値以下の生き物にお世話を実行） */
  readonly healthThreshold: number;
}

/** お世話候補の判定結果 */
interface CareCandidate {
  readonly creature: CreatureData;
  readonly action: AutoCareAction;
  readonly description: string;
  /** 緊急度スコア（高いほど優先） */
  readonly urgency: number;
}

/**
 * 自動餌やり（Auto-Care）マネージャー
 *
 * 設定した間隔で全生き物をスキャンし、
 * 健康状態が閾値以下のものに自動的にお世話を実行する。
 */
export class AutoCareManager {
  /** タイマーID */
  private timer: ReturnType<typeof setInterval> | null = null;
  /** お世話履歴ログ（最大100件） */
  private log: AutoCareLogEntry[] = [];
  /** ログの最大保持件数 */
  private static readonly MAX_LOG_ENTRIES = 100;

  constructor(
    private readonly creatureManager: CreatureManager,
    private config: AutoCareConfig,
  ) {}

  /** 現在の設定を取得 */
  getConfig(): AutoCareConfig {
    return this.config;
  }

  /** 設定を更新し、タイマーを再起動 */
  updateConfig(config: AutoCareConfig): void {
    this.config = config;
    // タイマーが動いていたら再起動して新しい間隔を反映
    if (this.timer !== null) {
      this.stop();
      if (config.enabled) {
        this.start();
      }
    } else if (config.enabled) {
      this.start();
    }
  }

  /** 自動餌やりタイマーを開始 */
  start(): void {
    if (this.timer !== null) {
      return;
    }
    if (!this.config.enabled) {
      return;
    }

    const intervalMs = this.config.intervalMinutes * 60 * 1000;
    this.timer = setInterval(() => {
      this.runAutoCare();
    }, intervalMs);
  }

  /** 自動餌やりタイマーを停止 */
  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** タイマーが稼働中かどうか */
  isRunning(): boolean {
    return this.timer !== null;
  }

  /** お世話履歴ログを取得 */
  getLog(): readonly AutoCareLogEntry[] {
    return this.log;
  }

  /** ログをクリア */
  clearLog(): void {
    this.log = [];
  }

  /**
   * 自動餌やりを手動実行（テストやコマンド実行用）
   * 戻り値: 実行されたお世話のログエントリ配列
   */
  runAutoCare(): AutoCareLogEntry[] {
    const results: AutoCareLogEntry[] = [];
    const candidates = this.findCareCandidates();

    // 緊急度が高い順にソート
    candidates.sort((a, b) => b.urgency - a.urgency);

    for (const candidate of candidates) {
      const entry = this.executeCare(candidate);
      if (entry) {
        results.push(entry);
      }
    }

    return results;
  }

  /**
   * お世話が必要な生き物を検索し、最適なアクションを決定する。
   * SuggestionEngineの提案ロジックを流用。
   */
  private findCareCandidates(): CareCandidate[] {
    const candidates: CareCandidate[] = [];
    const threshold = this.config.healthThreshold;
    const now = Date.now();

    for (const creature of this.creatureManager.getAll()) {
      // 卵はスキップ
      if (creature.stage === 'egg') {
        continue;
      }

      const health = creature.fileHealth;
      const daysSinceModified = (now - health.lastModified) / MS_PER_DAY;

      // HP（hunger）が閾値以下、またはファイル健康度に問題がある生き物を対象
      const needsCare = this.needsCare(creature, threshold, daysSinceModified);
      if (!needsCare) {
        continue;
      }

      // 最適なお世話アクションを決定（SuggestionEngineのロジックを流用）
      const { action, description, urgency } = this.determineAction(creature, health, daysSinceModified);

      candidates.push({
        creature,
        action,
        description,
        urgency,
      });
    }

    return candidates;
  }

  /**
   * 生き物がお世話を必要としているか判定
   */
  private needsCare(creature: CreatureData, threshold: number, daysSinceModified: number): boolean {
    // hunger が閾値以下
    if (creature.hunger <= threshold) {
      return true;
    }
    // happiness が閾値以下
    if (creature.happiness <= threshold) {
      return true;
    }
    // バグが多い
    if (creature.fileHealth.bugCount >= 3) {
      return true;
    }
    // ファイルが肥大化
    if (creature.fileHealth.lineCount > LINE_COUNT_OBESE) {
      return true;
    }
    // 長期間放置
    if (daysSinceModified > STALE_DAYS + 2) {
      return true;
    }
    return false;
  }

  /**
   * 生き物の状態から最適なお世話アクションを決定する。
   * 優先順位: cure > diet > untangle > split > wake > feed/pet
   */
  private determineAction(
    creature: CreatureData,
    health: FileHealth,
    daysSinceModified: number,
  ): { action: AutoCareAction; description: string; urgency: number } {
    // バグが多い → 治療
    if (health.bugCount >= 3) {
      return {
        action: 'cure',
        description: `バグが${health.bugCount}個検出 → 治療を実行`,
        urgency: 90 + health.bugCount,
      };
    }

    // ファイルが肥大化 → ダイエット
    if (health.lineCount > LINE_COUNT_OBESE) {
      return {
        action: 'diet',
        description: `${health.lineCount}行で肥大化 → ダイエットを実行`,
        urgency: 70,
      };
    }

    // ネストが深い → 解きほぐし
    if ((health.maxNesting ?? 0) > NESTING_THRESHOLD) {
      return {
        action: 'untangle',
        description: `ネスト${health.maxNesting}段 → 解きほぐしを実行`,
        urgency: 60,
      };
    }

    // 関数が長い → 分割
    if ((health.longestFunction ?? 0) > FUNCTION_LENGTH_THRESHOLD) {
      return {
        action: 'split',
        description: `${health.longestFunction}行の関数 → 分割を実行`,
        urgency: 55,
      };
    }

    // 長期間放置 → 起こす
    if (daysSinceModified > STALE_DAYS + 2) {
      return {
        action: 'wake',
        description: `${Math.floor(daysSinceModified)}日間放置 → レビューを実行`,
        urgency: 40,
      };
    }

    // happiness が低い → なでる
    if (creature.happiness <= creature.hunger) {
      return {
        action: 'pet',
        description: `happiness ${Math.floor(creature.happiness)}% → なでなでを実行`,
        urgency: 30 + (100 - creature.happiness),
      };
    }

    // hunger が低い → 餌やり
    return {
      action: 'feed',
      description: `HP ${Math.floor(creature.hunger)}% → 餌やりを実行`,
      urgency: 30 + (100 - creature.hunger),
    };
  }

  /**
   * 実際にお世話を実行し、ログエントリを返す。
   * 既存のCreatureManagerのfeed/petメソッドを呼び出す。
   */
  private executeCare(candidate: CareCandidate): AutoCareLogEntry | null {
    const { creature, action, description } = candidate;
    const hpBefore = Math.floor(creature.hunger);

    switch (action) {
      case 'feed':
        this.creatureManager.feed(creature.id);
        break;
      case 'pet':
        this.creatureManager.pet(creature.id);
        break;
      case 'cure':
        // 治療 = 餌やり（バグ修正は別途AIが行うため、HPを回復）
        this.creatureManager.feed(creature.id);
        break;
      case 'diet':
        // ダイエット = 餌やり（リファクタリングは別途）
        this.creatureManager.feed(creature.id);
        break;
      case 'untangle':
        // 解きほぐし = 餌やり
        this.creatureManager.feed(creature.id);
        break;
      case 'split':
        // 分割 = 餌やり
        this.creatureManager.feed(creature.id);
        break;
      case 'wake':
        // 起こす = なでる + 餌やり
        this.creatureManager.pet(creature.id);
        this.creatureManager.feed(creature.id);
        break;
      default:
        return null;
    }

    // お世話後のHP取得
    const updatedCreature = this.creatureManager.getById(creature.id);
    const hpAfter = updatedCreature ? Math.floor(updatedCreature.hunger) : hpBefore;

    const entry: AutoCareLogEntry = {
      timestamp: Date.now(),
      creatureId: creature.id,
      creatureName: creature.name,
      action,
      hpBefore,
      hpAfter,
      description,
    };

    // ログに追加（最大件数を超えたら古いものから削除）
    this.log.push(entry);
    if (this.log.length > AutoCareManager.MAX_LOG_ENTRIES) {
      this.log = this.log.slice(-AutoCareManager.MAX_LOG_ENTRIES);
    }

    return entry;
  }
}
