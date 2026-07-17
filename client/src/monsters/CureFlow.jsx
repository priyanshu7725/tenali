/**
 * CureFlow.jsx
 *
 * A five-question recovery run for a monster/topic pair. It reuses recorded
 * mistakes first, then fetches same-topic questions to make a full set.
 * Four correct answers cure the monster; every attempt is retained in the
 * local cure history.
 */

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { load, recordCure } from './monsterStore.js';
import { getMonsterName } from './monsterExplanations.js';
import MonsterAvatar from './MonsterAvatar.jsx';

const REQUIRED_CORRECT = 4;
const QUESTION_COUNT = 5;
const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

function normalise(value) {
  return String(value ?? '').trim().replace(/\s+/g, '').replace(/−/g, '-');
}

function answersMatch(submitted, expected) {
  const user = normalise(submitted);
  const correct = normalise(expected);
  if (!user || !correct) return false;
  const userNumber = Number(user);
  const correctNumber = Number(correct);
  if (Number.isFinite(userNumber) && Number.isFinite(correctNumber)) {
    return Math.abs(userNumber - correctNumber) < 0.01;
  }
  return user.toLowerCase() === correct.toLowerCase();
}

function historyQuestions(monsterId, topic) {
  const state = load();
  return (state.log || [])
    .filter(entry => entry.monsterId === monsterId && entry.topic === topic)
    .filter(entry => entry.question && entry.correctAnswer != null && entry.correctAnswer !== '')
    .slice(-QUESTION_COUNT)
    .reverse()
    .map((entry, index) => ({
      id: `history-${entry.timestamp}-${index}`,
      prompt: entry.question,
      correctAnswer: entry.correctAnswer,
    }));
}

async function fetchFallbackQuestion(topic, index) {
  const response = await fetch(`${API_BASE}/${topic}-api/question?difficulty=easy`);
  if (!response.ok) throw new Error(`Question endpoint returned ${response.status}`);
  const question = await response.json();
  const prompt = question.prompt ?? question.question ?? '';
  const correctAnswer = question.answer ?? question.correctAnswer ?? question.display;
  if (!prompt || correctAnswer == null || correctAnswer === '') {
    throw new Error('Question response lacks a usable prompt or answer');
  }
  return { id: question.id || `fallback-${index}`, prompt, correctAnswer };
}

function injectStyles() {
  if (typeof document === 'undefined' || document.querySelector('[data-monster-cure]')) return;
  const style = document.createElement('style');
  style.setAttribute('data-monster-cure', '');
  style.textContent = `
    .monster-cure-backdrop {
      position: fixed; inset: 0; z-index: 10010; display: grid; place-items: center;
      padding: 16px; background: rgba(0,0,0,0.65);
    }
    .monster-cure-card {
      position: relative;
      width: min(560px,100%); border-radius: 24px; padding: 32px 24px;
      color: var(--clr-text, #ede8e3); background: var(--clr-card, #2c2622);
      box-shadow: var(--shadow-card, 0 4px 24px rgba(0,0,0,0.25));
      border: 1px solid var(--clr-border, rgba(255,245,230,0.18));
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }
    .monster-cure-kicker {
      margin: 0 0 6px; color: var(--clr-accent, #e8864a);
      font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em;
    }
    .monster-cure-title {
      margin: 0 0 16px;
      font-family: var(--font-display);
      font-size: 26px;
    }
    .monster-cure-progress { margin: 18px 0 8px; color: var(--clr-text-soft, #a89e94); font-size: 14px; width: 100%; text-align: left; }
    .monster-cure-track { height: 7px; overflow: hidden; border-radius: 999px; background: var(--clr-surface, #362f2a); width: 100%; }
    .monster-cure-track > span { display: block; height: 100%; background: var(--clr-accent, #e8864a); transition: width .2s ease; }
    .monster-cure-question {
      margin: 24px 0 14px; padding: 20px; border-radius: var(--radius-sm, 10px);
      text-align: center; font-size: 24px; font-weight: 700; width: 100%;
      background: var(--clr-surface, #362f2a); border: 1px solid var(--clr-border, rgba(255,245,230,0.18));
    }
    .monster-cure-input {
      box-sizing: border-box; width: 100%; padding: 13px 14px;
      border: 1.5px solid var(--clr-border, rgba(255,245,230,0.18));
      border-radius: var(--radius-sm, 10px); color: var(--clr-text, #ede8e3);
      background: var(--clr-input, #3e3631); font: inherit; outline: none;
      transition: border-color var(--transition), box-shadow var(--transition);
    }
    .monster-cure-input:focus {
      border-color: var(--clr-accent, #e8864a);
      box-shadow: 0 0 0 3px var(--clr-accent-soft);
    }
    .monster-cure-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 16px; width: 100%; }
    .monster-cure-actions button {
      padding: 12px 24px; border: 0; border-radius: var(--radius-sm, 10px);
      cursor: pointer; font: inherit; font-weight: 700; transition: transform var(--transition), box-shadow var(--transition), background var(--transition);
    }
    .monster-cure-primary { color: #fff; background: var(--clr-accent, #e8864a); box-shadow: var(--shadow-btn); }
    .monster-cure-primary:hover { transform: translateY(-1px); background: #cc6a2e; }
    .monster-cure-primary:active { transform: translateY(0); }
    .monster-cure-secondary { color: var(--clr-text-soft, #a89e94); background: var(--clr-surface, #362f2a); border: 1px solid var(--clr-border, rgba(255,245,230,0.18)) !important; }
    .monster-cure-secondary:hover { background: var(--clr-hover-strong, rgba(255,245,230,0.08)); }
    .monster-cure-feedback { min-height: 24px; margin: 12px 0 0; font-size: 14px; width: 100%; text-align: left; }
    .monster-cure-good { color: var(--clr-correct, #5cb87a); font-weight: 600; }
    .monster-cure-bad  { color: var(--clr-wrong,   #e05a4a); font-weight: 600; }
    .monster-cure-result { text-align: center; padding: 12px 0; width: 100%; }
    .monster-cure-result h3 { font-family: var(--font-display); font-size: 24px; margin: 16px 0 8px; }
    
    /* CELEBRATION POOF */
    .cure-poof-cloud {
      position: absolute;
      width: 120px;
      height: 120px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0) 70%);
      transform: scale(0);
      opacity: 0;
      pointer-events: none;
      z-index: 10;
      top: 30px;
    }
    .cure-poof-cloud.poof-animate {
      animation: cure-poof-flash 0.5s ease-out;
    }
    @keyframes cure-poof-flash {
      0% { transform: scale(0.3); opacity: 1; filter: brightness(2); }
      50% { transform: scale(1.3); opacity: 0.8; }
      100% { transform: scale(1.6); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

export function CureFlow({ monsterId, topic, onComplete, onCancel }) {
  const [questions, setQuestions] = useState([]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [correctCount, setCorrectCount] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [finished, setFinished] = useState(false);
  const [poofActive, setPoofActive] = useState(false);
  const startedAt = useMemo(() => Date.now(), []);

  useEffect(() => {
    injectStyles();
    let cancelled = false;
    async function prepare() {
      const prepared = historyQuestions(monsterId, topic);
      for (let i = prepared.length; i < QUESTION_COUNT; i += 1) {
        try { prepared.push(await fetchFallbackQuestion(topic, i)); }
        catch (err) { console.warn('[monsters] cure fallback question failed:', err.message); break; }
      }
      while (prepared.length < QUESTION_COUNT && prepared.length > 0) {
        prepared.push({ ...prepared[0], id: `repeat-${prepared.length}` });
      }
      if (cancelled) return;
      if (prepared.length < QUESTION_COUNT) setError('Not enough questions are available for this cure yet.');
      else setQuestions(prepared.slice(0, QUESTION_COUNT));
      setLoading(false);
    }
    prepare();
    return () => { cancelled = true; };
  }, [monsterId, topic]);

  // Spark Celebration Trigger
  useEffect(() => {
    if (finished && correctCount >= REQUIRED_CORRECT) {
      setPoofActive(true);
      setTimeout(() => setPoofActive(false), 500);

      // Trigger operators explosion
      const chars = ['+', '-', 'x', '÷', '★', '✨', '✔'];
      const colors = ['#ffd700', '#5cb87a', '#e8864a', '#fff'];

      // Particle explosion from the center card
      for (let i = 0; i < 40; i++) {
        const p = document.createElement('div');
        p.className = 'cure-particle';
        p.innerText = chars[Math.floor(Math.random() * chars.length)];
        p.style.color = colors[Math.floor(Math.random() * colors.length)];
        
        const angle = Math.random() * Math.PI * 2;
        const dist = 80 + Math.random() * 180;
        const tx = Math.cos(angle) * dist;
        const ty = Math.sin(angle) * dist;
        
        p.style.setProperty('--tx', `${tx}px`);
        p.style.setProperty('--ty', `${ty}px`);
        
        // Spawn around the screen center
        p.style.left = '50%';
        p.style.top = '30%';

        document.body.appendChild(p);
        setTimeout(() => p.remove(), 1200);
      }
    }
  }, [finished, correctCount]);

  function submit() {
    if (!answer.trim() || feedback || !questions[index]) return;
    const isCorrect = answersMatch(answer, questions[index].correctAnswer);
    const nextCorrectCount = correctCount + (isCorrect ? 1 : 0);
    setCorrectCount(nextCorrectCount);
    setFeedback({ isCorrect, nextCorrectCount });
  }

  function advance() {
    if (!feedback) return;
    if (index + 1 < QUESTION_COUNT) {
      setIndex(current => current + 1);
      setAnswer('');
      setFeedback(null);
      return;
    }
    const success = correctCount >= REQUIRED_CORRECT;
    recordCure(monsterId, { startedAt, success, correctCount });
    setFinished(true);
  }

  function closeResult() {
    onComplete && onComplete({ success: correctCount >= REQUIRED_CORRECT, correctCount });
  }

  const body = (
    <div className="monster-cure-backdrop" role="dialog" aria-modal="true" aria-label="Monster cure">
      <div className="monster-cure-card">
        <div className={`cure-poof-cloud ${poofActive ? 'poof-animate' : ''}`} />
        
        {/* Render Monster Avatar. Turns healed only on successful finished view */}
        <MonsterAvatar
          monsterId={monsterId}
          size={90}
          healed={finished && correctCount >= REQUIRED_CORRECT}
          style={{ marginBottom: '16px' }}
        />

        <p className="monster-cure-kicker">Cure run · {getMonsterName(monsterId)}</p>
        <h2 className="monster-cure-title">Practice the pattern, not the panic.</h2>
        {loading && <p>Preparing five questions…</p>}
        {!loading && error && <><p>{error}</p><div className="monster-cure-actions"><button className="monster-cure-secondary" onClick={onCancel}>Back to Hall</button></div></>}
        {!loading && !error && !finished && questions[index] && <>
          <div className="monster-cure-progress">Question {index + 1} of {QUESTION_COUNT} · {correctCount} correct</div>
          <div className="monster-cure-track"><span style={{ width: `${((index + 1) / QUESTION_COUNT) * 100}%` }} /></div>
          <div className="monster-cure-question">{questions[index].prompt}</div>
          <input className="monster-cure-input" autoFocus value={answer} onChange={e => setAnswer(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') feedback ? advance() : submit(); }} placeholder="Your answer" aria-label="Your answer" />
          {feedback && <p className={`monster-cure-feedback ${feedback.isCorrect ? 'monster-cure-good' : 'monster-cure-bad'}`}>{feedback.isCorrect ? 'Correct — keep that pattern.' : `Not quite. The answer was ${questions[index].correctAnswer}.`}</p>}
          <div className="monster-cure-actions">
            <button className="monster-cure-secondary" onClick={onCancel}>Cancel</button>
            <button className="monster-cure-primary" onClick={feedback ? advance : submit}>{feedback ? (index + 1 === QUESTION_COUNT ? 'See result' : 'Next question') : 'Check answer'}</button>
          </div>
        </>}
        {finished && <div className="monster-cure-result"><h3>{correctCount >= REQUIRED_CORRECT ? 'Monster cured!' : 'The monster held on—for now.'}</h3><p>You got {correctCount} of {QUESTION_COUNT}; you need {REQUIRED_CORRECT} to cure it.</p><div className="monster-cure-actions"><button className="monster-cure-primary" onClick={closeResult}>Return to Hall</button></div></div>}
      </div>
    </div>
  );
  return typeof document !== 'undefined' && document.body ? createPortal(body, document.body) : body;
}

export default CureFlow;
