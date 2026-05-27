(async function init() {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const reducedData = window.matchMedia("(prefers-reduced-data: reduce)").matches;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const hasFinePointer =
    window.matchMedia("(pointer: fine)").matches &&
    window.matchMedia("(hover: hover)").matches;

  if (coarsePointer || reduceMotion || reducedData) {
    document.documentElement.classList.add("perf-lite");
  }

  const scaleSections = document.querySelectorAll("main > .section");
  const useLenis = !coarsePointer && !reduceMotion && !reducedData;

  const MOBILE_LAYOUT_MAX = 1100;

  function isMobileLayoutWidth() {
    return window.innerWidth <= MOBILE_LAYOUT_MAX;
  }

  function updateSectionScales() {
    if (reduceMotion || coarsePointer || isMobileLayoutWidth() || !scaleSections.length) {
      if (isMobileLayoutWidth() || coarsePointer || reduceMotion) {
        scaleSections.forEach((section) => {
          section.style.setProperty("--section-scale", "1");
        });
      }
      return;
    }

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

  /** Два одинаковых ряда + точная ширина цикла в px (без рывка на стыке) */
  function initPartnersMarquee() {
    if (reduceMotion) return;
    const track = document.querySelector("#partners .partners-track");
    if (!track) return;

    let row = track.querySelector(".partners-logos:not([aria-hidden])");
    if (!row) {
      row = track.querySelector(".partners-logos");
      row?.removeAttribute("aria-hidden");
    }
    if (!row) return;

    row.querySelectorAll('li[aria-hidden="true"]').forEach((li) => li.remove());
    delete row.dataset.duplicated;

    track.querySelectorAll(".partners-logos[aria-hidden]").forEach((el) => el.remove());

    if (!track.querySelector(".partners-logos[aria-hidden]")) {
      const clone = row.cloneNode(true);
      clone.setAttribute("aria-hidden", "true");
      track.appendChild(clone);
    }

    const measureLoop = () => {
      const set = track.querySelector(".partners-logos:not([aria-hidden])");
      if (!set) return;
      const w = set.getBoundingClientRect().width;
      if (w > 1) {
        track.style.setProperty("--partners-loop", `${w}px`);
      }
    };

    measureLoop();
    window.addEventListener("resize", measureLoop, { passive: true });
    window.addEventListener("load", measureLoop, { passive: true });

    if ("ResizeObserver" in window) {
      const ro = new ResizeObserver(measureLoop);
      ro.observe(track);
      track.querySelectorAll(".partners-logos img").forEach((img) => ro.observe(img));
    }

    track.dataset.marqueeReady = "true";
  }

  initPartnersMarquee();

  let layoutRaf = 0;
  function syncLayoutOnScroll() {
    if (layoutRaf) return;
    layoutRaf = requestAnimationFrame(() => {
      layoutRaf = 0;
      updateSectionScales();
      if (hasFinePointer) syncPointerHoverCard();
    });
  }

  if (useLenis) {
    const { default: Lenis } = await import(
      "https://cdn.jsdelivr.net/npm/lenis@1.3.23/+esm"
    );

    const easeInOutCubic = (t) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const lenis = new Lenis({
      autoRaf: true,
      lerp: 0.078,
      wheelMultiplier: 0.82,
      smoothWheel: true,
      syncTouch: false,
      touchMultiplier: 1,
      syncTouchLerp: 0.1,
      stopInertiaOnNavigate: true,
      anchors: {
        duration: 1.55,
        easing: easeInOutCubic,
        offset: 0,
      },
    });
    lenis.on("scroll", syncLayoutOnScroll);
  } else {
    window.addEventListener("scroll", syncLayoutOnScroll, { passive: true });
  }

  window.addEventListener("resize", syncLayoutOnScroll, { passive: true });

  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", syncLayoutOnScroll, {
      passive: true,
    });
    window.visualViewport.addEventListener("scroll", syncLayoutOnScroll, {
      passive: true,
    });
  }

  if (hasFinePointer) {
    window.addEventListener(
      "mousemove",
      (e) => {
        lastPointerX = e.clientX;
        lastPointerY = e.clientY;
        syncPointerHoverCard();
      },
      { passive: true }
    );

    document.documentElement.addEventListener("mouseleave", () => {
      lastPointerX = -1;
      lastPointerY = -1;
      syncPointerHoverCard();
    });
  }

  syncLayoutOnScroll();

  const revealItems = document.querySelectorAll(".reveal");

  if (reduceMotion) {
    revealItems.forEach((item) => {
      item.classList.add("in-view");
      item.style.transitionDelay = "0ms";
    });
  } else {
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
        threshold: 0.12,
        rootMargin: "0px 0px -24px 0px",
      }
    );

    revealItems.forEach((item) => {
      item.style.transitionDelay = "0ms";
      observer.observe(item);
    });
  }
})();
