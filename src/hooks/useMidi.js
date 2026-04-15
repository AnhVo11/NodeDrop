export function parseMidi(buffer) {
    const d = new Uint8Array(buffer);
    let p = 0;

    const ru32 = () => { const v = (d[p] << 24) | (d[p + 1] << 16) | (d[p + 2] << 8) | d[p + 3]; p += 4; return v >>> 0; };
    const ru16 = () => { const v = (d[p] << 8) | d[p + 1]; p += 2; return v; };
    const rvar = () => { let v = 0, b; do { b = d[p++]; v = (v << 7) | (b & 0x7f); } while (b & 0x80); return v; };

    p = 4; ru32();
    ru16(); // format (unused)
    const ntrk = ru16();
    const div = ru16();

    const tempoMap = [{ tick: 0, us: 500000 }];
    const rawNotes = [];

   let noteTrackCount = 0;
  for (let t = 0; t < ntrk; t++) {
    p += 4;
    const tlen = ru32();
    const tend = p + tlen;
    let tick = 0, last = 0;
    const open = {};

    // Peek ahead to see if this track has any note-on events
    let hasNotes = false;
    let pp = p;
    while (pp < tend) {
      let v = 0, b;
      do { b = d[pp++]; v = (v << 7) | (b & 0x7f); } while (b & 0x80);
      let sb = d[pp];
      if (sb & 0x80) { sb = d[pp++]; } else pp++;
      const type = sb & 0xf0;
      if (type === 0x90) { hasNotes = true; break; }
      if (type === 0x80 || type === 0xa0 || type === 0xe0 || type === 0xb0) pp += 2;
      else if (type === 0xc0 || type === 0xd0) pp += 1;
      else if (sb === 0xff) { pp++; let ml = 0, bx; do { bx = d[pp++]; ml = (ml << 7) | (bx & 0x7f); } while (bx & 0x80); pp += ml; }
      else if (sb === 0xf0 || sb === 0xf7) { let ml = 0, bx; do { bx = d[pp++]; ml = (ml << 7) | (bx & 0x7f); } while (bx & 0x80); pp += ml; }
    }
    const trackHand = hasNotes ? noteTrackCount : 0;
    if (hasNotes) noteTrackCount++;

        while (p < tend) {
            tick += rvar();
            let sb = d[p];
            if (sb & 0x80) { last = sb; p++; } else { sb = last; }
            const type = sb & 0xf0;

            if (type === 0x90) {
                const note = d[p++], vel = d[p++];
                if (vel > 0) { open[note] = { tick, vel, hand: trackHand }; }
                else if (open[note]) { rawNotes.push({ ...open[note], endTick: tick, note }); delete open[note]; }
            } else if (type === 0x80) {
                const note = d[p++]; p++;
                if (open[note]) { rawNotes.push({ ...open[note], endTick: tick, note }); delete open[note]; }
            } else if (type === 0xb0) {
                // Control change — capture sustain pedal (CC 64)
                const cc = d[p++], val = d[p++];
                if (cc === 64) {
                    rawNotes.push({ tick, vel: val, endTick: tick, hand: 0, isPedal: true });
                }
            } else if (type === 0xa0 || type === 0xe0) { p += 2; }
            else if (type === 0xc0 || type === 0xd0) { p += 1; }
            else if (sb === 0xff) {
                const mt = d[p++], ml = rvar();
                if (mt === 0x51 && ml === 3) tempoMap.push({ tick, us: (d[p] << 16) | (d[p + 1] << 8) | d[p + 2] });
                p += ml;
            } else if (sb === 0xf0 || sb === 0xf7) { p += rvar(); }
            else p++;
        }
        p = tend;
    }

    tempoMap.sort((a, b) => a.tick - b.tick);

    function tick2sec(tk) {
        let sec = 0, lt = 0, lu = 500000;
        for (const e of tempoMap) {
            if (e.tick >= tk) break;
            sec += ((Math.min(e.tick, tk) - lt) / div) * (lu / 1e6);
            lt = e.tick; lu = e.us;
        }
        return sec + ((tk - lt) / div) * (lu / 1e6);
    }

    return rawNotes.map(n => {
        if (n.isPedal) return {
            note: -1,
            isPedal: true,
            startTime: tick2sec(n.tick),
            duration: 0,
            vel: n.vel,
            hand: 0,
        };
        return {
            note: n.note,
            startTime: tick2sec(n.tick),
            duration: tick2sec(n.endTick) - tick2sec(n.tick),
            vel: n.vel / 127,
            hand: n.hand,
        };
    }).sort((a, b) => a.startTime - b.startTime);
}