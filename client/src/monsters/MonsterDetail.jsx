/**
 * MonsterDetail.jsx
 *
 * Full explanation view rendered inside HallPanel when a MonsterCard is
 * tapped. Shows the monster's name, tagline, full description, tips,
 * statistics (breach count, last attempt, cure history), and the
 * "Start Cure" CTA.
 *
 * Spec: §6.5 — "Tap → <MonsterDetail> overlay"
 *
 * UX:
 *   - Hero with monster blob + name + tagline
 *   - Stats row: breach count, last attempt, total cures (and successful)
 *   - Description paragraph
 *   - Tips as bullet list
 *   - Two actions: "Start Cure" (calls onStartCure) and "Back to Hall" (handled
 *     by HallPanel via the back button in the header — but we also support an
 *     explicit back button for usability)
 *
 * Props:
 *   - monsterId: string
 *   - breachCount: number
 *   - lastAttempt: number | null
 *   - cureHistory: Array<{ startedAt, success, correctCount }>
 *   - onBack: () => void
 *   - onStartCure: (monsterId, topic) => void
 */

import { useMemo, useState } from 'react';
import {
  getMonsterExplanation,
  getMonsterName,
  getMonsterTagline,
} from './monsterExplanations.js';
import { load } from './monsterStore.js';

// Color per monster (matches MonsterCard and MonsterToast)
const MONSTER_COLORS = {
  'bracketeer':     { primary: '#5b8def', secondary: '#3a6fce', emoji: '🎯' },
  'sign-swapper':   { primary: '#ef5b5b', secondary: '#ce3a3a', emoji: '⚡' },
  'decimal-drifter':{ primary: '#f0a500', secondary: '#c78700', emoji: '🌊' },
  'carry-crasher':  { primary: '#9b59b6', secondary: '#7d3fa0', emoji: '💥' },
};

function formatRelativeTime(ms) {
  if (ms == null) return 'never';
  const delta = Date.now() - ms;
  if (delta < 60_000) return 'just now';
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)} min ago`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)} hr ago`;
  if (delta < 604_800_000) return `${Math.floor(delta / 86_400_000)} days ago`;
  return new Date(ms).toLocaleDateString();
}

function injectDetailStyles() {
  if (typeof document === 'undefined') return;
  if (document.querySelector('style[data-monster-detail]')) return;

  const css = `
    .monster-detail {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .monster-detail-hero {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px;
      background: linear-gradient(135deg, rgba(91, 141, 239, 0.12), rgba(91, 141, 239, 0.04));
      border-radius: 12px;
      border-left: 4px solid var(--monster-primary, #5b8def);
    }
    .monster-detail-hero.warning {
      border-left-color: var(--clr-accent, #e8864a) !important;
      background: linear-gradient(135deg, rgba(232, 134, 74, 0.12), rgba(232, 134, 74, 0.04)) !important;
    }
    .monster-detail-hero.healed {
      border-left-color: #ffd700 !important;
      background: linear-gradient(135deg, rgba(255, 215, 0, 0.12), rgba(255, 215, 0, 0.04)) !important;
    }
    .monster-detail-blob {
      width: 80px;
      height: 80px;
      border-radius: 50% 40% 60% 50%;
      background: var(--monster-primary, #5b8def);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 38px;
      flex-shrink: 0;
      box-shadow: inset 0 -6px 12px rgba(0, 0, 0, 0.25), 0 4px 12px rgba(0, 0, 0, 0.3);
      animation: monster-detail-pulse 2.4s ease-in-out infinite;
    }
    @keyframes monster-detail-pulse {
      0%, 100% { transform: scale(1) rotate(0deg); }
      50%      { transform: scale(1.04) rotate(2deg); }
    }
    .monster-detail-name {
      font-size: 22px;
      font-weight: 700;
      margin: 0 0 4px;
    }
    .monster-detail-tagline {
      font-size: 14px;
      opacity: 0.8;
      font-style: italic;
      margin: 0;
    }
    .monster-detail-stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }
    .monster-detail-stat {
      text-align: center;
      padding: 10px;
      background: var(--clr-hover, rgba(255,245,230,0.04));
      border-radius: var(--radius-sm, 10px);
      border: 1px solid var(--clr-border, rgba(255,245,230,0.18));
    }
    .monster-detail-stat-value {
      font-size: 20px;
      font-weight: 700;
      color: var(--monster-primary, #5b8def);
      display: block;
    }
    .monster-detail-hero.healed .monster-detail-stat-value {
      color: #ffd700;
    }
    .monster-detail-hero.warning .monster-detail-stat-value {
      color: var(--clr-accent, #e8864a);
    }
    .monster-detail-stat-label {
      font-size: 11px;
      opacity: 0.7;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 2px;
    }
    .monster-detail-section h3 {
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 1px;
      opacity: 0.7;
      margin: 0 0 8px;
      font-weight: 600;
    }
    .monster-detail-description {
      font-size: 15px;
      line-height: 1.6;
      margin: 0;
    }
    .monster-detail-tips {
      margin: 0;
      padding-left: 20px;
    }
    .monster-detail-tips li {
      font-size: 14px;
      line-height: 1.5;
      margin-bottom: 8px;
    }
    .monster-detail-actions {
      display: flex;
      gap: 10px;
      padding-top: 8px;
      border-top: 1px solid var(--clr-border, rgba(255,245,230,0.18));
    }
    .monster-detail-btn {
      flex: 1;
      padding: 12px 16px;
      border-radius: var(--radius-sm, 10px);
      border: none;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
    }
    .monster-detail-btn-primary {
      background: var(--monster-primary, #5b8def);
      color: white;
    }
    .monster-detail-hero.healed ~ .monster-detail-actions .monster-detail-btn-primary {
      background: #ffd700;
      color: #1a1614;
    }
    .monster-detail-hero.warning ~ .monster-detail-actions .monster-detail-btn-primary {
      background: var(--clr-accent, #e8864a);
      color: white;
    }
    .monster-detail-btn-primary:hover {
      filter: brightness(1.1);
    }
    .monster-detail-btn-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .monster-detail-btn-secondary {
      background: var(--clr-hover, rgba(255,245,230,0.04));
      color: var(--clr-text, #ede8e3);
    }
    .monster-detail-btn-secondary:hover {
      background: var(--clr-hover-strong, rgba(255,245,230,0.08));
    }
    .monster-detail-topic-select {
      flex: 1;
      padding: 12px 16px;
      border-radius: 8px;
      border: 1px solid var(--clr-border, rgba(255,245,230,0.18));
      background: var(--clr-input, #3e3631);
      color: var(--clr-text, #ede8e3);
      font-size: 14px;
      font-family: inherit;
    }
  `;

  const style = document.createElement('style');
  style.setAttribute('data-monster-detail', '');
  style.textContent = css;
  document.head.appendChild(style);
}

/**
 * Find the most common topic this monster has been triggered on.
 * Falls back to first seen topic, or null.
 */
function getSuggestedTopic(monsterId) {
  const state = load();
  if (!state || !Array.isArray(state.log)) return null;
  const counts = {};
  for (const e of state.log) {
    if (e.monsterId === monsterId && e.topic) {
      counts[e.topic] = (counts[e.topic] || 0) + 1;
    }
  }
  const entries = Object.entries(counts);
  if (entries.length === 0) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

/**
 * Return all unique topics this monster has been triggered on,
 * sorted by frequency (most breached topic first).
 * Used to populate the cure topic selector with real choices.
 */
function getAllTopics(monsterId) {
  const state = load();
  if (!state || !Array.isArray(state.log)) return [];
  const counts = {};
  for (const e of state.log) {
    if (e.monsterId === monsterId && e.topic) {
      counts[e.topic] = (counts[e.topic] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([topic]) => topic);
}

import MonsterAvatar from './MonsterAvatar.jsx';
import { getMonsterHealedState } from './monsterStore.js';

export function MonsterDetail({ monsterId, breachCount, lastAttempt, cureHistory, onBack, onStartCure }) {
  // Inject styles once
  if (typeof document !== 'undefined') injectDetailStyles();

  const entry = getMonsterExplanation(monsterId);
  const colors = MONSTER_COLORS[monsterId] || MONSTER_COLORS['bracketeer'];

  // The cure flow will need a topic. Default to most common historical topic
  // for this monster. User can change before starting.
  const initialTopic = useMemo(() => getSuggestedTopic(monsterId) || '', [monsterId]);
  const allTopics = useMemo(() => getAllTopics(monsterId), [monsterId]);
  const [topic, setTopic] = useState(initialTopic);

  if (!entry) {
    return (
      <div className="monster-detail">
        <p>Unknown monster.</p>
        <button className="monster-detail-btn monster-detail-btn-secondary" onClick={onBack}>Back to Hall</button>
      </div>
    );
  }

  const curesTotal = Array.isArray(cureHistory) ? cureHistory.length : 0;
  const curesSuccessful = Array.isArray(cureHistory) ? cureHistory.filter(c => c && c.success).length : 0;
  const healedState = getMonsterHealedState(monsterId);

  function handleStart() {
    if (!topic) return;
    onStartCure && onStartCure(monsterId, topic);
  }

  return (
    <div className="monster-detail" data-monster-id={monsterId}>
      <div className={`monster-detail-hero ${healedState}`} style={{ '--monster-primary': colors.primary, '--monster-secondary': colors.secondary }}>
        <MonsterAvatar monsterId={monsterId} size={80} state={healedState} />
        <div>
          <h2 className="monster-detail-name" style={{ fontFamily: 'var(--font-display)' }}>{entry.name}</h2>
          <p className="monster-detail-tagline">{entry.tagline}</p>
        </div>
      </div>

      <div className="monster-detail-stats">
        <div className="monster-detail-stat">
          <span className="monster-detail-stat-value" style={healedState === 'healed' ? {color:'#ffd700'} : healedState === 'warning' ? {color:'var(--clr-accent)'} : {}}>{breachCount}</span>
          <span className="monster-detail-stat-label">Breaches</span>
        </div>
        <div className="monster-detail-stat">
          <span className="monster-detail-stat-value" style={healedState === 'healed' ? {color:'#ffd700'} : healedState === 'warning' ? {color:'var(--clr-accent)'} : {}}>{formatRelativeTime(lastAttempt)}</span>
          <span className="monster-detail-stat-label">Last Seen</span>
        </div>
        <div className="monster-detail-stat">
          <span className="monster-detail-stat-value" style={healedState === 'healed' ? {color:'#ffd700'} : healedState === 'warning' ? {color:'var(--clr-accent)'} : {}}>{curesSuccessful}/{curesTotal}</span>
          <span className="monster-detail-stat-label">Cures</span>
        </div>
      </div>


      <div className="monster-detail-section">
        <h3 style={{ fontFamily: 'var(--font-display)' }}>What it does</h3>
        <p className="monster-detail-description">{entry.description}</p>
      </div>

      <div className="monster-detail-section">
        <h3 style={{ fontFamily: 'var(--font-display)' }}>Tips for next time</h3>
        <ul className="monster-detail-tips">
          {entry.tips.map((tip, i) => (
            <li key={i}>{tip}</li>
          ))}
        </ul>
      </div>

      <div className="monster-detail-actions">
        <select
          className="monster-detail-topic-select"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          aria-label="Cure topic"
        >
          {allTopics.length === 0 && (
            <option value="" disabled>No history yet — get a question wrong first</option>
          )}
          {allTopics.length > 0 && !topic && (
            <option value="" disabled>Pick a topic to practice…</option>
          )}
          {allTopics.map((t) => (
            <option key={t} value={t}>
              {t}{t === initialTopic ? ' (your usual)' : ''}
            </option>
          ))}
        </select>
        <button
          className="monster-detail-btn monster-detail-btn-primary"
          onClick={handleStart}
          disabled={!topic}
        >
          Start Cure →
        </button>
      </div>
    </div>
  );
}

export default MonsterDetail;