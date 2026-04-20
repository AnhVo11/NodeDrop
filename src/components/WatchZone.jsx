import React, { useRef, useEffect, useState, useCallback } from 'react';

const MIN_NOTE = 21;
const MAX_NOTE = 108;
const TOTAL_KEYS = MAX_NOTE - MIN_NOTE + 1;
const PIANO_OVERLAY_H = 60;
const BG_TOLERANCE = 35;
const NOTE_OFF_FRAMES = 5;

function isBlackKey(note) {
    const m = note % 12;
    return [1, 3, 6, 8, 10].includes(m);
}

function countWhites(from, to) {
    let count = 0;
    for (let n = from; n <= to; n++) if (!isBlackKey(n)) count++;
    return count;
}

function buildKeyMap(zoneW, leftNote = MIN_NOTE, rightNote = MAX_NOTE, leftTrim = 0, rightTrim = 0) {
    const totalWhites = countWhites(leftNote, rightNote);
    const ww = zoneW / Math.max(1, totalWhites);
    const keyMap = {};
    let wi = 0;
    for (let n = leftNote; n <= rightNote; n++) {
        if (!isBlackKey(n)) {
            keyMap[n] = { xStart: Math.floor(wi * ww), xEnd: Math.ceil((wi + 1) * ww), isBlack: false };
            wi++;
        }
    }
    // Black key lean offsets (fraction of ww) — matches real piano layout
    // Positive = lean right, Negative = lean left
    const blackKeyLean = {
        1: -0.12, // C# leans toward C
        3: +0.12, // D# leans toward E
        6: -0.12, // F# leans toward F
        8: 0.00, // G# centered
        10: +0.12, // A# leans toward B
    };

    for (let n = leftNote; n <= rightNote; n++) {
        if (!isBlackKey(n)) continue;
        let leftW = n - 1, rightW = n + 1;
        while (leftW >= leftNote && isBlackKey(leftW)) leftW--;
        while (rightW <= rightNote && isBlackKey(rightW)) rightW++;
        const leftX = keyMap[leftW] ? keyMap[leftW].xEnd : 0;
        const rightX = keyMap[rightW] ? keyMap[rightW].xStart : zoneW;
        const mid = (leftX + rightX) / 2;
        const lean = (blackKeyLean[n % 12] ?? 0) * ww;
        const cx = mid + lean;
        const bw = ww * 0.55;
        keyMap[n] = { xStart: Math.floor(cx - bw / 2), xEnd: Math.ceil(cx + bw / 2), isBlack: true };
    }
    return keyMap;
}

function colorDist(r1, g1, b1, r2, g2, b2) {
    return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

function getHandles(z) {
    return [
        { id: 'tl', x: z.x, y: z.y },
        { id: 'tr', x: z.x + z.w, y: z.y },
        { id: 'bl', x: z.x, y: z.y + z.h },
        { id: 'br', x: z.x + z.w, y: z.y + z.h },
        { id: 'tc', x: z.x + z.w / 2, y: z.y },
        { id: 'bc', x: z.x + z.w / 2, y: z.y + z.h },
        { id: 'lc', x: z.x, y: z.y + z.h / 2 },
        { id: 'rc', x: z.x + z.w, y: z.y + z.h / 2 },
    ];
}

export default function WatchZone({ onCaptureDone, onClose }) {
    const [phase, setPhase] = useState('init');
    const [zone, setZone] = useState({ x: 150, y: 100, w: 760, h: 400 });
    const [dragState, setDragState] = useState(null);
    const [bgColor, setBgColor] = useState(null);
    const [noteCount, setNoteCount] = useState(0);
    const [crosshair, setCrosshair] = useState(null);
    const [hoverColor, setHoverColor] = useState(null);
    const [selectedKey, setSelectedKey] = useState(null);
    const selectedKeyRef = useRef(null);
    const [leftAnchor, setLeftAnchor] = useState(MIN_NOTE);
    const [rightAnchor, setRightAnchor] = useState(MAX_NOTE);
    const [anchorMode, setAnchorMode] = useState(null);
    const [leftTrim, setLeftTrim] = useState(0);
    const [rightTrim, setRightTrim] = useState(0);
    const [triggerPos, setTriggerPos] = useState(45);
    const triggerPosRef = useRef(45);
    const [scanRate, setScanRate] = useState(33); // ms between scans
    const scanRateRef = useRef(33);
    const anchorRef = useRef({ left: MIN_NOTE, right: MAX_NOTE, leftTrim: 0, rightTrim: 0 });
    const [scanMode, setScanMode] = useState('fill');
    const [fillThreshold, setFillThreshold] = useState(60);
    const [pointConfig, setPointConfig] = useState({ front: true, middle: true, end: false });
    const [hollowMode, setHollowMode] = useState(false);
    const [hollowColor, setHollowColor] = useState(null);
    const [smartFilter, setSmartFilter] = useState(true);
    const smartFilterRef = useRef(true);
    const scanModeRef = useRef('fill');
    const fillThresholdRef = useRef(0.6);
    const pointConfigRef = useRef({ front: true, middle: true, end: false });
    const hollowModeRef = useRef(false);
    const hollowColorRef = useRef(null);

    const videoRef = useRef(null);
    const bgCanvasRef = useRef(null);
    const overlayCanvasRef = useRef(null);
    const rafRef = useRef(null);
    const scanTimerRef = useRef(null);
    const streamRef = useRef(null);
    const imageCaptureRef = useRef(null);
    const startTimeRef = useRef(null);
    const activeRef = useRef(new Map());
    const notesRef = useRef([]);
    const zoneRef = useRef(zone);
    const bgColorRef = useRef(null);
    const noteCountRef = useRef(0);

    useEffect(() => { zoneRef.current = zone; }, [zone]);
    useEffect(() => { selectedKeyRef.current = selectedKey; }, [selectedKey]);
    useEffect(() => {
        anchorRef.current = { left: leftAnchor, right: rightAnchor, leftTrim, rightTrim };
    }, [leftAnchor, rightAnchor, leftTrim, rightTrim]);

    useEffect(() => { bgColorRef.current = bgColor; }, [bgColor]);
    useEffect(() => { triggerPosRef.current = triggerPos; }, [triggerPos]);
    useEffect(() => { scanRateRef.current = scanRate; }, [scanRate]);
    useEffect(() => { scanModeRef.current = scanMode; }, [scanMode]);
    useEffect(() => { fillThresholdRef.current = fillThreshold / 100; }, [fillThreshold]);
    useEffect(() => { pointConfigRef.current = pointConfig; }, [pointConfig]);
    useEffect(() => { hollowModeRef.current = hollowMode; }, [hollowMode]);
    useEffect(() => { smartFilterRef.current = smartFilter; }, [smartFilter]);
    useEffect(() => { hollowColorRef.current = hollowColor; }, [hollowColor]);

    // ---- Start screen share ----
    const startCapture = async () => {
        try {
            const s = await navigator.mediaDevices.getDisplayMedia({
                video: { frameRate: 30, displaySurface: 'window' },
                audio: false,
                preferCurrentTab: false,
            });
            streamRef.current = s;
            const track = s.getVideoTracks()[0];
            if (videoRef.current) {
                videoRef.current.srcObject = s;
                videoRef.current.muted = true;
                await videoRef.current.play();
            }
            s.getVideoTracks()[0].addEventListener('ended', () => onClose());
            // Bring NoteDrop back into focus after Chrome switches to shared tab
            setTimeout(() => window.focus(), 500);
            setPhase('setup');
        } catch (err) {
            console.error('Screen capture failed:', err?.message || err);
        }
    };

    // ---- Draw loop ----
    useEffect(() => {
        if (phase === 'init') return;
        const bg = bgCanvasRef.current;
        const ov = overlayCanvasRef.current;
        if (!bg || !ov) return;
        const bgCtx = bg.getContext('2d');
        const ovCtx = ov.getContext('2d');

        function drawFrame() {
            const cw = window.innerWidth;
            const ch = window.innerHeight;
            bg.width = cw; bg.height = ch;
            ov.width = cw; ov.height = ch;

            if (videoRef.current?.readyState >= 2) {
                bgCtx.drawImage(videoRef.current, 0, 0, cw, ch);
            } else {
                bgCtx.fillStyle = '#07070c';
                bgCtx.fillRect(0, 0, cw, ch);
            }

            ovCtx.clearRect(0, 0, cw, ch);
            const z = zoneRef.current;

            ovCtx.fillStyle = 'rgba(0,0,0,0.5)';
            ovCtx.fillRect(0, 0, cw, ch);
            ovCtx.clearRect(z.x, z.y, z.w, z.h);
            const { left: aln, right: arn, leftTrim: ltPct, rightTrim: rtPct } = anchorRef.current;
            const keyW = z.w / Math.max(1, countWhites(aln, arn));
            const lt = Math.round(keyW * ltPct / 100);
            const rt = Math.round(keyW * rtPct / 100);
            const leftEdge = z.x + lt;
            const rightEdge = z.x + z.w - rt;
            ovCtx.strokeStyle = phase === 'recording' ? '#e63946' : '#c9a84c';
            ovCtx.lineWidth = 2;
            ovCtx.strokeRect(leftEdge, z.y, z.w - lt - rt, z.h);

            const noteAreaH = z.h - PIANO_OVERLAY_H;
            const trigY = z.y + noteAreaH * (1 - triggerPosRef.current / 100);
            ovCtx.strokeStyle = phase === 'recording' ? 'rgba(230,57,70,0.9)' : 'rgba(201,168,76,0.7)';
            ovCtx.lineWidth = 2;
            ovCtx.setLineDash([6, 3]);
            ovCtx.beginPath();
            ovCtx.moveTo(leftEdge, trigY);
            ovCtx.lineTo(rightEdge, trigY);
            ovCtx.stroke();
            ovCtx.setLineDash([]);

            drawPianoOverlay(ovCtx, z);

            if (phase === 'setup' || phase === 'calibrate') {
                drawKeyMapOverlay(ovCtx, z);
            }

            if (phase === 'setup') {
                getHandles(z).forEach(h => {
                    ovCtx.fillStyle = '#c9a84c';
                    ovCtx.fillRect(h.x - 5, h.y - 5, 10, 10);
                });
            }


            if (phase === 'calibrate' && crosshair) {
                ovCtx.strokeStyle = 'white';
                ovCtx.lineWidth = 1;
                ovCtx.beginPath();
                ovCtx.moveTo(crosshair.x - 15, crosshair.y);
                ovCtx.lineTo(crosshair.x + 15, crosshair.y);
                ovCtx.moveTo(crosshair.x, crosshair.y - 15);
                ovCtx.lineTo(crosshair.x, crosshair.y + 15);
                ovCtx.stroke();
                ovCtx.strokeStyle = 'yellow';
                ovCtx.beginPath();
                ovCtx.arc(crosshair.x, crosshair.y, 4, 0, Math.PI * 2);
                ovCtx.stroke();
            }

            // Draw alignment lines for se lected key
            if (selectedKeyRef.current !== null) {
                const sk = selectedKeyRef.current;
                const { left: aln2, right: arn2, leftTrim: ltPct2 } = anchorRef.current;
                const keyW2 = z.w / Math.max(1, countWhites(aln2, arn2));
                const lt2 = Math.round(keyW2 * ltPct2 / 100);
                const fullKm = buildKeyMap(z.w, aln2, arn2, 0, 0);
                const km = fullKm[sk];
                if (km) {
                    let x1 = z.x + km.xStart;
                    let x2 = z.x + km.xEnd;
                    if (sk === aln2) x1 = z.x + lt2;
                    if (sk === arn2) x2 = rightEdge;
                    ovCtx.strokeStyle = 'rgba(255,220,0,0.9)';
                    ovCtx.lineWidth = 1.5;
                    ovCtx.setLineDash([4, 4]);
                    [x1, x2].forEach(x => {
                        ovCtx.beginPath();
                        ovCtx.moveTo(x, z.y);
                        ovCtx.lineTo(x, z.y + z.h - PIANO_OVERLAY_H);
                        ovCtx.stroke();
                    });
                    ovCtx.setLineDash([]);
                    // Label
                    const noteNames = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'];
                    const octave = Math.floor((sk - 21) / 12) + 0;
                    const noteName = noteNames[(sk - 21) % 12];
                    const name = noteName + octave;
                    ovCtx.fillStyle = 'rgba(255,220,0,0.9)';
                    ovCtx.font = 'bold 11px sans-serif';
                    ovCtx.textAlign = 'center';
                    ovCtx.fillText(name, (x1 + x2) / 2, z.y + 16);
                    ovCtx.textAlign = 'left';
                }
            }

            if (phase === 'recording') {
                ovCtx.fillStyle = '#e63946';
                ovCtx.beginPath();
                ovCtx.arc(z.x + 16, z.y + 16, 6, 0, Math.PI * 2);
                ovCtx.fill();
                ovCtx.fillStyle = 'white';
                ovCtx.font = 'bold 11px sans-serif';
                ovCtx.fillText('REC', z.x + 28, z.y + 20);
                ovCtx.fillStyle = 'rgba(255,255,255,0.8)';
                ovCtx.fillText(`${noteCountRef.current} notes`, z.x + z.w - 90, z.y + 20);
            }

            rafRef.current = requestAnimationFrame(drawFrame);
        }

        rafRef.current = requestAnimationFrame(drawFrame);
        return () => cancelAnimationFrame(rafRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase, crosshair]);

    function drawPianoOverlay(ctx, z) {
        const ky = z.y + z.h - PIANO_OVERLAY_H;
        const { left: ln, right: rn } = anchorRef.current;
        const totalW = countWhites(ln, rn);
        const ww = z.w / Math.max(1, totalW);
        ctx.fillStyle = 'rgba(7,7,12,0.8)';
        ctx.fillRect(z.x, ky, z.w, PIANO_OVERLAY_H);
        const keyW = ww;
        const lt = Math.round(keyW * anchorRef.current.leftTrim / 100);
        const rt = Math.round(keyW * anchorRef.current.rightTrim / 100);
        let wi = 0;
        for (let n = ln; n <= rn; n++) {
            if (isBlackKey(n)) continue;
            let x = z.x + wi * ww;
            let kw = ww;
            if (n === ln) { x += lt; kw -= lt; }
            if (n === rn) { kw -= rt; }
            ctx.fillStyle = 'rgba(232,227,212,0.9)';
            ctx.fillRect(x + 0.5, ky + 2, kw - 1, PIANO_OVERLAY_H - 3);
            ctx.strokeStyle = 'rgba(0,0,0,0.3)';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(x + 0.5, ky + 2, kw - 1, PIANO_OVERLAY_H - 3);
            wi++;
        }
        const bkm = buildKeyMap(z.w, ln, rn, 0, 0);
        for (let n = ln; n <= rn; n++) {
            if (!isBlackKey(n) || !bkm[n]) continue;
            const k = bkm[n];
            ctx.fillStyle = 'rgba(15,15,25,0.95)';
            ctx.fillRect(z.x + k.xStart, ky + 2, k.xEnd - k.xStart, PIANO_OVERLAY_H * 0.6);
        }
        // Draw C labels on white keys
        const wkm = buildKeyMap(z.w, ln, rn, 0, 0);
        ctx.font = 'bold 8px sans-serif';
        ctx.textAlign = 'center';
        for (let n = ln; n <= rn; n++) {
            if (isBlackKey(n) || !wkm[n]) continue;
            if (n % 12 !== 0) continue; // only C notes (MIDI C = 0 mod 12... actually C4=60, so n%12===0 is C)
            const k = wkm[n];
            const octave = Math.floor((n - 21) / 12);
            const cx = z.x + (k.xStart + k.xEnd) / 2;
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillText(`C${octave}`, cx, ky + PIANO_OVERLAY_H - 4);
        }
        ctx.textAlign = 'left';
    }

    function drawKeyMapOverlay(ctx, z) {
        const noteAreaH = z.h - PIANO_OVERLAY_H;
        const trigY = z.y + noteAreaH * (1 - triggerPosRef.current / 100);
        const km = buildKeyMap(z.w, anchorRef.current.left, anchorRef.current.right, anchorRef.current.leftTrim, anchorRef.current.rightTrim);
        for (let n = anchorRef.current.left; n <= anchorRef.current.right; n++) {
            if (isBlackKey(n) || !km[n]) continue;
            const x = z.x + km[n].xStart;
            ctx.strokeStyle = 'rgba(201,168,76,0.25)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, trigY - 14);
            ctx.lineTo(x, trigY + 14);
            ctx.stroke();
        }
    }

    // ---- Grab pixel from video ----
    const grabPixel = useCallback((screenX, screenY) => {
        try {
            const bgCtx = bgCanvasRef.current?.getContext('2d');
            if (!bgCtx) return null;
            const pixel = bgCtx.getImageData(Math.floor(screenX), Math.floor(screenY), 1, 1).data;
            return { r: pixel[0], g: pixel[1], b: pixel[2] };
        } catch (err) {
            console.error('grabPixel failed:', err?.message || err);
            return null;
        }
    }, []);

    const sampleColor = useCallback((screenX, screenY) => {
        const result = grabPixel(screenX, screenY);
        if (!result) return;
        const { r, g, b } = result;
        console.log(`Sampled rgb(${r},${g},${b})`);
        if (hollowModeRef.current && !hollowColorRef.current) {
            setHollowColor({ r, g, b });
        } else {
            setBgColor({ r, g, b });
        }
    }, [grabPixel]);

    // ---- Pointer events ----
    const onPointerDown = useCallback((e) => {
        const { clientX: mx, clientY: my } = e;
        const z = zoneRef.current;

        // Handle resize/move in setup phase — check handles FIRST
        if (phase === 'setup') {
            for (const h of getHandles(z)) {
                if (Math.abs(mx - h.x) <= 12 && Math.abs(my - h.y) <= 12) {
                    setDragState({ type: 'resize', handle: h.id, startX: mx, startY: my, startZone: { ...z } });
                    return;
                }
            }
        }

        // Check piano key clicks in setup and calibrate
        if (phase === 'calibrate' || phase === 'setup') {
            const z = zoneRef.current;
            const ky = z.y + z.h - PIANO_OVERLAY_H;
            if (my >= ky && my <= z.y + z.h) {
                const relX = mx - z.x;
                const ww = z.w / 52;
                let wi = 0, foundNote = null;
                for (let n = MIN_NOTE; n <= MAX_NOTE; n++) {
                    if (isBlackKey(n)) continue;
                    if (relX >= wi * ww && relX <= (wi + 1) * ww) { foundNote = n; break; }
                    wi++;
                }
                for (let n = MIN_NOTE; n <= MAX_NOTE; n++) {
                    if (!isBlackKey(n)) continue;
                    const frac = (n - MIN_NOTE) / TOTAL_KEYS;
                    const cx = frac * z.w;
                    const bw = ww * 0.5;
                    if (relX >= cx - bw / 2 && relX <= cx + bw / 2 && my <= ky + PIANO_OVERLAY_H * 0.6) {
                        foundNote = n; break;
                    }
                }
                if (foundNote !== null) {
                    if (anchorMode === 'left') {
                        setLeftAnchor(foundNote);
                        setAnchorMode(null);
                    } else if (anchorMode === 'right') {
                        setRightAnchor(foundNote);
                        setAnchorMode(null);
                    } else {
                        setSelectedKey(k => k === foundNote ? null : foundNote);
                    }
                    return;
                }
            }
            if (phase === 'calibrate') sampleColor(mx, my);
        }

        // Setup zone move
        if (phase === 'setup') {
            if (mx >= z.x && mx <= z.x + z.w && my >= z.y && my <= z.y + z.h) {
                setDragState({ type: 'move', startX: mx, startY: my, startZone: { ...z } });
            }
        }
    }, [phase, sampleColor, anchorMode]);

    const onPointerMove = useCallback((e) => {
        const { clientX: mx, clientY: my } = e;
        if (phase === 'calibrate') {
            setCrosshair({ x: mx, y: my });
            // Sample color under cursor for live preview
            const bgCtx = bgCanvasRef.current?.getContext('2d');
            if (bgCtx) {
                const pixel = bgCtx.getImageData(mx, my, 1, 1).data;
                setHoverColor({ r: pixel[0], g: pixel[1], b: pixel[2] });
            }
            return;
        }
        if (!dragState) return;
        const dx = mx - dragState.startX, dy = my - dragState.startY;
        const sz = dragState.startZone;
        if (dragState.type === 'move') { setZone({ ...sz, x: sz.x + dx, y: sz.y + dy }); return; }
        let { x, y, w, h } = sz;
        const hid = dragState.handle;
        if (hid.includes('r')) w = Math.max(300, sz.w + dx);
        if (hid.includes('l')) { x = sz.x + dx; w = Math.max(300, sz.w - dx); }
        if (hid.includes('b')) h = Math.max(150, sz.h + dy);
        if (hid.includes('t')) { y = sz.y + dy; h = Math.max(150, sz.h - dy); }
        setZone({ x, y, w, h });
    }, [phase, dragState]);

    const onPointerUp = useCallback(() => setDragState(null), []);

    // ---- Scan loop ----
    const startRecording = useCallback(() => {
        notesRef.current = [];
        activeRef.current = new Map();
        noteCountRef.current = 0;
        startTimeRef.current = performance.now();
        setPhase('recording');
        setNoteCount(0);

        function scan() {
            try {
                const rawZ = zoneRef.current;
                const keyW = rawZ.w / Math.max(1, countWhites(anchorRef.current.left, anchorRef.current.right));
                const ltPx = Math.round(keyW * anchorRef.current.leftTrim / 100);
                const rtPx = Math.round(keyW * anchorRef.current.rightTrim / 100);
                const z = {
                    ...rawZ,
                    x: rawZ.x + ltPx,
                    w: Math.max(50, rawZ.w - ltPx - rtPx),
                };
                const bg = bgColorRef.current;
                if (!bg) { scanTimerRef.current = setTimeout(scan, scanRateRef.current); return; }

                let imageData, scanW, scanH;

                const bgCtx = bgCanvasRef.current?.getContext('2d');
                if (!bgCtx) { scanTimerRef.current = setTimeout(scan, scanRateRef.current); return; }
                const noteAreaH = z.h - PIANO_OVERLAY_H;
                const trigY = Math.floor(z.y + noteAreaH * (1 - triggerPosRef.current / 100));
                scanW = Math.floor(z.w);
                scanH = 40;
                imageData = bgCtx.getImageData(Math.floor(z.x), Math.max(0, trigY - 20), scanW, scanH);

                const data = imageData.data;
                scanH = imageData.height;
                const now = (performance.now() - startTimeRef.current) / 1000;
                const activeNow = new Set();
                const { left: leftNote, right: rightNote } = anchorRef.current;
                const keyMap = buildKeyMap(scanW, leftNote, rightNote, 0, 0);

                // First pass: compute hit ratio for every key
                const hitRatios = {};
                const hitHandMap = {};
                const mode = scanModeRef.current;
                const pc = pointConfigRef.current;
                const threshold = fillThresholdRef.current;
                const hc = hollowColorRef.current;
                const hollow = hollowModeRef.current && hc;

                function pixelIsNote(px, py) {
                    const i = (py * scanW + px) * 4;
                    const r = data[i], g = data[i + 1], b = data[i + 2];
                    if (colorDist(r, g, b, bg.r, bg.g, bg.b) > BG_TOLERANCE) return true;
                    return false;
                }

                function pixelIsFill(px, py) {
                    if (!hollow) return false;
                    const i = (py * scanW + px) * 4;
                    const r = data[i], g = data[i + 1], b = data[i + 2];
                    return colorDist(r, g, b, hc.r, hc.g, hc.b) < BG_TOLERANCE;
                }

                // Check a column for hollow pattern: border→fill→border
                function checkColumnHollow(colX) {
                    let state = 'outside'; // outside → border → fill → border
                    let borderCount = 0;
                    for (let py = 0; py < scanH; py++) {
                        const isB = pixelIsNote(colX, py);
                        const isF = pixelIsFill(colX, py);
                        if (state === 'outside' && isB) { state = 'border1'; borderCount = 1; }
                        else if (state === 'border1' && isF) { state = 'fill'; }
                        else if (state === 'border1' && !isB) { state = 'outside'; }
                        else if (state === 'fill' && isB) { state = 'border2'; borderCount++; }
                        else if (state === 'fill' && !isF && !isB) { state = 'outside'; }
                    }
                    return borderCount >= 2;
                }

                function checkPoint(colX) {
                    // Check a 2px wide column at colX across full scanH
                    let hits = 0;
                    for (let py = 0; py < scanH; py++) {
                        if (pixelIsNote(Math.min(scanW - 1, colX), py)) hits++;
                    }
                    return hits / scanH > 0.3; // 30% of that column height must match
                }

                for (let n = MIN_NOTE; n <= MAX_NOTE; n++) {
                    const km = keyMap[n];
                    if (!km) continue;
                    const colStart = Math.max(0, km.xStart);
                    const colEnd = Math.min(scanW - 1, km.xEnd);
                    const totalCols = colEnd - colStart + 1;
                    if (totalCols <= 0) { hitRatios[n] = 0; continue; }

                    let hit = false;

                    if (mode === 'point') {
                        const frontCol = Math.floor(colStart + totalCols * 0.1);
                        const midCol = Math.floor(colStart + totalCols * 0.5);
                        const endCol = Math.floor(colStart + totalCols * 0.9);
                        const checkFn = hollow ? checkColumnHollow : checkPoint;
                        const results = {
                            front: checkFn(frontCol),
                            middle: checkFn(midCol),
                            end: checkFn(endCol),
                        };
                        hit = Object.entries(pc).every(([key, required]) => !required || results[key]);
                        hitRatios[n] = hit ? 1.0 : 0;
                    } else {
                        let matchCount = 0;
                        for (let px = colStart; px <= colEnd; px++) {
                            const colHit = hollow ? checkColumnHollow(px) : (() => {
                                let c = 0;
                                for (let py = 0; py < scanH; py++) if (pixelIsNote(px, py)) c++;
                                return c / scanH > 0.3;
                            })();
                            if (colHit) matchCount++;
                        }
                        hitRatios[n] = matchCount / totalCols;
                        hit = hitRatios[n] >= threshold;
                    }

                    hitHandMap[n] = 0;
                }

                // Second pass: a note fires only if its ratio is a LOCAL PEAK
                // Debug: log top 5 highest hit ratio keys every 2 seconds
                if (Math.floor(now * 0.5) !== Math.floor((now - 0.033) * 0.5)) {
                    const sorted = Object.entries(hitRatios)
                        .filter(([, v]) => v > 0.05)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 5);
                    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
                    const labels = sorted.map(([n, v]) => {
                        const ni = parseInt(n);
                        return `${noteNames[(ni - 21) % 12]}${Math.floor((ni - 12) / 12)}:${v.toFixed(2)}`;
                    });
                    console.log('Top keys:', labels.join(' | ') || 'none');
                }

                // Second pass: a note fires only if its ratio is a LOCAL PEAK
                // significantly higher than both neighbors
                for (let n = MIN_NOTE; n <= MAX_NOTE; n++) {
                    const ratio = hitRatios[n];
                    if (ratio < 0.15) continue; // too low to be anything

                    // Find nearest neighbors (skip across black/white boundary)
                    const leftNeighbor = hitRatios[n - 1] ?? 0;
                    const rightNeighbor = hitRatios[n + 1] ?? 0;
                    const maxNeighbor = Math.max(leftNeighbor, rightNeighbor);

                    // Must be a local peak: significantly higher than neighbors
                    // OR neighbors are also high (chord — both notes playing)
                    const isLocalPeak = ratio >= maxNeighbor * 1.4 || ratio >= 0.85;
                    const isHighEnough = scanModeRef.current === 'point' ? ratio >= 0.9 : ratio >= fillThresholdRef.current;

                    if (isHighEnough && isLocalPeak) {
                        const hand = hitHandMap[n] ?? 0;
                        const key = `${n}_${hand}`;
                        activeNow.add(key);
                        if (!activeRef.current.has(key)) {
                            activeRef.current.set(key, { startTime: now, hand, absentFrames: 0 });
                        } else {
                            activeRef.current.get(key).absentFrames = 0;
                        }
                    }
                }

                // Post-process: resolve adjacent simultaneous NEW notes
                const newKeys = [...activeNow].filter(k => !activeRef.current.has(k));
                if (smartFilterRef.current && newKeys.length > 1) {
                    // Group by adjacent notes firing at same time
                    const newNotes = newKeys.map(k => parseInt(k.split('_')[0])).sort((a, b) => a - b);
                    let i = 0;
                    while (i < newNotes.length) {
                        // Find cluster of adjacent notes
                        let j = i;
                        while (j + 1 < newNotes.length && newNotes[j + 1] - newNotes[j] <= 1) j++;
                        const cluster = newNotes.slice(i, j + 1);
                        if (cluster.length === 2) {
                            // Keep higher ratio
                            const [a, b] = cluster;
                            const ra = hitRatios[a] ?? 0;
                            const rb = hitRatios[b] ?? 0;
                            const remove = ra >= rb ? b : a;
                            activeNow.delete(`${remove}_0`);
                            activeNow.delete(`${remove}_1`);
                        } else if (cluster.length >= 3) {
                            // Keep only middle
                            const mid = cluster[Math.floor(cluster.length / 2)];
                            cluster.forEach(n => {
                                if (n !== mid) {
                                    activeNow.delete(`${n}_0`);
                                    activeNow.delete(`${n}_1`);
                                }
                            });
                        }
                        i = j + 1;
                    }
                }

                // Note off with debounce
                activeRef.current.forEach((val, key) => {
                    if (!activeNow.has(key)) {
                        val.absentFrames++;
                        if (val.absentFrames >= NOTE_OFF_FRAMES) {
                            const duration = now - val.startTime;
                            if (duration > 0.08) {
                                const noteNum = parseInt(key.split('_')[0]);
                                notesRef.current.push({
                                    note: noteNum, startTime: val.startTime,
                                    duration, vel: 0.7, hand: val.hand, isPedal: false,
                                });
                                noteCountRef.current++;
                                setNoteCount(c => c + 1);
                            }
                            activeRef.current.delete(key);
                        }
                    }
                });

            } catch (err) {
                console.error('Scan error:', err?.message || err);
            }
            scanTimerRef.current = setTimeout(scan, 33);
        }

        scan();
    }, []);

    const stopRecording = useCallback(() => {
        clearTimeout(scanTimerRef.current);
        const now = (performance.now() - startTimeRef.current) / 1000;
        activeRef.current.forEach((val, key) => {
            const duration = now - val.startTime;
            if (duration > 0.08) {
                const noteNum = parseInt(key.split('_')[0]);
                notesRef.current.push({
                    note: noteNum, startTime: val.startTime,
                    duration, vel: 0.7, hand: val.hand, isPedal: false,
                });
            }
        });
        streamRef.current?.getTracks().forEach(t => t.stop());
        onCaptureDone(notesRef.current.sort((a, b) => a.startTime - b.startTime));
    }, [onCaptureDone]);

    const btnStyle = (active, danger) => ({
        padding: '10px 20px',
        background: danger ? 'rgba(230,57,70,0.15)' : active ? 'rgba(201,168,76,0.2)' : 'rgba(255,255,255,0.05)',
        border: `1px solid ${danger ? 'rgba(230,57,70,0.7)' : active ? 'rgba(201,168,76,0.7)' : 'rgba(255,255,255,0.2)'}`,
        color: danger ? '#e63946' : active ? '#c9a84c' : 'rgba(255,255,255,0.6)',
        borderRadius: 8, cursor: 'pointer', fontSize: 12,
        letterSpacing: 2, textTransform: 'uppercase', fontFamily: 'inherit',
        WebkitTapHighlightColor: 'transparent',
    });

    const calibrateInstruction = !bgColor
        ? 'CLICK ON THE BACKGROUND COLOR (EMPTY AREA WITH NO NOTES)'
        : 'BACKGROUND SAMPLED — READY TO RECORD';

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200 }}>
            <video ref={videoRef} style={{ display: 'none' }} muted playsInline />
            <canvas ref={bgCanvasRef} style={{ position: 'absolute', inset: 0, display: 'block' }} />
            <canvas
                ref={overlayCanvasRef}
                style={{
                    position: 'absolute', inset: 0, display: 'block',
                    cursor: phase === 'calibrate' ? 'crosshair' : phase === 'setup' ? 'move' : 'default',
                }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
            />

            {/* Init */}
            {phase === 'init' && (
                <div style={{
                    position: 'absolute', inset: 0, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(7,7,12,0.95)',
                }}>
                    <div style={{
                        background: '#12121c', border: '1px solid rgba(201,168,76,0.3)',
                        borderRadius: 16, padding: 36, maxWidth: 460, textAlign: 'left',
                        display: 'flex', flexDirection: 'column', gap: 20,
                        boxShadow: '0 24px 64px rgba(0,0,0,0.8)',
                    }}>
                        <div style={{ color: '#c9a84c', fontSize: 13, letterSpacing: 4, textTransform: 'uppercase', textAlign: 'center' }}>
                            NoteReader
                        </div>
                        <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, lineHeight: 2.2, letterSpacing: 1 }}>
                            <b style={{ color: 'rgba(201,168,76,0.8)' }}>1.</b> Open a falling notes piano video in another window<br />
                            <b style={{ color: 'rgba(201,168,76,0.8)' }}>2.</b> Click Share Screen — choose <b style={{ color: 'white' }}>Window</b> not Tab<br />
                            <b style={{ color: 'rgba(201,168,76,0.8)' }}>3.</b> Align the zone so the piano overlay matches the video keys<br />
                            <b style={{ color: 'rgba(201,168,76,0.8)' }}>4.</b> Click the background color, then click a note color<br />
                            <b style={{ color: 'rgba(201,168,76,0.8)' }}>5.</b> Hit Record!
                        </div>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                            <button style={btnStyle(true)} onClick={startCapture}>Share Screen</button>
                            <button style={btnStyle(false)} onClick={onClose}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Setup */}
            {phase === 'setup' && (
                <div style={{
                    position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)',
                    display: 'flex', gap: 12, alignItems: 'center',
                    background: 'rgba(7,7,12,0.92)', border: '1px solid rgba(201,168,76,0.25)',
                    borderRadius: 12, padding: '10px 20px', boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                    width: 'calc(100vw - 40px)', maxWidth: 1400, boxSizing: 'border-box',
                }}>
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, letterSpacing: 1.5 }}>
                        ALIGN PIANO OVERLAY WITH VIDEO KEYS · DRAG EDGES TO FIT
                    </span>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid rgba(201,168,76,0.25)', borderRadius: 8, padding: '6px 10px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 8, letterSpacing: 1 }}>MOST LEFT KEY SIZE</span>
                                <span style={{ color: '#c9a84c', fontSize: 11 }}>{100 - leftTrim}%</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <button style={{ ...btnStyle(false), padding: '1px 7px', fontSize: 10 }}
                                    onClick={() => setLeftTrim(t => Math.max(0, t - 5))}>▲</button>
                                <button style={{ ...btnStyle(false), padding: '1px 7px', fontSize: 10 }}
                                    onClick={() => setLeftTrim(t => Math.min(80, t + 5))}>▼</button>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid rgba(201,168,76,0.25)', borderRadius: 8, padding: '6px 10px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 8, letterSpacing: 1 }}>MOST RIGHT KEY SIZE</span>
                                <span style={{ color: '#c9a84c', fontSize: 11 }}>{100 - rightTrim}%</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <button style={{ ...btnStyle(false), padding: '1px 7px', fontSize: 10 }}
                                    onClick={() => setRightTrim(t => Math.max(0, t - 5))}>▲</button>
                                <button style={{ ...btnStyle(false), padding: '1px 7px', fontSize: 10 }}
                                    onClick={() => setRightTrim(t => Math.min(80, t + 5))}>▼</button>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, letterSpacing: 1 }}>SCAN LINE:</span>
                        <input type="range" min="5" max="95" value={triggerPos}
                            onChange={e => setTriggerPos(parseInt(e.target.value))}
                            style={{ width: 80, height: 2, accentColor: '#c9a84c' }} />
                        <span style={{ color: '#c9a84c', fontSize: 11, minWidth: 32 }}>{triggerPos}%</span>
                    </div>
                    <button style={btnStyle(true)} onClick={() => setPhase('calibrate')}>NEXT: CALIBRATE COLORS →</button>
                    <button style={btnStyle(false, true)} onClick={() => { streamRef.current?.getTracks().forEach(t => t.stop()); onClose(); }}>CANCEL</button>
                </div>
            )}

            {/* Calibrate */}
            {phase === 'calibrate' && (
                <div style={{
                    position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)',
                    display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'nowrap', justifyContent: 'center',
                    background: 'rgba(7,7,12,0.92)', border: '1px solid rgba(201,168,76,0.25)',
                    borderRadius: 12, padding: '10px 16px', boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                    width: 'calc(100vw - 40px)', maxWidth: 1400, boxSizing: 'border-box',
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                        <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, letterSpacing: 1.5 }}>
                            {calibrateInstruction}
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 6, padding: '5px 10px' }}>
                            {hoverColor && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <div style={{ width: 14, height: 14, borderRadius: 3, flexShrink: 0, background: `rgb(${hoverColor.r},${hoverColor.g},${hoverColor.b})`, border: '1px solid rgba(255,255,255,0.3)' }} />
                                    <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 9, fontFamily: 'monospace' }}>rgb({hoverColor.r},{hoverColor.g},{hoverColor.b})</span>
                                </div>
                            )}
                            {bgColor && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <div style={{ width: 14, height: 14, borderRadius: 3, flexShrink: 0, background: `rgb(${bgColor.r},${bgColor.g},${bgColor.b})`, border: '1.5px solid rgba(201,168,76,0.6)' }} />
                                    <span style={{ color: '#c9a84c', fontSize: 9, fontFamily: 'monospace' }}>rgb({bgColor.r},{bgColor.g},{bgColor.b}) BG</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Scan settings */}
                    <div style={{
                        display: 'flex', flexDirection: 'row', gap: 12, alignItems: 'center',
                        background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 12px',
                        border: '1px solid rgba(201,168,76,0.15)', flexShrink: 0,
                    }}>
                        {/* Mode toggle */}
                        <div style={{ display: 'flex', gap: 6 }}>
                            {['fill', 'point'].map(m => (
                                <button key={m} style={{ ...btnStyle(scanMode === m), padding: '4px 12px', fontSize: 10 }}
                                    onClick={() => setScanMode(m)}>
                                    {m === 'fill' ? 'FILL %' : 'POINT'}
                                </button>
                            ))}
                        </div>

                        {scanMode === 'fill' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, letterSpacing: 1 }}>MATCH</span>
                                <input type="range" min="20" max="95" value={fillThreshold}
                                    onChange={e => setFillThreshold(parseInt(e.target.value))}
                                    style={{ width: 80, height: 2, accentColor: '#c9a84c' }} />
                                <span style={{ color: '#c9a84c', fontSize: 11, fontFamily: 'monospace' }}>{fillThreshold}%</span>
                            </div>
                        )}

                        {/* Smart filter option */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div onClick={() => setSmartFilter(s => !s)} style={{
                                width: 18, height: 18, borderRadius: 4, cursor: 'pointer', flexShrink: 0,
                                background: smartFilter ? '#c9a84c' : 'transparent',
                                border: `2px solid ${smartFilter ? '#c9a84c' : 'rgba(255,255,255,0.3)'}`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                {smartFilter && <span style={{ fontSize: 11, color: '#000', fontWeight: 'bold' }}>✓</span>}
                            </div>
                            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, letterSpacing: 1 }}>SMART FILTER</span>
                        </div>

                        {/* Hollow note option */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div
                                onClick={() => setHollowMode(h => !h)}
                                style={{
                                    width: 18, height: 18, borderRadius: 4, cursor: 'pointer',
                                    background: hollowMode ? '#c9a84c' : 'transparent',
                                    border: `2px solid ${hollowMode ? '#c9a84c' : 'rgba(255,255,255,0.3)'}`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}
                            >
                                {hollowMode && <span style={{ fontSize: 11, color: '#000', fontWeight: 'bold' }}>✓</span>}
                            </div>
                            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, letterSpacing: 1 }}>HOLLOW NOTES</span>
                            {hollowMode && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>FILL COLOR:</span>
                                    {hollowColor ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                            <div style={{
                                                width: 16, height: 16, borderRadius: 3,
                                                background: `rgb(${hollowColor.r},${hollowColor.g},${hollowColor.b})`,
                                                border: '1.5px solid rgba(255,255,255,0.4)',
                                            }} />
                                            <span style={{ color: '#c9a84c', fontSize: 9, fontFamily: 'monospace' }}>
                                                rgb({hollowColor.r},{hollowColor.g},{hollowColor.b})
                                            </span>
                                            <button style={{ ...btnStyle(false), padding: '2px 6px', fontSize: 9 }}
                                                onClick={() => setHollowColor(null)}>×</button>
                                        </div>
                                    ) : (
                                        <span style={{ color: 'rgba(255,80,80,0.8)', fontSize: 10, letterSpacing: 1 }}>
                                            CLICK INSIDE A NOTE TO SAMPLE
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>

                        {scanMode === 'point' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {/* Mini key visual */}
                                <div style={{ position: 'relative', height: 28, width: 120, background: 'rgba(232,227,212,0.15)', borderRadius: 4, border: '1px solid rgba(255,255,255,0.15)' }}>
                                    {[
                                        { key: 'front', pct: 10, label: 'F' },
                                        { key: 'middle', pct: 50, label: 'M' },
                                        { key: 'end', pct: 90, label: 'E' },
                                    ].map(({ key, pct, label }) => (
                                        <div key={key}
                                            onClick={() => setPointConfig(p => ({ ...p, [key]: !p[key] }))}
                                            style={{
                                                position: 'absolute', left: `${pct}%`, top: '50%',
                                                transform: 'translate(-50%, -50%)',
                                                width: 14, height: 14, borderRadius: '50%',
                                                background: pointConfig[key] ? '#c9a84c' : 'rgba(255,255,255,0.15)',
                                                border: `2px solid ${pointConfig[key] ? '#c9a84c' : 'rgba(255,255,255,0.3)'}`,
                                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            }}>
                                            <span style={{ fontSize: 7, color: pointConfig[key] ? '#000' : 'rgba(255,255,255,0.5)', fontWeight: 'bold' }}>{label}</span>
                                        </div>
                                    ))}
                                    {/* Key divider lines */}
                                    <div style={{ position: 'absolute', left: '33%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.1)' }} />
                                    <div style={{ position: 'absolute', left: '66%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.1)' }} />
                                </div>

                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                        {bgColor && (
                            <button style={{ ...btnStyle(false), width: 100, textAlign: 'center', padding: '10px 0' }} onClick={() => setBgColor(null)}>RESET</button>
                        )}
                        {bgColor && (
                            <button style={{ ...btnStyle(true), width: 150, textAlign: 'center', padding: '10px 0' }} onClick={startRecording}>⬤ RECORD</button>
                        )}
                        <button style={{ ...btnStyle(false), width: 100, textAlign: 'center', padding: '10px 0' }} onClick={() => setPhase('setup')}>← BACK</button>
                        <button style={{ ...btnStyle(false, true), width: 100, textAlign: 'center', padding: '10px 0' }} onClick={() => { streamRef.current?.getTracks().forEach(t => t.stop()); onClose(); }}>CANCEL</button>
                    </div>
                </div>
            )}

            {/* Recording */}
            {phase === 'recording' && (
                <div style={{
                    position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)',
                    display: 'flex', gap: 12, alignItems: 'center',
                    background: 'rgba(7,7,12,0.92)', border: '1px solid rgba(230,57,70,0.4)',
                    borderRadius: 12, padding: '12px 20px', boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                }}>
                    <span style={{ color: 'rgba(230,57,70,0.9)', fontSize: 11, letterSpacing: 2 }}>
                        ⬤ RECORDING — {noteCount} NOTES CAPTURED
                    </span>
                    <button style={btnStyle(false, true)} onClick={stopRecording}>■ STOP & USE</button>
                </div>
            )}
        </div>
    );
}