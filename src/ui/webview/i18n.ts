export type Language = 'en' | 'ja';

const translations: Record<Language, Record<string, string>> = {
  en: {
    'goal': 'GOAL: CARE FOR THEM',
    'lives': 'Lives',
    'bugs': 'Bugs',
    'feed': 'Feed',
    'pet': 'Pet',
    'mute': 'Mute',
    'unmute': 'Unmute',
    'nom': 'nom',
    'dna': 'DNA',
    'freq': 'Freq',
    'night': 'Night',
    'poly': 'Poly',
    'speed': 'Speed',
    'consist': 'Consist',
    'lang': 'Lang',
    'diet_msg': 'This file is too long ({lines} lines). Split into smaller modules!',
    'cure_msg': 'Bugs found ({bugs})! Remove TODO, console.log, and any types.',
    'wake_msg': "This file hasn't been touched in {days} days. Time to review!",
    'feed_msg': 'Yum! Your creature is happy.',
    'diet_wrong': 'This file is already slim ({lines} lines). No diet needed!',
    'cure_wrong': 'No bugs found. This file is clean!',
    'wake_wrong': 'This file was recently edited. No need to wake!',
    'diet_label': 'Diet',
    'cure_label': 'Cure',
    'wake_label': 'Wake',
    'feed_label': 'Feed',
    'chat_placeholder': 'Talk to your agent...',
    'chat_send': 'Send',
    'chat_greeting': 'What can I help you with?',
    'chat_working': 'Working on: "{msg}"',
    'committed': 'Committed!',
    'you': 'You',
    'click_feed': '\u{1F35E} Click a creature to feed!',
    'click_care': '\u{1FA7A} Click a creature to care for!',
    'care_label': 'Care',
    'care_diagnosing': 'Diagnosing...',
    'care_approved': 'AI is working on it!',
    'approve': 'OK',
    'cancel': 'Cancel',
    'add_agent': '+ Agent',
    'health_report': 'Code Health',
    'total_lines': 'Lines',
    'avg_level': 'Avg Lv',
    'healthy': 'Healthy',
    'fat_files': 'Fat',
    'abandoned': 'Idle',
  },
  ja: {
    'goal': 'みんなを大切に育てよう',
    'lives': 'いきもの',
    'bugs': 'バグ',
    'feed': 'ごはん',
    'pet': 'なでる',
    'mute': 'ミュート',
    'unmute': 'ミュート解除',
    'nom': 'もぐもぐ',
    'dna': 'DNA',
    'freq': '頻度',
    'night': '夜型',
    'poly': '多言語',
    'speed': '速度',
    'consist': '規則性',
    'lang': '言語',
    'diet_msg': 'このファイルは長すぎます（{lines}行）。小さなモジュールに分割しましょう！',
    'cure_msg': 'バグ発見（{bugs}件）！TODO、console.log、any型を除去しましょう。',
    'wake_msg': 'このファイルは{days}日間放置されています。レビューしましょう！',
    'feed_msg': 'もぐもぐ！生き物が喜んでいます。',
    'diet_wrong': 'このファイルはスリムです（{lines}行）。ダイエット不要！',
    'cure_wrong': 'バグはありません。きれいなファイルです！',
    'wake_wrong': 'このファイルは最近編集されています。起こす必要なし！',
    'diet_label': 'ダイエット',
    'cure_label': '治療',
    'wake_label': '起こす',
    'feed_label': 'ごはん',
    'chat_placeholder': 'エージェントに話しかける...',
    'chat_send': '送信',
    'chat_greeting': '何かお手伝いしましょうか？',
    'chat_working': '作業中: 「{msg}」',
    'committed': 'コミット！',
    'you': 'あなた',
    'click_feed': '\u{1F35E} 生き物をクリックして餌をあげよう！',
    'click_care': '\u{1FA7A} ケアしたい生き物をクリック！',
    'care_label': 'ケア',
    'care_diagnosing': '診断中...',
    'care_approved': 'AIが作業を開始しました！',
    'approve': 'OK',
    'cancel': 'キャンセル',
    'add_agent': '+ エージェント',
    'health_report': 'コード健康度',
    'total_lines': '行数',
    'avg_level': '平均Lv',
    'healthy': '健康',
    'fat_files': '肥大',
    'abandoned': '放置',
  },
};

let currentLang: Language = 'en';

export function setLanguage(lang: Language): void {
  currentLang = lang;
}

export function getLanguage(): Language {
  return currentLang;
}

export function t(key: string, params?: Record<string, string | number>): string {
  let text = translations[currentLang]?.[key] ?? translations['en']?.[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, String(v));
    }
  }
  return text;
}
