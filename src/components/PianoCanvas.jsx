import React, { useRef, useEffect, useCallback, useState } from 'react';
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
    editMode, onExitEdit, onAddNote, onUpdateNotes,
}) {
    const canvasRef = useRef(null);
    const particlesRef = useRef([]);
    const rafRef = useRef(null);
    const scrollX = useRef(0);
    const isScrubbing = useRef(false);
    const isSeekingBar = useRef(false);
    const scrubStartY = useRef(0);
    const scrubStartTime = useRef(0);

    // Edit mode state
    const [editTool, setEditTool] = useState('add');
    const editToolRef = useRef('add');
    const addPreviewRef = useRef(null); // {note, startTime, startY, ch}
    const sustainTrailRef = useRef([]);
    const lastSustainPt = useRef(null);

    const stateRef = useRef({});
    stateRef.current = {
        noteObjs, isPlaying, playOffset, playStart,
        tempoScale, scheduled, activeKeys, zoom,
        rightColor, leftColor, editMode,
    };

    // Keep editToolRef in sync
    useEffect(() => { editToolRef.current = editTool; }, [editTool]);

    const getPianoWidth = () => window.innerWidth * (stateRef.current.zoom / 100);

    const currentTime = useCallback(() => {
        const { isPlaying, playOffset, playStart, tempoScale } = stateRef.current;
        const aCtx = getCtx();
        if (!isPlaying || !aCtx) return playOffset;
        return playOffset + (aCtx.currentTime - playStart) * tempoScale;
    }, [getCtx]);

    const getNoteRect = useCallback((n, ch) => {
        const pw = getPianoWidth();
        const x = noteX(n.note, pw) - scrollX.current;
        const w = noteW(n.note, pw);
        const ahead2 = n.startTime - currentTime();
        const ahead1 = (n.startTime + n.duration) - currentTime();
        const fallH = ch - KEY_H - BAR_H;
        const y2 = BAR_H + fallH * (1 - ahead2 / LOOK_AHEAD_VIS);
        const y1 = BAR_H + fallH * (1 - ahead1 / LOOK_AHEAD_VIS);
        return { x: x - w / 2, y: Math.min(y1, y2), w, h: Math.max(Math.abs(y2 - y1), 4) };
    }, [currentTime]);

    // ---- Helpers for edit mode ----
    function yToSongTime(y, ch) {
        const fallH = ch - KEY_H - BAR_H;
        const ahead = (1 - (y - BAR_H) / fallH) * LOOK_AHEAD_VIS;
        return currentTime() + ahead;
    }

    function xToNote(x) {
        const pw = getPianoWidth();
        const adjustedX = x + scrollX.current;
        // Check black keys first
        for (let n = MIN_NOTE; n <= MAX_NOTE; n++) {
            if (!isBlack(n)) continue;
            const nx = noteX(n, pw);
            const nw = noteW(n, pw);
            if (adjustedX >= nx - nw / 2 && adjustedX <= nx + nw / 2) return n;
        }
        // White keys
        const totalW = getTotalWhites();
        const ww = pw / totalW;
        const wi = Math.floor(adjustedX / ww);
        let count = 0;
        for (let n = MIN_NOTE; n <= MAX_NOTE; n++) {
            if (isBlack(n)) continue;
            if (count === wi) return n;
            count++;
        }
        return null;
    }

    function checkSustainSwipe(x1, y1, x2, y2, ch, setSustainVal) {
        if (setSustainVal === 'remove') {
            const { noteObjs } = stateRef.current;
            const st = currentTime();
            const updated = noteObjs.filter(n => {
                if (n.isPedal) return true;
                if (n.note < MIN_NOTE || n.note > MAX_NOTE) return true;
                if (n.startTime > st + LOOK_AHEAD_VIS) return true;
                if (n.startTime + n.duration < st - 0.2) return true;
                const r = getNoteRect(n, ch);
                if (r.y + r.h > ch - KEY_H + 10) return true;
                if (Math.max(x1, x2) < r.x || Math.min(x1, x2) > r.x + r.w) return true;
                if (Math.max(y1, y2) < r.y || Math.min(y1, y2) > r.y + r.h) return true;
                return false; // remove this note
            });
            if (updated.length !== noteObjs.length) onUpdateNotes(updated);
            return;
        }
        const { noteObjs } = stateRef.current;
        const st = currentTime();
        const updated = noteObjs.map(n => ({ ...n }));
        let changed = false;
        updated.forEach(n => {
            if (n.isPedal) return;
            if (n.note < MIN_NOTE || n.note > MAX_NOTE) return;
            if (n.startTime > st + LOOK_AHEAD_VIS) return;
            if (n.startTime + n.duration < st - 0.2) return;
            const r = getNoteRect(n, ch);
            if (r.y + r.h > ch - KEY_H + 10) return;
            if (Math.max(x1, x2) < r.x || Math.min(x1, x2) > r.x + r.w) return;
            if (Math.max(y1, y2) < r.y || Math.min(y1, y2) > r.y + r.h) return;
            if (n.sustain === setSustainVal) return;
            n.sustain = setSustainVal;
            changed = true;
        });
        if (changed) onUpdateNotes(updated);
    }

    // ---- Touch / Mouse handlers ----
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const getXY = (e) => e.touches
            ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
            : { x: e.clientX, y: e.clientY };

        const onStart = (e) => {
            if (e.touches) e.preventDefault();
            const { x, y } = getXY(e);
            const ch = canvas.height;
            const barY = ch - KEY_H - 6;

            // Progress bar seek
            if (y >= barY - 16 && y <= barY + 22) {
                isSeekingBar.current = true;
                return;
            }

            if (stateRef.current.editMode) {
                const tool = editToolRef.current;
                if (tool === 'add') {
                    // Start placing a note
                    const midiNote = xToNote(x);
                    if (midiNote !== null) {
                        addPreviewRef.current = {
                            note: midiNote,
                            startTime: yToSongTime(y, ch),
                            startY: y,
                            ch,
                        };
                    }
                } else if (tool === 'sustain' || tool === 'unsustain' || tool === 'remove') {
                    lastSustainPt.current = { x, y };
                    sustainTrailRef.current = [{ x, y }];
                }
                return;
            }

            // Normal scrub
            isScrubbing.current = true;
            scrubStartY.current = y;
            scrubStartTime.current = currentTime();
        };

        const onMove = (e) => {
            if (e.touches) e.preventDefault();
            const { x, y } = getXY(e);
            const ch = canvas.height;

            // Progress bar drag
            if (isSeekingBar.current) {
                const ratio = x / canvas.width;
                onScrub(Math.max(0, Math.min(1, ratio)) * songDuration);
                return;
            }

            if (stateRef.current.editMode) {
                const tool = editToolRef.current;
                if (tool === 'add' && addPreviewRef.current) {
                    addPreviewRef.current.currentY = y;
                } else if ((tool === 'sustain' || tool === 'unsustain' || tool === 'remove') && lastSustainPt.current) {
                    const prev = lastSustainPt.current;
                    checkSustainSwipe(prev.x, prev.y, x, y, ch, tool === 'sustain');
                    lastSustainPt.current = { x, y };
                    sustainTrailRef.current.push({ x, y });
                    if (sustainTrailRef.current.length > 30) sustainTrailRef.current.shift();
                }
                return;
            }

            // Normal scrub
            if (!isScrubbing.current) return;
            const dy = y - scrubStartY.current;
            const song = stateRef.current.noteObjs;
            const maxTime = song.length ? song[song.length - 1].startTime : 0;
            const newTime = Math.max(0, Math.min(maxTime, scrubStartTime.current + dy / PIXELS_PER_SECOND));
            onScrub(newTime);
        };

        const onEnd = (e) => {
            const ch = canvas.height;

            if (isSeekingBar.current) { isSeekingBar.current = false; return; }

            if (stateRef.current.editMode) {
                const tool = editToolRef.current;
                if (tool === 'add' && addPreviewRef.current) {
                    const prev = addPreviewRef.current;
                    const endY = prev.currentY ?? prev.startY;
                    const startTime = prev.startTime;
                    // Duration from drag distance downward
                    const fallH = ch - KEY_H - BAR_H;
                    const rawDur = Math.abs(endY - prev.startY) * LOOK_AHEAD_VIS / fallH;
                    const duration = Math.max(0.1, rawDur);
                    const newNote = {
                        note: prev.note,
                        startTime: Math.max(0, startTime),
                        duration,
                        vel: 0.7,
                        hand: prev.note >= 60 ? 0 : 1,
                        sustain: false,
                    };
                    onAddNote(newNote);
                    addPreviewRef.current = null;
                }
                // Clear sustain trail
                lastSustainPt.current = null;
                setTimeout(() => { sustainTrailRef.current = []; }, 300);
                return;
            }

            isScrubbing.current = false;
        };

        canvas.addEventListener('touchstart', onStart, { passive: false });
        canvas.addEventListener('touchmove', onMove, { passive: false });
        canvas.addEventListener('touchend', onEnd, { passive: true });
        canvas.addEventListener('mousedown', onStart, { passive: true });
        canvas.addEventListener('mousemove', onMove, { passive: true });
        canvas.addEventListener('mouseup', onEnd, { passive: true });

        return () => {
            canvas.removeEventListener('touchstart', onStart);
            canvas.removeEventListener('touchmove', onMove);
            canvas.removeEventListener('touchend', onEnd);
            canvas.removeEventListener('mousedown', onStart);
            canvas.removeEventListener('mousemove', onMove);
            canvas.removeEventListener('mouseup', onEnd);
        };
    }, [currentTime, onScrub, songDuration, onAddNote, onUpdateNotes]);

    // ---- Schedule ahead ----
    const scheduleAhead = useCallback(() => {
        const { isPlaying, tempoScale, scheduled } = stateRef.current;
        const aCtx = getCtx();
        if (!isPlaying || !aCtx) return;
        const songNow = currentTime();
        const audioNow = aCtx.currentTime;
        const newSched = new Set(scheduled);
        let changed = false;
        stateRef.current.noteObjs.forEach((n, i) => {
            if (newSched.has(i)) return;
            if (n.isPedal) return;
            if (n.note < MIN_NOTE || n.note > MAX_NOTE) return;
            const delay = (n.startTime - songNow) / tempoScale;
            if (delay < LOOK_AHEAD_SCH && delay > -0.05) {
                newSched.add(i);
                const fireAt = audioNow + Math.max(0, delay);
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
                ctx.fillStyle = wi % 2 === 0 ? 'rgba(255,255,255,0.008)' : 'rgba(255,255,255,0.014)';
                ctx.fillRect(x, BAR_H, ww, fallH);
            }
            wi++;
        }
        const g = ctx.createLinearGradient(0, ch - KEY_H - 50, 0, ch - KEY_H);
        g.addColorStop(0, 'transparent');
        g.addColorStop(1, 'rgba(7,7,12,0.8)');
        ctx.fillStyle = g;
        ctx.fillRect(0, ch - KEY_H - 50, cw, 50);
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

            const r = getNoteRect(n, ch);
            if (r.x + r.w < 0 || r.x > cw) return;
            const rr = Math.min(r.w * 0.35, 7);
            const fillC = n.hand === 0 ? rightColor : leftColor;
            const pastAmount = st - (n.startTime + n.duration);
            ctx.globalAlpha = pastAmount > 0 ? Math.max(0.15, 1 - pastAmount * 2) : 1;

            ctx.shadowBlur = 14;
            ctx.shadowColor = fillC + '88';
            ctx.fillStyle = fillC;
            ctx.beginPath();
            ctx.roundRect(r.x, r.y, r.w, r.h, rr);
            ctx.fill();

            ctx.shadowBlur = 0;
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.beginPath();
            ctx.roundRect(r.x, r.y, r.w, Math.min(4, r.h), [rr, rr, 0, 0]);
            ctx.fill();

            // Sustain indicator — white border + S
            if (n.sustain) {
                ctx.strokeStyle = 'rgba(255,255,255,0.95)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.roundRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2, rr);
                ctx.stroke();
                if (r.h > 14 && r.w > 10) {
                    ctx.fillStyle = 'white';
                    ctx.font = `bold ${Math.min(r.w * 0.55, 11)}px sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('S', r.x + r.w / 2, r.y + r.h / 2);
                    ctx.textBaseline = 'alphabetic';
                    ctx.textAlign = 'left';
                }
            }

            ctx.globalAlpha = 1;
        });

        // Draw add note preview
        const prev = addPreviewRef.current;
        if (prev) {
            const endY = prev.currentY ?? prev.startY;
            const fallH = ch - KEY_H - BAR_H;
            const rawDur = Math.abs(endY - prev.startY) * LOOK_AHEAD_VIS / fallH;
            const dur = Math.max(0.1, rawDur);
            const previewNote = {
                note: prev.note, startTime: prev.startTime,
                duration: dur, hand: prev.note >= 60 ? 0 : 1,
            };
            const r = getNoteRect(previewNote, ch);
            const rr = Math.min(r.w * 0.35, 7);
            ctx.globalAlpha = 0.6;
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 3]);
            ctx.beginPath();
            ctx.roundRect(r.x, r.y, r.w, Math.max(r.h, 8), rr);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha = 1;
        }

        ctx.shadowBlur = 0;
        ctx.restore();
    }, [currentTime, getNoteRect]);

    // ---- Draw sustain trail ----
    const drawSustainTrail = useCallback((ctx) => {
        const trail = sustainTrailRef.current;
        if (trail.length < 2) return;
        const tool = editToolRef.current;
        ctx.save();
        ctx.strokeStyle = tool === 'sustain' ? 'rgba(255,255,255,0.85)' : tool === 'unsustain' ? 'rgba(255,80,80,0.85)' : 'rgba(255,50,50,0.85)';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowBlur = 10;
        ctx.shadowColor = tool === 'sustain' ? 'rgba(255,255,255,0.5)' : tool === 'unsustain' ? 'rgba(255,80,80,0.5)' : 'rgba(255,50,50,0.5)';
        ctx.beginPath();
        trail.forEach((pt, i) => {
            ctx.globalAlpha = (i + 1) / trail.length;
            if (i === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
        });
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.restore();
    }, []);

    // ---- Draw piano keys ----
    const drawPianoKeys = useCallback((ctx, cw, ch) => {
        const { noteObjs, rightColor, leftColor } = stateRef.current;
        const st = currentTime();
        const pw = getPianoWidth();
        const ww = pw / getTotalWhites();
        const ky = ch - KEY_H;

        const activeMap = new Map();
        noteObjs.forEach(n => {
            if (n.isPedal) return;
            if (n.note < MIN_NOTE || n.note > MAX_NOTE) return;
            if (n.startTime <= st && n.startTime + n.duration >= st) {
                activeMap.set(n.note, n.hand === 0 ? rightColor : leftColor);
            }
        });

        ctx.fillStyle = '#0f0f18';
        ctx.fillRect(0, ky, cw, KEY_H);
        ctx.fillStyle = 'rgba(201,168,76,0.45)';
        ctx.fillRect(0, ky, cw, 1.5);

        let wi = 0;
        for (let n = MIN_NOTE; n <= MAX_NOTE; n++) {
            if (isBlack(n)) continue;
            const x = wi * ww - scrollX.current;
            if (x + ww > 0 && x < cw) {
                const color = activeMap.get(n);
                ctx.fillStyle = color ?? '#e8e3d4';
                ctx.fillRect(x + 1, ky + 2, ww - 2, KEY_H - 4);
                if (color) {
                    ctx.shadowBlur = 18; ctx.shadowColor = color;
                    ctx.fillStyle = color;
                    ctx.fillRect(x + 1, ky + KEY_H - 28, ww - 2, 26);
                    ctx.shadowBlur = 0;
                }
                ctx.fillStyle = 'rgba(0,0,0,0.18)';
                ctx.fillRect(x, ky + 2, 1, KEY_H - 4);
            }
            wi++;
        }
        for (let n = MIN_NOTE; n <= MAX_NOTE; n++) {
            if (!isBlack(n)) continue;
            const x = noteX(n, pw) - scrollX.current;
            const bw = ww * 0.54;
            const bh = KEY_H * 0.60;
            if (x + bw > 0 && x - bw < cw) {
                const color = activeMap.get(n);
                ctx.fillStyle = color ?? '#161622';
                ctx.beginPath();
                ctx.roundRect(x - bw / 2, ky + 2, bw, bh, [0, 0, 5, 5]);
                ctx.fill();
                if (color) {
                    ctx.shadowBlur = 12; ctx.shadowColor = color;
                    ctx.fillStyle = color;
                    ctx.fillRect(x - bw / 2 + 2, ky + bh - 14, bw - 4, 12);
                    ctx.shadowBlur = 0;
                }
            }
        }
    }, [currentTime]);

    // ---- Draw progress bar + time ----
    const drawProgressAndTime = useCallback((ctx, cw, ch) => {
        const t = currentTime();
        const prog = Math.min(1, Math.max(0, t / songDuration));
        const barY = ch - KEY_H - 6;

        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.beginPath(); ctx.roundRect(0, barY, cw, 6, 3); ctx.fill();
        ctx.fillStyle = '#e63946';
        ctx.beginPath(); ctx.roundRect(0, barY, Math.max(6, cw * prog), 6, 3); ctx.fill();
        const dotX = Math.max(8, cw * prog);
        ctx.beginPath(); ctx.arc(dotX, barY + 3, 9, 0, Math.PI * 2);
        ctx.fillStyle = '#e63946';
        ctx.shadowBlur = 12; ctx.shadowColor = '#e63946';
        ctx.fill(); ctx.shadowBlur = 0;

        ctx.font = 'bold 15px Palatino Linotype, Palatino, serif';
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.textAlign = 'right';
        ctx.fillText(`${formatTime(t)} / ${formatTime(songDuration)}`, cw - 16, barY - 10);
        ctx.textAlign = 'left';
    }, [currentTime, songDuration]);

    function formatTime(s) {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec.toString().padStart(2, '0')}`;
    }

    // ---- Game loop ----
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        if (!CanvasRenderingContext2D.prototype.roundRect) {
            CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
                r = typeof r === 'number' ? r : (Array.isArray(r) ? r[0] : 0);
                this.moveTo(x + r, y); this.lineTo(x + w - r, y);
                this.quadraticCurveTo(x + w, y, x + w, y + r); this.lineTo(x + w, y + h - r);
                this.quadraticCurveTo(x + w, y + h, x + w - r, y + h); this.lineTo(x + r, y + h);
                this.quadraticCurveTo(x, y + h, x, y + h - r); this.lineTo(x, y + r);
                this.quadraticCurveTo(x, y, x + r, y); this.closePath(); return this;
            };
        }

        function loop() {
            const cw = canvas.width = window.innerWidth;
            const ch = canvas.height = window.innerHeight;

            scheduleAhead();

            const { isPlaying, noteObjs } = stateRef.current;
            if (isPlaying && noteObjs.length) {
                const last = noteObjs[noteObjs.length - 1];
                if (currentTime() > last.startTime + last.duration + 0.8) onSongEnd();
            }

            drawBG(ctx, cw, ch);
            drawNotes(ctx, cw, ch);
            drawPianoKeys(ctx, cw, ch);
            drawSustainTrail(ctx);
            drawProgressAndTime(ctx, cw, ch);

            rafRef.current = requestAnimationFrame(loop);
        }

        rafRef.current = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(rafRef.current);
    }, [scheduleAhead, currentTime, getCtx, onSongEnd, drawBG, drawNotes, drawPianoKeys, drawSustainTrail, drawProgressAndTime]);

    // ---- Edit toolbar styles ----
    const toolBtn = (tool) => ({
        background: editTool === tool ? 'rgba(201,168,76,0.25)' : 'transparent',
        border: editTool === tool
            ? '1px solid rgba(201,168,76,0.8)'
            : '1px solid rgba(201,168,76,0.3)',
        color: editTool === tool ? '#c9a84c' : 'rgba(201,168,76,0.5)',
        padding: '8px 16px', borderRadius: 6,
        cursor: 'pointer', fontSize: 11, letterSpacing: 2,
        textTransform: 'uppercase', fontFamily: 'inherit',
        WebkitTapHighlightColor: 'transparent',
    });

    return (
        <div style={{ position: 'fixed', inset: 0 }}>
            <canvas ref={canvasRef} style={{ display: 'block', touchAction: 'none' }} />

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
                }}>SUSTAIN</span>
            </div>

            {/* Edit toolbar */}
            {editMode && (
                <div style={{
                    position: 'fixed',
                    top: 64,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: 'rgba(7,7,12,0.92)',
                    border: '1px solid rgba(201,168,76,0.2)',
                    borderRadius: 12,
                    padding: '8px 14px',
                    backdropFilter: 'blur(12px)',
                    zIndex: 30,
                    width: 'calc(100vw - 32px)',
                    maxWidth: 700,
                }}>

                    {/* Hint text — fixed size box so it never pushes buttons */}
                    <div style={{
                        width: 200,
                        minWidth: 200,
                        flexShrink: 0,
                        color: 'rgba(255,255,255,0.3)',
                        fontSize: 10,
                        letterSpacing: 1.5,
                        textTransform: 'uppercase',
                        lineHeight: 1.5,
                    }}>
                        {editTool === 'add' ? 'TAP TO ADD NOTE · DRAG DOWN FOR LENGTH' :
                            editTool === 'sustain' ? 'SWIPE ACROSS NOTES TO MARK SUSTAIN' :
                                editTool === 'unsustain' ? 'SWIPE ACROSS NOTES TO REMOVE SUSTAIN' :
                                    'SWIPE ACROSS NOTES TO DELETE THEM'}
                    </div>

                    <div style={{ width: 1, height: 24, background: 'rgba(201,168,76,0.2)', flexShrink: 0 }} />

                    {/* Fixed size tool buttons */}
                    {[
                        { key: 'add', label: '➕ Add' },
                        { key: 'sustain', label: 'S+ Sustain' },
                        { key: 'unsustain', label: 'S− Remove' },
                        { key: 'remove', label: '🗑 Delete' },
                    ].map(({ key, label }) => (
                        <button
                            key={key}
                            style={{
                                width: 90,
                                minWidth: 90,
                                flexShrink: 0,
                                background: editTool === key ? 'rgba(201,168,76,0.25)' : 'transparent',
                                border: editTool === key
                                    ? '1px solid rgba(201,168,76,0.8)'
                                    : '1px solid rgba(201,168,76,0.25)',
                                color: editTool === key ? '#c9a84c' : 'rgba(201,168,76,0.45)',
                                padding: '8px 0',
                                borderRadius: 6,
                                cursor: 'pointer',
                                fontSize: 10,
                                letterSpacing: 1.5,
                                textTransform: 'uppercase',
                                fontFamily: 'inherit',
                                WebkitTapHighlightColor: 'transparent',
                                textAlign: 'center',
                            }}
                            onClick={() => setEditTool(key)}
                        >
                            {label}
                        </button>
                    ))}

                    <div style={{ width: 1, height: 24, background: 'rgba(201,168,76,0.2)', flexShrink: 0 }} />

                    {/* Done button — fixed size */}
                    <button
                        style={{
                            width: 80,
                            minWidth: 80,
                            flexShrink: 0,
                            background: 'rgba(201,168,76,0.15)',
                            border: '1px solid rgba(201,168,76,0.6)',
                            color: '#c9a84c',
                            padding: '8px 0',
                            borderRadius: 6,
                            cursor: 'pointer',
                            fontSize: 10,
                            letterSpacing: 2,
                            textTransform: 'uppercase',
                            fontFamily: 'inherit',
                            WebkitTapHighlightColor: 'transparent',
                            textAlign: 'center',
                        }}
                        onClick={onExitEdit}
                    >
                        ✓ Done
                    </button>

                </div>
            )}
        </div>
    );
}