import Lenis from "https://cdn.jsdelivr.net/npm/lenis@1.3.23/+esm";

const easeInOutCubic = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

const lenis = new Lenis({
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

const scaleSections = document.querySelectorAll("main > .section");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function updateSectionScales() {
  if (reduceMotion || !scaleSections.length) return;

  const vh = window.innerHeight;
  const viewportMid = vh * 0.5;
  const falloff = vh * 0.9;

  scaleSections.forEach((section) => {
    const rect = section.getBoundingClientRect();
    const sectionMid = rect.top + rect.height * 0.5;
    const dist = Math.abs(sectionMid - viewportMid);
    const t = Math.min(1, dist / falloff);
    const focus = 1 - t * t;
    const easedFocus = focus * focus * (3 - 2 * focus);
    const scale = 0.96 + easedFocus * 0.04;
    section.style.setProperty("--section-scale", scale.toFixed(4));
  });
}

lenis.on("scroll", updateSectionScales);
window.addEventListener("resize", updateSectionScales, { passive: true });
updateSectionScales();

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
