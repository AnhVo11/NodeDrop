import { useRef, useEffect } from 'react';
import * as Tone from 'tone';

export function useAudio() {
  const samplerRef  = useRef(null);
  const loadedRef   = useRef(false);
  const pedalOnRef  = useRef(false);
  const heldNotes   = useRef(new Set());

  useEffect(() => {
    const initSampler = () => {
      if (samplerRef.current) return;
      samplerRef.current = new Tone.Sampler({
        urls: {
          A0: 'A0.mp3',    C1: 'C1.mp3',
          'D#1': 'Ds1.mp3', 'F#1': 'Fs1.mp3',
          A1: 'A1.mp3',    C2: 'C2.mp3',
          'D#2': 'Ds2.mp3', 'F#2': 'Fs2.mp3',
          A2: 'A2.mp3',    C3: 'C3.mp3',
          'D#3': 'Ds3.mp3', 'F#3': 'Fs3.mp3',
          A3: 'A3.mp3',    C4: 'C4.mp3',
          'D#4': 'Ds4.mp3', 'F#4': 'Fs4.mp3',
          A4: 'A4.mp3',    C5: 'C5.mp3',
          'D#5': 'Ds5.mp3', 'F#5': 'Fs5.mp3',
          A5: 'A5.mp3',    C6: 'C6.mp3',
          'D#6': 'Ds6.mp3', 'F#6': 'Fs6.mp3',
          A6: 'A6.mp3',    C7: 'C7.mp3',
          'D#7': 'Ds7.mp3', 'F#7': 'Fs7.mp3',
          A7: 'A7.mp3',    C8: 'C8.mp3',
        },
        baseUrl: 'https://tonejs.github.io/audio/salamander/',
        onload: () => { loadedRef.current = true; },
      }).toDestination();
    };

    window.addEventListener('pointerdown', initSampler, { once: true });
    window.addEventListener('keydown',     initSampler, { once: true });

    return () => {
      window.removeEventListener('pointerdown', initSampler);
      window.removeEventListener('keydown',     initSampler);
      samplerRef.current?.dispose();
    };
  }, []);

  function initAudio() {
    Tone.start();
  }

  function midiToNote(midi) {
    const notes = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    const octave = Math.floor(midi / 12) - 1;
    return notes[midi % 12] + octave;
  }

  // Call this from App when pedal state changes
  function setPedal(on) {
    pedalOnRef.current = on;
    if (!on && samplerRef.current) {
      // Release all held notes when pedal lifts
      heldNotes.current.forEach(note => {
        try { samplerRef.current.triggerRelease(midiToNote(note), Tone.now()); } catch(e) {}
      });
      heldNotes.current.clear();
    }
  }

  function playNote(midiNote, vel = 0.65, dur = 0.5) {
    if (!loadedRef.current || !samplerRef.current) return;
    Tone.start();
    const note = midiToNote(midiNote);

    if (pedalOnRef.current) {
      // With pedal: trigger attack only, let note ring
      samplerRef.current.triggerAttack(note, Tone.now(), vel);
      heldNotes.current.add(midiNote);
    } else {
      samplerRef.current.triggerAttackRelease(note, Math.max(dur, 0.1), Tone.now(), vel);
    }
  }

  function scheduleNote(midiNote, vel, dur, fireAt) {
    if (!loadedRef.current || !samplerRef.current) return;
    const note    = midiToNote(midiNote);
    const now     = Tone.getContext().currentTime;
    const delay   = Math.max(0, fireAt - now);
    const toneNow = Tone.now();

    if (pedalOnRef.current) {
      samplerRef.current.triggerAttack(note, toneNow + delay, vel);
      heldNotes.current.add(midiNote);
    } else {
      samplerRef.current.triggerAttackRelease(
        note, Math.max(dur, 0.1), toneNow + delay, vel
      );
    }
  }

  function getCtx() {
    return Tone.getContext().rawContext;
  }

  return { initAudio, playNote, scheduleNote, getCtx, setPedal };
}