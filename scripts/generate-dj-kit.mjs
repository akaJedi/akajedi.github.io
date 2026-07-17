import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rate = 44100;
const output = join(dirname(dirname(fileURLToPath(import.meta.url))), "static", "audio", "dj-pads");
mkdirSync(output, { recursive: true });
const decay = (t, speed) => Math.exp(-t * speed);
const smooth = (x) => x * x * (3 - 2 * x);
const noiseGenerator = (initial) => {
  let seed = initial >>> 0;
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return (seed / 0xffffffff) * 2 - 1;
  };
};
const writeWav = (name, duration, render, seed) => {
  const length = Math.ceil(duration * rate);
  const samples = new Float32Array(length);
  const noise = noiseGenerator(seed);
  let peak = 0;
  for (let i = 0; i < length; i += 1) {
    samples[i] = Math.max(-1, Math.min(1, render(i / rate, i, noise)));
    peak = Math.max(peak, Math.abs(samples[i]));
  }
  const scale = peak ? 0.9 / peak : 1;
  const wav = Buffer.alloc(44 + length * 2);
  wav.write("RIFF", 0); wav.writeUInt32LE(36 + length * 2, 4); wav.write("WAVE", 8);
  wav.write("fmt ", 12); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22); wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write("data", 36);
  wav.writeUInt32LE(length * 2, 40);
  samples.forEach((sample, i) => wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sample * scale)) * 32767), 44 + i * 2));
  writeFileSync(join(output, name), wav);
};
const sounds = [
  ["01-kick.wav", .58, (t, _i, n) => Math.sin(2 * Math.PI * (42 + 145 * Math.exp(-t * 22)) * t) * decay(t, 7.2) + n() * decay(t, 85) * .18],
  ["02-snare.wav", .48, (t, _i, n) => n() * decay(t, 10) * .8 + Math.sin(2 * Math.PI * 185 * t) * decay(t, 17) * .35],
  ["03-closed-hat.wav", .13, (t, _i, n) => n() * Math.sin(2 * Math.PI * 7100 * t) * decay(t, 32)],
  ["04-open-hat.wav", .68, (t, _i, n) => n() * Math.sin(2 * Math.PI * 6300 * t) * decay(t, 5.5)],
  ["05-clap.wav", .44, (t, _i, n) => {
    const burst = [0, .027, .054].reduce((sum, offset) => sum + (t >= offset ? decay(t - offset, 70) : 0), 0);
    return n() * (burst * .55 + (t > .07 ? decay(t - .07, 12) * .45 : 0));
  }],
  ["06-bass-drop.wav", 1.05, (t) => Math.tanh(Math.sin(2 * Math.PI * (38 + 155 * Math.exp(-t * 3.2)) * t) * 2.1) * decay(t, 1.8)],
  ["07-laser.wav", .52, (t) => Math.sin(2 * Math.PI * (120 + 1550 * Math.exp(-t * 7.5)) * t) * decay(t, 4.3)],
  ["08-riser.wav", 1.2, (t, _i, n) => {
    const p = t / 1.2;
    return (Math.sin(2 * Math.PI * (160 + 1900 * smooth(p)) * t) * .48 + n() * .42) * Math.sin(Math.PI * p) ** .7;
  }],
  ["09-vinyl-scratch.wav", .62, (t, _i, n) => {
    const tone = Math.sin(2 * Math.PI * (420 + 680 * Math.sin(t * Math.PI * 7)) * t);
    return (tone * .62 + n() * .38) * decay(t, 2.2) * Math.sign(Math.sin(t * Math.PI * 14) || 1);
  }],
  ["10-rewind.wav", .86, (t, _i, n) => {
    const p = t / .86;
    return (Math.sin(2 * Math.PI * (230 + 2700 * p * p) * t) * .62 + n() * .28) * Math.sin(Math.PI * p);
  }],
  ["11-horn.wav", .92, (t) => {
    const e = Math.min(1, t / .025) * decay(Math.max(0, t - .1), 2.8);
    const v = 1 + Math.sin(2 * Math.PI * 5.4 * t) * .012;
    return (Math.sin(2 * Math.PI * 220 * v * t) + Math.sin(2 * Math.PI * 277 * v * t) * .62 + Math.sin(2 * Math.PI * 330 * v * t) * .42) * e * .48;
  }],
  ["12-glitch.wav", .58, (t, _i, n) => {
    const step = Math.floor(t * 32);
    const frequency = 120 + ((step * 173) % 1600);
    return (Math.sign(Math.sin(2 * Math.PI * frequency * t)) * .66 + n() * .3) * (step % 3 === 1 ? 0 : 1) * decay(t, 1.4);
  }],
];
sounds.forEach(([name, duration, render], index) => writeWav(name, duration, render, 0x1a2b3c4d + index * 7919));
console.log(`Generated ${sounds.length} original DJ samples in ${output}`);
