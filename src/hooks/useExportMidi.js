export function exportMidi(notes, title) {
    const bpm = 120;
    const ticksPerBeat = 480;
    const usPerBeat = Math.round(60000000 / bpm);

    function sec2tick(s) { return Math.round(s * ticksPerBeat * (bpm / 60)); }

    function writeVarLen(val) {
        if (val < 0x80) return [val];
        const out = [];
        out.unshift(val & 0x7f); val >>= 7;
        while (val > 0) { out.unshift((val & 0x7f) | 0x80); val >>= 7; }
        return out;
    }

    function buildTrack(events) {
        const bytes = [];
        let lastTick = 0;
        events.sort((a, b) => a.tick - b.tick);
        for (const ev of events) {
            const delta = ev.tick - lastTick;
            lastTick = ev.tick;
            bytes.push(...writeVarLen(delta), ...ev.data);
        }
        bytes.push(0x00, 0xff, 0x2f, 0x00); // end of track
        return bytes;
    }

    // Tempo track
    const tempoTrack = buildTrack([{
        tick: 0,
        data: [0xff, 0x51, 0x03,
            (usPerBeat >> 16) & 0xff,
            (usPerBeat >> 8) & 0xff,
            usPerBeat & 0xff]
    }]);

    // Notes by hand → 2 tracks
    const tracks = [[], []];
    notes.filter(n => !n.isPedal).forEach(n => {
        const ch = n.hand === 0 ? 0 : 1;
        const startTick = sec2tick(n.startTime);
        const endTick = sec2tick(n.startTime + n.duration);
        const vel = Math.round((n.vel ?? 0.7) * 127);
        tracks[n.hand].push({ tick: startTick, data: [0x90 | ch, n.note, vel] });
        tracks[n.hand].push({ tick: endTick, data: [0x80 | ch, n.note, 0] });
    });
    // Pedal events
    notes.filter(n => n.isPedal).forEach(n => {
        const tick = sec2tick(n.startTime);
        tracks[0].push({ tick, data: [0xb0, 64, n.vel] });
    });

    function writeUint32(v) { return [(v >> 24) & 0xff, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff]; }
    function writeUint16(v) { return [(v >> 8) & 0xff, v & 0xff]; }

    const allTracks = [tempoTrack, buildTrack(tracks[0]), buildTrack(tracks[1])];
    const bytes = [
        0x4d, 0x54, 0x68, 0x64, // MThd
        ...writeUint32(6),
        ...writeUint16(1), // format 1
        ...writeUint16(allTracks.length),
        ...writeUint16(ticksPerBeat),
    ];
    for (const t of allTracks) {
        bytes.push(0x4d, 0x54, 0x72, 0x6b); // MTrk
        bytes.push(...writeUint32(t.length));
        bytes.push(...t);
    }

    const blob = new Blob([new Uint8Array(bytes)], { type: 'audio/midi' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (title || 'notedrop-song') + '.mid';
    a.click();
    URL.revokeObjectURL(url);
}