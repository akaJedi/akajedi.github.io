(() => {
  const carousels = document.querySelectorAll("[data-signal-carousel]");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const padNotes = [261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66];
  const fallbackPads = [
    "01-kick.wav", "02-snare.wav", "03-closed-hat.wav", "04-open-hat.wav",
    "05-clap.wav", "06-bass-drop.wav", "07-laser.wav", "08-riser.wav",
    "09-vinyl-scratch.wav", "10-rewind.wav", "11-horn.wav", "12-glitch.wav",
  ].map((name) => ({
    label: name.replace(/^\d+-/, "").replace(/\.wav$/i, "").replaceAll("-", " "),
    loop: false,
    url: `/audio/dj-pads/${name}`,
  }));
  const makeNumberedSet = (directory, prefix, extension, loop) =>
    Array.from({ length: 12 }, (_, index) => {
      const number = String(index + 1).padStart(2, "0");
      return {
        label: prefix + " " + number,
        loop,
        url: "/audio/" + directory + "/" + prefix + "-" + number + "." + extension,
      };
    });
  const sequencePads = makeNumberedSet("loops", "sequence", "mp3", true);
  const chillPads = makeNumberedSet("chill", "chill", "wav", true);
  const soundSets = [sequencePads, fallbackPads, chillPads];
  let selectedSet = 0;
  try {
    const storedSet = Number(localStorage.getItem("signal-sound-set"));
    if (Number.isInteger(storedSet) && storedSet >= 0 && storedSet < soundSets.length) selectedSet = storedSet;
  } catch (_) {
    // Storage is optional; the first set remains the default.
  }
  let currentPads = soundSets[selectedSet];
  const padGroups = [];
  const activeLoops = new Map();
  const padTimers = new WeakMap();
  let audioContext;
  let masterOutput;

  const ensureAudio = async () => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;

    if (!audioContext) {
      audioContext = new AudioContext();
      masterOutput = audioContext.createGain();
      masterOutput.gain.value = 0.82;
      masterOutput.connect(audioContext.destination);
    }

    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    return audioContext.state === "running" ? audioContext : null;
  };

  const playSynthFallback = async (index) => {
    const context = await ensureAudio();
    if (!context || !masterOutput) return;

    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const attack = context.createOscillator();
    const gain = context.createGain();
    const attackGain = context.createGain();

    oscillator.type = index % 3 === 0 ? "square" : index % 3 === 1 ? "triangle" : "sine";
    oscillator.frequency.setValueAtTime(padNotes[index], now);
    oscillator.frequency.exponentialRampToValueAtTime(padNotes[index] * 0.97, now + 0.42);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.42, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.48);

    attack.type = "square";
    attack.frequency.setValueAtTime(1400 + index * 35, now);
    attack.frequency.exponentialRampToValueAtTime(700 + index * 20, now + 0.07);
    attackGain.gain.setValueAtTime(0.16, now);
    attackGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);

    oscillator.connect(gain);
    attack.connect(attackGain);
    gain.connect(masterOutput);
    attackGain.connect(masterOutput);
    oscillator.start(now);
    attack.start(now);
    oscillator.stop(now + 0.5);
    attack.stop(now + 0.08);
  };

  const playPadSound = async (index) => {
    const playing = activeLoops.get(index);
    if (playing) {
      playing.pause();
      playing.currentTime = 0;
      activeLoops.delete(index);
      return false;
    }

    try {
      const assignment = currentPads[index];
      const audio = new Audio(assignment.url);
      audio.loop = assignment.loop;
      audio.preload = "auto";
      audio.playsInline = true;
      audio.volume = 0.9;
      if (assignment.loop) activeLoops.set(index, audio);
      await audio.play();
      if (activeLoops.get(index) !== audio) {
        audio.pause();
        return false;
      }
      if (assignment.loop) {
        audio.addEventListener("ended", () => {
          if (activeLoops.get(index) === audio) activeLoops.delete(index);
        });
      }
      return assignment.loop;
    } catch (error) {
      const failed = activeLoops.get(index);
      if (failed) activeLoops.delete(index);
      console.warn("DJ sample unavailable; using synthesized fallback", error);
      await playSynthFallback(index);
      return false;
    }
  };

  const stopAllPads = () => {
    activeLoops.forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    });
    activeLoops.clear();
    padGroups.forEach(({ pads }) => pads.forEach((pad) => {
      pad.classList.remove("is-playing", "is-hit");
      pad.setAttribute("aria-pressed", "false");
    }));
  };

  const syncPadLabels = () => {
    padGroups.forEach(({ pads, groupLabel }) => pads.forEach((pad, index) => {
      const assignment = currentPads[index];
      pad.setAttribute("aria-label", groupLabel + " " + (index + 1) + ": " + assignment.label);
      pad.title = assignment.label;
    }));
  };

  const selectSoundSet = (index, persist = true) => {
    if (!Number.isInteger(index) || !soundSets[index]) return;
    stopAllPads();
    selectedSet = index;
    currentPads = soundSets[index];
    syncPadLabels();
    document.querySelectorAll("[data-signal-set]").forEach((button) => {
      const active = Number(button.dataset.signalSet) === index;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    if (persist) {
      try { localStorage.setItem("signal-sound-set", String(index)); } catch (_) {}
    }
  };

  document.querySelectorAll("[data-signal-pads]").forEach((padGrid) => {
    const pads = [...padGrid.querySelectorAll("span")];
    const groupLabel = padGrid.getAttribute("aria-label") || "Sound pad";
    padGroups.push({ pads, groupLabel });


    pads.forEach((pad, index) => {
      pad.setAttribute("role", "button");
      pad.setAttribute("tabindex", "0");
      pad.setAttribute("aria-pressed", "false");
      pad.setAttribute("aria-label", `${groupLabel} ${index + 1}`);
      pad.style.setProperty("--pad-hue", String((index * 29 + 12) % 360));

      const activate = () => {
        window.clearTimeout(padTimers.get(pad));
        pad.classList.remove("is-hit");
        void pad.offsetWidth;
        pad.classList.add("is-hit");
        playPadSound(index)
          .then((isPlaying) => {
            pad.classList.toggle("is-playing", isPlaying);
            pad.setAttribute("aria-pressed", String(isPlaying));
          })
          .catch((error) => console.warn("Sound pad playback failed", error));
        padTimers.set(
          pad,
          window.setTimeout(() => pad.classList.remove("is-hit"), 240),
        );
      };

      pad.addEventListener("click", activate);
      pad.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activate();
        }
      });
    });
  });


  document.querySelectorAll("[data-signal-sets]").forEach((setControl) => {
    setControl.querySelectorAll("[data-signal-set]").forEach((button) => {
      button.addEventListener("click", () => selectSoundSet(Number(button.dataset.signalSet)));
    });
  });
  selectSoundSet(selectedSet, false);

  document.querySelectorAll("[data-signal-wheel]").forEach((wheel) => {
    let startY = 0;
    let startTime = 0;
    let activePointer = null;
    let decayFrame;
    let decayDelay;

    const boostWheel = (rate) => {
      const orbit = wheel
        .getAnimations()
        .find((animation) => animation.animationName === "signal-orbit");
      if (!orbit) return;

      window.cancelAnimationFrame(decayFrame);
      window.clearTimeout(decayDelay);
      orbit.playbackRate = Math.max(1, Math.min(rate, 9));

      decayDelay = window.setTimeout(() => {
        const decay = () => {
          orbit.playbackRate += (1 - orbit.playbackRate) * 0.025;
          if (orbit.playbackRate > 1.02) {
            decayFrame = window.requestAnimationFrame(decay);
          } else {
            orbit.playbackRate = 1;
          }
        };
        decayFrame = window.requestAnimationFrame(decay);
      }, 650);
    };

    wheel.addEventListener("pointerdown", (event) => {
      activePointer = event.pointerId;
      startY = event.clientY;
      startTime = performance.now();
      wheel.classList.add("is-wheel-dragging");
      wheel.setPointerCapture(event.pointerId);
    });

    wheel.addEventListener("pointerup", (event) => {
      if (event.pointerId !== activePointer) return;
      const distance = event.clientY - startY;
      const elapsed = Math.max(performance.now() - startTime, 16);
      wheel.classList.remove("is-wheel-dragging");
      activePointer = null;

      if (distance > 18) {
        boostWheel(1.6 + (distance / elapsed) * 9);
      }
    });

    wheel.addEventListener("pointercancel", () => {
      wheel.classList.remove("is-wheel-dragging");
      activePointer = null;
    });

    wheel.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        boostWheel(4);
      }
    });
  });

  carousels.forEach((carousel) => {
    const slides = [...carousel.querySelectorAll("[data-signal-slide]")];
    const lights = [...carousel.querySelectorAll(".summer-signal__lights i")];
    const toggle = carousel.querySelector("[data-signal-toggle]");
    const preferenceTrigger = carousel
      .closest(".summer-signal")
      ?.querySelector(".summer-signal__ring--two");
    const interval = Number(carousel.dataset.interval) || 10000;
    const pauseLabel = carousel.dataset.pauseLabel || "Pause slideshow";
    const resumeLabel = carousel.dataset.resumeLabel || "Resume slideshow";

    if (preferenceTrigger) {
      const desktop = window.matchMedia("(min-width: 992px)");
      let unlockClicks = 0;
      let unlockTimer;

      preferenceTrigger.addEventListener("click", () => {
        if (!desktop.matches) {
          return;
        }

        unlockClicks += 1;
        window.clearTimeout(unlockTimer);

        if (unlockClicks === 3) {
          const unlocked = document.documentElement.classList.toggle("preferences-unlocked");
          unlockClicks = 0;
          try {
            if (unlocked) {
              localStorage.setItem("preferences-unlocked", "true");
            } else {
              localStorage.removeItem("preferences-unlocked");
            }
          } catch (_) {
            // The controls still toggle for this page when storage is unavailable.
          }
          return;
        }

        unlockTimer = window.setTimeout(() => {
          unlockClicks = 0;
        }, 5000);
      });
    }

    if (slides.length < 2 || !toggle) return;

    let current = 0;
    let timer;
    let inView = true;
    let userPaused = prefersReducedMotion.matches;

    const showSlide = (index) => {
      current = (index + slides.length) % slides.length;
      slides.forEach((slide, slideIndex) => {
        const active = slideIndex === current;
        slide.classList.toggle("is-active", active);
        slide.setAttribute("aria-hidden", String(!active));
      });
      lights.forEach((light, lightIndex) => {
        light.classList.toggle("is-active", lightIndex === current);
      });
    };

    const sync = () => {
      window.clearInterval(timer);
      const stopped = userPaused || !inView || document.hidden;
      carousel.classList.toggle("is-paused", stopped);
      toggle.setAttribute("aria-pressed", String(userPaused));
      toggle.setAttribute("aria-label", userPaused ? resumeLabel : pauseLabel);
      toggle.title = userPaused ? resumeLabel : pauseLabel;

      if (!stopped) {
        timer = window.setInterval(() => showSlide(current + 1), interval);
      }
    };

    toggle.addEventListener("click", () => {
      userPaused = !userPaused;
      sync();
    });

    document.addEventListener("visibilitychange", sync);

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(([entry]) => {
        inView = entry.isIntersecting;
        sync();
      }, { threshold: 0.2 });
      observer.observe(carousel);
    }

    showSlide(0);
    sync();
  });
})();
