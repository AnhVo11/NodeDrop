export function buildChopinNocturne() {
  const EN = 0.278;
  const QN = 0.556;
  const TN = EN / 3; // triplet feel

  const notes = [];

  function n(t, pitch, dur, hand = 0, vel = 0.7) {
    notes.push({ note: pitch, startTime: t, duration: dur * 0.9, vel, hand });
  }

  function chord(t, pitches, dur, hand = 1, vel = 0.4) {
    pitches.forEach(p => n(t, p, dur, hand, vel));
  }

  // --- LEFT HAND (arpeggiated accompaniment) ---
  function arp(t, root) {
    n(t + 0*EN, root, EN, 1, 0.4);
    n(t + 1*EN, root+7, EN, 1, 0.4);
    n(t + 2*EN, root+12, EN, 1, 0.4);
    n(t + 3*EN, root+7, EN, 1, 0.4);
  }

  // --- A SECTION (main melody) ---
  let t = 0;

  for (let i = 0; i < 2; i++) {
    let o = t;

    // LH pattern
    arp(o, 51); // Eb
    arp(o + 4*EN, 48); // C
    arp(o + 8*EN, 50); // D
    arp(o + 12*EN, 51); // Eb

    // RH melody (simplified, expressive)
    n(o + 0*EN, 75, QN, 0, 0.8); // Eb
    n(o + 2*EN, 77, EN, 0, 0.75);
    n(o + 3*EN, 79, EN, 0, 0.75);

    // triplet ornament
    n(o + 4*EN, 79, TN, 0, 0.7);
    n(o + 4*EN + TN, 77, TN, 0, 0.7);
    n(o + 4*EN + 2*TN, 75, TN, 0, 0.7);

    n(o + 6*EN, 74, QN, 0, 0.8);
    n(o + 8*EN, 75, QN, 0, 0.8);

    t += 16 * EN;
  }

  // --- B SECTION (slight variation) ---
  let B = t;

  arp(B, 53); // F
  arp(B + 4*EN, 51); // Eb
  arp(B + 8*EN, 48); // C
  arp(B + 12*EN, 50); // D

  n(B + 0*EN, 77, QN, 0, 0.8);
  n(B + 2*EN, 79, EN, 0, 0.75);
  n(B + 3*EN, 80, EN, 0, 0.75);

  // expressive descent
  n(B + 4*EN, 79, EN, 0, 0.7);
  n(B + 5*EN, 77, EN, 0, 0.7);
  n(B + 6*EN, 75, QN, 0, 0.8);

  // cadence
  chord(B + 8*EN, [51, 55, 58], QN + EN, 1, 0.5);
  n(B + 8*EN, 75, QN + EN, 0, 0.85);

  return notes.sort((a, b) => a.startTime - b.startTime);
}