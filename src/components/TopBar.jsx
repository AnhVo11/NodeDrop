import React from 'react';

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
  tempoWrap: { display: 'flex', alignItems: 'center', gap: 6 },
  lbl: {
    color: 'rgba(201,168,76,0.6)', fontSize: 11,
    letterSpacing: 1, minWidth: 34, textAlign: 'right',
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
    width: 44, height: 44, fontSize: 18,
    WebkitTapHighlightColor: 'transparent',
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
};

export default function TopBar({
  isPlaying, onPlayPause, onRestart, onMidiLoad,
  tempo, onTempoChange,
  zoom, onZoomChange,
  songTitle,
}) {
  return (
    <>
      <div style={styles.bar}>
        <div style={styles.brand}>NoteDrop</div>
        <div style={styles.controls}>

          {/* Tempo */}
          <div style={styles.tempoWrap}>
            <span style={styles.lbl}>{tempo}%</span>
            <input
              type="range" min="25" max="200" value={tempo}
              onChange={e => onTempoChange(parseInt(e.target.value))}
              style={{ width: 72, height: 2, accentColor: '#c9a84c' }}
            />
          </div>

          <div style={styles.divider} />

          {/* Zoom */}
          <div style={styles.tempoWrap}>
            <span style={styles.lbl}>🔍</span>
            <input
              type="range" min="100" max="400" value={zoom}
              onChange={e => onZoomChange(parseInt(e.target.value))}
              style={{ width: 72, height: 2, accentColor: '#c9a84c' }}
            />
          </div>

          <div style={styles.divider} />

          {/* Restart */}
          <button style={styles.btn} onClick={onRestart}>↺</button>

          {/* Play/Pause */}
          <button style={styles.btnLarge} onClick={onPlayPause}>
            {isPlaying ? '⏸' : '▶'}
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