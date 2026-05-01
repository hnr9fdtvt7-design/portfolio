import Lenis from "https://cdn.jsdelivr.net/npm/lenis@1.3.23/+esm";

const easeInOutCubic = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

new Lenis({
  autoRaf: true,
  lerp: 0.078,
  wheelMultiplier: 0.82,
  smoothWheel: true,
  syncTouch: true,
  touchMultiplier: 1.05,
  syncTouchLerp: 0.092,
  stopInertiaOnNavigate: true,
  anchors: {
    duration: 1.55,
    easing: easeInOutCubic,
    offset: 0,
  },
});

const revealItems = document.querySelectorAll(".reveal");

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in-view");
        observer.unobserve(entry.target);
      }
    });
  },
  {
    threshold: 0.2,
    rootMargin: "0px 0px -40px 0px",
  }
);

revealItems.forEach((item) => {
  item.style.transitionDelay = "0ms";
  observer.observe(item);
});
