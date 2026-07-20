(() => {
  const carousels = document.querySelectorAll("[data-signal-carousel]");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const padTimers = new WeakMap();
  let coffeeTrack;

  const playCoffeeTrack = () => {
    if (!coffeeTrack) {
      coffeeTrack = new Audio("/audio/sound-04.mp3");
      coffeeTrack.preload = "none";
      coffeeTrack.volume = 0.58;
    }

    coffeeTrack.pause();
    coffeeTrack.currentTime = 0;
    const playback = coffeeTrack.play();
    if (playback) {
      playback.catch(() => {});
    }
  };

  document.querySelectorAll("[data-signal-pads]").forEach((padGrid) => {
    const pads = [...padGrid.querySelectorAll("span")];
    const groupLabel = padGrid.getAttribute("aria-label") || "Interactive color tiles";
    const coffeeLabel = padGrid.dataset.coffeeLabel || "Coffee music";

    pads.forEach((pad, index) => {
      pad.setAttribute("role", "button");
      pad.setAttribute("tabindex", "0");
      pad.setAttribute(
        "aria-label",
        index === 3 ? `${groupLabel} ${index + 1}: ${coffeeLabel}` : `${groupLabel} ${index + 1}`,
      );
      pad.style.setProperty("--pad-hue", String((index * 29 + 12) % 360));

      const activate = () => {
        if (index === 3) {
          window.clearTimeout(padTimers.get(pad));
          pad.classList.add("is-coffee-active");
          pad.classList.remove("is-coffee-pulse");
          void pad.offsetWidth;
          pad.classList.add("is-coffee-pulse");
          padTimers.set(
            pad,
            window.setTimeout(() => pad.classList.remove("is-coffee-pulse"), 520),
          );
          playCoffeeTrack();
          return;
        }

        window.clearTimeout(padTimers.get(pad));
        pad.classList.remove("is-hit");
        void pad.offsetWidth;
        pad.classList.add("is-hit");
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
    const interval = Number(carousel.dataset.interval) || 10000;
    const pauseLabel = carousel.dataset.pauseLabel || "Pause slideshow";
    const resumeLabel = carousel.dataset.resumeLabel || "Resume slideshow";

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
