import React, { useState } from 'react';

const COLORS = [
  '#4a9eff', '#c9a84c', '#4aff91', '#ff4a4a',
  '#b44aff', '#ff4adb', '#ffffff', '#ff944a',
];

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
  lbl: {
    color: 'rgba(201,168,76,0.6)', fontSize: 11,
    letterSpacing: 1, textAlign: 'right',
  },
  val: {
    color: 'rgba(201,168,76,0.9)', fontSize: 11,
    letterSpacing: 1, minWidth: 28, textAlign: 'left',
  },
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
  loadBtn: {
    background: 'transparent',
    border: '1px solid rgba(201,168,76,0.35)',
    color: 'rgba(201,168,76,0.65)', padding: '7px 12px', borderRadius: 4,
    cursor: 'pointer', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase',
    fontFamily: 'inherit', WebkitTapHighlightColor: 'transparent',
  },
  fileInput: { display: 'none' },
  songTitle: {
    position: 'fixed', top: 60, left: '50%', transform: 'translateX(-50%)',
    color: 'rgba(201,168,76,0.35)', fontSize: 10, letterSpacing: 3,
    textAlign: 'center', pointerEvents: 'none', whiteSpace: 'nowrap',
  },
  divider: {
    width: 1, height: 20, background: 'rgba(201,168,76,0.2)', margin: '0 2px',
  },
  dropdown: {
    position: 'absolute', top: 44, left: 0,
    background: '#12121c', border: '1px solid rgba(201,168,76,0.3)',
    borderRadius: 8, padding: 10, zIndex: 100,
    display: 'flex', flexWrap: 'wrap', gap: 8, width: 140,
  },
  swatch: {
    width: 22, height: 22, borderRadius: '50%', cursor: 'pointer',
  },
};

function ColorButton({ label, value, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <button
        style={styles.textBtn}
        onClick={() => setOpen(o => !o)}
      >
        <div style={{
          width: 12, height: 12, borderRadius: '50%',
          background: value, flexShrink: 0,
        }} />
        {label}
      </button>
      {open && (
        <div style={styles.dropdown}>
          {COLORS.map(c => (
            <div
              key={c}
              style={{
                ...styles.swatch,
                background: c,
                border: value === c ? '2px solid white' : '2px solid rgba(255,255,255,0.15)',
                transform: value === c ? 'scale(1.2)' : 'scale(1)',
              }}
              onClick={() => { onChange(c); setOpen(false); }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function TopBar({
  isPlaying, onPlayPause, onRestart, onMidiLoad,
  tempo, onTempoChange,
  zoom, onZoomChange,
  fullPedal, onToggleFullPedal,
  rightColor, onRightColorChange,
  leftColor, onLeftColorChange,
  songTitle,
}) {
  const speedDisplay = (tempo / 100).toFixed(1);

  return (
    <>
      <div style={styles.bar}>
        <div style={styles.brand}>NoteDrop</div>
        <div style={styles.controls}>

          {/* Speed */}
          <div style={styles.sliderWrap}>
            <span style={styles.lbl}>SPEED</span>
            <input
              type="range" min="25" max="200" value={tempo}
              onChange={e => onTempoChange(parseInt(e.target.value))}
              style={{ width: 64, height: 2, accentColor: '#c9a84c' }}
            />
            <span style={styles.val}>{speedDisplay}x</span>
          </div>

          <div style={styles.divider} />

          {/* Zoom */}
          <div style={styles.sliderWrap}>
            <span style={styles.lbl}>ZOOM</span>
            <input
              type="range" min="100" max="400" value={zoom}
              onChange={e => onZoomChange(parseInt(e.target.value))}
              style={{ width: 64, height: 2, accentColor: '#c9a84c' }}
            />
            <span style={styles.val}>{zoom}%</span>
          </div>

          <div style={styles.divider} />

          {/* Right hand color */}
          <ColorButton label="RIGHT" value={rightColor} onChange={onRightColorChange} />

          {/* Left hand color */}
          <ColorButton label="LEFT" value={leftColor} onChange={onLeftColorChange} />

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

          {/* Load MIDI */}
          <label style={styles.loadBtn} htmlFor="midi-input">Load MIDI</label>
          <input
            id="midi-input" type="file" accept=".mid,.midi"
            style={styles.fileInput}
            onChange={onMidiLoad}
          />

        </div>
      </div>
      <div style={styles.songTitle}>{songTitle}</div>
    </>
  );
}