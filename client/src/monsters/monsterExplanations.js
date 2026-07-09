/**
 * monsterExplanations.js
 *
 * Static, hand-written mini-lessons shown in the Hall of Silly Mistakes when a
 * student taps a monster. No LLM, no runtime generation — these are the
 * authoritative explanations for v0.2. Future versions can ship a richer set
 * or accept additions without changing the schema.
 *
 * Schema is intentionally flat: an object keyed by monsterId. Each entry has
 * the four pieces of text the Hall panel needs to render a card.
 *   - name:        Display name (e.g. "The Bracketeer")
 *   - tagline:     One-line mood (e.g. "Forgot to share with everyone inside.")
 *   - description: Three-sentence pedagogical mini-lesson.
 *   - tips:        Two practical tips for the cure / next-attempt.
 *
 * Keep the language second-person and concrete. The student should read it
 * once and understand the mistake. Author: P. Sole sign-off authority: P.
 */

export const MONSTER_EXPLANATIONS = {
  'bracketeer': {
    name: 'The Bracketeer',
    tagline: 'Forgot to share with everyone inside.',
    description:
      'When you see a(b + c), every term inside the brackets gets multiplied by the number outside. ' +
      '3(x + 2) = 3·x + 3·2 = 3x + 6. The Bracketeer got you because you multiplied the outside ' +
      'number by only the first term inside. Distribute to all the terms, not just one.',
    tips: [
      'Count the terms inside the brackets before you start. Each one needs a partner from outside.',
      'If your answer has fewer terms than expected, you probably missed one.',
    ],
  },

  'sign-swapper': {
    name: 'The Sign Swapper',
    tagline: 'Mixed up your + and −.',
    description:
      'When negative numbers appear in a problem, slow down at the very last step. ' +
      'Did your answer keep the sign the problem asked for? A sign swap means everything else was ' +
      'right, but the final value came out with the opposite sign.',
    tips: [
      'Box the sign of the answer before you start computing. Re-check the box at the end.',
      'If a question involves (-3) and you got -2 when 2 is plausible, suspect the Sign Swapper.',
    ],
  },

  'decimal-drifter': {
    name: 'The Decimal Drifter',
    tagline: 'The point jumped to the wrong spot.',
    description:
      'Decimal answers depend on place value: the position of the dot tells you whether 0.8 means ' +
      '"eight tenths" or "eight hundredths". When your answer has the same digits as the correct ' +
      'answer but the decimal point sits somewhere else, that is a drift. Count the decimal places ' +
      'in the question, count them in your answer, and they should match.',
    tips: [
      'After computing, read your answer aloud as words ("zero point zero eight") to spot a drift.',
      'Sanity-check: 0.5 × 0.4 should be smaller than 0.5. If it is bigger, the dot moved the wrong way.',
    ],
  },

  'carry-crasher': {
    name: 'The Carry Crasher',
    tagline: 'The carried number got lost.',
    description:
      'When you add or subtract multi-digit numbers, work column by column, right to left. ' +
      'If a column adds up to 10 or more, write down the ones digit and carry the tens to the next column. ' +
      'If your answer is "one off" from the right answer in a way that hints at a missed or extra carry, ' +
      'redo the columns one at a time and watch the carries.',
    tips: [
      'Write the carried digits above the next column. They disappear in your head, not on the page.',
      'If a carry feels "weird", trust the rewrite — column-by-column is faster than guessing.',
    ],
  },
};

/**
 * Return the explanation entry for a monsterId, or null if the id is unknown.
 * Safe consumer-facing lookup; defaults never throw.
 */
export function getMonsterExplanation(monsterId) {
  return MONSTER_EXPLANATIONS[monsterId] || null;
}

/**
 * Display name for a monsterId, or "Unknown Monster" if the id is unknown.
 * Useful for toasts where we want a single string without a shape check.
 */
export function getMonsterName(monsterId) {
  const entry = MONSTER_EXPLANATIONS[monsterId];
  return entry ? entry.name : 'Unknown Monster';
}

/**
 * Tagline for a monsterId, or empty string. Cheap accessor used in toast
 * render. Distinct from description — tagline is the one-liner.
 */
export function getMonsterTagline(monsterId) {
  const entry = MONSTER_EXPLANATIONS[monsterId];
  return entry ? entry.tagline : '';
}
