# NoteDrop — Project Context

## Overview
**NoteDrop** is a personal piano learning web app built with React.
Inspired by the iOS app "Piano 3D" (now removed from App Store).
Falling notes learning — no sheet music needed, learn by watching colored bars fall.

## Repo
- GitHub: `https://github.com/AnhVo11/NoteDrop` (note: local folder is `notedrop` lowercase)
- Local path: `/Users/anhvo/Desktop/notedrop`
- Run: `npm start` → opens at `http://localhost:3000`
- Test on iPad: `http://192.168.1.192:3000` (same WiFi)

## Tech Stack
- **React** (Create React App)
- **Tone.js** — Salamander Grand Piano real samples (loaded on first tap)
- **Web Audio API** — for scheduling
- **HTML5 Canvas** — all visuals drawn in game loop
- **Pure CSS-in-JS** — no CSS files except `index.css`

## File Structure
```
src/
├── App.jsx                  ← main state, song loading, handlers
├── index.js / index.css
├── components/
│   ├── PianoCanvas.jsx      ← canvas game loop, drawing, scrub gesture
│   ├── EditOverlay.jsx      ← all edit mode logic + toolbar UI
│   ├── TopBar.jsx           ← top navigation bar
│   └── PianoKeys.jsx        ← piano key math helpers (exported functions)
├── hooks/
│   ├── useAudio.js          ← Tone.js sampler, playNote, scheduleNote, setPedal
│   ├── useMidi.js           ← MIDI file parser (parseMidi function)
│   └── useEditHistory.js    ← undo/redo stack (pushUndo, undo, redo)
└── data/
    └── furElise.js          ← built-in demo song (not used currently)

public/
└── midi/
    ├── chopin.mid           ← Chopin Nocturne E Flat Major (default)
    ├── river.mid            ← Yiruma - River Flows in You
    └── kiss.mid             ← Yiruma - Kiss the Rain
```

## Key Constants
- `MIN_NOTE = 21` (A0), `MAX_NOTE = 108` (C8) — full 88 keys
- `KEY_H = 130` — piano keyboard height at bottom
- `BAR_H = 56` — top bar height
- `LOOK_AHEAD_VIS = 4.5` — seconds of notes visible ahead
- `PIXELS_PER_SECOND = 120` — scrub sensitivity

## Features Built
### Playback
- Falling notes (blue = right hand, gold = left hand, colors customizable)
- Real grand piano sound via Tone.js Salamander samples
- Play/Pause/Restart controls
- Speed slider (0.25x to 2.0x)
- Zoom slider (100% to 400%) — zooms piano width

### Navigation
- **Vertical scroll** on canvas = scrub through song timeline
- **Red progress bar** at bottom above keys = YouTube-style playhead, draggable
- Time display (current / total)

### Sustain Pedal
- MIDI pedal events parsed and tracked
- Red dot indicator "SUSTAIN" shown when pedal is active
- **Full Sustain** button = override entire song with sustain
- Sustain affects audio via Tone.js triggerAttack (notes ring, no hard cut on release)

### Song Loading
- Gear ⚙ button dropdown contains:
  - Built-in songs (Chopin, River Flows in You, Kiss the Rain)
  - Load MIDI file from device
  - Edit Song mode

### Piano Keys
- Full 88 keys rendered on canvas (not SVG anymore)
- Keys highlight with note color when active
- Keys light up during scrub too

### Edit Mode
Entered via Gear → Edit Song. Song auto-pauses.
Toolbar appears at top (below nav bar), height: 64px.

**Smart tool (default — no button selected):**
- Tap empty space → ADD note (drag up/down to set length)
- Tap top of note → RESIZE from top (drag up = extend earlier)
- Tap bottom of note → RESIZE from bottom (drag down = extend later)
- Tap middle of note (•••) → MOVE note (up/down = time, left/right = pitch)

**Tool buttons (toggleable — click again to deselect):**
- **- DELETE** — swipe across notes to delete with particle explosion
- **🎹 PEDAL** — draw/edit sustain pedal regions on timeline:
  - Drag up/down = draw new red pedal region
  - Grab short red line inside top of region = resize top edge
  - Grab short red line inside bottom of region = resize bottom edge
  - Grab circle in middle = move whole region
  - Tap region (no drag) = delete it
  - Regions only visible when PEDAL tool is active

**Undo ↩ / Redo ↪** — up to 50 levels

**Visual indicators on notes in edit mode:**
- White bar at top = resize handle
- White bar at bottom = resize handle
- Three dots ••• in middle = drag to move

## Note Data Structure
```js
{
  note: 60,          // MIDI note number
  startTime: 1.5,    // seconds from song start
  duration: 0.4,     // seconds
  vel: 0.7,          // velocity 0-1
  hand: 0,           // 0 = right, 1 = left
  isPedal: false,    // true for pedal events
  sustain: false,    // legacy, no longer used
}
// Pedal events:
{ isPedal: true, startTime: 1.0, duration: 0, vel: 127, note: -1, hand: 0 } // pedal ON
{ isPedal: true, startTime: 3.0, duration: 0, vel: 0,   note: -1, hand: 0 } // pedal OFF
```

## Collaboration Style
- **Surgical edits preferred** — "find X, replace with Y" not full rewrites
- Only give full file rewrite when many things change at once
- User pastes relevant file/error when asking for fixes
- Build command: `npm start`
- User is Anh, works on Mac, tests on iPad (same WiFi)

## Known Issues / Next Ideas
- Export edited song as MIDI file
- More built-in songs
- Song name editor
- GitHub Pages hosting so friends can access via URL
- Note velocity editing