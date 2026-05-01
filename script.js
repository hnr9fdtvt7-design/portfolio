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

updateSectionScales();

function setupCursorGlowStack(stack) {
  const layer = stack.querySelector(".process-cursor-layer");
  if (!layer) return null;

  let smoothX = 50;
  let smoothY = 50;
  let targetX = 50;
  let targetY = 50;
  let rafId = 0;
  let leaveResetId = 0;
  let stackActive = false;
  let firstGlowFrame = true;
  const glowFadeMs = 1150;
  const smoothLerp = 0.18;

  function syncGlow() {
    smoothX += (targetX - smoothX) * smoothLerp;
    smoothY += (targetY - smoothY) * smoothLerp;
    stack.style.setProperty("--cursor-x", `${smoothX}%`);
    stack.style.setProperty("--cursor-y", `${smoothY}%`);
    const moving =
      Math.abs(targetX - smoothX) > 0.035 || Math.abs(targetY - smoothY) > 0.035;
    if (moving) {
      rafId = requestAnimationFrame(syncGlow);
    } else {
      rafId = 0;
    }
  }

  function pointerInside(clientX, clientY) {
    const rect = stack.getBoundingClientRect();
    return (
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    );
  }

  function updateGlowPosition(clientX, clientY) {
    const rect = stack.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    targetX = x;
    targetY = y;
    if (firstGlowFrame) {
      smoothX = x;
      smoothY = y;
      stack.style.setProperty("--cursor-x", `${smoothX}%`);
      stack.style.setProperty("--cursor-y", `${smoothY}%`);
      firstGlowFrame = false;
    }
    if (!rafId) rafId = requestAnimationFrame(syncGlow);
  }

  function activateGlow() {
    if (leaveResetId) {
      clearTimeout(leaveResetId);
      leaveResetId = 0;
    }
    layer.classList.add("is-active");
    stackActive = true;
  }

  function deactivateGlow() {
    layer.classList.remove("is-active");
    stackActive = false;
    firstGlowFrame = true;
    cancelAnimationFrame(rafId);
    rafId = 0;
    if (leaveResetId) clearTimeout(leaveResetId);
    leaveResetId = setTimeout(() => {
      leaveResetId = 0;
      stack.style.removeProperty("--cursor-x");
      stack.style.removeProperty("--cursor-y");
    }, glowFadeMs);
  }

  return function handleMove(clientX, clientY) {
    if (pointerInside(clientX, clientY)) {
      activateGlow();
      updateGlowPosition(clientX, clientY);
    } else if (stackActive) {
      deactivateGlow();
    }
  };
}

let lastPointerX = -1;
let lastPointerY = -1;

const POINTER_HOVER_CARD_CLASS = "is-pointer-hover";
let activePointerHoverCard = null;

function findPointerHoverCardTarget(el) {
  const ctaWrap = el.closest(".cta-wrap");
  if (ctaWrap && ctaWrap.closest(".cta-section")) return ctaWrap;

  const card = el.closest(".card, .case-card");
  if (!card) return null;
  if (card.matches(".process-item") && card.closest(".process-list")) return card;
  if (
    card.matches(".card:not(.process-item)") &&
    card.closest(".service-grid")
  )
    return card;
  if (card.matches(".case-card") && card.closest(".case-grid")) return card;
  return null;
}

function syncPointerHoverCard() {
  let next = null;
  if (lastPointerX >= 0 && lastPointerY >= 0) {
    const hit = document.elementFromPoint(lastPointerX, lastPointerY);
    if (hit) next = findPointerHoverCardTarget(hit);
  }
  if (activePointerHoverCard === next) return;
  activePointerHoverCard?.classList.remove(POINTER_HOVER_CARD_CLASS);
  next?.classList.add(POINTER_HOVER_CARD_CLASS);
  activePointerHoverCard = next;
}

const cursorGlowStacks = document.querySelectorAll("[data-cursor-glow]");
const cursorGlowHandlers = !reduceMotion
  ? [...cursorGlowStacks].map(setupCursorGlowStack).filter(Boolean)
  : [];

function syncCursorGlowWithViewport() {
  if (lastPointerX < 0 || !cursorGlowHandlers.length) return;
  cursorGlowHandlers.forEach((handler) => handler(lastPointerX, lastPointerY));
}

function syncLayoutAndCursorGlow() {
  updateSectionScales();
  syncCursorGlowWithViewport();
  syncPointerHoverCard();
}

lenis.on("scroll", syncLayoutAndCursorGlow);

window.addEventListener("resize", syncLayoutAndCursorGlow, { passive: true });

if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", syncLayoutAndCursorGlow, {
    passive: true,
  });
  window.visualViewport.addEventListener("scroll", syncLayoutAndCursorGlow, {
    passive: true,
  });
}

window.addEventListener(
  "mousemove",
  (e) => {
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
    syncPointerHoverCard();
    cursorGlowHandlers.forEach((handler) => handler(e.clientX, e.clientY));
  },
  { passive: true }
);

document.documentElement.addEventListener("mouseleave", () => {
  lastPointerX = -1;
  lastPointerY = -1;
  syncPointerHoverCard();
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
