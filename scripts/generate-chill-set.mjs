import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rate = 44100;
const duration = 8;
const output = join(dirname(dirname(fileURLToPath(import.meta.url))), "static", "audio", "chill");
mkdirSync(output, { recursive: true });

const moods = [
  [68, 48, [0, 5, 3, 4], [0, 2, 4, 7, 9]],
  [72, 50, [0, 3, 5, 4], [0, 3, 5, 7, 10]],
  [74, 45, [0, 4, 5, 3], [0, 2, 4, 7, 11]],
  [76, 52, [0, 5, 4, 3], [0, 3, 5, 7, 10]],
  [78, 47, [0, 3, 4, 5], [0, 2, 5, 7, 9]],
  [80, 49, [0, 4, 3, 5], [0, 3, 5, 7, 10]],
  [82, 53, [0, 5, 2, 4], [0, 2, 4, 7, 9]],
  [84, 46, [0, 3, 5, 2], [0, 3, 5, 7, 10]],
  [86, 51, [0, 4, 2, 5], [0, 2, 4, 7, 9]],
  [88, 43, [0, 5, 3, 4], [0, 3, 5, 7, 10]],
  [90, 55, [0, 3, 4, 2], [0, 2, 5, 7, 9]],
  [92, 48, [0, 4, 5, 3], [0, 3, 5, 7, 10]],
];

const frequency = (midi) => 440 * 2 ** ((midi - 69) / 12);
const envelope = (phase, attack = 0.08, release = 0.35) =>
  Math.min(1, phase / attack) * Math.min(1, (1 - phase) / release);

const renderMelody = ([bpm, root, progression, scale], setIndex) => {
  const samples = new Float32Array(rate * duration);
  const beat = 60 / bpm;
  let seed = 0x5f3759df + setIndex * 7919;
  const noise = () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return (seed / 0xffffffff) * 2 - 1;
  };
  let peak = 0;

  for (let index = 0; index < samples.length; index += 1) {
    const time = index / rate;
    const barLength = beat * 4;
    const bar = Math.floor(time / barLength);
    const barPhase = (time % barLength) / barLength;
    const degree = progression[bar % progression.length];
    const chordRoot = root + scale[degree % scale.length];
    const chordEnvelope = Math.min(1, barPhase / 0.08, (1 - barPhase) / 0.12);
    const chord = [0, 3 + (setIndex % 2), 7, 12]
      .reduce((sum, interval, voice) => {
        const hz = frequency(chordRoot + interval);
        return sum + Math.sin(2 * Math.PI * hz * time + voice * 0.7) / (voice + 1.7);
      }, 0) * chordEnvelope * 0.22;

    const stepLength = beat / 2;
    const step = Math.floor(time / stepLength);
    const stepPhase = (time % stepLength) / stepLength;
    const melodyMidi = root + 12 + scale[(step * 3 + setIndex * 2 + bar) % scale.length];
    const melodyHz = frequency(melodyMidi);
    const pluck = (Math.sin(2 * Math.PI * melodyHz * time) +
      Math.sin(2 * Math.PI * melodyHz * 2 * time) * 0.18) *
      envelope(stepPhase, 0.04, 0.58) * 0.16;

    const bassHz = frequency(chordRoot - 12);
    const bass = Math.sin(2 * Math.PI * bassHz * time) * chordEnvelope * 0.2;
    const pulsePhase = (time % beat) / beat;
    const softPulse = Math.sin(2 * Math.PI * 62 * time) * Math.exp(-pulsePhase * 8) * 0.055;
    const texture = noise() * 0.006 * (0.4 + 0.6 * Math.sin(Math.PI * barPhase));
    samples[index] = chord + pluck + bass + softPulse + texture;
    peak = Math.max(peak, Math.abs(samples[index]));
  }

  const wav = Buffer.alloc(44 + samples.length * 2);
  wav.write("RIFF", 0); wav.writeUInt32LE(36 + samples.length * 2, 4); wav.write("WAVE", 8);
  wav.write("fmt ", 12); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22); wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write("data", 36);
  wav.writeUInt32LE(samples.length * 2, 40);
  const gain = 0.86 / peak;
  samples.forEach((sample, index) => wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sample * gain)) * 32767), 44 + index * 2));
  return wav;
};

moods.forEach((mood, index) => {
  const number = String(index + 1).padStart(2, "0");
  writeFileSync(join(output, `chill-${number}.wav`), renderMelody(mood, index));
});
console.log(`Generated ${moods.length} original chill-out melodies in ${output}`);
