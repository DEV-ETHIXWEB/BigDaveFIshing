import { useRef, useEffect, useState, useCallback } from 'react';
import { gsap } from 'gsap';

import './AccordionGallery.css';

export interface AccordionItem {
  image: string;
  /** Candidate widths, so a closed panel does not fetch a full-size photograph. */
  srcset?: string;
  /** Intrinsic size of `image`, so the browser can reserve the box before it loads. */
  width?: number | string;
  height?: number | string;
  label?: string;
  alt?: string;
  link?: string;
}

/**
 * Matches the `max-width` in AccordionGallery.css that stacks the panels.
 *
 * Raised from 520 to 768 to cover tablets. Between those widths the gallery was still a
 * five-panel horizontal accordion 460px tall, opened on HOVER - on a device with no
 * pointer to hover with, and with the closed panels down to about 100px wide. The column
 * layout is the honest one for a touch screen: full-width photos, opened by tapping.
 * 768 is the same breakpoint CardNav already uses to switch to its phone shape, so the
 * whole page changes character at one width rather than two.
 */
const STACK_BREAKPOINT = 768;

interface Props {
  items: AccordionItem[];
  defaultIndex?: number;
  accentColor?: string;
  overlayColor?: string;
  textColor?: string;
  height?: number;
  gap?: number;
  radius?: number;
  expandRatio?: number;
  orientation?: 'horizontal' | 'vertical';
  duration?: number;
  ease?: string;
  parallax?: number;
  tilt?: number;
  stagger?: number;
  trigger?: 'hover' | 'click';
  showLabels?: boolean;
  grayscale?: boolean;
  className?: string;
}

const AccordionGallery = ({
  items,
  defaultIndex = 2,
  accentColor = '#ffffff',
  overlayColor = '#111111',
  textColor = '#ffffff',
  height = 460,
  gap = 10,
  radius = 16,
  expandRatio = 0.52,
  orientation = 'horizontal',
  duration = 0.6,
  ease = 'power3.out',
  parallax = 0.5,
  tilt = 8,
  stagger = 0.06,
  trigger = 'hover',
  showLabels = true,
  grayscale = true,
  className = '',
}: Props) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRefs = useRef<(HTMLElement | null)[]>([]);
  const mediaRefs = useRef<(HTMLElement | null)[]>([]);
  const barRefs = useRef<(HTMLElement | null)[]>([]);
  const textRefs = useRef<(HTMLElement | null)[]>([]);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const firstRunRef = useRef(true);
  const mediaSizeRef = useRef(320);

  const vertical = orientation === 'vertical';
  const count = items.length;
  const [active, setActive] = useState(Math.min(Math.max(defaultIndex, 0), count - 1));

  /**
   * True at the width where the stylesheet stacks the panels into a column.
   *
   * The CSS has always done this at 520px, but nothing told the component, so every
   * measurement and every tween carried on working in the horizontal axis while the
   * layout was vertical. Two things went wrong at once on a phone:
   *
   *   `--ag-media-size` was derived from the container's WIDTH and then applied by the
   *   mobile stylesheet as the media's HEIGHT, so each photo was scaled to roughly 210px
   *   tall inside an 84px band - a centre-cropped strip you cannot identify;
   *
   *   and the container was `height: auto`, so flex-grow had no free space to distribute
   *   and the open panel never actually opened. Every panel sat at its 84px minimum, which
   *   made the whole section a stack of identical slivers rather than an accordion.
   *
   * Reading it from matchMedia keeps the one breakpoint in the stylesheet, where it
   * belongs, and mirrors it here rather than hard-coding 520 in two places that can drift.
   */
  const [stacked, setStacked] = useState(false);
  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${STACK_BREAKPOINT}px)`);
    const sync = () => setStacked(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  // Stacked is vertical in every way that matters to the maths below: which dimension is
  // measured, which axis the parallax drifts along, and which way the panels tilt.
  const columnar = vertical || stacked;

  const prefersReduced =
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;

  const applyLayout = useCallback(
    (animate: boolean) => {
      const panels = panelRefs.current;
      if (!panels.length) return;

      const r = Math.min(Math.max(expandRatio, 0.2), 0.9);
      const grow = count > 1 ? (r * (count - 1)) / (1 - r) : 1;
      const mediaSize = mediaSizeRef.current;

      tlRef.current?.kill();
      const dur = animate && !prefersReduced ? duration : 0;
      const tl = gsap.timeline();

      panels.forEach((panel, i) => {
        if (!panel) return;
        const isActive = i === active;
        const media = mediaRefs.current[i];
        const bar = barRefs.current[i];
        const text = textRefs.current[i];

        const rot = isActive ? 0 : i < active ? tilt : -tilt;
        const rotProp = columnar ? { rotateX: -rot } : { rotateY: rot };

        tl.to(panel, { flexGrow: isActive ? grow : 1, ...rotProp, duration: dur, ease }, 0);

        if (media) {
          const drift = Math.max(-1.5, Math.min(1.5, active - i));
          const shift = drift * parallax * mediaSize * 0.06;
          const gray = grayscale ? (isActive ? 0 : 1) : 0;
          tl.to(
            media,
            {
              xPercent: -50,
              yPercent: -50,
              x: columnar ? 0 : isActive ? 0 : shift,
              y: columnar ? (isActive ? 0 : shift) : 0,
              // Custom properties the stylesheet reads for the desaturation and dim.
              '--ag-gray': gray,
              '--ag-dim': isActive ? 0 : 0.35,
              duration: dur,
              ease,
            } as gsap.TweenVars,
            0,
          );
        }

        if (showLabels && bar && text) {
          if (isActive) {
            tl.to(
              [bar, text],
              { opacity: 1, x: 0, duration: dur, ease, stagger: prefersReduced ? 0 : stagger },
              0,
            );
          } else {
            tl.to([bar, text], { opacity: 0, x: -14, duration: dur * 0.6, ease }, 0);
          }
        }
      });

      tlRef.current = tl;
    },
    [
      active,
      count,
      expandRatio,
      duration,
      ease,
      columnar,
      tilt,
      parallax,
      grayscale,
      showLabels,
      stagger,
      prefersReduced,
    ],
  );

  // Always points at the newest applyLayout, so the ResizeObserver below can call the
  // current one without having to be rebuilt every time `active` changes. Assigned in an
  // effect rather than during render: a render can be thrown away or replayed, and a ref
  // written during one would then describe a render that never committed.
  const applyLayoutRef = useRef(applyLayout);
  useEffect(() => {
    applyLayoutRef.current = applyLayout;
  });

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      // The axis the panels are laid out along, which is the one the open panel grows
      // into. Measuring the other one is what sized the photos wrongly on a phone.
      const total = columnar ? rect.height : rect.width;
      const usable = Math.max(total - gap * (count - 1), 120);
      const size = Math.max(140, usable * Math.min(Math.max(expandRatio, 0.2), 0.9) * 1.22);
      mediaSizeRef.current = size;
      el.style.setProperty('--ag-media-size', `${size}px`);
      applyLayoutRef.current(!firstRunRef.current);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
    // `applyLayout` is deliberately NOT a dependency, and is read through a ref instead.
    // It is rebuilt whenever `active` changes, i.e. on every hover, and listing it here
    // tore down and re-created the ResizeObserver on each one - an observer disconnect,
    // an allocation and a fresh observe per mouse movement across the gallery, to watch a
    // box that had not changed size. The effect only needs to re-run when the geometry
    // inputs change.
  }, [gap, count, expandRatio, columnar]);

  useEffect(() => {
    applyLayout(!firstRunRef.current);
    firstRunRef.current = false;
  }, [applyLayout]);

  useEffect(
    () => () => {
      tlRef.current?.kill();
    },
    [],
  );

  const handleEnter = (i: number) => {
    if (trigger === 'hover') setActive(i);
  };

  const handleClick = (i: number, e: React.MouseEvent) => {
    if (i !== active) {
      e.preventDefault();
      setActive(i);
    }
  };

  /**
   * Arrow keys move both the open panel and the focus ring together.
   *
   * Moving only the open panel left focus on the panel the key was pressed from, so the
   * ring and the open photo were on two different panels, Tab continued from the wrong
   * place, and `onFocus` - which also opens a panel - reopened the old one the moment
   * focus moved anywhere. Focusing the target fixes all three, and because the focus
   * handler opens whatever it lands on, this does not need to call setActive itself.
   */
  const focusPanel = (i: number) => panelRefs.current[i]?.focus();

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      focusPanel((i + 1) % count);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      focusPanel((i - 1 + count) % count);
    } else if (e.key === 'Home') {
      e.preventDefault();
      focusPanel(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      focusPanel(count - 1);
    }
  };

  return (
    <div
      ref={rootRef}
      className={`accordion-gallery${vertical ? ' accordion-gallery--vertical' : ''}${className ? ` ${className}` : ''}`}
      style={
        {
          '--ag-accent': accentColor,
          '--ag-overlay': overlayColor,
          '--ag-text': textColor,
          '--ag-gap': `${gap}px`,
          '--ag-radius': `${radius}px`,
          /* Always a definite height, including when stacked. `flex-grow` distributes
             FREE space, and a column with `height: auto` has none to give, so the open
             panel could never open on a phone. Taller than the desktop row because a
             column has to fit the same photos one above another. */
          height: vertical
            ? `${Math.round(height * 1.6)}px`
            : stacked
              ? `${Math.round(height * 1.35)}px`
              : `${height}px`,
        } as React.CSSProperties
      }
    >
      {items.map((item, i) => {
        const isActive = i === active;
        const label = item.label ?? '';
        // Panels are controls, not links: activating one swaps which photo is open
        // rather than navigating. A real <button> gets keyboard and screen-reader
        // behaviour for free, where the original's tabIndex-ed <div> did not.
        return (
          <button
            key={item.image}
            type="button"
            ref={(el) => {
              panelRefs.current[i] = el;
            }}
            className={`ag-panel${isActive ? ' ag-panel--active' : ''}`}
            style={{ borderRadius: `${radius}px` }}
            onClick={(e) => handleClick(i, e)}
            onMouseEnter={() => handleEnter(i)}
            onFocus={() => setActive(i)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            aria-pressed={isActive}
            aria-label={label ? `Show photo: ${label}` : `Show photo ${i + 1} of ${count}`}
          >
            <span className="ag-panel__frame">
              <span
                className="ag-panel__media"
                ref={(el) => {
                  mediaRefs.current[i] = el;
                }}
              >
                {/* lazy + async: this island sits well below the fold, and five
                    full-size photographs fetched synchronously on hydration was the
                    single heaviest thing on the homepage after the JS. width/height let
                    the browser reserve the box rather than reflow when each one lands. */}
                <img
                  src={item.image}
                  srcSet={item.srcset}
                  sizes="(max-width: 768px) 100vw, 50vw"
                  width={item.width}
                  height={item.height}
                  alt={item.alt ?? label}
                  loading="lazy"
                  decoding="async"
                  draggable="false"
                />
              </span>
              <span className="ag-panel__overlay" aria-hidden="true" />
            </span>
            {showLabels && label && (
              <span className="ag-panel__label" aria-hidden="true">
                <span
                  className="ag-panel__bar"
                  ref={(el) => {
                    barRefs.current[i] = el;
                  }}
                />
                <span
                  className="ag-panel__text"
                  ref={(el) => {
                    textRefs.current[i] = el;
                  }}
                >
                  {label}
                </span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default AccordionGallery;
