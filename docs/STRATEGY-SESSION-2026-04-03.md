# Digital Life 特戦会議ログ — 2026/04/03

## 参加メンバー
- 堀江貴文（プロダクト × マーケティング）
- 佐藤航陽（メタバース・空間経済）
- 中島聡（Windows95生みの親・エンジニアリング）
- Sam Altman（OpenAI CEO・プラットフォーム戦略）
- Dario Amodei（Anthropic CEO・AIセーフティ）
- 上地蓮 / Salafune（衛星データAI・OSS実践者）

---

## 核心ビジョン（全員合意）

Digital Lifeは「ツール」ではなく「新しいインターフェースの原形」。

中島聡が30年探してきた「GUIの次」：
- 旧世界: アイコンをクリック → メニューを選ぶ → 設定を変える
- 新世界: 生き物を見る → 直感で状態を理解 → エサを与える → AIが裏で動く → 完了

ターゲット: 非エンジニアがAIでシステムを作る時代に、非エンジニアがシステムを維持するためのインターフェース。

---

## $100M戦略（OSS無料段階での評価額）

パスB（AI Agent Orchestration）を主軸にパスA（Enterprise Code Health）を組み合わせる。
- Developer Companion（入口）→ Agent Dashboard（定着）
- 「かわいい」がトロイの木馬。エージェント統合管理がモート（堀）。

### ロードマップ
- Phase 0（今〜3ヶ月）: 0→1,000ユーザー、Marketplace公開、デモ動画
- Phase 1（3〜6ヶ月）: 1,000→50,000ユーザー、Web Dashboard MVP
- Phase 2（6〜12ヶ月）: マネタイズ開始、シードラウンド $2-5M
- Phase 3（12〜24ヶ月）: Series A、海外展開
- Phase 4（24〜36ヶ月）: $100M ARR

---

## 「スタートボタン」= バイラルの核

全員合意: 「開いた瞬間、生き物があなたに話しかける」

```
インストール → VS Code起動 → 5秒後:
「おはようございます！私はパフ。あなたのプロジェクトから生まれました。
 今日のあなたのコードの調子は... まあまあです。
 3つのファイルがちょっと疲れてるみたいです。見てあげますか？」
```

---

## 拡散戦略

1. バイラルの3条件: スクショが美しい × 一言で説明できる × 感情が動く
2. 「生き物が死ぬ」= 最強のバイラルエンジン（Duolingoのフクロウ理論）
3. 「生き物カード」でSNSシェア
4. Discord/Slackに生存報告が流れる
5. 有名リポジトリ図鑑（react、linuxの生き物を覗ける）

### ローンチ計画
- Day -7: ティザー動画を毎日Xに投稿
- Day -3: 中島聡ブログで言及
- Day 0: Product Hunt + Hacker News + Reddit同時公開
- Day +7: コントリビューター第1号を大切にする

---

## 無料API連携（トークン消費ゼロ）

Claude APIは却下（ユーザーにAPIキー取得を求めると離脱率が跳ね上がる）。

### Tier S: 明日実装（キー不要・通信不要）

| # | 機能 | API/技術 |
|---|---|---|
| 1 | 生き物が声で喋る | Web Speech TTS（ブラウザ内蔵） |
| 2 | 時間帯で行動変化 | Date + setInterval |
| 3 | コーディング行動に反応 | VS Code Event API |

### Tier A: 今週実装（キー不要 or 30秒で取得）

| # | 機能 | API |
|---|---|---|
| 4 | 宇宙の空が毎日変わる | NASA APOD（デモキー即使用可） |
| 5 | ISS通過で宇宙イベント | Open Notify（キー不要） |
| 6 | 祝日で行動が変わる | Nager.Date（キー不要） |
| 7 | 時々詩を引用する | PoetryDB（キー不要） |
| 8 | 地球の裏の時間を語る | WorldTimeAPI（キー不要） |
| 9 | チャットに生存報告 | Discord/Slack Webhook |

### Tier B: 来月実装

| # | 機能 | API |
|---|---|---|
| 10 | 有名リポジトリ図鑑 | GitHub REST API |
| 11 | PRに生き物ステータス | GitHub Actions |
| 12 | 現実の天気と同期 | OpenWeatherMap |

### Tier 夢: Phase 2以降

| # | 機能 | API |
|---|---|---|
| 13 | 物理センサー連携 | Web Serial API |
| 14 | AR表示 | WebXR API |
| 15 | 音声対話操作 | Web Speech Recognition |

---

## 明日朝の実装順（最終確定）

```
1. ターミナル切り替え修正          ← リスク最大、先に潰す
   ├─ OutputChannelでメッセージ確認
   ├─ switch:プレフィックスの到達確認
   └─ 切り替えロジック動作確認

2. Morning Briefing MVP            ← バイラルの核（スタートボタン）
   ├─ 起動5秒後に生き物が話しかける
   ├─ ファイル健康状態のサマリ生成
   └─ 「治しますか？」→ 「はい」でエージェントターミナルへ

3. Web Speech TTS                  ← 生き物が声で喋る（驚き最大）

4. 時間帯行動変化                  ← 朝/昼/夜で生き物の行動が変わる

5. 生き物の言葉を人間的に          ← 非エンジニア向け表現
   ├─ 「bug detected」→「ちょっと体調悪いみたい」
   └─ 感情移入できる表現に
```

---

## ターミナル切り替え修正の具体手順

### 仮説（中島指示）
```
仮説1: agentType が undefined（プロパティ名の不一致）
仮説2: rawType が "switch:undefined"（agentIdがnull）
仮説3: addAgent case に到達する前に別の case が先にマッチ
```

### デバッグ手順
```typescript
// extension.ts の case 'addAgent' 内の最初の行に追加:
const outputChannel = vscode.window.createOutputChannel('Digital Life Debug');
outputChannel.appendLine(`[addAgent] raw message: ${JSON.stringify(message)}`);
outputChannel.show(true);
```

### 代替アプローチ（terminal.show()が効かない場合）
```typescript
// 方法1: TerminalLocation.Editor（エディタタブとして開く）
// 方法2: workbench.action.terminal.focus + focusNext ループ
// 方法3: processId ベースで特定
```

---

## Morning Briefing MVP 設計

```typescript
// src/briefing/MorningBriefing.ts（新規）
export interface BriefingData {
  recentCommits: number;
  newBugs: string[];
  unhealthyFiles: string[];
  topPriority: string | null;
}

// extension.ts の activate() 内:
setTimeout(async () => {
  const briefing = await generateMorningBriefing(creatures, monitor);
  sendToWebview({ type: 'agentSpeak', agentId: firstAgent.id, text: briefing });
  vscode.window.showInformationMessage(briefing);
}, 5000);
```

---

## 名言集

- 堀江: 「考えすぎるな。来週までにMarketplaceに出せ。完璧を目指すな。」
- 中島: 「1つだけやれ。10個の機能が"まあまあ"より、1個の機能が"やばい"の方が100倍広がる。」
- Sam: 「技術がどれだけ凄くても、入口が悪ければ誰も来ない。入口は"生き物が話しかけてくる5秒間"だ。」
- Dario: 「1人の開発者を恋に落とせ。それがClaudeの成長の仕方だった。」
- 上地: 「StarよりIssueが大事。最初のContributor 10人が全てを決める。」
- 佐藤: 「"かわいい"を売りにするな。"直感的にわかる"を売りにしろ。」

---

## 中島聡の「新しいインターフェース」論

NewsPicksの落合陽一対談より:
- 30年間GUIは変わっていない（デスクトップ、アイコン、ウィンドウ）
- 次は「インテント（意図）ベース」のインターフェース
- AIがOS核となり、ユーザーの背後で必要なツールを勝手に叩く
- Digital Lifeはその原形 — 生き物メタファーによるAIエージェント操作
