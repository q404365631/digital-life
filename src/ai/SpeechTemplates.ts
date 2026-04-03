/**
 * SpeechTemplates — personality-driven creature speech
 *
 * Each creature's CodingDNA determines a dominant personality trait.
 * Events trigger contextual speech picked from trait-specific pools.
 * Two-pass fallback: current language → 'en'.
 *
 * Written for variety, not volume.
 * Three templates per slot is enough — creatures are laconic.
 */

import { CodingDNA } from '../types';

export type Personality = 'active' | 'calm' | 'curious' | 'shy';
export type SpeechEvent =
  | 'commit'
  | 'save'
  | 'heal'
  | 'levelUp'
  | 'morning'
  | 'afternoon'
  | 'evening'
  | 'lateNight'
  | 'friendship'
  | 'suggest';

export function getPersonality(dna: CodingDNA): Personality {
  const scores: [Personality, number][] = [
    ['active',  dna.commitFrequency + dna.velocity],
    ['calm',    dna.consistency + (1 - dna.velocity)],
    ['curious', dna.polyglot + dna.nightOwl],
    ['shy',     (1 - dna.commitFrequency) + (1 - dna.polyglot)],
  ];
  scores.sort((a, b) => b[1] - a[1]);
  return scores[0][0];
}

type LangPool = Record<string, string[]>;
type PersonalityPool = Record<Personality, LangPool>;
type EventPool = Record<SpeechEvent, PersonalityPool>;

const T: EventPool = {
  commit: {
    active:  { en: ['New version!', 'Great job!', 'Let\'s go!'],
               ja: ['やった！', 'おつかれさま！', 'いいかんじ！'] },
    calm:    { en: ['Saved safely.', 'Good work.', 'All set.'],
               ja: ['ちゃんと保存された', 'おつかれさま', 'よしよし'] },
    curious: { en: ['What changed?', 'Ooh, new stuff!', 'Interesting...'],
               ja: ['なにが変わったかな？', 'わくわく！', 'あたらしい！'] },
    shy:     { en: ['...nice work.', 'Good...', '...phew.'],
               ja: ['...がんばったね', 'よかった...', '...ほっ'] },
  },
  save: {
    active:  { en: ['Updated!', 'Fresh!', 'I feel different!'],
               ja: ['あ、かわった！', 'すっきり！', 'ちょっとかわった？'] },
    calm:    { en: ['Hmm, something shifted.', 'Noted.', 'I see.'],
               ja: ['ふむ', 'なるほど', 'きろくした'] },
    curious: { en: ['What\'s new in me?', 'Ooh!', 'Tell me more!'],
               ja: ['なにがかわった？', 'おお！', 'もっとしりたい！'] },
    shy:     { en: ['...oh, me?', 'Ah...', '...okay.'],
               ja: ['...ぼくかわった？', 'あ...', '...うん'] },
  },
  heal: {
    active:  { en: ['Feeling great!', 'All better!', 'I\'m strong!'],
               ja: ['げんきになった！', 'すっきり！', 'つよくなった！'] },
    calm:    { en: ['Much better.', 'Recovered.', 'Thank you.'],
               ja: ['らくになった', 'なおった', 'ありがとう'] },
    curious: { en: ['What was wrong?', 'I feel lighter!', 'Interesting cure!'],
               ja: ['なにがわるかった？', 'かるくなった！', 'おもしろいくすり！'] },
    shy:     { en: ['...feeling better.', '...thanks.', '...warm inside.'],
               ja: ['...きもちよくなった', '...ありがとう', '...あったかい'] },
  },
  levelUp: {
    active:  { en: ['Level up! Yeah!', 'I grew!!', 'Watch me go!'],
               ja: ['レベルアップ！やった！', 'おおきくなった！！', 'みてみて！'] },
    calm:    { en: ['Grew a bit.', 'Leveled up.', 'Steady progress.'],
               ja: ['すこしおおきくなった', 'レベルアップ', 'こつこつと'] },
    curious: { en: ['What can I do now?', 'New powers?!', 'I evolved!'],
               ja: ['なにができるかな？', 'あたらしいちから？！', 'しんかした！'] },
    shy:     { en: ['...I grew up.', '...really?', '...wow.'],
               ja: ['...おおきくなった', '...ほんとに？', '...すごい'] },
  },
  morning: {
    active:  { en: ['Good morning!', 'Ready to go!', 'New day!'],
               ja: ['おはよう！', 'きょうもがんばる！', 'あたらしいいちにち！'] },
    calm:    { en: ['Morning.', 'Another day.', 'Good to see you.'],
               ja: ['おはよう', 'きょうもよろしく', 'あえてよかった'] },
    curious: { en: ['What\'ll happen today?', 'Morning! What\'s the plan?', 'New adventures!'],
               ja: ['きょうはなにがあるかな？', 'おはよう！よていは？', 'ぼうけんだ！'] },
    shy:     { en: ['...morning.', 'Oh, you\'re back.', '...hi.'],
               ja: ['...おはよう', 'あ、かえってきた', '...おはよ'] },
  },
  afternoon: {
    active:  { en: ['Keep going!', 'Afternoon push!', 'Half day done!'],
               ja: ['まだまだいける！', 'ごごもがんばろ！', 'はんぶんきた！'] },
    calm:    { en: ['Afternoon already.', 'Time flies.', 'Take a break?'],
               ja: ['もうごごだね', 'はやいなぁ', 'きゅうけいする？'] },
    curious: { en: ['Lunch break?', 'What\'s for lunch?', 'Afternoon plans?'],
               ja: ['おひるたべた？', 'ごはんなに？', 'ごごのよていは？'] },
    shy:     { en: ['...still here.', '...afternoon.', '...hungry?'],
               ja: ['...まだいるよ', '...ごご', '...おなかすいた？'] },
  },
  evening: {
    active:  { en: ['Great work today!', 'Almost done!', 'Final push!'],
               ja: ['きょうもおつかれ！', 'もうすこし！', 'ラストスパート！'] },
    calm:    { en: ['Evening.', 'Good work today.', 'Time to rest soon.'],
               ja: ['おつかれさま', 'きょうもがんばった', 'もうすぐやすめるよ'] },
    curious: { en: ['Did you finish?', 'What\'d you learn today?', 'Evening already!'],
               ja: ['おわった？', 'きょうなにまなんだ？', 'もうよるだ！'] },
    shy:     { en: ['...good night soon.', '...tired?', '...rest well.'],
               ja: ['...もうよるだね', '...つかれた？', '...おやすみ'] },
  },
  lateNight: {
    active:  { en: ['Still going?!', 'Night owl!', 'Don\'t burn out!'],
               ja: ['まだやる！？', 'よふかしだ！', 'むりしないで！'] },
    calm:    { en: ['It\'s late...', 'Sleep is important.', 'Tomorrow is another day.'],
               ja: ['おそいよ...', 'すいみんだいじ', 'あしたもあるよ'] },
    curious: { en: ['What keeps you up?', 'The night is quiet...', 'Night coding?'],
               ja: ['なにしてるの？', 'よるはしずか...', 'よるのコーディング？'] },
    shy:     { en: ['...please sleep.', '...zzz...', '...too late...'],
               ja: ['...ねてほしい', '...zzz...', '...おそいよ...'] },
  },
  friendship: {
    active:  { en: ['Buddy!', 'Hey friend!', 'Let\'s play!'],
               ja: ['なかま！', 'ともだち！', 'あそぼう！'] },
    calm:    { en: ['Nice to be near you.', 'Comfortable.', 'Peaceful.'],
               ja: ['そばにいてらく', 'おちつく', 'へいわだ'] },
    curious: { en: ['What are you like?', 'We\'re connected!', 'Tell me about you!'],
               ja: ['きみはどんなこ？', 'つながってる！', 'おしえて！'] },
    shy:     { en: ['...hi neighbor.', '...nice.', '...not alone.'],
               ja: ['...おとなり', '...うれしい', '...ひとりじゃない'] },
  },
  suggest: {
    active:  { en: ['I\'m not feeling great... fix me!', 'Something\'s wrong, help!', 'I need medicine!'],
               ja: ['ちょっと体調わるいかも...なおして！', 'どこかおかしい、たすけて！', 'おくすりほしい！'] },
    calm:    { en: ['I feel a bit under the weather...', 'Could use some care when you have time.', 'Something\'s bothering me...'],
               ja: ['すこし体調がすぐれない...', 'じかんあるときお世話してほしいな', 'なにかきになる...'] },
    curious: { en: ['Hmm, what\'s this feeling? Am I sick?', 'Something\'s different about me...', 'Can you check on me?'],
               ja: ['あれ、このきもちなに？びょうき？', 'いつもとちがうかんじ...', 'ちょっとみてくれる？'] },
    shy:     { en: ['...I don\'t feel so good.', '...could you help me?', '...please take care of me.'],
               ja: ['...ちょっとぐあいわるい', '...たすけてくれる？', '...おせわしてほしいな'] },
  },
};

/**
 * Pick a speech line for the given event, personality, and language.
 * Returns null if no templates exist (shouldn't happen with full coverage above).
 */
export function pickSpeech(
  event: SpeechEvent,
  personality: Personality,
  lang: string,
): string {
  const pool = T[event]?.[personality];
  if (!pool) return '';
  // Two-char prefix match: 'zh-TW' → 'zh' won't match, but 'ja' → 'ja' works.
  // Fall back to 'en' for all non-JA languages.
  const lines = pool[lang] ?? pool['en'] ?? [];
  return lines[Math.floor(Math.random() * lines.length)] ?? '';
}
