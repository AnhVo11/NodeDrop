export function buildFurElise() {
  const EN = 0.278, QN = 0.556;
  const notes = [];

  function n(t, pitch, dur, hand = 0, vel = 0.7) {
    notes.push({ note: pitch, startTime: t, duration: dur * 0.88, vel, hand });
  }
  function chord(t, pitches, dur, hand = 1, vel = 0.45) {
    pitches.forEach(p => n(t, p, dur, hand, vel));
  }

  for (let rep = 0; rep < 2; rep++) {
    const o = rep === 0 ? 0 : 24 * EN;
    n(o+ 0*EN, 76, EN); n(o+ 1*EN, 75, EN); n(o+ 2*EN, 76, EN); n(o+ 3*EN, 75, EN);
    n(o+ 4*EN, 76, EN); n(o+ 5*EN, 71, EN); n(o+ 6*EN, 74, EN); n(o+ 7*EN, 72, EN);
    n(o+ 8*EN, 69, QN+EN, 0, 0.75); chord(o+8*EN, [45,52,57], QN);
    n(o+11*EN, 60, EN); n(o+12*EN, 64, EN); n(o+13*EN, 69, EN);
    n(o+14*EN, 71, QN+EN, 0, 0.75); chord(o+14*EN, [40,47,52], QN);
    n(o+17*EN, 64, EN); n(o+18*EN, 68, EN); n(o+19*EN, 71, EN);
    n(o+20*EN, 72, QN+EN, 0, 0.75); chord(o+20*EN, [45,52,57], QN);
    n(o+23*EN, 64, EN);
  }

  const end = 48*EN;
  n(end+0*EN, 69, QN+EN, 0, 0.75); chord(end, [45,52,57], QN);
  n(end+3*EN, 60, EN); n(end+4*EN, 64, EN); n(end+5*EN, 69, EN);
  n(end+6*EN, 71, QN+EN, 0, 0.75); chord(end+6*EN, [40,47,52], QN);
  n(end+9*EN, 64, EN); n(end+10*EN, 68, EN); n(end+11*EN, 71, EN);

  const B = end + 12*EN;
  n(B+0*EN, 74, EN); n(B+1*EN, 72, EN); n(B+2*EN, 71, EN); n(B+3*EN, 67, EN);
  chord(B+3*EN, [43,47,50,55], QN);
  n(B+4*EN, 64, EN); n(B+5*EN, 69, EN); n(B+6*EN, 71, EN); n(B+7*EN, 72, EN);
  chord(B+7*EN, [45,52,57], QN);
  n(B+8*EN, 71, EN); n(B+9*EN, 69, EN); n(B+10*EN, 67, EN); n(B+11*EN, 65, EN);
  chord(B+11*EN, [41,48,53], QN);
  n(B+12*EN, 64, EN+QN, 0, 0.8); chord(B+12*EN, [40,47,52], QN+EN);

  const C = B + 14*EN;
  n(C+0*EN, 76, EN); n(C+1*EN, 75, EN); n(C+2*EN, 76, EN); n(C+3*EN, 75, EN);
  n(C+4*EN, 76, EN); n(C+5*EN, 71, EN); n(C+6*EN, 74, EN); n(C+7*EN, 72, EN);
  n(C+8*EN, 69, QN+EN, 0, 0.75); chord(C+8*EN, [45,52,57], QN);
  n(C+11*EN, 60, EN); n(C+12*EN, 64, EN); n(C+13*EN, 69, EN);
  n(C+14*EN, 71, QN+EN, 0, 0.75); chord(C+14*EN, [40,47,52], QN);
  n(C+17*EN, 64, EN); n(C+18*EN, 72, EN); n(C+19*EN, 71, EN);
  n(C+20*EN, 69, QN+EN*2, 0, 0.8); chord(C+20*EN, [45,52,57], QN+EN*2);

  return notes.sort((a, b) => a.startTime - b.startTime);
}