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
    .monster-cure-backdrop { position:fixed; inset:0; z-index:10010; display:grid; place-items:center; padding:16px; background:rgba(5,8,18,.78); }
    .monster-cure-card { width:min(560px,100%); border-radius:18px; padding:24px; color:#f8fbff; background:#18213a; box-shadow:0 24px 70px rgba(0,0,0,.45); }
    .monster-cure-kicker { margin:0 0 6px; color:#9fc0ff; font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; }
    .monster-cure-title { margin:0; font-size:25px; }
    .monster-cure-progress { margin:18px 0 8px; color:#bdc8df; font-size:14px; }
    .monster-cure-track { height:7px; overflow:hidden; border-radius:999px; background:#2a3657; }
    .monster-cure-track > span { display:block; height:100%; background:#6ea8fe; transition:width .2s ease; }
    .monster-cure-question { margin:26px 0 14px; padding:18px; border-radius:12px; text-align:center; font-size:22px; font-weight:700; background:rgba(255,255,255,.07); }
    .monster-cure-input { box-sizing:border-box; width:100%; padding:13px 14px; border:1px solid #53678f; border-radius:9px; color:inherit; background:#10182b; font:inherit; }
    .monster-cure-actions { display:flex; gap:10px; justify-content:flex-end; margin-top:16px; }
    .monster-cure-actions button { padding:10px 15px; border:0; border-radius:8px; cursor:pointer; font:inherit; font-weight:700; }
    .monster-cure-primary { color:#08111f; background:#8dbbff; }
    .monster-cure-secondary { color:#dce7ff; background:#2b3858; }
    .monster-cure-feedback { min-height:24px; margin:12px 0 0; font-size:14px; }
    .monster-cure-good { color:#88e2aa; } .monster-cure-bad { color:#ff9f9f; }
    .monster-cure-result { text-align:center; padding:12px 0; }
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
      // If the endpoint is unavailable, repeating a real historical mistake
      // is still better than showing a broken cure session.
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
