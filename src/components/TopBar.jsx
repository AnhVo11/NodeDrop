import React, { useState, useRef, useEffect } from 'react';

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
    width: 36, height: 36, fontSize: 14,
    WebkitTapHighlightColor: 'transparent',
  },
  btnLarge: {
    background: 'transparent',
    border: '1.5px solid rgba(201,168,76,0.35)',
    color: '#c9a84c', borderRadius: '50%',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 44, height: 44, fontSize: 16,
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
  songTitle: {
    position: 'fixed', top: 64, left: 16,
    color: 'rgba(255,255,255,0.85)', fontSize: 13, letterSpacing: 3,
    textAlign: 'left', pointerEvents: 'none', whiteSpace: 'nowrap',
  },
  fileInput: { display: 'none' },
  // Gear dropdown
  gearWrap: { position: 'relative' },
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
  '#4a9eff','#c9a84c','#4aff91','#ff4a4a',
  '#b44aff','#ff4adb','#ffffff','#ff944a',
];

function ColorButton({ label, value, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position:'relative' }}>
      <button style={styles.textBtn} onClick={() => setOpen(o => !o)}>
        <div style={{ width:12, height:12, borderRadius:'50%', background:value, flexShrink:0 }} />
        {label}
      </button>
      {open && (
        <div style={{
          position:'absolute', top:38, left:0,
          background:'#12121c', border:'1px solid rgba(201,168,76,0.3)',
          borderRadius:8, padding:10, zIndex:100,
          display:'flex', flexWrap:'wrap', gap:8, width:140,
        }}>
          {COLORS.map(c => (
            <div key={c} onClick={() => { onChange(c); setOpen(false); }} style={{
              width:22, height:22, borderRadius:'50%', cursor:'pointer',
              background:c,
              border: value===c ? '2px solid white' : '2px solid rgba(255,255,255,0.15)',
              transform: value===c ? 'scale(1.2)' : 'scale(1)',
            }} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function TopBar({
  isPlaying, onPlayPause, onRestart, onMidiLoad,
  tempo, onTempoChange, zoom, onZoomChange,
  fullPedal, onToggleFullPedal,
  rightColor, onRightColorChange,
  leftColor, onLeftColorChange,
  onEnterEdit,
  songTitle,
}) {
  const [gearOpen, setGearOpen] = useState(false);
  const gearRef = useRef(null);
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

  return (
    <>
      <div style={styles.bar}>
        <div style={styles.brand}>NoteDrop</div>
        <div style={styles.controls}>

          {/* Speed */}
          <div style={styles.sliderWrap}>
            <span style={styles.lbl}>SPEED</span>
            <input type="range" min="25" max="200" value={tempo}
              onChange={e => onTempoChange(parseInt(e.target.value))}
              style={{ width:64, height:2, accentColor:'#c9a84c' }} />
            <span style={styles.val}>{speedDisplay}x</span>
          </div>

          <div style={styles.divider} />

          {/* Zoom */}
          <div style={styles.sliderWrap}>
            <span style={styles.lbl}>ZOOM</span>
            <input type="range" min="100" max="400" value={zoom}
              onChange={e => onZoomChange(parseInt(e.target.value))}
              style={{ width:64, height:2, accentColor:'#c9a84c' }} />
            <span style={styles.val}>{zoom}%</span>
          </div>

          <div style={styles.divider} />

          {/* Colors */}
          <ColorButton label="RIGHT" value={rightColor} onChange={onRightColorChange} />
          <ColorButton label="LEFT"  value={leftColor}  onChange={onLeftColorChange}  />

          <div style={styles.divider} />

          {/* Full Sustain */}
          <button
            style={{
              ...styles.textBtn,
              background: fullPedal ? 'rgba(220,50,50,0.25)' : 'transparent',
              border: fullPedal ? '1px solid rgba(220,50,50,0.7)' : '1px solid rgba(201,168,76,0.35)',
              color: fullPedal ? '#ff6666' : 'rgba(201,168,76,0.5)',
            }}
            onClick={onToggleFullPedal}
          >
            FULL SUSTAIN
          </button>

          <div style={styles.divider} />

          {/* Restart */}
          <button style={styles.btn} onClick={onRestart}>↺</button>

          {/* Play/Pause */}
          <button style={styles.btnLarge} onClick={onPlayPause}>
            {isPlaying ? '■' : '▶'}
          </button>

          <div style={styles.divider} />

          {/* Gear button */}
          <div style={styles.gearWrap} ref={gearRef}>
            <button
              style={{
                ...styles.btn,
                background: gearOpen ? 'rgba(201,168,76,0.15)' : 'transparent',
              }}
              onClick={() => setGearOpen(o => !o)}
            >
              ⚙
            </button>

            {gearOpen && (
              <div style={styles.dropdown}>
                {/* Load MIDI */}
                <label style={styles.dropItem} htmlFor="midi-input">
                  <span>📂</span> Load MIDI
                </label>
                <input id="midi-input" type="file" accept=".mid,.midi"
                  style={styles.fileInput}
                  onChange={(e) => { onMidiLoad(e); setGearOpen(false); }} />

                <div style={styles.dropDivider} />

                {/* Edit Song */}
                <button style={styles.dropItem}
                  onClick={() => { onEnterEdit(); setGearOpen(false); }}>
                  <span>✏️</span> Edit Song
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
      <div style={styles.songTitle}>{songTitle}</div>
    </>
  );
}