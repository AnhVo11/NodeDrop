import React, { useRef, useEffect, useCallback, useState } from 'react';
import { noteX, noteW, getTotalWhites, isBlack } from './PianoKeys';
import { useEditHistory } from '../hooks/useEditHistory';

const MIN_NOTE = 21;
const MAX_NOTE = 108;
const KEY_H = 130;
const BAR_H = 56;
const LOOK_AHEAD_VIS = 4.5;
const HANDLE_SIZE = 16;

export default function EditOverlay({
    canvasRef,
    noteObjs,
    onAddNote,
    onUpdateNotes,
    onExitEdit,
    currentTime,
    getPianoWidth,
    scrollX,
    rightColor,
    leftColor,
    onScrub,
    songDuration,
}) {
    const [editTool, setEditTool] = useState(null);
    const [paintHand, setPaintHand] = useState(null); // null=off, 0=right, 1=left
    const paintHandRef = useRef(null);
    const editToolRef = useRef(null);
    const sustainTrailRef = useRef([]);
    const interactRef = useRef(null);
    const particlesRef = useRef([]);
    const rafRef = useRef(null);
    const overlayCanvasRef = useRef(null);
    const editScrubRef = useRef(null);
    // Pedal drawing state
    const pedalDrawRef = useRef(null); // { startTime, currentTime }

    const stateRef = useRef({});
    stateRef.current = { noteObjs, rightColor, leftColor };

    useEffect(() => { editToolRef.current = editTool; }, [editTool]);
    useEffect(() => { paintHandRef.current = paintHand; }, [paintHand]);

    const { pushUndo, undo, redo } = useEditHistory(onUpdateNotes, stateRef);

    // ---- Helpers ----
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
    }, [currentTime, getPianoWidth, scrollX]);

    // Convert song time to Y position
    const timeToY = useCallback((songTime, ch) => {
        const ahead = songTime - currentTime();
        const fallH = ch - KEY_H - BAR_H;
        return BAR_H + fallH * (1 - ahead / LOOK_AHEAD_VIS);
    }, [currentTime]);

    function yToSongTime(y, ch) {
        const fallH = ch - KEY_H - BAR_H;
        return currentTime() + (1 - (y - BAR_H) / fallH) * LOOK_AHEAD_VIS;
    }

    function xToNote(x) {
        const pw = getPianoWidth();
        const ax = x + scrollX.current;
        for (let n = MIN_NOTE; n <= MAX_NOTE; n++) {
            if (!isBlack(n)) continue;
            const nx = noteX(n, pw), nw = noteW(n, pw);
            if (ax >= nx - nw / 2 && ax <= nx + nw / 2) return n;
        }
        const ww = pw / getTotalWhites();
        const wi = Math.floor(ax / ww);
        let count = 0;
        for (let n = MIN_NOTE; n <= MAX_NOTE; n++) {
            if (isBlack(n)) continue;
            if (count === wi) return n;
            count++;
        }
        return null;
    }

    function findNoteAt(x, y, ch) {
        const { noteObjs } = stateRef.current;
        for (let i = noteObjs.length - 1; i >= 0; i--) {
            const n = noteObjs[i];
            if (n.isPedal || n.note < MIN_NOTE || n.note > MAX_NOTE) continue;
            const r = getNoteRect(n, ch);
            if (x < r.x || x > r.x + r.w || y < r.y || y > r.y + r.h) continue;
            let zone = 'middle';
            if (r.h > HANDLE_SIZE * 2) {
                if (y <= r.y + HANDLE_SIZE) zone = 'top';
                else if (y >= r.y + r.h - HANDLE_SIZE) zone = 'bottom';
            }
            return { index: i, note: n, rect: r, zone };
        }
        return null;
    }

    function findPedalRegionAt(y, ch) {
        const { noteObjs } = stateRef.current;
        let pedalStart = null;
        for (let i = 0; i < noteObjs.length; i++) {
            const n = noteObjs[i];
            if (!n.isPedal) continue;
            if (n.vel >= 64) {
                pedalStart = n.startTime;
            } else if (pedalStart !== null) {
                const y1 = timeToY(pedalStart, ch);
                const y2 = timeToY(n.startTime, ch);
                const top = Math.min(y1, y2);
                const bottom = Math.max(y1, y2);
                if (y >= top && y <= bottom) {
                    return { startTime: pedalStart, endTime: n.startTime };
                }
                pedalStart = null;
            }
        }
        return null;
    }

    function findPedalHandleAt(y, ch) {
        const { noteObjs } = stateRef.current;
        let pedalStartIdx = -1;
        for (let i = 0; i < noteObjs.length; i++) {
            const n = noteObjs[i];
            if (!n.isPedal) continue;
            if (n.vel >= 64) {
                pedalStartIdx = i;
            } else if (pedalStartIdx !== -1) {
                const startN = noteObjs[pedalStartIdx];
                const y1 = timeToY(startN.startTime, ch);
                const y2 = timeToY(n.startTime, ch);
                const top = Math.min(y1, y2);
                const bottom = Math.max(y1, y2);
                if (Math.abs(y - top) <= 18) {
                    return { edge: 'end', idx: i };
                }
                if (Math.abs(y - bottom) <= 18) {
                    return { edge: 'start', idx: pedalStartIdx };
                }
                pedalStartIdx = -1;
            }
        }
        return null;
    }

    function findPedalMiddleAt(y, ch) {
        const { noteObjs } = stateRef.current;
        let pedalStartIdx = -1;
        for (let i = 0; i < noteObjs.length; i++) {
            const n = noteObjs[i];
            if (!n.isPedal) continue;
            if (n.vel >= 64) { pedalStartIdx = i; }
            else if (pedalStartIdx !== -1) {
                const startN = noteObjs[pedalStartIdx];
                const y1 = timeToY(startN.startTime, ch);
                const y2 = timeToY(n.startTime, ch);
                const mid = (y1 + y2) / 2;
                if (Math.abs(y - mid) <= 20) {
                    return { startIdx: pedalStartIdx, endIdx: i };
                }
                pedalStartIdx = -1;
            }
        }
        return null;
    }

    // ---- Particles ----
    function spawnParticles(x, y, color) {
        for (let i = 0; i < 28; i++) {
            const a = Math.random() * Math.PI * 2;
            const s = 2 + Math.random() * 6;
            particlesRef.current.push({
                x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 3,
                size: 2 + Math.random() * 4,
                life: 1.0 + Math.random() * 0.4, color,
            });
        }
        particlesRef.current.push({
            x, y, vx: 0, vy: 0, size: 28, life: 0.5, color: 'rgba(255,255,255,0.7)',
        });
    }

    // ---- Delete swipe ----
    function checkDeleteSwipe(x1, y1, x2, y2, ch) {
        const { noteObjs, rightColor, leftColor } = stateRef.current;
        const st = currentTime();
        const updated = noteObjs.filter(n => {
            if (n.isPedal || n.note < MIN_NOTE || n.note > MAX_NOTE) return true;
            if (n.startTime > st + LOOK_AHEAD_VIS || n.startTime + n.duration < st - 0.2) return true;
            const r = getNoteRect(n, ch);
            if (r.y + r.h > ch - KEY_H + 10) return true;
            if (Math.max(x1, x2) < r.x || Math.min(x1, x2) > r.x + r.w) return true;
            if (Math.max(y1, y2) < r.y || Math.min(y1, y2) > r.y + r.h) return true;
            spawnParticles(r.x + r.w / 2, r.y + r.h / 2, n.hand === 0 ? rightColor : leftColor);
            return false;
        });
        if (updated.length !== noteObjs.length) { pushUndo(noteObjs); onUpdateNotes(updated); }
    }

    // ---- Touch / Mouse ----
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
            const tool = editToolRef.current;
            const barY = ch - KEY_H - 6;

            // Progress bar seek
            if (y >= barY - 16 && y <= barY + 22) {
                editScrubRef.current = { startX: x, startTime: currentTime(), isBar: true };
                return;
            }

            // ---- PEDAL tool ----
            if (tool === 'pedal') {
                // Check middle circle FIRST before anything else
                const mid = findPedalMiddleAt(y, ch);
                if (mid) {
                    pushUndo(stateRef.current.noteObjs);
                    const startN = stateRef.current.noteObjs[mid.startIdx];
                    const endN = stateRef.current.noteObjs[mid.endIdx];
                    interactRef.current = {
                        type: 'pedalMove',
                        startIdx: mid.startIdx,
                        endIdx: mid.endIdx,
                        origStartTime: startN.startTime,
                        origEndTime: endN.startTime,
                        startY: y,
                    };
                    return;
                }
                // Check handle edges
                const handle = findPedalHandleAt(y, ch);
                if (handle) {
                    pushUndo(stateRef.current.noteObjs);
                    interactRef.current = {
                        type: 'pedalResize',
                        edge: handle.edge,
                        idx: handle.idx,
                        origTime: stateRef.current.noteObjs[handle.idx].startTime,
                        startY: y,
                    };
                    return;
                }
                // Only draw new region if not hitting anything
                const startTime = yToSongTime(y, ch);
                pedalDrawRef.current = { startTime, currentTime: startTime, startY: y };
                return;
            }

            // ---- PAINT tool ----
            if (tool === 'paint') {
                pushUndo(stateRef.current.noteObjs);
                interactRef.current = { type: 'paint', lastX: x, lastY: y };
                return;
            }

            // Block multiple interactions
            if (interactRef.current || pedalDrawRef.current) return;

            // ---- DELETE tool ----
            if (tool === 'remove') {
                interactRef.current = { type: 'deleteSwipe', lastX: x, lastY: y };
                checkDeleteSwipe(x - 1, y - 1, x + 1, y + 1, ch);
                return;
            }

            // ---- Smart mode ----
            const hit = findNoteAt(x, y, ch);
            if (hit) {
                pushUndo(stateRef.current.noteObjs);
                interactRef.current = {
                    type: hit.zone === 'middle' ? 'move' : 'resize',
                    zone: hit.zone,
                    noteIndex: hit.index,
                    origStart: hit.note.startTime,
                    origDuration: hit.note.duration,
                    origNote: hit.note.note,
                    startX: x, startY: y,
                };
            } else {
                const midiNote = xToNote(x);
                if (midiNote !== null) {
                    interactRef.current = {
                        type: 'add',
                        addPreview: {
                            note: midiNote,
                            startTime: yToSongTime(y, ch),
                            startY: y, currentY: y,
                        },
                    };
                }
            }
        };

        const onMove = (e) => {
            if (e.touches) e.preventDefault();
            const { x, y } = getXY(e);
            const ch = canvas.height;
            const cw = canvas.width;

            // Progress bar seek
            if (editScrubRef.current?.isBar) {
                onScrub(Math.max(0, Math.min(1, x / cw)) * songDuration);
                return;
            }

            // Pedal drawing
            if (pedalDrawRef.current) {
                pedalDrawRef.current.currentTime = yToSongTime(y, ch);
                pedalDrawRef.current.currentY = y;
                return;
            }

            const ia = interactRef.current;
            if (!ia) return;

            // Pedal resize
            if (ia?.type === 'pedalMove') {
                const fallH = ch - KEY_H - BAR_H;
                const dy = y - ia.startY;
                const timeDelta = -dy * LOOK_AHEAD_VIS / fallH;
                const { noteObjs } = stateRef.current;
                const updated = noteObjs.map((n, i) => {
                    if (i === ia.startIdx) return { ...n, startTime: Math.max(0, ia.origStartTime + timeDelta) };
                    if (i === ia.endIdx) return { ...n, startTime: Math.max(0, ia.origEndTime + timeDelta) };
                    return n;
                });
                onUpdateNotes(updated);
                return;
            }

            if (ia?.type === 'pedalResize') {
                const fallH = ch - KEY_H - BAR_H;
                const dy = y - ia.startY;
                const timeDelta = -dy * LOOK_AHEAD_VIS / fallH;
                const { noteObjs } = stateRef.current;
                const updated = noteObjs.map((n, i) => {
                    if (i !== ia.idx) return n;
                    return { ...n, startTime: Math.max(0, ia.origTime + timeDelta) };
                });
                onUpdateNotes(updated);
                return;
            }

            // Delete swipe
            if (ia.type === 'deleteSwipe') {
                checkDeleteSwipe(ia.lastX, ia.lastY, x, y, ch);
                ia.lastX = x; ia.lastY = y;
                sustainTrailRef.current.push({ x, y });
                if (sustainTrailRef.current.length > 30) sustainTrailRef.current.shift();
                return;
            }

            if (ia.type === 'paint') {
                const { noteObjs } = stateRef.current;
                let changed = false;
                const updated = noteObjs.map(n => {
                    if (n.isPedal || n.note < MIN_NOTE || n.note > MAX_NOTE) return n;
                    const r = getNoteRect(n, ch);
                    const x1 = Math.min(ia.lastX, x), x2 = Math.max(ia.lastX, x);
                    const y1 = Math.min(ia.lastY, y), y2 = Math.max(ia.lastY, y);
                    const hits = x2 >= r.x && x1 <= r.x + r.w && y2 >= r.y && y1 <= r.y + r.h;
                    if (!hits || n.hand === paintHandRef.current) return n;
                    changed = true;
                    return { ...n, hand: paintHandRef.current };
                });
                if (changed) onUpdateNotes(updated);
                ia.lastX = x; ia.lastY = y;
                sustainTrailRef.current.push({ x, y });
                if (sustainTrailRef.current.length > 30) sustainTrailRef.current.shift();
                return;
            }

            if (ia.type === 'add') {
                ia.addPreview.currentY = y;
                return;
            }

            const { noteObjs } = stateRef.current;
            const fallH = ch - KEY_H - BAR_H;
            const dy = y - ia.startY;

            if (ia.type === 'move') {
                const timeDelta = -dy * LOOK_AHEAD_VIS / fallH;
                const newNote = xToNote(x);
                const updated = noteObjs.map((n, i) => {
                    if (i !== ia.noteIndex) return n;
                    return {
                        ...n,
                        startTime: Math.max(0, ia.origStart + timeDelta),
                        note: newNote !== null ? newNote : n.note,
                        hand: newNote !== null ? (newNote >= 60 ? 0 : 1) : n.hand,
                    };
                });
                onUpdateNotes(updated);
            }

            if (ia.type === 'resize') {
                const delta = dy * LOOK_AHEAD_VIS / fallH;
                const updated = noteObjs.map((n, i) => {
                    if (i !== ia.noteIndex) return n;
                    if (ia.zone === 'top') {
                        return {
                            ...n,
                            duration: Math.max(0.05, ia.origDuration - delta),
                        };
                    } else {
                        return {
                            ...n,
                            startTime: Math.max(0, ia.origStart - delta),
                            duration: Math.max(0.05, ia.origDuration + delta),
                        };
                    }
                });
                onUpdateNotes(updated);
            }
        };

        const onEnd = () => {
            const ch = canvas.height;

            if (editScrubRef.current) { editScrubRef.current = null; return; }

            if (interactRef.current?.type === 'pedalResize' ||
                interactRef.current?.type === 'pedalMove') {
                interactRef.current = null; return;
            }

            // Finish pedal region
            if (pedalDrawRef.current) {
                const pd = pedalDrawRef.current;
                const ch = canvas.height;
                const t1 = Math.min(pd.startTime, pd.currentTime);
                const t2 = Math.max(pd.startTime, pd.currentTime);
                const dur = t2 - t1;

                // Tap (no drag) on existing pedal region = delete it
                if (dur < 0.05) {
                    const hit = findPedalRegionAt(pd.startY, ch);
                    if (hit) {
                        pushUndo(stateRef.current.noteObjs);
                        const filtered = stateRef.current.noteObjs.filter(n => {
                            if (!n.isPedal) return true;
                            return !(n.startTime >= hit.startTime - 0.01 && n.startTime <= hit.endTime + 0.01);
                        });
                        onUpdateNotes(filtered);
                    }
                    pedalDrawRef.current = null;
                    return;
                }
                if (dur > 0.05) {
                    pushUndo(stateRef.current.noteObjs);
                    // Remove any existing pedal events that overlap this region
                    const filtered = stateRef.current.noteObjs.filter(n => {
                        if (!n.isPedal) return true;
                        // Remove pedal events inside the new region
                        return !(n.startTime >= t1 - 0.01 && n.startTime <= t2 + 0.01);
                    });
                    // Add pedal on + off events
                    const withPedal = [
                        ...filtered,
                        { isPedal: true, startTime: t1, duration: 0, vel: 127, note: -1, hand: 0 },
                        { isPedal: true, startTime: t2, duration: 0, vel: 0, note: -1, hand: 0 },
                    ].sort((a, b) => a.startTime - b.startTime);
                    onUpdateNotes(withPedal);
                }
                pedalDrawRef.current = null;
                return;
            }

            // Clear delete trail
            if (interactRef.current?.type === 'deleteSwipe' || interactRef.current?.type === 'paint') {
                interactRef.current = null;
                setTimeout(() => { sustainTrailRef.current = []; }, 300);
                return;
            }

            const ia = interactRef.current;
            if (ia?.type === 'add') {
                const prev = ia.addPreview;
                const topY = Math.min(prev.currentY, prev.startY);
                const bottomY = Math.max(prev.currentY, prev.startY);
                const startTime = yToSongTime(bottomY, ch);
                const endTime = yToSongTime(topY, ch);
                pushUndo(stateRef.current.noteObjs);
                onAddNote({
                    note: prev.note,
                    startTime: Math.max(0, startTime),
                    duration: Math.max(0.1, endTime - startTime),
                    vel: 0.7,
                    hand: prev.note >= 60 ? 0 : 1,
                    sustain: false,
                });
            }

            interactRef.current = null;
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ---- Overlay canvas draw loop ----
    useEffect(() => {
        const canvas = overlayCanvasRef.current;
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

        function drawParticles() {
            particlesRef.current = particlesRef.current.filter(p => p.life > 0);
            particlesRef.current.forEach(p => {
                p.x += p.vx; p.y += p.vy; p.vy += 0.18; p.life -= 0.025;
                ctx.globalAlpha = Math.max(0, p.life);
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, Math.max(0.1, p.size * p.life), 0, Math.PI * 2);
                ctx.fill();
            });
            ctx.globalAlpha = 1;
        }

        function drawPedalRegions() {
            if (editToolRef.current !== 'pedal') return;
            const { noteObjs } = stateRef.current;
            const ch = canvas.height;
            const cw = canvas.width;
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, BAR_H, canvas.width, canvas.height - KEY_H - BAR_H);
            ctx.clip();
            let pedalStart = null;
            noteObjs.forEach(n => {
                if (!n.isPedal) return;
                if (n.vel >= 64) {
                    pedalStart = n.startTime;
                } else if (pedalStart !== null) {
                    // Draw the region
                    const y1 = timeToY(pedalStart, ch);
                    const y2 = timeToY(n.startTime, ch);
                    const top = Math.min(y1, y2);
                    const bottom = Math.max(y1, y2);
                    if (bottom > BAR_H) {
                        ctx.fillStyle = 'rgba(230,57,70,0.15)';
                        ctx.fillRect(0, top, cw, bottom - top);
                        ctx.strokeStyle = 'rgba(230,57,70,0.8)';
                        ctx.lineWidth = 2;
                        ctx.setLineDash([]);
                        ctx.beginPath(); ctx.moveTo(0, top); ctx.lineTo(cw, top); ctx.stroke();
                        ctx.beginPath(); ctx.moveTo(0, bottom); ctx.lineTo(cw, bottom); ctx.stroke();
                        const hx = cw / 2;
                        ctx.strokeStyle = 'rgba(230,57,70,0.95)';
                        ctx.lineWidth = 3;
                        ctx.lineCap = 'round';
                        ctx.beginPath(); ctx.moveTo(hx - 30, top + 8); ctx.lineTo(hx + 30, top + 8); ctx.stroke();
                        ctx.beginPath(); ctx.moveTo(hx - 30, bottom - 8); ctx.lineTo(hx + 30, bottom - 8); ctx.stroke();
                        ctx.fillStyle = 'rgba(230,57,70,0.6)';
                        ctx.font = '10px sans-serif';
                        ctx.fillText('PEDAL', 8, top + 13);
                        const midY = (top + bottom) / 2;
                        const midX = cw / 2;
                        ctx.beginPath();
                        ctx.arc(midX, midY, 14, 0, Math.PI * 2);
                        ctx.fillStyle = 'rgba(230,57,70,0.25)';
                        ctx.fill();
                        ctx.strokeStyle = 'rgba(230,57,70,0.9)';
                        ctx.lineWidth = 2;
                        ctx.stroke();
                    }
                    pedalStart = null;
                }
            });

            // Draw pedal preview while dragging
            const pd = pedalDrawRef.current;
            ctx.restore();

            if (pd) {
                const y1 = timeToY(pd.startTime, ch);
                const y2 = timeToY(pd.currentTime, ch);
                const top = Math.min(y1, y2);
                const bottom = Math.max(y1, y2);
                ctx.fillStyle = 'rgba(230,57,70,0.12)';
                ctx.fillRect(0, top, cw, bottom - top);
                ctx.strokeStyle = 'rgba(230,57,70,0.9)';
                ctx.lineWidth = 2;
                ctx.setLineDash([6, 3]);
                ctx.beginPath(); ctx.moveTo(0, top); ctx.lineTo(cw, top); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(0, bottom); ctx.lineTo(cw, bottom); ctx.stroke();
                ctx.setLineDash([]);
                ctx.fillStyle = 'rgba(230,57,70,0.7)';
                ctx.font = '10px sans-serif';
                ctx.fillText('PEDAL', 8, top + 13);
            }
        }

        function drawNoteIndicators() {
            const { noteObjs } = stateRef.current;
            const ch = canvas.height;
            const cw = canvas.width;
            const st = currentTime();
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, BAR_H, cw, ch - KEY_H - BAR_H);
            ctx.clip();
            noteObjs.forEach(n => {
                if (n.isPedal || n.note < MIN_NOTE || n.note > MAX_NOTE) return;
                if (n.startTime > st + LOOK_AHEAD_VIS + 0.2) return;
                if (n.startTime + n.duration < st - 0.5) return;
                const r = getNoteRect(n, ch);
                if (r.x + r.w < 0 || r.x > cw || r.h < 8) return;

                // Top resize handle
                ctx.fillStyle = 'rgba(255,255,255,0.55)';
                ctx.beginPath(); ctx.roundRect(r.x + 4, r.y + 3, r.w - 8, 4, 2); ctx.fill();

                // Bottom resize handle
                ctx.fillStyle = 'rgba(255,255,255,0.55)';
                ctx.beginPath(); ctx.roundRect(r.x + 4, r.y + r.h - 7, r.w - 8, 4, 2); ctx.fill();

                // Middle drag dots
                if (r.h > 32) {
                    const midY = r.y + r.h / 2;
                    const midX = r.x + r.w / 2;
                    ctx.fillStyle = 'rgba(255,255,255,0.4)';
                    [-5, 0, 5].forEach(offset => {
                        ctx.beginPath();
                        ctx.arc(midX + offset, midY, 2, 0, Math.PI * 2);
                        ctx.fill();
                    });
                }
            });
            ctx.restore();
        }

        function drawAddPreview() {
            const ia = interactRef.current;
            if (!ia || ia.type !== 'add') return;
            const ch = canvas.height;
            const prev = ia.addPreview;
            const topY = Math.min(prev.currentY, prev.startY);
            const bottomY = Math.max(prev.currentY, prev.startY);
            const startTime = yToSongTime(bottomY, ch);
            const endTime = yToSongTime(topY, ch);
            const pNote = {
                note: prev.note,
                startTime: Math.max(0, startTime),
                duration: Math.max(0.1, endTime - startTime),
                hand: prev.note >= 60 ? 0 : 1,
            };
            const r = getNoteRect(pNote, ch);
            const rr = Math.min(r.w * 0.35, 7);
            ctx.globalAlpha = 0.65;
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 3]);
            ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, Math.max(r.h, 8), rr); ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha = 1;
        }

        function drawDeleteTrail() {
            const trail = sustainTrailRef.current;
            if (trail.length < 2) return;
            const ia = interactRef.current;
            const { rightColor, leftColor } = stateRef.current;
            const trailColor = ia?.type === 'paint'
                ? (paintHandRef.current === 0 ? rightColor : leftColor)
                : 'rgba(255,60,60,0.85)';
            ctx.save();
            ctx.strokeStyle = trailColor;
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.shadowBlur = 12;
            ctx.shadowColor = 'rgba(255,60,60,0.5)';
            ctx.beginPath();
            trail.forEach((pt, i) => {
                ctx.globalAlpha = (i + 1) / trail.length;
                if (i === 0) ctx.moveTo(pt.x, pt.y);
                else ctx.lineTo(pt.x, pt.y);
            });
            ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.restore();
        }

        function loop() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            drawPedalRegions();
            drawParticles();
            drawNoteIndicators();
            drawAddPreview();
            drawDeleteTrail();
            rafRef.current = requestAnimationFrame(loop);
        }

        rafRef.current = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(rafRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ---- Toolbar ----
    const toggleTool = (key) => setEditTool(t => t === key ? null : key);

    const toolBtn = (key) => ({
        width: 88, minWidth: 88, flexShrink: 0,
        background: editTool === key ? 'rgba(201,168,76,0.25)' : 'transparent',
        border: editTool === key
            ? '1px solid rgba(201,168,76,0.8)'
            : '1px solid rgba(201,168,76,0.25)',
        color: editTool === key ? '#c9a84c' : 'rgba(201,168,76,0.9)',
        padding: 0, borderRadius: 6, cursor: 'pointer',
        fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase',
        fontFamily: 'inherit', WebkitTapHighlightColor: 'transparent',
        textAlign: 'center', alignSelf: 'stretch',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
    });

    const undoRedoBtn = {
        width: 44, minWidth: 44, flexShrink: 0,
        background: 'transparent',
        border: '1px solid rgba(201,168,76,0.25)',
        color: 'rgba(201,168,76,0.9)',
        padding: 0, borderRadius: 6, cursor: 'pointer',
        fontSize: 14, fontFamily: 'inherit',
        WebkitTapHighlightColor: 'transparent', textAlign: 'center',
        alignSelf: 'stretch',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
    };

    const hintText =
        editTool === 'pedal' ? 'DRAG=DRAW · GRAB LINES=RESIZE · TAP=DELETE' :
            editTool === 'remove' ? 'SWIPE NOTES TO DELETE' :
                'TAP EMPTY=ADD · ••• DRAG=MOVE · ▬ TOP/BOTTOM=RESIZE';

    return (
        <>
            <canvas
                ref={overlayCanvasRef}
                style={{ position: 'fixed', inset: 0, pointerEvents: 'none', display: 'block' }}
            />

            <div style={{
                position: 'fixed', top: 64, left: '50%', transform: 'translateX(-50%)',
                display: 'flex', alignItems: 'stretch', gap: 6,
                background: 'rgba(7,7,12,0.94)',
                border: '1px solid rgba(201,168,76,0.2)',
                borderRadius: 12, padding: '8px 12px',
                backdropFilter: 'blur(12px)', zIndex: 50,
                width: 'calc(100vw - 16px)', maxWidth: 850,
                boxSizing: 'border-box', height: 64,
            }}>

                {/* Hint */}
                <div style={{
                    width: 200, minWidth: 200, flexShrink: 0,
                    color: 'rgba(255,255,255,0.7)', fontSize: 10,
                    letterSpacing: 1.5, textTransform: 'uppercase', lineHeight: 1.5,
                    display: 'flex', alignItems: 'center',
                }}>
                    {hintText}
                </div>

                <div style={{ width: 1, background: 'rgba(201,168,76,0.15)', flexShrink: 0, alignSelf: 'stretch' }} />

                {/* Undo / Redo */}
                <button style={undoRedoBtn} onClick={undo} title="Undo"><i className="bi bi-arrow-counterclockwise" /></button>
                <button style={undoRedoBtn} onClick={redo} title="Redo"><i className="bi bi-arrow-clockwise" /></button>

                <div style={{ width: 1, background: 'rgba(201,168,76,0.15)', flexShrink: 0, alignSelf: 'stretch' }} />

                {/* Tools */}
                {[
                    { key: 'remove', label: '- DELETE' },
                    { key: 'pedal', label: 'SUSTAIN' },
                ].map(({ key, label }) => (
                    <button key={key} style={toolBtn(key)} onClick={() => toggleTool(key)}>
                        {label}
                    </button>
                ))}

                <div style={{ width: 1, background: 'rgba(201,168,76,0.15)', flexShrink: 0, alignSelf: 'stretch' }} />

                {/* L / R hand paint buttons */}
                {[
                    { hand: 1, label: 'L', color: leftColor },
                    { hand: 0, label: 'R', color: rightColor },
                ].map(({ hand, label, color }) => (
                    <button
                        key={hand}
                        style={{
                            width: 44, minWidth: 44, flexShrink: 0,
                            background: editTool === 'paint' && paintHand === hand ? `${color}22` : 'transparent',
                            border: editTool === 'paint' && paintHand === hand
                                ? `1px solid ${color}`
                                : '1px solid rgba(201,168,76,0.25)',
                            color: editTool === 'paint' && paintHand === hand ? color : 'rgba(201,168,76,0.8)',
                            padding: 0, borderRadius: 6, cursor: 'pointer',
                            fontSize: 11, letterSpacing: 1.5,
                            fontFamily: 'inherit', WebkitTapHighlightColor: 'transparent',
                            alignSelf: 'stretch', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', gap: 5,
                        }}
                        onClick={() => {
                            if (editTool === 'paint' && paintHand === hand) {
                                setEditTool(null); setPaintHand(null);
                            } else {
                                setEditTool('paint'); setPaintHand(hand);
                            }
                        }}
                    >
                        <div style={{
                            width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0,
                        }} />
                        {label}
                    </button>
                ))}

                <div style={{ width: 1, background: 'rgba(201,168,76,0.15)', flexShrink: 0, alignSelf: 'stretch' }} />
                {/* Done */}
                <button
                    style={{
                        width: 70, minWidth: 70, flexShrink: 0,
                        background: 'rgba(201,168,76,0.15)',
                        border: '1px solid rgba(201,168,76,0.6)',
                        color: '#c9a84c', padding: 0, borderRadius: 6,
                        cursor: 'pointer', fontSize: 10, letterSpacing: 2,
                        textTransform: 'uppercase', fontFamily: 'inherit',
                        WebkitTapHighlightColor: 'transparent', textAlign: 'center',
                        alignSelf: 'stretch',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                    onClick={onExitEdit}
                >
                    ✓ DONE
                </button>
            </div>
        </>
    );
}