import React, { useState, useRef, useEffect } from 'react';
import { SkipStart, Play, Pause, Infinity, Gear, Book, CloudArrowDown, Pencil, HandIndex, MusicNote, FileMusic } from 'react-bootstrap-icons';

const styles = {
    bar: {
        position: 'fixed', top: 0, left: 0, right: 0, height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px', zIndex: 20,
        background: 'linear-gradient(180deg, rgba(7,7,12,0.97) 0%, transparent 100%)',
    },
    brand: {
        color: '#c9a84c', fontSize: 15, letterSpacing: 5,
        textTransform: 'uppercase', opacity: 0.9,
    },
    controls: { display: 'flex', alignItems: 'center', gap: 10 },
    sliderWrap: { display: 'flex', alignItems: 'center', gap: 6 },
    lbl: { color: 'rgba(201,168,76,0.6)', fontSize: 11, letterSpacing: 1 },
    val: { color: 'rgba(201,168,76,0.9)', fontSize: 11, letterSpacing: 1, minWidth: 28 },
    btn: {
        background: 'transparent',
        border: '1px solid rgba(201,168,76,0.35)',
        color: '#c9a84c', borderRadius: '50%',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 36, height: 36, fontSize: 18,
        WebkitTapHighlightColor: 'transparent',
    },
    btnLarge: {
        background: 'transparent',
        border: '1.5px solid rgba(201,168,76,0.35)',
        color: '#c9a84c', borderRadius: '50%',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 44, height: 44, fontSize: 22,
        WebkitTapHighlightColor: 'transparent',
    },
    textBtn: {
        background: 'transparent',
        border: '1px solid rgba(201,168,76,0.35)',
        color: 'rgba(201,168,76,0.65)', padding: '0 10px', borderRadius: 4,
        cursor: 'pointer', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase',
        fontFamily: 'inherit', WebkitTapHighlightColor: 'transparent',
        height: 30, display: 'flex', alignItems: 'center', gap: 6,
    },
    divider: { width: 1, height: 20, background: 'rgba(201,168,76,0.2)', margin: '0 2px' },
    center: {
        position: 'fixed', left: '50%', top: '0px',
        height: '56px',
        transform: 'translateX(-50%)',
        display: 'flex', alignItems: 'center', gap: 10,
        zIndex: 21,
    },
    songTitle: {
        position: 'fixed', top: 76, left: 16,
        color: 'rgba(255,255,255,0.85)', fontSize: 13, letterSpacing: 3,
        textAlign: 'left', pointerEvents: 'none', whiteSpace: 'nowrap',
    },
    fileInput: { display: 'none' },
    // Gear dropdown
    gearWrap: { position: 'relative' },
    handWrap: { position: 'relative' },
    dropdown: {
        position: 'absolute', top: 44, right: 0,
        background: '#12121c', border: '1px solid rgba(201,168,76,0.25)',
        borderRadius: 8, padding: '6px 0', zIndex: 100, minWidth: 160,
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
    },
    dropItem: {
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 16px', cursor: 'pointer',
        color: 'rgba(201,168,76,0.8)', fontSize: 11,
        letterSpacing: 2, textTransform: 'uppercase',
        fontFamily: 'inherit', background: 'transparent',
        border: 'none', width: '100%', textAlign: 'left',
        WebkitTapHighlightColor: 'transparent',
    },
    dropDivider: { height: 1, background: 'rgba(201,168,76,0.1)', margin: '4px 0' },
};

const COLORS = [
    '#4a9eff', '#c9a84c', '#4aff91', '#ff4a4a',
    '#b44aff', '#ff4adb', '#ffffff', '#ff944a',
];

function HandColorButton({ rightColor, onRightColorChange, leftColor, onLeftColorChange, hiddenHands, onToggleHideHand }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('pointerdown', handler);
        return () => document.removeEventListener('pointerdown', handler);
    }, []);
    return (
        <div style={styles.handWrap} ref={ref}>
            <button style={styles.btn} onClick={() => setOpen(o => !o)} title="Hand Colors"><HandIndex /></button>
            {open && (
                <div style={{
                    position: 'absolute', top: 44, right: 0,
                    background: '#12121c', border: '1px solid rgba(201,168,76,0.25)',
                    borderRadius: 8, padding: '12px 14px', zIndex: 100,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.6)', minWidth: 140,
                    display: 'flex', flexDirection: 'row', gap: 16,
                }}>
                    <div>
                        <div style={{ color: 'rgba(201,168,76,0.6)', fontSize: 10, letterSpacing: 2, marginBottom: 6, whiteSpace: 'nowrap' }}>LEFT HAND</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, width: 74 }}>
                            {COLORS.map(c => (
                                <div key={c} onClick={() => { onLeftColorChange(c); if (hiddenHands[1]) onToggleHideHand(1); }} style={{
                                    width: 20, height: 20, borderRadius: '50%', cursor: 'pointer', background: c,
                                    border: leftColor === c ? '2px solid white' : '2px solid rgba(255,255,255,0.15)',
                                    transform: leftColor === c ? 'scale(1.2)' : 'scale(1)',
                                }} />
                            ))}
                            <div onClick={() => onToggleHideHand(1)} style={{
                                width: 20, height: 20, borderRadius: '50%', cursor: 'pointer',
                                background: hiddenHands[1] ? 'rgba(255,80,80,0.15)' : 'rgba(255,255,255,0.08)',
                                border: hiddenHands[1] ? '2px solid rgba(255,80,80,0.8)' : '2px solid rgba(255,255,255,0.25)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 15, color: hiddenHands[1] ? 'rgba(255,80,80,0.9)' : 'rgba(255,255,255,0.4)',
                                boxSizing: 'border-box', flexShrink: 0,
                            }}><div style={{ width: 16, height: 16, borderRadius: '50%', background: hiddenHands[1] ? 'rgba(255,80,80,0.9)' : 'rgba(0,0,0,0.85)', border: '1.5px solid rgba(255,255,255,0.2)' }} /></div>
                        </div>
                    </div>
                    <div style={{ width: 1, background: 'rgba(201,168,76,0.1)' }} />
                    <div>
                        <div style={{ color: 'rgba(201,168,76,0.6)', fontSize: 10, letterSpacing: 2, marginBottom: 6, whiteSpace: 'nowrap' }}>RIGHT HAND</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, width: 74 }}>
                            {COLORS.map(c => (
                                <div key={c} onClick={() => { onRightColorChange(c); if (hiddenHands[0]) onToggleHideHand(0); }} style={{
                                    width: 20, height: 20, borderRadius: '50%', cursor: 'pointer', background: c,
                                    border: rightColor === c ? '2px solid white' : '2px solid rgba(255,255,255,0.15)',
                                    transform: rightColor === c ? 'scale(1.2)' : 'scale(1)',
                                }} />
                            ))}
                            <div onClick={() => onToggleHideHand(0)} style={{
                                width: 20, height: 20, borderRadius: '50%', cursor: 'pointer',
                                background: hiddenHands[0] ? 'rgba(255,80,80,0.15)' : 'rgba(255,255,255,0.08)',
                                border: hiddenHands[0] ? '2px solid rgba(255,80,80,0.8)' : '2px solid rgba(255,255,255,0.25)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 15, color: hiddenHands[0] ? 'rgba(255,80,80,0.9)' : 'rgba(255,255,255,0.4)',
                                boxSizing: 'border-box', flexShrink: 0,
                            }}><div style={{ width: 16, height: 16, borderRadius: '50%', background: hiddenHands[0] ? 'rgba(255,80,80,0.9)' : 'rgba(0,0,0,0.85)', border: '1.5px solid rgba(255,255,255,0.2)' }} /></div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function TopBar({
    isPlaying, onPlayPause, onRestart, onMidiLoad, onLoadSong,
    tempo, onTempoChange, zoom, onZoomChange, keyZoom, onKeyZoomChange,
    fullPedal, onToggleFullPedal,
    rightColor, onRightColorChange,
    leftColor, onLeftColorChange,
    onEnterEdit, onCreateSong, onSave,
    songTitle, isCreateMode,
    loop, onToggleLoop,
    hiddenHands, onToggleHideHand,
    editMode,
}) {
    const [gearOpen, setGearOpen] = useState(false);
    const [libraryOpen, setLibraryOpen] = useState(false);
    const [speedActive, setSpeedActive] = useState(false);
    const gearRef = useRef(null);
    const libraryRef = useRef(null);
    const speedDisplay = (tempo / 100).toFixed(1);

    // Close gear when clicking outside
    useEffect(() => {
        const handler = (e) => {
            if (gearRef.current && !gearRef.current.contains(e.target)) {
                setGearOpen(false);
            }
        };
        document.addEventListener('pointerdown', handler);
        return () => document.removeEventListener('pointerdown', handler);
    }, []);

    useEffect(() => {
        const handler = (e) => {
            if (libraryRef.current && !libraryRef.current.contains(e.target)) setLibraryOpen(false);
        };
        document.addEventListener('pointerdown', handler);
        return () => document.removeEventListener('pointerdown', handler);
    }, []);

    return (
        <>
            <div style={styles.bar}>
                <div style={styles.brand}>NoteDrop</div>

                {/* Center — go to start + play/pause + loop */}
                <div style={styles.center}>
                    <button style={styles.btn} onClick={onRestart} title="Go to beginning"><SkipStart /></button>
                    <button style={styles.btnLarge} onClick={onPlayPause}>
                        {isPlaying ? <Pause /> : <Play />}
                    </button>
                    <button
                        style={{
                            ...styles.btn,
                            background: loop ? 'rgba(201,168,76,0.2)' : 'transparent',
                            border: loop ? '1px solid rgba(201,168,76,0.8)' : '1px solid rgba(201,168,76,0.35)',
                            color: loop ? '#c9a84c' : 'rgba(201,168,76,0.9)',
                        }}
                        onClick={onToggleLoop}
                        title="Loop"
                    ><Infinity /></button>
                </div>

                <div style={styles.controls}>

                    {/* Speed */}
                    <div style={styles.sliderWrap}>
                        <span style={styles.lbl}>SPEED</span>
                        <input type="range" min="25" max="200" value={tempo}
                            onChange={e => onTempoChange(parseInt(e.target.value))}
                            onPointerDown={() => setSpeedActive(true)}
                            onPointerUp={() => setSpeedActive(false)}
                            onTouchStart={() => setSpeedActive(true)}
                            onTouchEnd={() => setSpeedActive(false)}
                            style={{
                                width: speedActive ? 140 : 64,
                                height: 2, accentColor: '#c9a84c',
                                transition: 'width 0.3s ease',
                            }} />
                        <span style={styles.val}>{speedDisplay}x</span>
                    </div>

                    {/* Hand Colors */}
                    <HandColorButton
                        rightColor={rightColor} onRightColorChange={onRightColorChange}
                        leftColor={leftColor} onLeftColorChange={onLeftColorChange}
                        hiddenHands={hiddenHands} onToggleHideHand={onToggleHideHand}
                    />

                    <div style={styles.divider} />

                    {/* Create Song button */}
                    <button style={styles.btn} onClick={onCreateSong} title="Create Song">
                        <FileMusic />
                    </button>

                    {/* Library button */}
                    <div style={styles.gearWrap} ref={libraryRef}>
                        <button
                            style={{
                                ...styles.btn,
                                background: libraryOpen ? 'rgba(201,168,76,0.15)' : 'transparent',
                            }}
                            onClick={() => setLibraryOpen(o => !o)}
                        >
                            <Book />
                        </button>
                        {libraryOpen && (
                            <div style={styles.dropdown}>
                                <button style={styles.dropItem}
                                    onClick={() => { onLoadSong('chopin'); setLibraryOpen(false); }}>
                                    <MusicNote /> Chopin
                                </button>
                                <button style={styles.dropItem}
                                    onClick={() => { onLoadSong('river'); setLibraryOpen(false); }}>
                                    <MusicNote /> River Flows in You
                                </button>
                                <button style={styles.dropItem}
                                    onClick={() => { onLoadSong('kiss'); setLibraryOpen(false); }}>
                                    <MusicNote /> Kiss the Rain
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Gear button */}
                    <div style={styles.gearWrap} ref={gearRef}>
                        <button
                            style={{
                                ...styles.btn,
                                background: gearOpen ? 'rgba(201,168,76,0.15)' : 'transparent',
                            }}
                            onClick={() => setGearOpen(o => !o)}
                        >
                            <Gear />
                        </button>

                        {gearOpen && (
                            <div style={styles.dropdown}>
                                {/* View zoom */}
                                <div style={{ padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={styles.lbl}>VIEW</span>
                                            <span style={styles.val}>{zoom}%</span>
                                        </div>
                                        <input type="range" min="1" max="300" value={zoom}
                                            onChange={e => onZoomChange(parseInt(e.target.value))}
                                            style={{ width: '100%', height: 2, accentColor: '#c9a84c' }} />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={styles.lbl}>KEYS</span>
                                            <span style={styles.val}>{keyZoom}%</span>
                                        </div>
                                        <input type="range" min="100" max="200" value={keyZoom}
                                            onChange={e => onKeyZoomChange(parseInt(e.target.value))}
                                            style={{ width: '100%', height: 2, accentColor: '#c9a84c' }} />
                                    </div>
                                </div>
                                <div style={styles.dropDivider} />
                                {/* Load MIDI */}
                                <label style={styles.dropItem} htmlFor="midi-input">
                                    <CloudArrowDown /> Load MIDI
                                </label>
                                <input id="midi-input" type="file" accept=".mid,.midi"
                                    style={styles.fileInput}
                                    onChange={(e) => { onMidiLoad(e); setGearOpen(false); }} />

                                <div style={styles.dropDivider} />

                                {/* Edit Song */}
                                {!isCreateMode && (
                                    <button style={styles.dropItem}
                                        onClick={() => { onEnterEdit(); setGearOpen(false); }}>
                                        <Pencil /> Edit Song
                                    </button>
                                )}

                                {/* Save MIDI */}
                                <button style={styles.dropItem}
                                    onClick={() => { onSave(); setGearOpen(false); }}>
                                    <FileMusic /> Save MIDI
                                </button>

                                <div style={styles.dropDivider} />


                            </div>
                        )}
                    </div>

                </div>
            </div>
            {!editMode && <div style={styles.songTitle}>{songTitle}</div>}
        </>
    );
}