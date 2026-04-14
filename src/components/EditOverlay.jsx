import React, { useRef, useEffect, useCallback, useState } from 'react';
import { noteX, noteW, getTotalWhites, isBlack } from './PianoKeys';
import { useEditHistory } from '../hooks/useEditHistory';

const MIN_NOTE = 21;
const MAX_NOTE = 108;
const KEY_H = 130;
const BAR_H = 56;
const LOOK_AHEAD_VIS = 4.5;
const HANDLE_SIZE = 16; // px from top or bottom = resize zone

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
    const editToolRef = useRef(null);
    const sustainTrailRef = useRef([]);
    const lastSustainPt = useRef(null);
    const interactRef = useRef(null);
    const particlesRef = useRef([]);
    const rafRef = useRef(null);
    const overlayCanvasRef = useRef(null);
    const editScrubRef = useRef(null);

    const stateRef = useRef({});
    stateRef.current = { noteObjs, rightColor, leftColor };

    useEffect(() => { editToolRef.current = editTool; }, [editTool]);

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

    // Returns hit zone: 'top', 'bottom', 'middle', or null
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

    // ---- Swipe notes ----
    function checkSwipeNotes(x1, y1, x2, y2, ch, action) {
        const { noteObjs, rightColor, leftColor } = stateRef.current;
        const st = currentTime();
        let changed = false;

        if (action === 'remove') {
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
            return;
        }

        const updated = noteObjs.map(n => {
            if (n.isPedal || n.note < MIN_NOTE || n.note > MAX_NOTE) return n;
            if (n.startTime > st + LOOK_AHEAD_VIS || n.startTime + n.duration < st - 0.2) return n;
            const r = getNoteRect(n, ch);
            if (r.y + r.h > ch - KEY_H + 10) return n;
            if (Math.max(x1, x2) < r.x || Math.min(x1, x2) > r.x + r.w) return n;
            if (Math.max(y1, y2) < r.y || Math.min(y1, y2) > r.y + r.h) return n;
            if (n.sustain === action) return n;
            changed = true;
            return { ...n, sustain: action };
        });
        if (changed) { pushUndo(noteObjs); onUpdateNotes(updated); }
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
            const cw = canvas.width;
            const tool = editToolRef.current;
            const barY = ch - KEY_H - 6;

            // Progress bar seek
            if (y >= barY - 16 && y <= barY + 22) {
                editScrubRef.current = { startY: y, startX: x, startTime: currentTime(), isBar: true };
                return;
            }

            // Block new interaction if one already in progress
            if (interactRef.current || lastSustainPt.current) return;

            if (tool === 'sustain' || tool === 'unsustain' || tool === 'remove') {
                lastSustainPt.current = { x, y };
                sustainTrailRef.current = [{ x, y }];
                return;
            }

            // Smart mode
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
            const tool = editToolRef.current;

            // Progress bar seek
            if (editScrubRef.current) {
                if (editScrubRef.current.isBar) {
                    const ratio = Math.max(0, Math.min(1, x / cw));
                    onScrub(ratio * songDuration);
                }
                return;
            }

            if ((tool === 'sustain' || tool === 'unsustain' || tool === 'remove') && lastSustainPt.current) {
                const prev = lastSustainPt.current;
                const action = tool === 'sustain' ? true : tool === 'unsustain' ? false : 'remove';
                checkSwipeNotes(prev.x, prev.y, x, y, ch, action);
                lastSustainPt.current = { x, y };
                sustainTrailRef.current.push({ x, y });
                if (sustainTrailRef.current.length > 30) sustainTrailRef.current.shift();
                return;
            }

            const ia = interactRef.current;
            if (!ia) return;

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
                        // Top edge = note END time
                        // Drag up (dy < 0) → delta negative → duration increases ✓
                        return {
                            ...n,
                            duration: Math.max(0.05, ia.origDuration - delta),
                        };
                    } else {
                        // Bottom edge = note START time
                        // Drag down (dy > 0) → startTime earlier → duration longer ✓
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
            const tool = editToolRef.current;

            if (editScrubRef.current) { editScrubRef.current = null; return; }

            if (tool === 'sustain' || tool === 'unsustain' || tool === 'remove') {
                lastSustainPt.current = null;
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
            lastSustainPt.current = null;
            setTimeout(() => { sustainTrailRef.current = []; }, 300);
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

        function drawNoteIndicators() {
            const { noteObjs } = stateRef.current;
            const ch = canvas.height;
            const cw = canvas.width;
            const st = currentTime();

            noteObjs.forEach(n => {
                if (n.isPedal || n.note < MIN_NOTE || n.note > MAX_NOTE) return;
                if (n.startTime > st + LOOK_AHEAD_VIS + 0.2) return;
                if (n.startTime + n.duration < st - 0.5) return;
                const r = getNoteRect(n, ch);
                if (r.x + r.w < 0 || r.x > cw) return;
                if (r.h < 8) return;

                const rr = Math.min(r.w * 0.35, 7);

                // Top resize handle — white bar at top
                ctx.fillStyle = 'rgba(255,255,255,0.55)';
                ctx.beginPath();
                ctx.roundRect(r.x + 4, r.y + 3, r.w - 8, 4, 2);
                ctx.fill();

                // Bottom resize handle — white bar at bottom
                ctx.fillStyle = 'rgba(255,255,255,0.55)';
                ctx.beginPath();
                ctx.roundRect(r.x + 4, r.y + r.h - 7, r.w - 8, 4, 2);
                ctx.fill();

                // Middle drag indicator — dots
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
            ctx.beginPath();
            ctx.roundRect(r.x, r.y, r.w, Math.max(r.h, 8), rr);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha = 1;
        }

        function drawSustainTrail() {
            const trail = sustainTrailRef.current;
            if (trail.length < 2) return;
            const tool = editToolRef.current;
            const color = tool === 'sustain'
                ? 'rgba(255,255,255,0.85)'
                : tool === 'unsustain'
                    ? 'rgba(255,180,50,0.85)'
                    : 'rgba(255,60,60,0.85)';
            const glow = tool === 'sustain'
                ? 'rgba(255,255,255,0.5)'
                : tool === 'unsustain'
                    ? 'rgba(255,180,50,0.5)'
                    : 'rgba(255,60,60,0.5)';
            ctx.save();
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.shadowBlur = 12;
            ctx.shadowColor = glow;
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
            drawParticles();
            drawNoteIndicators();
            drawAddPreview();
            drawSustainTrail();
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
        color: editTool === key ? '#c9a84c' : 'rgba(201,168,76,0.45)',
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
        color: 'rgba(201,168,76,0.6)',
        padding: 0, borderRadius: 6, cursor: 'pointer',
        fontSize: 14, fontFamily: 'inherit',
        WebkitTapHighlightColor: 'transparent', textAlign: 'center',
        alignSelf: 'stretch',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
    };

    const hintText =
        editTool === 'sustain' ? 'SWIPE NOTES TO MARK SUSTAIN' :
            editTool === 'unsustain' ? 'SWIPE NOTES TO REMOVE SUSTAIN' :
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
                backdropFilter: 'blur(12px)', zIndex: 30,
                width: 'calc(100vw - 16px)', maxWidth: 850,
                boxSizing: 'border-box',
                height: 64,
            }}>

                <div style={{
                    width: 200, minWidth: 200, flexShrink: 0,
                    color: 'rgba(255,255,255,0.3)', fontSize: 10,
                    letterSpacing: 1.5, textTransform: 'uppercase', lineHeight: 1.5,
                    display: 'flex', alignItems: 'center',
                }}>
                    {hintText}
                </div>

                <div style={{ width: 1, height: 24, background: 'rgba(201,168,76,0.15)', flexShrink: 0 }} />

                <button style={undoRedoBtn} onClick={undo} title="Undo">↩</button>
                <button style={undoRedoBtn} onClick={redo} title="Redo">↪</button>

                <div style={{ width: 1, height: 24, background: 'rgba(201,168,76,0.15)', flexShrink: 0 }} />

                {[
                    { key: 'remove', label: '- DELETE' },
                    { key: 'sustain', label: '+ SUSTAIN' },
                    { key: 'unsustain', label: '- SUSTAIN' },
                ].map(({ key, label }) => (
                    <button key={key} style={toolBtn(key)} onClick={() => toggleTool(key)}>
                        {label}
                    </button>
                ))}

                <div style={{ width: 1, height: 24, background: 'rgba(201,168,76,0.15)', flexShrink: 0 }} />

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