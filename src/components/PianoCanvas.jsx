import React, { useRef, useEffect, useCallback } from 'react';
import { isBlack, noteX, noteW, getTotalWhites } from './PianoKeys';
import EditOverlay from './EditOverlay';

const MIN_NOTE = 21;
const MAX_NOTE = 108;
const KEY_H = 130;
const BAR_H = 56;
const LOOK_AHEAD_SCH = 0.25;
const PIXELS_PER_SECOND = 120;

export default function PianoCanvas({
    noteObjs, setNoteObjs,
    isPlaying, playOffset, playStart,
    tempoScale, scheduled, setScheduled,
    activeKeys, setActiveKeys,
    scheduleNote, playNote, getCtx,
    onSongEnd, onScrub, zoom,
    isPedalOn, fullPedal, onToggleFullPedal,
    hiddenHands,
    onZoomChange, keyZoom, onKeyZoomChange,
    rightColor, leftColor,
    songDuration,
    editMode, onExitEdit, onAddNote, onUpdateNotes,
}) {
    const canvasRef = useRef(null);
    const rafRef = useRef(null);
    const scrollX = useRef(0);
    const isScrubbing = useRef(false);
    const isSeekingBar = useRef(false);
    const scrubStartY = useRef(0);
    const scrubStartTime = useRef(0);
    const dragStartX = useRef(0);
    const dragStartScrollX = useRef(0);
    const dragDirectionRef = useRef(null); // 'h' or 'v'
    const fontSizeRef = useRef(15);

    const pinchRef = useRef(null); // { initDist: {h, v}, initZoom: {key, view} }
    const stateRef = useRef({});
    const lookAhead = 4.5 + (zoom - 100) / 300 * Math.max(0, songDuration - 4.5);
    stateRef.current = {
        noteObjs, isPlaying, playOffset, playStart,
        tempoScale, scheduled, activeKeys, zoom,
        rightColor, leftColor, editMode, hiddenHands, lookAhead, keyZoom,
    };

    const getPianoWidth = useCallback(
        () => window.innerWidth * (stateRef.current.keyZoom / 100),
        []
    );

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
        const la = stateRef.current.lookAhead;
        const ahead2 = n.startTime - currentTime();
        const ahead1 = (n.startTime + n.duration) - currentTime();
        const fallH = ch - KEY_H - BAR_H;
        const y2 = BAR_H + fallH * (1 - ahead2 / la);
        const y1 = BAR_H + fallH * (1 - ahead1 / la);
        return { x: x - w / 2, y: Math.min(y1, y2), w, h: Math.max(Math.abs(y2 - y1), 4) };
    }, [currentTime, getPianoWidth]);

    // ---- Scrub / Seek gesture ----
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const getXY = (e) => e.touches
            ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
            : { x: e.clientX, y: e.clientY };

        const onStart = (e) => {
            if (stateRef.current.editMode) return;
            if (e.touches) e.preventDefault();
            const { x, y } = getXY(e);
            const barY = BAR_H;
            const prog = Math.min(1, Math.max(0, currentTime() / songDuration));
            const dotX = Math.max(8, canvas.width * prog);
            const nearDot = Math.abs(x - dotX) <= 20 && y >= barY - 8 && y <= barY + 14;
            if (nearDot) {
                isSeekingBar.current = true; return;
            }
            isScrubbing.current = true;
            scrubStartY.current = y;
            scrubStartTime.current = currentTime();
            dragStartX.current = x;
            dragStartScrollX.current = scrollX.current;
            dragDirectionRef.current = null;
        };

        const onMove = (e) => {
            if (stateRef.current.editMode) return;
            if (e.touches) e.preventDefault();
            const { x, y } = getXY(e);
            if (isSeekingBar.current) {
                onScrub(Math.max(0, Math.min(1, x / canvas.width)) * songDuration);
                return;
            }
            if (!isScrubbing.current) return;
            const dx = x - dragStartX.current;
            const dy = y - scrubStartY.current;

            if (!dragDirectionRef.current) {
                if (Math.abs(dx) > Math.abs(dy) + 5) dragDirectionRef.current = 'h';
                else if (Math.abs(dy) > Math.abs(dx) + 5) dragDirectionRef.current = 'v';
                else return;
            }

            if (dragDirectionRef.current === 'h') {
                const pw = stateRef.current.keyZoom > 100
                    ? window.innerWidth * (stateRef.current.keyZoom / 100)
                    : window.innerWidth;
                const maxScroll = Math.max(0, pw - window.innerWidth);
                scrollX.current = Math.max(0, Math.min(maxScroll, dragStartScrollX.current - dx));
                return;
            }

            const song = stateRef.current.noteObjs;
            const maxTime = song.length ? song[song.length - 1].startTime : 0;
            onScrub(Math.max(0, Math.min(maxTime, scrubStartTime.current + dy / PIXELS_PER_SECOND)));
        };

        const onEnd = () => {
            isScrubbing.current = false;
            isSeekingBar.current = false;
        };

        const onPinchStart = (e) => {
            if (e.touches.length !== 2) return;
            const t0 = e.touches[0], t1 = e.touches[1];
            pinchRef.current = {
                initH: Math.abs(t0.clientX - t1.clientX),
                initV: Math.abs(t0.clientY - t1.clientY),
                initKeyZoom: stateRef.current.keyZoom,
                initViewZoom: stateRef.current.zoom,
                direction: null,
            };
        };

        const onPinchMove = (e) => {
            if (e.touches.length !== 2 || !pinchRef.current) return;
            e.preventDefault();
            const t0 = e.touches[0], t1 = e.touches[1];
            const curH = Math.abs(t0.clientX - t1.clientX);
            const curV = Math.abs(t0.clientY - t1.clientY);
            const p = pinchRef.current;

            if (!p.direction) {
                const dh = Math.abs(curH - p.initH);
                const dv = Math.abs(curV - p.initV);
                if (dh > 10 || dv > 10) {
                    p.direction = dh >= dv ? 'h' : 'v';
                } else return;
            }

            if (p.direction === 'h') {
                const hScale = curH / Math.max(p.initH, 1);
                const dampened = 1 + (hScale - 1) * 0.3;
                const newKey = Math.min(400, Math.max(100, p.initKeyZoom * dampened));
                onKeyZoomChange(Math.round(newKey));
            } else {
                const vScale = Math.max(p.initV, 1) / curV;
                const dampened = 1 + (vScale - 1) * 0.3;
                const newView = Math.min(400, Math.max(100, p.initViewZoom * dampened));
                onZoomChange(Math.round(newView));
            }
        };

        const onPinchEnd = (e) => {
            if (e.touches.length < 2) pinchRef.current = null;
        };

        canvas.addEventListener('touchstart', onPinchStart, { passive: false });
        canvas.addEventListener('touchmove', onPinchMove, { passive: false });
        canvas.addEventListener('touchend', onPinchEnd, { passive: true });
        canvas.addEventListener('touchstart', onStart, { passive: false });
        canvas.addEventListener('touchmove', onMove, { passive: false });
        canvas.addEventListener('touchend', onEnd, { passive: true });
        canvas.addEventListener('mousedown', onStart, { passive: true });
        canvas.addEventListener('mousemove', onMove, { passive: true });
        canvas.addEventListener('mouseup', onEnd, { passive: true });

        return () => {
            canvas.removeEventListener('touchstart', onPinchStart);
            canvas.removeEventListener('touchmove', onPinchMove);
            canvas.removeEventListener('touchend', onPinchEnd);
            canvas.removeEventListener('touchstart', onStart);
            canvas.removeEventListener('touchmove', onMove);
            canvas.removeEventListener('touchend', onEnd);
            canvas.removeEventListener('mousedown', onStart);
            canvas.removeEventListener('mousemove', onMove);
            canvas.removeEventListener('mouseup', onEnd);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentTime, onScrub, songDuration]);

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
            const { hiddenHands } = stateRef.current;
            if (newSched.has(i) || n.isPedal || n.note < MIN_NOTE || n.note > MAX_NOTE) return;
            if (hiddenHands[n.hand]) { newSched.add(i); changed = true; return; }
            const delay = (n.startTime - songNow) / tempoScale;
            if (delay < LOOK_AHEAD_SCH && delay > -0.05) {
                newSched.add(i);
                scheduleNote(n.note, n.vel, n.duration / tempoScale, audioNow + Math.max(0, delay));
                changed = true;
            }
        });
        if (changed) setScheduled(newSched);
    }, [currentTime, getCtx, scheduleNote, setScheduled]);

    // ---- Draw BG ----
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
    }, [getPianoWidth]);

    // ---- Draw Notes ----
    const drawNotes = useCallback((ctx, cw, ch) => {
        const { noteObjs, rightColor, leftColor, editMode } = stateRef.current;
        const st = currentTime();
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, BAR_H, cw, ch - KEY_H - BAR_H);
        ctx.clip();

        noteObjs.forEach(n => {
            if (n.isPedal || n.note < MIN_NOTE || n.note > MAX_NOTE) return;
            if (!editMode && hiddenHands[n.hand]) return;
            if (n.startTime > st + stateRef.current.lookAhead + 0.2) return;
            if (n.startTime + n.duration < st - 0.5) return;

            const r = getNoteRect(n, ch);
            if (r.x + r.w < 0 || r.x > cw) return;
            const rr = Math.min(r.w * 0.35, 7);
            const fillC = n.hand === 0 ? rightColor : leftColor;
            const past = st - (n.startTime + n.duration);
            ctx.globalAlpha = past > 0 ? Math.max(0.15, 1 - past * 2) : 1;

            ctx.shadowBlur = 14;
            ctx.shadowColor = fillC + '88';
            ctx.fillStyle = fillC;
            ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rr); ctx.fill();

            ctx.shadowBlur = 0;
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, Math.min(4, r.h), [rr, rr, 0, 0]); ctx.fill();

            // Sustain indicator
            if (n.sustain) {
                ctx.strokeStyle = 'rgba(255,255,255,0.95)';
                ctx.lineWidth = 2;
                ctx.beginPath(); ctx.roundRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2, rr); ctx.stroke();
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

            // Resize handle shown in edit mode
            if (editMode && r.h > 18) {
                ctx.fillStyle = 'rgba(255,255,255,0.35)';
                ctx.fillRect(r.x + r.w * 0.25, r.y + 4, r.w * 0.5, 3);
            }

            ctx.globalAlpha = 1;
        });

        ctx.shadowBlur = 0;
        ctx.restore();
    }, [currentTime, getNoteRect, hiddenHands]);

    // ---- Draw Piano Keys ----
    const drawPianoKeys = useCallback((ctx, cw, ch) => {
        const { noteObjs, rightColor, leftColor } = stateRef.current;
        const st = currentTime();
        const pw = getPianoWidth();
        const ww = pw / getTotalWhites();
        const ky = ch - KEY_H;

        const { hiddenHands, editMode } = stateRef.current;
        const activeMap = new Map();
        noteObjs.forEach(n => {
            if (n.isPedal || n.note < MIN_NOTE || n.note > MAX_NOTE) return;
            if (!editMode && hiddenHands[n.hand]) return;
            if (n.startTime <= st && n.startTime + n.duration >= st)
                activeMap.set(n.note, n.hand === 0 ? rightColor : leftColor);
        });

        ctx.fillStyle = '#0f0f18'; ctx.fillRect(0, ky, cw, KEY_H);
        ctx.fillStyle = 'rgba(201,168,76,0.45)'; ctx.fillRect(0, ky, cw, 1.5);

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
                ctx.beginPath(); ctx.roundRect(x - bw / 2, ky + 2, bw, bh, [0, 0, 5, 5]); ctx.fill();
                if (color) {
                    ctx.shadowBlur = 12; ctx.shadowColor = color;
                    ctx.fillStyle = color;
                    ctx.fillRect(x - bw / 2 + 2, ky + bh - 14, bw - 4, 12);
                    ctx.shadowBlur = 0;
                }
            }
        }
    }, [currentTime, getPianoWidth]);

    // ---- Draw Progress + Time ----
    const drawProgressAndTime = useCallback((ctx, cw, ch) => {
        const t = currentTime();
        const prog = Math.min(1, Math.max(0, t / songDuration));
        const barY = BAR_H;

        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.beginPath(); ctx.roundRect(0, barY, cw, 6, 3); ctx.fill();
        ctx.fillStyle = '#e63946';
        ctx.beginPath(); ctx.roundRect(0, barY, Math.max(6, cw * prog), 6, 3); ctx.fill();
        const dotX = Math.max(8, cw * prog);
        ctx.beginPath(); ctx.arc(dotX, barY + 3, 9, 0, Math.PI * 2);
        ctx.fillStyle = '#e63946';
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#e63946';
        ctx.fill();
        ctx.shadowBlur = 0;

        const targetSize = isSeekingBar.current ? 75 : 15;
        fontSizeRef.current += (targetSize - fontSizeRef.current) * 0.15;
        ctx.font = `bold ${Math.round(fontSizeRef.current)}px Palatino Linotype, Palatino, serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.textAlign = 'right';
        ctx.fillText(formatTime(t), cw - 16, ch - KEY_H - 12);
        ctx.textAlign = 'left';
    }, [currentTime, songDuration]);

    function formatTime(s) {
        const m = Math.floor(s / 60);
        return `${m}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
    }

    // ---- Game Loop ----
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
            drawProgressAndTime(ctx, cw, ch);
            rafRef.current = requestAnimationFrame(loop);
        }

        rafRef.current = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(rafRef.current);
    }, [scheduleAhead, currentTime, getCtx, onSongEnd, drawBG, drawNotes, drawPianoKeys, drawProgressAndTime]);

    return (
        <div style={{ position: 'fixed', inset: 0 }}>
            <canvas ref={canvasRef} style={{ display: 'block', touchAction: 'none' }} />

            {/* Sustain indicator */}
            <div
                onClick={onToggleFullPedal}
                style={{
                    position: 'absolute', bottom: KEY_H + 10, left: 10,
                    display: 'flex', alignItems: 'center', gap: 6,
                    cursor: 'pointer',
                    border: fullPedal ? '1px solid rgba(220,50,50,0.8)' : '1px solid transparent',
                    borderRadius: 6, padding: '4px 8px',
                    background: fullPedal ? 'rgba(220,50,50,0.1)' : 'transparent',
                    transition: 'all 0.15s',
                    WebkitTapHighlightColor: 'transparent',
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

            {/* Edit overlay */}
            {editMode && (
                <EditOverlay
                    canvasRef={canvasRef}
                    noteObjs={noteObjs}
                    onAddNote={onAddNote}
                    onUpdateNotes={onUpdateNotes}
                    onExitEdit={onExitEdit}
                    currentTime={currentTime}
                    getPianoWidth={getPianoWidth}
                    scrollX={scrollX}
                    rightColor={rightColor}
                    leftColor={leftColor}
                    onScrub={onScrub}
                    songDuration={songDuration}
                    lookAhead={stateRef.current.lookAhead}
                />
            )}
        </div>
    );
}