/**
 * MonsterToast.jsx
 *
 * Renders a brief, top-right floating notification when a monster is
 * triggered. Subscribes to `tenali:wrongAnswer` CustomEvent on window.
 *
 * Spec: D:\vins-phase-2\tenali-docs-backup\FEATURE_MONSTERS.md v0.2 §6.
 *
 * UX:
 *   - First sighting ("introduced!") — 5s on screen, larger, has "View Hall" CTA
 *   - Repeat sighting ("strikes again!") — 2s on screen, tappable, dismisses on click
 *   - Closes on timeout or click
 *   - Multiple wrong answers in quick succession queue up (latest wins after
 *     the current toast finishes); spec §6.5.
 *
 * Layout:
 *   - Position: fixed top-right, 24px from edges
 *   - Styling: CSS blobs for the monster art (color per monster), uses CSS
 *     variables from theme if present, falls back to own colors
 *   - z-index: high (999999) so it sits above all other UI
 *   - Animation: slide-in from right, fade-out on dismiss
 *
 * No new external dependencies. Plain React + inline styles + a tiny CSS block
 * injected once via a <style> tag.
 */

import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getMonsterName, getMonsterTagline } from './monsterExplanations.js';
import { isMonsterSeen } from './monsterStore.js';

const EVENT_NAME = 'tenali:wrongAnswer';
const INTRO_DURATION_MS = 5000;
const REPEAT_DURATION_MS = 2000;
const FADE_OUT_MS = 300;

// Color scheme per monster (spec §4.4 — distinctive, animatable blobs)
const MONSTER_COLORS = {
  'bracketeer':     { primary: '#5b8def', secondary: '#3a6fce', emoji: '🎯' },
  'sign-swapper':   { primary: '#ef5b5b', secondary: '#ce3a3a', emoji: '⚡' },
  'decimal-drifter':{ primary: '#f0a500', secondary: '#c78700', emoji: '🌊' },
  'carry-crasher':  { primary: '#9b59b6', secondary: '#7d3fa0', emoji: '💥' },
};

/**
 * Inject a one-time CSS block for the toast. Idempotent via data attribute.
 */
function injectToastStyles() {
  if (typeof document === 'undefined') return;
  if (document.querySelector('style[data-monster-toast]')) return;

  const css = `
    .monster-toast {
      position: fixed;
      top: 24px;
      right: 24px;
      min-width: 280px;
      max-width: 360px;
      padding: 16px 18px;
      background: var(--card-bg, #1e1e2e);
      color: var(--text, #f0f0f0);
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
      border-left: 4px solid var(--monster-primary, #5b8def);
      z-index: 999999;
      cursor: pointer;
      user-select: none;
      animation: monster-toast-slidein 280ms cubic-bezier(0.4, 0, 0.2, 1);
      transition: opacity ${FADE_OUT_MS}ms ease-out, transform ${FADE_OUT_MS}ms ease-out;
      font-family: inherit;
      font-size: 14px;
      line-height: 1.4;
    }
    .monster-toast.dismissing {
      opacity: 0;
      transform: translateX(20px);
    }
    .monster-toast-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .monster-toast-blob {
      width: 40px;
      height: 40px;
      border-radius: 50% 40% 60% 50%;
      background: var(--monster-primary, #5b8def);
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      box-shadow: inset 0 -3px 6px rgba(0, 0, 0, 0.2);
      animation: monster-blob-pulse 1.4s ease-in-out infinite;
    }
    .monster-toast-content {
      flex: 1;
      min-width: 0;
    }
    .monster-toast-title {
      font-weight: 600;
      margin-bottom: 2px;
    }
    .monster-toast-tagline {
      font-size: 12px;
      opacity: 0.8;
    }
    .monster-toast-cta {
      margin-top: 8px;
      padding: 6px 12px;
      background: var(--monster-primary, #5b8def);
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }
    .monster-toast-cta:hover {
      opacity: 0.9;
    }
    @keyframes monster-toast-slidein {
      from {
        opacity: 0;
        transform: translateX(40px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }
    @keyframes monster-blob-pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.08); }
    }
  `;

  const style = document.createElement('style');
  style.setAttribute('data-monster-toast', '');
  style.textContent = css;
  document.head.appendChild(style);
}

/**
 * Top-level toast manager. Renders at most one toast at a time. New events
 * queue up; the latest one is shown after the current dismisses.
 *
 * Props:
 *   - onOpenHall(): optional callback when user taps the toast's "View Hall" CTA
 *   - onTap(): optional callback when user taps the toast (for any other UX)
 */
export function MonsterToast({ onOpenHall, onTap }) {
  const [active, setActive] = useState(null);     // { monsterId, topic, ... }
  const [dismissing, setDismissing] = useState(false);
  const queueRef = useRef([]);
  const timerRef = useRef(null);

  // Inject styles once on mount
  useEffect(() => {
    injectToastStyles();
  }, []);

  // Subscribe to wrongAnswer events
  useEffect(() => {
    function handle(e) {
      const detail = e.detail || {};
      if (!detail.monsterId) return;

      // Determine variant based on whether monster was seen
      const seen = isMonsterSeen(detail.monsterId);
      const next = { ...detail, isIntro: !seen };

      if (active) {
        // Queue for after current dismisses
        queueRef.current.push(next);
        return;
      }

      showToast(next);
    }
    window.addEventListener(EVENT_NAME, handle);
    return () => window.removeEventListener(EVENT_NAME, handle);
  }, [active]);

  function showToast(toast) {
    setActive(toast);
    setDismissing(false);

    const duration = toast.isIntro ? INTRO_DURATION_MS : REPEAT_DURATION_MS;
    timerRef.current = setTimeout(() => dismiss(), duration);
  }

  function dismiss() {
    if (!active) return;
    setDismissing(true);

    setTimeout(() => {
      setActive(null);
      setDismissing(false);

      // Show next queued toast, if any
      const next = queueRef.current.shift();
      if (next) {
        showToast(next);
      }
    }, FADE_OUT_MS);
  }

  function handleClick() {
    dismiss();
    if (active && !active.isIntro) {
      // Repeat toasts: tap = dismiss only (no Hall CTA shown)
      onTap && onTap(active);
    }
  }

  function handleCta(e) {
    e.stopPropagation();
    dismiss();
    onOpenHall && onOpenHall(active);
  }

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!active) return null;

  const colors = MONSTER_COLORS[active.monsterId] || MONSTER_COLORS['bracketeer'];
  const name = getMonsterName(active.monsterId);
  const tagline = getMonsterTagline(active.monsterId);
  const titleSuffix = active.isIntro ? 'introduced!' : 'strikes again!';

  const toastEl = (
    <div
      className={`monster-toast ${dismissing ? 'dismissing' : ''}`}
      style={{ '--monster-primary': colors.primary, '--monster-secondary': colors.secondary }}
      onClick={handleClick}
      role="status"
      aria-live="polite"
      data-monster-id={active.monsterId}
      data-monster-topic={active.topic}
    >
      <div className="monster-toast-row">
        <div className="monster-toast-blob" aria-hidden="true">{colors.emoji}</div>
        <div className="monster-toast-content">
          <div className="monster-toast-title">{name} {titleSuffix}</div>
          <div className="monster-toast-tagline">{tagline}</div>
        </div>
      </div>
      {active.isIntro && (
        <button className="monster-toast-cta" onClick={handleCta}>
          View Hall →
        </button>
      )}
    </div>
  );

  // Portal-render into document.body so the toast sits above all
  // route-specific React trees and works in every route without needing
  // per-route wiring. Falls back to inline render in non-browser contexts.
  if (typeof document !== 'undefined' && document.body) {
    return createPortal(toastEl, document.body);
  }
  return toastEl;
}

export default MonsterToast;