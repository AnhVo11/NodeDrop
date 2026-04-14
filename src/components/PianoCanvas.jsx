import React, { useRef, useEffect, useCallback } from 'react';
import PianoKeys, { isBlack, noteX, noteW, getTotalWhites } from './PianoKeys';

const MIN_NOTE = 21;
const MAX_NOTE = 108;
const KEY_H = 130;
const BAR_H = 56;
const LOOK_AHEAD_VIS = 4.5;
const LOOK_AHEAD_SCH = 0.25;
// const PIANO_MIN_WIDTH = 1200;
const PIXELS_PER_SECOND = 120; // how many px of swipe = 1 second of song

export default function PianoCanvas({
    noteObjs, setNoteObjs,
    isPlaying, playOffset, playStart,
    tempoScale, scheduled, setScheduled,
    activeKeys, setActiveKeys,
    scheduleNote, playNote, getCtx,
    onSongEnd, onScrub, zoom,
    isPedalOn, hasPedal,
}) {
    const canvasRef = useRef(null);
    const particlesRef = useRef([]);
    const rafRef = useRef(null);
    const scrollX = useRef(0);

    // Scroll (scrub) tracking
    const isScrubbing = useRef(false);
    const scrubStartY = useRef(0);
    const scrubStartTime = useRef(0);

    const stateRef = useRef({});


    stateRef.current = {
        noteObjs, isPlaying, playOffset, playStart,
        tempoScale, scheduled, activeKeys, zoom,
    };

    const getPianoWidth = () => window.innerWidth * (stateRef.current.zoom / 100);;

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

    // ---- Native touch/mouse handlers ----
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
            // swipe up (negative dy) = forward in time, swipe down = backward
            const timeDelta = dy / PIXELS_PER_SECOND;
            const song = stateRef.current.noteObjs;
            const maxTime = song.length ? song[song.length - 1].startTime : 0;
            const newTime = Math.max(0, Math.min(maxTime, scrubStartTime.current + timeDelta));
            onScrub(newTime);
        };

        const onTouchEnd = () => {
            isScrubbing.current = false;
        };

        const onMouseDown = (e) => {
            isScrubbing.current = true;
            scrubStartY.current = e.clientY;
            scrubStartTime.current = currentTime();
        };

        const onMouseMove = (e) => {
            if (!isScrubbing.current) return;
            const dy = e.clientY - scrubStartY.current;
            const timeDelta = -dy / PIXELS_PER_SECOND;
            const song = stateRef.current.noteObjs;
            const maxTime = song.length ? song[song.length - 1].startTime : 0;
            const newTime = Math.max(0, Math.min(maxTime, scrubStartTime.current + timeDelta));
            onScrub(newTime);
        };

        const onMouseUp = () => {
            isScrubbing.current = false;
        };

        canvas.addEventListener('touchstart', onTouchStart, { passive: false });
        canvas.addEventListener('touchmove', onTouchMove, { passive: false });
        canvas.addEventListener('touchend', onTouchEnd, { passive: true });
        canvas.addEventListener('mousedown', onMouseDown, { passive: true });
        canvas.addEventListener('mousemove', onMouseMove, { passive: true });
        canvas.addEventListener('mouseup', onMouseUp, { passive: true });

        return () => {
            canvas.removeEventListener('touchstart', onTouchStart);
            canvas.removeEventListener('touchmove', onTouchMove);
            canvas.removeEventListener('touchend', onTouchEnd);
            canvas.removeEventListener('mousedown', onMouseDown);
            canvas.removeEventListener('mousemove', onMouseMove);
            canvas.removeEventListener('mouseup', onMouseUp);
        };
    }, [currentTime, onScrub]);

    const scheduleAhead = useCallback(() => {
        const { isPlaying, tempoScale, scheduled } = stateRef.current;
        const aCtx = getCtx();
        if (!isPlaying || !aCtx) return;

        const songNow = currentTime();
        const audioNow = aCtx.currentTime;
        const newSched = new Set(scheduled);
        const newActive = new Map(stateRef.current.activeKeys);
        let changed = false;

        stateRef.current.noteObjs.forEach((n, i) => {
            if (newSched.has(i)) return;
            if (n.note < MIN_NOTE || n.note > MAX_NOTE) return;
            const delay = (n.startTime - songNow) / tempoScale;
            if (delay < LOOK_AHEAD_SCH && delay > -0.05) {
                newSched.add(i);
                const fireAt = audioNow + Math.max(0, delay);
                const realDur = n.duration / tempoScale;
                scheduleNote(n.note, n.vel, realDur, fireAt);
                newActive.set(n.note, fireAt + realDur);
                changed = true;
            }
        });

        if (changed) {
            setScheduled(newSched);
            setActiveKeys(newActive);
        }
    }, [currentTime, getCtx, scheduleNote, setScheduled, setActiveKeys]);

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

    const drawNotes = useCallback((ctx, cw, ch) => {
        const { noteObjs } = stateRef.current;
        const st = currentTime();
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, BAR_H, cw, ch - KEY_H - BAR_H);
        ctx.clip();

        noteObjs.forEach(n => {
            if (n.note < MIN_NOTE || n.note > MAX_NOTE) return;
            if (n.startTime > st + LOOK_AHEAD_VIS + 0.2) return;
            if (n.startTime + n.duration < st - 0.15) return;

            const r = getNoteRect(n, ch);
            if (r.x + r.w < 0 || r.x > cw) return;
            const rr = Math.min(r.w * 0.35, 7);
            const isRH = n.hand === 0;
            const fillC = isRH ? '#4a9eff' : '#c9a84c';
            const glowC = isRH ? 'rgba(74,158,255,0.55)' : 'rgba(201,168,76,0.55)';
            const topC = isRH ? '#7bc4ff' : '#e8d080';

            // Fade out past notes
            const pastAmount = st - (n.startTime + n.duration);
            ctx.globalAlpha = pastAmount > 0 ? Math.max(0.15, 1 - pastAmount * 2) : 1;

            ctx.shadowBlur = 14;
            ctx.shadowColor = glowC;
            ctx.fillStyle = fillC;
            ctx.beginPath();
            ctx.roundRect(r.x, r.y, r.w, r.h, rr);
            ctx.fill();

            ctx.shadowBlur = 0;
            ctx.fillStyle = topC;
            ctx.beginPath();
            ctx.roundRect(r.x, r.y, r.w, Math.min(4, r.h), [rr, rr, 0, 0]);
            ctx.fill();
            ctx.globalAlpha = 1;
        });

        ctx.shadowBlur = 0;
        ctx.restore();
    }, [currentTime, getNoteRect]);

    const drawParticles = useCallback((ctx) => {
        particlesRef.current = particlesRef.current.filter(p => p.life > 0);
        particlesRef.current.forEach(p => {
            p.x += p.vx; p.y += p.vy; p.vy += 0.18; p.life -= 0.03;
            ctx.globalAlpha = Math.max(0, p.life);
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, Math.max(0.1, p.size * p.life), 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
    }, []);

    // Scrub indicator line
    const drawScrubLine = useCallback((ctx, cw, ch) => {
        if (!isScrubbing.current) return;
        const y = BAR_H + (ch - KEY_H - BAR_H) * (1 - 0 / LOOK_AHEAD_VIS);
        ctx.save();
        ctx.strokeStyle = 'rgba(201,168,76,0.6)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(cw, y);
        ctx.stroke();
        ctx.setLineDash([]);
        // Label
        ctx.fillStyle = 'rgba(201,168,76,0.5)';
        ctx.font = '10px Palatino';
        ctx.letterSpacing = '2px';
        ctx.fillText('NOW', 12, y - 6);
        ctx.restore();
    }, []);

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
            const aCtx = getCtx();

            if (aCtx) {
                const now = aCtx.currentTime;
                const newActive = new Map(stateRef.current.activeKeys);
                let changed = false;
                newActive.forEach((end, note) => {
                    if (end < now) { newActive.delete(note); changed = true; }
                });
                if (changed) setActiveKeys(newActive);
            }

            scheduleAhead();

            const { isPlaying, noteObjs } = stateRef.current;
            if (isPlaying && noteObjs.length) {
                const last = noteObjs[noteObjs.length - 1];
                if (currentTime() > last.startTime + last.duration + 0.8) onSongEnd();
            }

            drawBG(ctx, cw, ch);
            drawNotes(ctx, cw, ch);
            drawParticles(ctx);
            drawScrubLine(ctx, cw, ch);

            rafRef.current = requestAnimationFrame(loop);
        }

        rafRef.current = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(rafRef.current);
    }, [scheduleAhead, currentTime, getCtx, onSongEnd, setActiveKeys, drawBG, drawNotes, drawParticles, drawScrubLine]);

    return (
        <div style={{ position: 'fixed', inset: 0 }}>
            <canvas ref={canvasRef} style={{ display: 'block', touchAction: 'none' }} />
            <PianoKeys
                canvasWidth={window.innerWidth}
                pianoWidth={getPianoWidth()}
                scrollX={scrollX.current}
                keyHeight={KEY_H}
                activeKeys={stateRef.current.activeKeys}
                audioTime={getCtx()?.currentTime ?? -1}
            />
            {(
                <div style={{
                    position: 'absolute',
                    bottom: KEY_H + 12,
                    left: 16,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    pointerEvents: 'none',
                }}>
                    <div style={{
                        width: 10, height: 10, borderRadius: '50%',
                        background: isPedalOn ? '#ff3333' : 'rgba(255,255,255,0.1)',
                        boxShadow: isPedalOn ? '0 0 8px rgba(255,50,50,0.8)' : 'none',
                        transition: 'background 0.1s, box-shadow 0.1s',
                    }} />
                    <span style={{
                        color: isPedalOn ? 'rgba(255,100,100,0.8)' : 'rgba(255,255,255,0.2)',
                        fontSize: 10, letterSpacing: 2,
                        textTransform: 'uppercase',
                        transition: 'color 0.1s',
                        fontFamily: 'Palatino',
                    }}>
                        SUSTAIN
                    </span>
                </div>
            )}
        </div>
    );
}
