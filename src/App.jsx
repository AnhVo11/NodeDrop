import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import TopBar from './components/TopBar';
import PianoCanvas from './components/PianoCanvas';
import { useAudio } from './hooks/useAudio';
import { parseMidi } from './hooks/useMidi';
import { buildFurElise } from './data/furElise';

const MIN_NOTE = 21;
const MAX_NOTE = 108;

export default function App() {
    const { initAudio, playNote, scheduleNote, getCtx, setPedal } = useAudio();

    const [song, setSong] = useState(() => buildFurElise());
    const [noteObjs, setNoteObjs] = useState(() => buildFurElise().map(n => ({ ...n, sliced: false })));
    const [songTitle, setSongTitle] = useState('Für Elise — Beethoven');
    const [isPlaying, setIsPlaying] = useState(false);
    const [playOffset, setPlayOffset] = useState(0);
    const [playStart, setPlayStart] = useState(0);
    const [tempoScale, setTempoScale] = useState(1.0);
    const [tempo, setTempo] = useState(100);
    const [zoom, setZoom] = useState(100);
    const [fullPedal, setFullPedal] = useState(false);
    const [isPedalOn, setIsPedalOn] = useState(false);
    const [scheduled, setScheduled] = useState(new Set());
    const [activeKeys, setActiveKeys] = useState(new Map());

    const stateRef = useRef({});
    stateRef.current = { isPlaying, playOffset, playStart, tempoScale };
    const scrubPlayedRef = useRef(new Set());

    const getCurrentTime = useCallback(() => {
        const { isPlaying, playOffset, playStart, tempoScale } = stateRef.current;
        const aCtx = getCtx();
        if (!isPlaying || !aCtx) return playOffset;
        return playOffset + (aCtx.currentTime - playStart) * tempoScale;
    }, [getCtx]);

    const hasPedal = useMemo(() => song.some(n => n.isPedal), [song]);
    useEffect(() => {
        setPedal(isPedalOn);
    }, [isPedalOn, setPedal]);

    useEffect(() => {
        if (fullPedal) { setIsPedalOn(true); return; }
        if (!hasPedal) { setIsPedalOn(false); return; }

        const interval = setInterval(() => {
            const t = getCurrentTime();
            let on = false;
            for (const n of song) {
                if (!n.isPedal) continue;
                if (n.startTime > t) break;
                on = n.vel >= 64;
            }
            setIsPedalOn(on);
        }, 50);

        return () => clearInterval(interval);
    }, [fullPedal, hasPedal, song, getCurrentTime]);

    const handlePlayPause = useCallback(() => {
        initAudio();
        const aCtx = getCtx();
        if (!aCtx) return;
        if (!isPlaying) {
            const last = song[song.length - 1];
            if (last && playOffset >= last.startTime + last.duration + 0.5) {
                setNoteObjs(song.map(n => ({ ...n, sliced: false })));
                setScheduled(new Set());
                setPlayOffset(0);
            }
            setPlayStart(aCtx.currentTime);
            setIsPlaying(true);
        } else {
            setPlayOffset(getCurrentTime());
            setScheduled(new Set());
            setIsPlaying(false);
        }
    }, [isPlaying, playOffset, song, initAudio, getCtx, getCurrentTime]);

    const handleRestart = useCallback(() => {
        setIsPlaying(false);
        setPlayOffset(0);
        setPlayStart(0);
        setScheduled(new Set());
        setActiveKeys(new Map());
        setNoteObjs(song.map(n => ({ ...n, sliced: false })));
    }, [song]);

    const handleSongEnd = useCallback(() => {
        setIsPlaying(false);
        setPlayOffset(0);
        setScheduled(new Set());
        setNoteObjs(song.map(n => ({ ...n, sliced: false })));
    }, [song]);

    const handleTempoChange = useCallback(val => {
        const aCtx = getCtx();
        if (isPlaying && aCtx) {
            setPlayOffset(getCurrentTime());
            setPlayStart(aCtx.currentTime);
            setScheduled(new Set());
        }
        setTempo(val);
        setTempoScale(val / 100);
    }, [isPlaying, getCtx, getCurrentTime]);

    const handleZoomChange = useCallback(val => {
        setZoom(val);
    }, []);

    const handleScrub = useCallback((newTime) => {
        const aCtx = getCtx();
        setPlayOffset(newTime);
        setScheduled(new Set());
        if (isPlaying && aCtx) setPlayStart(aCtx.currentTime);

        const newActive = new Map();

        song.forEach(n => {
            if (n.isPedal) return;
            if (n.note < MIN_NOTE || n.note > MAX_NOTE) return;
            const isHit = n.startTime <= newTime && n.startTime + n.duration >= newTime;
            if (!isHit) {
                // Note no longer under cursor — remove from played set so it can play again next time
                scrubPlayedRef.current.delete(n.startTime + '_' + n.note);
                return;
            }
            // Already played this note during this scrub pass — skip
            const key = n.startTime + '_' + n.note;
            if (scrubPlayedRef.current.has(key)) return;

            scrubPlayedRef.current.add(key);
            initAudio();
            playNote(n.note, n.vel * 0.6, Math.min(n.duration, 0.3));
            const ac = getCtx();
            if (ac) newActive.set(n.note, ac.currentTime + 0.35);
        });

        if (newActive.size > 0) setActiveKeys(newActive);
    }, [isPlaying, getCtx, song, initAudio, playNote, setActiveKeys]);

    const handleMidiLoad = useCallback(e => {
        const f = e.target.files[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = ev => {
            try {
                const notes = parseMidi(ev.target.result)
                    .filter(n => n.isPedal || (n.note >= MIN_NOTE && n.note <= MAX_NOTE));
                if (!notes.filter(n => !n.isPedal).length) {
                    alert('No notes found in playable range.');
                    return;
                }
                const title = f.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
                setSong(notes);
                setNoteObjs(notes.map(n => ({ ...n, sliced: false })));
                setSongTitle(title);
                setIsPlaying(false);
                setPlayOffset(0);
                setPlayStart(0);
                setScheduled(new Set());
                setActiveKeys(new Map());
            } catch (err) { alert('Could not parse MIDI: ' + err.message); }
        };
        reader.readAsArrayBuffer(f);
        e.target.value = '';
    }, []);

    return (
        <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#07070c' }}>
            <PianoCanvas
                noteObjs={noteObjs}
                setNoteObjs={setNoteObjs}
                isPlaying={isPlaying}
                playOffset={playOffset}
                playStart={playStart}
                tempoScale={tempoScale}
                scheduled={scheduled}
                setScheduled={setScheduled}
                activeKeys={activeKeys}
                setActiveKeys={setActiveKeys}
                scheduleNote={scheduleNote}
                playNote={playNote}
                getCtx={getCtx}
                onSongEnd={handleSongEnd}
                onScrub={handleScrub}
                zoom={zoom}
                isPedalOn={isPedalOn}
                hasPedal={hasPedal}
            />
            <TopBar
                isPlaying={isPlaying}
                onPlayPause={handlePlayPause}
                onRestart={handleRestart}
                onMidiLoad={handleMidiLoad}
                tempo={tempo}
                onTempoChange={handleTempoChange}
                zoom={zoom}
                onZoomChange={handleZoomChange}
                fullPedal={fullPedal}
                onToggleFullPedal={() => setFullPedal(f => !f)}
                songTitle={songTitle.toUpperCase()}
            />
            {!isPlaying && (
                <div style={{
                    position: 'fixed', top: '50%', left: '50%',
                    transform: 'translate(-50%,-50%)',
                    color: 'rgba(201,168,76,0.15)', fontSize: 12,
                    letterSpacing: 5, textTransform: 'uppercase',
                    pointerEvents: 'none',
                }}>
                    SCROLL UP · DOWN TO NAVIGATE
                </div>
            )}
        </div>
    );
}