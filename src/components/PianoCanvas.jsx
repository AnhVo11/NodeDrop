import React, { useRef, useEffect, useCallback } from 'react';
import { isBlack, noteX, noteW, getTotalWhites } from './PianoKeys';

const MIN_NOTE = 21;
const MAX_NOTE = 108;
const KEY_H = 130;
const BAR_H = 56;
const LOOK_AHEAD_VIS = 4.5;
const LOOK_AHEAD_SCH = 0.25;
const PIXELS_PER_SECOND = 120;

export default function PianoCanvas({
  noteObjs, setNoteObjs,
  isPlaying, playOffset, playStart,
  tempoScale, scheduled, setScheduled,
  activeKeys, setActiveKeys,
  scheduleNote, playNote, getCtx,
  onSongEnd, onScrub, zoom,
  isPedalOn,
  rightColor, leftColor,
  songDuration,
}) {
  const canvasRef      = useRef(null);
  const particlesRef   = useRef([]);
  const rafRef         = useRef(null);
  const scrollX        = useRef(0);
  const isScrubbing    = useRef(false);
  const scrubStartY    = useRef(0);
  const scrubStartTime = useRef(0);

  const stateRef = useRef({});
  stateRef.current = {
    noteObjs, isPlaying, playOffset, playStart,
    tempoScale, scheduled, activeKeys, zoom,
    rightColor, leftColor,
  };

  const getPianoWidth = () => window.innerWidth * (stateRef.current.zoom / 100);

  const currentTime = useCallback(() => {
    const { isPlaying, playOffset, playStart, tempoScale } = stateRef.current;
    const aCtx = getCtx();
    if (!isPlaying || !aCtx) return playOffset;
    return playOffset + (aCtx.currentTime - playStart) * tempoScale;
  }, [getCtx]);

  const getNoteRect = useCallback((n, ch) => {
    const pw = getPianoWidth();
    const x  = noteX(n.note, pw) - scrollX.current;
    const w  = noteW(n.note, pw);
    const ahead2 = n.startTime - currentTime();
    const ahead1 = (n.startTime + n.duration) - currentTime();
    const fallH  = ch - KEY_H - BAR_H;
    const y2 = BAR_H + fallH * (1 - ahead2 / LOOK_AHEAD_VIS);
    const y1 = BAR_H + fallH * (1 - ahead1 / LOOK_AHEAD_VIS);
    return { x: x - w/2, y: Math.min(y1,y2), w, h: Math.max(Math.abs(y2-y1), 4) };
  }, [currentTime]);

  // ---- Touch / Mouse ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onTouchStart = (e) => {
      e.preventDefault();
      isScrubbing.current = true;
      scrubStartY.current = e.touches[0].clientY;
      scrubStartTime.current = currentTime();
    };
    const onTouchMove = (e) => {
      e.preventDefault();
      if (!isScrubbing.current) return;
      const dy = e.touches[0].clientY - scrubStartY.current;
      const song = stateRef.current.noteObjs;
      const maxTime = song.length ? song[song.length-1].startTime : 0;
      const newTime = Math.max(0, Math.min(maxTime, scrubStartTime.current + dy / PIXELS_PER_SECOND));
      onScrub(newTime);
    };
    const onTouchEnd = () => { isScrubbing.current = false; };
    const onMouseDown = (e) => {
      isScrubbing.current = true;
      scrubStartY.current = e.clientY;
      scrubStartTime.current = currentTime();
    };
    const onMouseMove = (e) => {
      if (!isScrubbing.current) return;
      const dy = e.clientY - scrubStartY.current;
      const song = stateRef.current.noteObjs;
      const maxTime = song.length ? song[song.length-1].startTime : 0;
      const newTime = Math.max(0, Math.min(maxTime, scrubStartTime.current + dy / PIXELS_PER_SECOND));
      onScrub(newTime);
    };
    const onMouseUp = () => { isScrubbing.current = false; };

    canvas.addEventListener('touchstart',  onTouchStart, { passive: false });
    canvas.addEventListener('touchmove',   onTouchMove,  { passive: false });
    canvas.addEventListener('touchend',    onTouchEnd,   { passive: true });
    canvas.addEventListener('mousedown',   onMouseDown,  { passive: true });
    canvas.addEventListener('mousemove',   onMouseMove,  { passive: true });
    canvas.addEventListener('mouseup',     onMouseUp,    { passive: true });
    return () => {
      canvas.removeEventListener('touchstart',  onTouchStart);
      canvas.removeEventListener('touchmove',   onTouchMove);
      canvas.removeEventListener('touchend',    onTouchEnd);
      canvas.removeEventListener('mousedown',   onMouseDown);
      canvas.removeEventListener('mousemove',   onMouseMove);
      canvas.removeEventListener('mouseup',     onMouseUp);
    };
  }, [currentTime, onScrub]);

  // ---- Schedule ahead ----
  const scheduleAhead = useCallback(() => {
    const { isPlaying, tempoScale, scheduled } = stateRef.current;
    const aCtx = getCtx();
    if (!isPlaying || !aCtx) return;

    const songNow  = currentTime();
    const audioNow = aCtx.currentTime;
    const newSched  = new Set(scheduled);
    let changed = false;

    stateRef.current.noteObjs.forEach((n, i) => {
      if (newSched.has(i)) return;
      if (n.isPedal) return;
      if (n.note < MIN_NOTE || n.note > MAX_NOTE) return;
      const delay = (n.startTime - songNow) / tempoScale;
      if (delay < LOOK_AHEAD_SCH && delay > -0.05) {
        newSched.add(i);
        const fireAt  = audioNow + Math.max(0, delay);
        const realDur = n.duration / tempoScale;
        scheduleNote(n.note, n.vel, realDur, fireAt);
        changed = true;
      }
    });

    if (changed) setScheduled(newSched);
  }, [currentTime, getCtx, scheduleNote, setScheduled]);

  // ---- Draw background ----
  const drawBG = useCallback((ctx, cw, ch) => {
    ctx.fillStyle = '#07070c';
    ctx.fillRect(0, 0, cw, ch);
    const fallH = ch - KEY_H - BAR_H;
    const pw = getPianoWidth();
    const ww = pw / getTotalWhites();
    let wi = 0;
    for (let n = MIN_NOTE; n <= MAX_NOTE; n++) {
      if (isBlack(n)) continue;
      const x = wi * ww - scrollX.current;
      if (x + ww > 0 && x < cw) {
        ctx.fillStyle = wi%2===0 ? 'rgba(255,255,255,0.008)' : 'rgba(255,255,255,0.014)';
        ctx.fillRect(x, BAR_H, ww, fallH);
      }
      wi++;
    }
    const g = ctx.createLinearGradient(0, ch-KEY_H-50, 0, ch-KEY_H);
    g.addColorStop(0,'transparent');
    g.addColorStop(1,'rgba(7,7,12,0.8)');
    ctx.fillStyle = g;
    ctx.fillRect(0, ch-KEY_H-50, cw, 50);
  }, []);

  // ---- Draw falling notes ----
  const drawNotes = useCallback((ctx, cw, ch) => {
    const { noteObjs, rightColor, leftColor } = stateRef.current;
    const st = currentTime();
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, BAR_H, cw, ch - KEY_H - BAR_H);
    ctx.clip();

    noteObjs.forEach(n => {
      if (n.isPedal) return;
      if (n.note < MIN_NOTE || n.note > MAX_NOTE) return;
      if (n.startTime > st + LOOK_AHEAD_VIS + 0.2) return;
      if (n.startTime + n.duration < st - 0.5) return;

      const r    = getNoteRect(n, ch);
      if (r.x + r.w < 0 || r.x > cw) return;
      const rr     = Math.min(r.w * 0.35, 7);
      const fillC  = n.hand === 0 ? rightColor : leftColor;
      const pastAmount = st - (n.startTime + n.duration);
      ctx.globalAlpha = pastAmount > 0 ? Math.max(0.15, 1 - pastAmount * 2) : 1;

      ctx.shadowBlur  = 14;
      ctx.shadowColor = fillC + '88';
      ctx.fillStyle   = fillC;
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.w, r.h, rr);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.fillStyle  = 'rgba(255,255,255,0.4)';
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.w, Math.min(4, r.h), [rr, rr, 0, 0]);
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    ctx.shadowBlur = 0;
    ctx.restore();
  }, [currentTime, getNoteRect]);

  // ---- Draw piano keys on canvas ----
  const drawPianoKeys = useCallback((ctx, cw, ch) => {
    const { noteObjs, rightColor, leftColor } = stateRef.current;
    const st   = currentTime();
    const pw   = getPianoWidth();
    const ww   = pw / getTotalWhites();
    const ky   = ch - KEY_H;

    // Build active note map from song time — simple and accurate
    const activeMap = new Map();
    noteObjs.forEach(n => {
      if (n.isPedal) return;
      if (n.note < MIN_NOTE || n.note > MAX_NOTE) return;
      if (n.startTime <= st && n.startTime + n.duration >= st) {
        activeMap.set(n.note, n.hand === 0 ? rightColor : leftColor);
      }
    });

    // Background
    ctx.fillStyle = '#0f0f18';
    ctx.fillRect(0, ky, cw, KEY_H);

    // Gold divider
    ctx.fillStyle = 'rgba(201,168,76,0.45)';
    ctx.fillRect(0, ky, cw, 1.5);

    // White keys
    let wi = 0;
    for (let n = MIN_NOTE; n <= MAX_NOTE; n++) {
      if (isBlack(n)) continue;
      const x = wi * ww - scrollX.current;
      if (x + ww > 0 && x < cw) {
        const color = activeMap.get(n);
        // Base key
        ctx.fillStyle = color ? color : '#e8e3d4';
        ctx.fillRect(x+1, ky+2, ww-2, KEY_H-4);
        // Glow at bottom when active
        if (color) {
          ctx.shadowBlur  = 18;
          ctx.shadowColor = color;
          ctx.fillStyle   = color;
          ctx.fillRect(x+1, ky + KEY_H - 28, ww-2, 26);
          ctx.shadowBlur  = 0;
        }
        // Divider
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(x, ky+2, 1, KEY_H-4);
      }
      wi++;
    }

    // Black keys — drawn on top
    for (let n = MIN_NOTE; n <= MAX_NOTE; n++) {
      if (!isBlack(n)) continue;
      const x  = noteX(n, pw) - scrollX.current;
      const bw = ww * 0.54;
      const bh = KEY_H * 0.60;
      if (x + bw > 0 && x - bw < cw) {
        const color = activeMap.get(n);
        ctx.fillStyle = color ? color : '#161622';
        ctx.beginPath();
        ctx.roundRect(x-bw/2, ky+2, bw, bh, [0,0,5,5]);
        ctx.fill();
        if (color) {
          ctx.shadowBlur  = 12;
          ctx.shadowColor = color;
          ctx.fillStyle   = color;
          ctx.fillRect(x-bw/2+2, ky + bh - 14, bw-4, 12);
          ctx.shadowBlur  = 0;
        }
      }
    }
  }, [currentTime]);

  // ---- Draw particles ----
  const drawParticles = useCallback((ctx) => {
    particlesRef.current = particlesRef.current.filter(p => p.life > 0);
    particlesRef.current.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.vy += 0.18; p.life -= 0.03;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle   = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.1, p.size * p.life), 0, Math.PI*2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }, []);

  // ---- Draw progress bar + time ----
  const drawProgressAndTime = useCallback((ctx, cw, ch) => {
    const t    = currentTime();
    const prog = Math.min(1, Math.max(0, t / songDuration));
    const barY = ch - KEY_H - 4;

    // Track
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(0, barY, cw, 4);
    // Fill
    ctx.fillStyle = '#e63946';
    ctx.fillRect(0, barY, cw * prog, 4);
    // Dot
    ctx.beginPath();
    ctx.arc(Math.max(6, cw * prog), barY + 2, 6, 0, Math.PI*2);
    ctx.fillStyle   = '#e63946';
    ctx.shadowBlur  = 8;
    ctx.shadowColor = '#e63946';
    ctx.fill();
    ctx.shadowBlur = 0;

    // Time
    const cur   = formatTime(t);
    const total = formatTime(songDuration);
    ctx.font      = '11px Palatino Linotype, Palatino, serif';
    ctx.fillStyle = 'rgba(201,168,76,0.55)';
    ctx.textAlign = 'right';
    ctx.fillText(`${cur} / ${total}`, cw - 12, barY - 8);
    ctx.textAlign = 'left';
  }, [currentTime, songDuration]);

  function formatTime(s) {
    const m   = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2,'0')}`;
  }

  // ---- Game loop ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (!CanvasRenderingContext2D.prototype.roundRect) {
      CanvasRenderingContext2D.prototype.roundRect = function(x,y,w,h,r) {
        r = typeof r==='number' ? r : (Array.isArray(r) ? r[0] : 0);
        this.moveTo(x+r,y); this.lineTo(x+w-r,y);
        this.quadraticCurveTo(x+w,y,x+w,y+r); this.lineTo(x+w,y+h-r);
        this.quadraticCurveTo(x+w,y+h,x+w-r,y+h); this.lineTo(x+r,y+h);
        this.quadraticCurveTo(x,y+h,x,y+h-r); this.lineTo(x,y+r);
        this.quadraticCurveTo(x,y,x+r,y); this.closePath(); return this;
      };
    }

    function loop() {
      const cw = canvas.width  = window.innerWidth;
      const ch = canvas.height = window.innerHeight;

      scheduleAhead();

      const { isPlaying, noteObjs } = stateRef.current;
      if (isPlaying && noteObjs.length) {
        const last = noteObjs[noteObjs.length - 1];
        if (currentTime() > last.startTime + last.duration + 0.8) onSongEnd();
      }

      drawBG(ctx, cw, ch);
      drawNotes(ctx, cw, ch);
      drawParticles(ctx);
      drawPianoKeys(ctx, cw, ch);
      drawProgressAndTime(ctx, cw, ch);

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [scheduleAhead, currentTime, getCtx, onSongEnd, drawBG, drawNotes, drawParticles, drawPianoKeys, drawProgressAndTime]);

  return (
    <div style={{ position:'fixed', inset:0 }}>
      <canvas ref={canvasRef} style={{ display:'block', touchAction:'none' }} />
      {/* Sustain indicator */}
      <div style={{
        position: 'absolute', bottom: KEY_H + 16, left: 16,
        display: 'flex', alignItems: 'center', gap: 6,
        pointerEvents: 'none',
      }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: isPedalOn ? '#ff3333' : 'rgba(255,255,255,0.12)',
          boxShadow: isPedalOn ? '0 0 8px rgba(255,50,50,0.8)' : 'none',
          transition: 'all 0.1s',
        }} />
        <span style={{
          color: isPedalOn ? 'rgba(255,100,100,0.9)' : 'rgba(255,255,255,0.2)',
          fontSize: 10, letterSpacing: 2, textTransform: 'uppercase',
          transition: 'color 0.1s', fontFamily: 'Palatino',
        }}>
          SUSTAIN
        </span>
      </div>
    </div>
  );
}