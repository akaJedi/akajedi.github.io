(() => {
  const carousels = document.querySelectorAll("[data-signal-carousel]");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

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
