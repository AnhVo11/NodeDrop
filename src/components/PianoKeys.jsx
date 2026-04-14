import React from 'react';

const MIN_NOTE = 21;
const MAX_NOTE = 108;
const BLACK_PATTERN = new Set([1, 3, 6, 8, 10]);

export function isBlack(note) { return BLACK_PATTERN.has(note % 12); }

export function getTotalWhites() {
    let c = 0;
    for (let n = MIN_NOTE; n <= MAX_NOTE; n++) if (!isBlack(n)) c++;
    return c;
}

export function whitesBefore(note) {
    let c = 0;
    for (let n = MIN_NOTE; n < note; n++) if (!isBlack(n)) c++;
    return c;
}

export function noteX(note, pianoWidth) {
    const totalWhites = getTotalWhites();
    const ww = pianoWidth / totalWhites;
    if (!isBlack(note)) return (whitesBefore(note) + 0.5) * ww;
    let lo = note - 1; while (isBlack(lo)) lo--;
    let hi = note + 1; while (isBlack(hi)) hi++;
    return (noteX(lo, pianoWidth) + noteX(hi, pianoWidth)) / 2;
}

export function noteW(note, pianoWidth) {
    const ww = pianoWidth / getTotalWhites();
    return isBlack(note) ? ww * 0.52 : ww * 0.88;
}

export default function PianoKeys({ canvasWidth, pianoWidth, scrollX, keyHeight, activeKeys, audioTime }) {
    const totalWhites = getTotalWhites();
    const ww = pianoWidth / totalWhites;
    const keys = [];

    // White keys
    let wi = 0;
    for (let n = MIN_NOTE; n <= MAX_NOTE; n++) {
        if (isBlack(n)) continue;
        const x = wi * ww - scrollX;
        if (x + ww > 0 && x < canvasWidth) {
            const active = activeKeys.has(n) && activeKeys.get(n) > audioTime;
            keys.push(
                <React.Fragment key={`w${n}`}>
                    <rect x={x + 1} y={2} width={ww - 2} height={keyHeight - 4} fill={active ? '#ffe680' : '#e8e3d4'} />
                    {active && <rect x={x + 1} y={2} width={ww - 2} height={7} fill="#ffd700" filter="url(#keyGlow)" />}
                    <rect x={x} y={2} width={1} height={keyHeight - 4} fill="rgba(0,0,0,0.18)" />
                </React.Fragment>
            );
        }
        wi++;
    }

    // Black keys
    for (let n = MIN_NOTE; n <= MAX_NOTE; n++) {
        if (!isBlack(n)) continue;
        const x = noteX(n, pianoWidth) - scrollX;
        const bw = ww * 0.54;
        const bh = keyHeight * 0.60;
        if (x + bw > 0 && x - bw < canvasWidth) {
            const active = activeKeys.has(n) && activeKeys.get(n) > audioTime;
            keys.push(
                <React.Fragment key={`b${n}`}>
                    <rect x={x - bw / 2} y={2} width={bw} height={bh} fill={active ? '#a07820' : '#161622'} rx={5} />
                    {active && <rect x={x - bw / 2 + 2} y={2} width={bw - 4} height={4} fill="#daa520" />}
                </React.Fragment>
            );
        }
    }

    return (
        <svg style={{ position: 'absolute', bottom: 0, left: 0 }} width={canvasWidth} height={keyHeight}>
            <defs>
                <filter id="keyGlow">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
            </defs>
            <rect width={canvasWidth} height={keyHeight} fill="#0f0f18" />
            <rect width={canvasWidth} height={1.5} fill="rgba(201,168,76,0.45)" />
            {keys}
        </svg>
    );
}