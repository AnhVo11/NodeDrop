import { useRef } from 'react';

export function useAudio() {
  const aCtxRef = useRef(null);

  function initAudio() {
    if (!aCtxRef.current) {
      aCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (aCtxRef.current.state === 'suspended') aCtxRef.current.resume();
  }

  function playNote(midiNote, vel = 0.65, dur = 0.5) {
    const aCtx = aCtxRef.current;
    if (!aCtx) return;

    const freq = 440 * Math.pow(2, (midiNote - 69) / 12);
    const now  = aCtx.currentTime;
    const env  = aCtx.createGain();
    env.connect(aCtx.destination);
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(vel * 0.45, now + 0.003);
    env.gain.exponentialRampToValueAtTime(vel * 0.28, now + 0.12);
    env.gain.exponentialRampToValueAtTime(0.0001, now + Math.min(dur + 1.8, 5));

    [[1,1,'triangle'],[2,0.5,'sine'],[3,0.22,'sine'],[4,0.10,'sine'],[6,0.05,'sine']]
      .forEach(([h, a, t]) => {
        const osc = aCtx.createOscillator();
        const g   = aCtx.createGain();
        osc.type = t;
        osc.frequency.value = freq * h;
        g.gain.value = a;
        osc.connect(g);
        g.connect(env);
        osc.start(now);
        osc.stop(now + Math.min(dur + 2.5, 6));
      });
  }

  function scheduleNote(midiNote, vel, dur, fireAt) {
    const aCtx = aCtxRef.current;
    if (!aCtx) return;

    const freq = 440 * Math.pow(2, (midiNote - 69) / 12);
    const env  = aCtx.createGain();
    env.connect(aCtx.destination);
    env.gain.setValueAtTime(0, fireAt);
    env.gain.linearRampToValueAtTime(vel * 0.4, fireAt + 0.003);
    env.gain.exponentialRampToValueAtTime(vel * 0.25, fireAt + 0.12);
    env.gain.exponentialRampToValueAtTime(0.0001, fireAt + Math.min(dur + 1.8, 5));

    [[1,1,'triangle'],[2,0.5,'sine'],[3,0.22,'sine'],[4,0.10,'sine']]
      .forEach(([h, a, t]) => {
        const osc = aCtx.createOscillator();
        const g   = aCtx.createGain();
        osc.type = t;
        osc.frequency.value = freq * h;
        g.gain.value = a;
        osc.connect(g);
        g.connect(env);
        osc.start(fireAt);
        osc.stop(fireAt + Math.min(dur + 2.5, 6));
      });
  }

  function getCtx() { return aCtxRef.current; }

  return { initAudio, playNote, scheduleNote, getCtx };
}