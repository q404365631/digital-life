/*
 * i18n — Digital Life by SHIKAKERU
 *
 * Design principles:
 *   - Zero technical jargon. A child should understand every string.
 *   - The creature IS the interface. Language describes feelings, not metrics.
 *   - Emoji used only where they carry meaning, never as decoration.
 */

export type Language = 'en' | 'ja' | 'zh-TW' | 'zh-CN' | 'ko' | 'es';

const LANG_CYCLE: readonly Language[] = ['en', 'ja', 'zh-TW', 'zh-CN', 'ko', 'es'];
const LANG_LABEL: Record<Language, string> = {
  'en': 'EN',
  'ja': 'JA',
  'zh-TW': '繁',
  'zh-CN': '简',
  'ko': 'KO',
  'es': 'ES',
};

type Dict = Record<string, string>;

const dict: Record<Language, Dict> = {

  // ── English ──────────────────────────────────────────────
  en: {
    lives:            'friends',
    nom:              'nom',
    committed:        'Treat time!',

    // toolbar (icon-only — these are tooltips)
    tt_feed:          'Give food',
    tt_care:          'Take care',
    tt_lang:          'Language',
    tt_mute:          'Sound',
    tt_unmute:        'Sound',
    tt_add_agent:     'Call a helper',
    tt_delete:        'Say goodbye',
    tt_clear:         'Start over',

    // action feedback
    click_feed:       'Tap a friend to feed',
    click_care:       'Tap a friend to take care of',
    feed_msg:         'Yum! Feeling good.',
    care_diagnosing:  'Checking up...',
    care_approved:    'Helper is on it!',
    approve:          'Yes',
    cancel:           'Nope',

    // health report (emotional, not technical)
    hr_title:         'How are they?',
    hr_great:         'Feeling great',
    hr_sick:          'Feeling sick',
    hr_heavy:         'Overfed',
    hr_sleepy:        'Sleepy',

    // creature speech bubbles
    bubble_hungry:    'hungry...',
    bubble_sick:      'not feeling well...',
    bubble_heavy:     'so full...',
    bubble_sleepy:    'zzz...',
    bubble_happy:     'life is good',
    bubble_evolve:    'I grew up!',

    // personality (replaces DNA)
    personality:      'Personality',
    trait_active:     'Active',
    trait_nocturnal:  'Night owl',
    trait_curious:    'Curious',
    trait_swift:      'Swift',
    trait_steady:     'Steady',
  },

  // ── Japanese ─────────────────────────────────────────────
  ja: {
    lives:            'なかま',
    nom:              'もぐもぐ',
    committed:        'ごほうびタイム！',

    tt_feed:          'ごはんをあげる',
    tt_care:          'お世話する',
    tt_lang:          'ことば',
    tt_mute:          'おと',
    tt_unmute:        'おと',
    tt_add_agent:     'おたすけを呼ぶ',
    tt_delete:        'おわかれ',
    tt_clear:         'やりなおす',

    click_feed:       'ごはんをあげたい子をタップ',
    click_care:       'お世話したい子をタップ',
    feed_msg:         'もぐもぐ！ごきげん',
    care_diagnosing:  'みてるよ...',
    care_approved:    'おたすけ開始！',
    approve:          'うん',
    cancel:           'やめる',

    hr_title:         'みんなの様子',
    hr_great:         'げんき',
    hr_sick:          'ぐったり',
    hr_heavy:         'おなかパンパン',
    hr_sleepy:        'すやすや',

    bubble_hungry:    'おなかすいた...',
    bubble_sick:      'きもちわるい...',
    bubble_heavy:     'くるしい...',
    bubble_sleepy:    'zzz...',
    bubble_happy:     'いいきもち',
    bubble_evolve:    'おおきくなった！',

    personality:      'せいかく',
    trait_active:     'かつどうてき',
    trait_nocturnal:  'よるがた',
    trait_curious:    'こうきしん',
    trait_swift:      'すばやい',
    trait_steady:     'まじめ',
  },

  // ── Traditional Chinese ──────────────────────────────────
  'zh-TW': {
    lives:            '夥伴',
    nom:              '嚼嚼',
    committed:        '獎勵時間！',

    tt_feed:          '餵食',
    tt_care:          '照顧',
    tt_lang:          '語言',
    tt_mute:          '聲音',
    tt_unmute:        '聲音',
    tt_add_agent:     '呼叫幫手',
    tt_delete:        '告別',
    tt_clear:         '重新開始',

    click_feed:       '點擊想要餵食的夥伴',
    click_care:       '點擊想要照顧的夥伴',
    feed_msg:         '嚼嚼！心情好好',
    care_diagnosing:  '看看狀況...',
    care_approved:    '幫手出發！',
    approve:          '好',
    cancel:           '不要',

    hr_title:         '大家的狀態',
    hr_great:         '很有精神',
    hr_sick:          '不舒服',
    hr_heavy:         '吃太飽了',
    hr_sleepy:        '想睡覺',

    bubble_hungry:    '肚子餓了...',
    bubble_sick:      '不太舒服...',
    bubble_heavy:     '好撐...',
    bubble_sleepy:    'zzz...',
    bubble_happy:     '好開心',
    bubble_evolve:    '我長大了！',

    personality:      '個性',
    trait_active:     '活潑',
    trait_nocturnal:  '夜貓子',
    trait_curious:    '好奇',
    trait_swift:      '敏捷',
    trait_steady:     '穩重',
  },

  // ── Simplified Chinese ───────────────────────────────────
  'zh-CN': {
    lives:            '伙伴',
    nom:              '嚼嚼',
    committed:        '奖励时间！',

    tt_feed:          '喂食',
    tt_care:          '照顾',
    tt_lang:          '语言',
    tt_mute:          '声音',
    tt_unmute:        '声音',
    tt_add_agent:     '呼叫帮手',
    tt_delete:        '告别',
    tt_clear:         '重新开始',

    click_feed:       '点击想要喂食的伙伴',
    click_care:       '点击想要照顾的伙伴',
    feed_msg:         '嚼嚼！心情好好',
    care_diagnosing:  '看看状况...',
    care_approved:    '帮手出发！',
    approve:          '好',
    cancel:           '不要',

    hr_title:         '大家的状态',
    hr_great:         '很有精神',
    hr_sick:          '不舒服',
    hr_heavy:         '吃太饱了',
    hr_sleepy:        '想睡觉',

    bubble_hungry:    '肚子饿了...',
    bubble_sick:      '不太舒服...',
    bubble_heavy:     '好撑...',
    bubble_sleepy:    'zzz...',
    bubble_happy:     '好开心',
    bubble_evolve:    '我长大了！',

    personality:      '性格',
    trait_active:     '活泼',
    trait_nocturnal:  '夜猫子',
    trait_curious:    '好奇',
    trait_swift:      '敏捷',
    trait_steady:     '稳重',
  },

  // ── Korean ───────────────────────────────────────────────
  ko: {
    lives:            '친구',
    nom:              '냠냠',
    committed:        '간식 시간!',

    tt_feed:          '밥 주기',
    tt_care:          '돌보기',
    tt_lang:          '언어',
    tt_mute:          '소리',
    tt_unmute:        '소리',
    tt_add_agent:     '도우미 부르기',
    tt_delete:        '안녕히',
    tt_clear:         '처음부터',

    click_feed:       '밥 줄 친구를 탭하세요',
    click_care:       '돌볼 친구를 탭하세요',
    feed_msg:         '냠냠! 기분 좋아',
    care_diagnosing:  '살펴보는 중...',
    care_approved:    '도우미 출발!',
    approve:          '응',
    cancel:           '아니',

    hr_title:         '모두의 상태',
    hr_great:         '기운 넘침',
    hr_sick:          '아픔',
    hr_heavy:         '배부름',
    hr_sleepy:        '졸림',

    bubble_hungry:    '배고파...',
    bubble_sick:      '몸이 안 좋아...',
    bubble_heavy:     '너무 불러...',
    bubble_sleepy:    'zzz...',
    bubble_happy:     '기분 좋아',
    bubble_evolve:    '나 컸어!',

    personality:      '성격',
    trait_active:     '활발',
    trait_nocturnal:  '올빼미',
    trait_curious:    '호기심',
    trait_swift:      '민첩',
    trait_steady:     '꾸준',
  },

  // ── Spanish ──────────────────────────────────────────────
  es: {
    lives:            'amigos',
    nom:              'ñam',
    committed:        'Hora de premio!',

    tt_feed:          'Dar comida',
    tt_care:          'Cuidar',
    tt_lang:          'Idioma',
    tt_mute:          'Sonido',
    tt_unmute:        'Sonido',
    tt_add_agent:     'Llamar ayudante',
    tt_delete:        'Despedirse',
    tt_clear:         'Empezar de nuevo',

    click_feed:       'Toca un amigo para alimentar',
    click_care:       'Toca un amigo para cuidar',
    feed_msg:         'Ñam! Se siente bien.',
    care_diagnosing:  'Revisando...',
    care_approved:    'El ayudante va!',
    approve:          'Si',
    cancel:           'No',

    hr_title:         'Como estan?',
    hr_great:         'Muy bien',
    hr_sick:          'Enfermo',
    hr_heavy:         'Muy lleno',
    hr_sleepy:        'Dormido',

    bubble_hungry:    'tengo hambre...',
    bubble_sick:      'no me siento bien...',
    bubble_heavy:     'estoy lleno...',
    bubble_sleepy:    'zzz...',
    bubble_happy:     'que bien',
    bubble_evolve:    'He crecido!',

    personality:      'Personalidad',
    trait_active:     'Activo',
    trait_nocturnal:  'Nocturno',
    trait_curious:    'Curioso',
    trait_swift:      'Veloz',
    trait_steady:     'Constante',
  },
};

// ── Runtime ────────────────────────────────────────────────

let current: Language = 'en';

export const setLanguage  = (l: Language): void => { current = l; };
export const getLanguage  = (): Language => current;
export const nextLanguage = (): Language => LANG_CYCLE[(LANG_CYCLE.indexOf(current) + 1) % LANG_CYCLE.length];
export const langLabel    = (l: Language = current): string => LANG_LABEL[l];

export function t(key: string, params?: Record<string, string | number>): string {
  let text = dict[current]?.[key] ?? dict['en']?.[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, String(v));
    }
  }
  return text;
}
