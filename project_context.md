# NoteDrop — Project Context

## Overview
**NoteDrop** is a personal piano learning web app built with React.
Inspired by the iOS app "Piano 3D" (now removed from App Store).
Falling notes learning — no sheet music needed, learn by watching colored bars fall.

## Repo
- GitHub: `https://github.com/AnhVo11/NoteDrop`
- Local path: `/Users/anhvo/Desktop/notedrop`
- Run: `npm start` → opens at `http://localhost:3000`
- Test on iPad: `http://192.168.1.79:3000` (same WiFi)

## Tech Stack
- **React** (Create React App)
- **Tone.js** — Salamander Grand Piano real samples (loaded on first tap)
- **Web Audio API** — for scheduling
- **HTML5 Canvas** — all visuals drawn in game loop
- **Pure CSS-in-JS** — no CSS files except `index.css`
- **Web MIDI API** — sends MIDI to external devices (Chrome on Mac only, not iOS)

## File Structure
src/
├── App.jsx                  ← main state, song loading, handlers, MIDI output
├── index.js / index.css
├── components/
│   ├── PianoCanvas.jsx      ← canvas game loop, drawing, scrub/pinch gesture
│   ├── EditOverlay.jsx      ← all edit mode logic + toolbar UI
│   ├── CreateOverlay.jsx    ← create song mode overlay
│   ├── TopBar.jsx           ← top navigation bar + gear dropdown settings
│   ├── WatchZone.jsx        ← NoteReader screen capture component
│   └── PianoKeys.jsx        ← piano key math helpers (exported functions)
├── hooks/
│   ├── useAudio.js          ← Tone.js sampler, playNote, scheduleNote, setPedal
│   ├── useMidi.js           ← MIDI file parser (parseMidi function)
│   ├── useExportMidi.js     ← MIDI export (exportMidi function)
│   └── useEditHistory.js    ← undo/redo stack (pushUndo, undo, redo)

public/
└── midi/
    ├── chopin.mid           ← Chopin Nocturne E Flat Major (default)
    ├── river.mid            ← Yiruma - River Flows in You
    └── kiss.mid             ← Yiruma - Kiss the Rain

## Key Constants
- `MIN_NOTE = 21` (A0), `MAX_NOTE = 108` (C8) — full 88 keys
- `KEY_H = 130` — piano keyboard height at bottom
- `BAR_H = 56` — top bar height
- `PIXELS_PER_SECOND = 120` — scrub sensitivity

## Features Built

### Playback
- Falling notes (gold = right hand, red = left hand, colors customizable per hand)
- Real grand piano sound via Tone.js Salamander samples
- Play/Pause/Restart controls
- Speed slider (0.25x to 2.0x)
- Loop toggle
- View zoom slider (100–300%) — zooms note fall speed/lookahead
- Keys zoom slider (100–200%) — zooms piano key width
- Pinch gesture: horizontal = key zoom (min 100%), vertical = view zoom (min 100%, max 200%)
- Horizontal pan when keys zoomed in

### MIDI Output (Mac Chrome only)
- Web MIDI API sends notes to external MIDI devices
- Gear dropdown shows MIDI OUTPUT selector when devices connected
- Sustain pedal CC64 sent on channel 0 with 80ms debounce on pedal-off
- MIDI_OFFSET = -0.15s (sends notes early to compensate piano latency)
- Restart sends sustain-off + all-notes-off
- Tested with Yamaha PPC10R → MX90RW piano
- Does NOT work on iPad/iOS (Apple blocks Web MIDI in all browsers)

### Key Names
- Toggle in Gear dropdown: "Key Names ✓"
- Shows note names (A, A#, B, C...) on piano keys
- Shows note names on falling notes (when note tall/wide enough)
- White keys: black text, black keys: white text

### Navigation
- Vertical scroll on canvas = scrub through song timeline
- Red progress bar at top = draggable playhead
- Time display (current position)

### Sustain Pedal
- MIDI pedal events parsed and tracked
- Red dot indicator "SUSTAIN" shown when active
- Full Sustain button = override entire song with sustain
- MIDI CC64 sent to external piano

### Song Loading
- Gear dropdown: built-in songs, Load MIDI, Edit Song, Save MIDI
- Library button: Chopin, River Flows in You, Kiss the Rain
- Auto-detects single vs two-track MIDI (single = all gold, two = gold+red)

### Edit Mode
- Smart tool: tap empty = add, tap top/bottom = resize, tap middle = move
- Delete tool: swipe to delete with particle explosion
- Pedal tool: draw/edit sustain regions
- Undo/Redo (50 levels)

### Create Song Mode
- Start fresh with empty song
- WatchZone (NoteReader) button to capture from screen
- Save as MIDI with custom name

### NoteReader (WatchZone)
Two scan modes:

**Falling Notes mode:**
- Yellow scan zone, dashed trigger line
- Background color calibration (click empty area)
- Fill % or Point detection
- Tolerance slider (5–100, default 35) — how different pixel must be from BG
- Fill% threshold slider
- Smart filter (suppress adjacent false notes)
- Hollow notes mode (detect outline-style notes)
- Save/load named configs to localStorage

**Piano Keys mode:**
- Red scan line across piano
- Per-key equal-width column detection
- Auto Detect button: samples white/black key colors from scan line
- Manual white/black key color sampling
- Tolerance + Hit Ratio sliders
- Per-key baseline captured on record start
- Virtual piano overlay shows detected keys in green during recording

**Config Save/Load:**
- Named configs saved to localStorage key `watchZoneConfigs`
- Save button in calibrate panel (both modes)
- Load dropdown in setup panel
- Saves: zone, scanType, anchors, trims, colors, all thresholds

## Collaboration Style
- **Surgical edits preferred** — "find X, replace with Y" not full rewrites
- Always specify which file first (App.jsx, WatchZone.jsx, etc.)
- User pastes relevant file/error when asking for fixes
- Build: `npm start`
- User is Anh, works on Mac, tests on iPad (same WiFi)

## Known Issues / Next Ideas
- WatchZone baseline sometimes captures wrong colors if video not ready
- Debug console.log statements still in WatchZone (KEY ratios, ACTIVE keys, BASELINE SAMPLE)
- Web MIDI not available on iPad (Apple restriction)
- GitHub Pages hosting
- Note velocity editing
- More built-in songs