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

  const MOBILE_LAYOUT_MAX = 1024;

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

  const partnersSection = document.querySelector("#partners");
  const partnersTrack = document.querySelector(".partners-track");
  const partnersFirstSet = partnersTrack?.querySelector(".partners-logos");
  let partnersLoopWidth = 0;
  let lenisInstance = null;
  let partnersScrollTarget = 0;
  let partnersScrollCurrent = 0;
  let partnersFrozenTarget = 0;
  let partnersExtraOffset = 0;
  let partnersExtraOffsetTarget = 0;
  let partnersPinPhase = "idle";
  let partnersPinnedScrollY = 0;
  let partnersPinMarqueeBase = 0;
  let partnersLastCenterOffset = 0;
  let partnersLockBlend = 0;
  let partnersLastWheelDelta = 0;
  let partnersReleasedScrollPos = 0;
  const PARTNERS_SCROLL_RATE = 0.42;
  const PARTNERS_WHEEL_RATE = 0.45;
  const PARTNERS_LERP = 0.078;
  const PARTNERS_PAGE_LOCK_LERP = 0.078;
  const PARTNERS_VELOCITY_DAMP = 0.92;
  const PARTNERS_PIN_BAND = 0.18;
  const PARTNERS_PIN_LOCK_MIN = 0.42;
  const PARTNERS_RELEASE_SCROLL = 0.14;

  function getPartnersSectionRect() {
    return partnersSection?.getBoundingClientRect() ?? null;
  }

  function getPartnersCenterOffset() {
    const rect = getPartnersSectionRect();
    if (!rect) return null;
    const vh = window.innerHeight;
    return rect.top + rect.height * 0.5 - vh * 0.5;
  }

  function computePartnersPinScrollY() {
    const offset = getPartnersCenterOffset();
    if (offset === null) return getScrollY();
    return getScrollY() + offset;
  }

  function getPartnersBaseTarget() {
    if (!partnersSection) return 0;

    const vh = window.innerHeight;
    const rect = partnersSection.getBoundingClientRect();

    if (rect.top > vh) return 0;
    if (rect.bottom < 0) {
      return partnersFrozenTarget - partnersExtraOffset;
    }

    return Math.max(0, vh - rect.top) * PARTNERS_SCROLL_RATE;
  }

  function resetPartnersPinState() {
    partnersPinPhase = "idle";
    partnersSection?.classList.remove("is-pinned");
    partnersPinnedScrollY = 0;
    partnersPinMarqueeBase = 0;
    partnersLastCenterOffset = 0;
    partnersLockBlend = 0;
    partnersLastWheelDelta = 0;
    partnersReleasedScrollPos = 0;
  }

  function beginPartnersArming() {
    if (partnersPinPhase !== "idle") return;
    partnersPinPhase = "arming";
    partnersPinnedScrollY = computePartnersPinScrollY();
    partnersPinMarqueeBase = partnersScrollCurrent;
    partnersExtraOffset = 0;
    partnersExtraOffsetTarget = 0;
    partnersLockBlend = 0;
  }

  function activatePartnersPin() {
    if (partnersPinPhase !== "arming") return;
    partnersPinPhase = "pinned";
    partnersSection?.classList.add("is-pinned");
    partnersPinMarqueeBase = partnersScrollCurrent;
    partnersExtraOffset = 0;
    partnersExtraOffsetTarget = 0;
    partnersLockBlend = 1;
  }

  function clampPartnersCycleOffset(value) {
    if (partnersLoopWidth <= 0) return 0;
    return Math.min(partnersLoopWidth, Math.max(0, value));
  }

  function releasePartnersPin() {
    if (partnersPinPhase === "released" || partnersPinPhase === "idle") return;
    partnersPinPhase = "released";
    partnersSection?.classList.remove("is-pinned");
    partnersLockBlend = 0;

    const frozenOffset = clampPartnersCycleOffset(partnersExtraOffset);
    partnersExtraOffset = frozenOffset;
    partnersExtraOffsetTarget = frozenOffset;
    partnersReleasedScrollPos = partnersScrollCurrent;
    partnersScrollTarget = partnersReleasedScrollPos;
    partnersFrozenTarget = partnersReleasedScrollPos;

    if (lenisInstance) {
      const carry = Math.max(0, partnersLastWheelDelta * 0.35);
      const nudge = window.innerHeight * PARTNERS_RELEASE_SCROLL;
      lenisInstance.scrollTo(getScrollY() + nudge + carry, { lerp: PARTNERS_LERP });

      if (typeof lenisInstance.velocity === "number") {
        lenisInstance.velocity = Math.max(partnersLastWheelDelta * 0.2, lenisInstance.velocity * 0.35);
      }
    }
  }

  function updatePartnersPinState() {
    if (!partnersSection || reduceMotion || partnersLoopWidth <= 0) return;

    const rect = getPartnersSectionRect();
    if (!rect) return;

    const vh = window.innerHeight;
    const centerOffset = getPartnersCenterOffset();
    if (centerOffset === null) return;

    if (rect.top > vh) {
      resetPartnersPinState();
      return;
    }

    if (partnersPinPhase === "released" && rect.bottom < 0) {
      return;
    }

    if (partnersPinPhase === "released" && rect.top > vh) {
      resetPartnersPinState();
      partnersExtraOffset = 0;
      partnersExtraOffsetTarget = 0;
      return;
    }

    if (partnersPinPhase === "idle") {
      const inBand = Math.abs(centerOffset) < vh * PARTNERS_PIN_BAND;
      if (inBand) beginPartnersArming();
    }

    if (partnersPinPhase === "arming") {
      partnersPinnedScrollY = computePartnersPinScrollY();
      partnersLockBlend += (1 - partnersLockBlend) * PARTNERS_PAGE_LOCK_LERP;
      if (partnersLockBlend > 0.94) activatePartnersPin();
    }

    partnersLastCenterOffset = centerOffset;
  }

  function getScrollY() {
    if (lenisInstance && typeof lenisInstance.scroll === "number") {
      return lenisInstance.scroll;
    }
    return (
      window.scrollY ||
      document.documentElement.scrollTop ||
      document.body.scrollTop ||
      0
    );
  }

  function initPartnersMarquee() {
    if (!partnersTrack || !partnersFirstSet || reduceMotion) return;

    const items = [...partnersFirstSet.children];

    for (let i = items.length - 1; i >= 0; i -= 1) {
      const clone = items[i].cloneNode(true);
      clone.setAttribute("aria-hidden", "true");
      partnersFirstSet.insertBefore(clone, partnersFirstSet.firstChild);
    }

    items.forEach((item) => {
      const clone = item.cloneNode(true);
      clone.setAttribute("aria-hidden", "true");
      partnersFirstSet.appendChild(clone);
    });

    const measurePartnersLoop = () => {
      partnersLoopWidth = partnersFirstSet.scrollWidth / 3;
    };

    measurePartnersLoop();
    window.addEventListener("resize", measurePartnersLoop, { passive: true });
    window.addEventListener("load", measurePartnersLoop, { passive: true });

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", measurePartnersLoop, {
        passive: true,
      });
    }

    if ("ResizeObserver" in window) {
      const partnersRo = new ResizeObserver(measurePartnersLoop);
      partnersRo.observe(partnersFirstSet);
      partnersFirstSet.querySelectorAll("img").forEach((img) => {
        partnersRo.observe(img);
      });
    }

    return measurePartnersLoop;
  }

  const measurePartnersLoop = initPartnersMarquee();

  function setPartnersScrollTarget() {
    if (!partnersSection) return;

    const vh = window.innerHeight;
    const rect = partnersSection.getBoundingClientRect();

    if (rect.top > vh) {
      partnersExtraOffset = 0;
      partnersExtraOffsetTarget = 0;
      partnersScrollTarget = 0;
      partnersFrozenTarget = 0;
      return;
    }

    if (partnersPinPhase === "pinned" || partnersPinPhase === "arming") {
      const cycleOffset =
        partnersPinPhase === "pinned" ? clampPartnersCycleOffset(partnersExtraOffset) : 0;
      partnersScrollTarget = partnersPinMarqueeBase + cycleOffset;
      partnersFrozenTarget = partnersScrollTarget;
      return;
    }

    if (partnersPinPhase === "released") {
      partnersScrollTarget = partnersReleasedScrollPos;
      partnersFrozenTarget = partnersReleasedScrollPos;
      return;
    }

    if (rect.top < vh && rect.bottom > 0) {
      partnersScrollTarget = partnersPinMarqueeBase || getPartnersBaseTarget();
      partnersFrozenTarget = partnersScrollTarget;
      return;
    }

    const baseTarget = getPartnersBaseTarget();
    partnersScrollTarget = baseTarget;
    partnersFrozenTarget = partnersScrollTarget;
  }

  function syncPartnersPageLock() {
    const isLocking = partnersPinPhase === "arming" || partnersPinPhase === "pinned";

    if (!isLocking) {
      partnersLockBlend += (0 - partnersLockBlend) * PARTNERS_PAGE_LOCK_LERP;
      if (partnersLockBlend < 0.008) partnersLockBlend = 0;
      return;
    }

    if (partnersPinPhase === "arming") {
      partnersPinnedScrollY = computePartnersPinScrollY();
    }

    const currentY = getScrollY();
    const diff = partnersPinnedScrollY - currentY;
    const pullLerp = PARTNERS_LERP * Math.max(partnersLockBlend, 0.06);

    if (lenisInstance) {
      if (typeof lenisInstance.velocity === "number" && Math.abs(lenisInstance.velocity) > 0.05) {
        const damp = PARTNERS_VELOCITY_DAMP + (1 - PARTNERS_VELOCITY_DAMP) * (1 - partnersLockBlend);
        lenisInstance.velocity *= damp;
      }

      if (Math.abs(diff) > 0.1) {
        const nextY = currentY + diff * pullLerp;
        lenisInstance.scrollTo(nextY, { lerp: pullLerp, force: true });
      }
      return;
    }

    if (Math.abs(diff) > 0.1) {
      window.scrollTo(0, currentY + diff * pullLerp);
    }
  }

  function initPartnersPinScroll() {
    if (!partnersSection || !partnersTrack || reduceMotion) return;

    const onWheel = (e) => {
      if (partnersPinPhase === "released" || partnersLoopWidth <= 0) return;

      const rect = getPartnersSectionRect();
      const centerOffset = getPartnersCenterOffset();
      if (!rect || centerOffset === null) return;

      const vh = window.innerHeight;
      const inPinZone =
        rect.top < vh * 0.9 &&
        rect.bottom > vh * 0.1 &&
        centerOffset < vh * 0.42;

      if (partnersPinPhase === "idle" && inPinZone) {
        beginPartnersArming();
      }

      if (partnersPinPhase === "arming" && partnersLockBlend < PARTNERS_PIN_LOCK_MIN) {
        return;
      }

      if (partnersPinPhase !== "pinned" && partnersPinPhase !== "arming") return;

      e.preventDefault();
      e.stopPropagation();
      partnersLastWheelDelta = e.deltaY;

      if (partnersPinPhase !== "pinned") return;

      if (e.deltaY <= 0 && partnersExtraOffsetTarget <= 0) return;

      partnersExtraOffsetTarget = clampPartnersCycleOffset(
        partnersExtraOffsetTarget + e.deltaY * PARTNERS_WHEEL_RATE
      );

      if (partnersExtraOffsetTarget >= partnersLoopWidth - 0.5) {
        releasePartnersPin();
      }
    };

    document.addEventListener("wheel", onWheel, { passive: false, capture: true });
  }

  function tickPartnersMarquee() {
    if (partnersTrack && !reduceMotion && partnersLoopWidth > 0) {
      updatePartnersPinState();
      syncPartnersPageLock();

      partnersExtraOffsetTarget = clampPartnersCycleOffset(partnersExtraOffsetTarget);
      partnersExtraOffset +=
        (partnersExtraOffsetTarget - partnersExtraOffset) * PARTNERS_LERP;
      partnersExtraOffset = clampPartnersCycleOffset(partnersExtraOffset);

      setPartnersScrollTarget();

      if (partnersPinPhase === "released") {
        partnersScrollCurrent = partnersReleasedScrollPos;
      } else {
        partnersScrollCurrent +=
          (partnersScrollTarget - partnersScrollCurrent) * PARTNERS_LERP;
      }

      if (partnersPinPhase === "idle" && partnersScrollCurrent >= partnersLoopWidth * 8) {
        partnersScrollCurrent -= partnersLoopWidth * 4;
        partnersScrollTarget -= partnersLoopWidth * 4;
      }

      const offset = -partnersLoopWidth + partnersScrollCurrent;
      partnersTrack.style.transform = `translate3d(${offset}px, 0, 0)`;
    }
    requestAnimationFrame(tickPartnersMarquee);
  }

  if (!reduceMotion && partnersTrack) {
    setPartnersScrollTarget();
    requestAnimationFrame(tickPartnersMarquee);
  }

  let layoutRaf = 0;
  function syncLayoutOnScroll() {
    if (layoutRaf) return;
    layoutRaf = requestAnimationFrame(() => {
      layoutRaf = 0;
      updateSectionScales();
      if (partnersPinPhase !== "pinned") {
        setPartnersScrollTarget();
      }
      if (hasFinePointer) syncPointerHoverCard();
    });
  }

  if (useLenis) {
    const { default: Lenis } = await import(
      "https://cdn.jsdelivr.net/npm/lenis@1.3.23/+esm"
    );

    const easeInOutCubic = (t) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    lenisInstance = new Lenis({
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
    lenisInstance.on("scroll", syncLayoutOnScroll);
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
  measurePartnersLoop?.();
  setPartnersScrollTarget();
  initPartnersPinScroll();

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
