/**
 * MobileModuleSheet — Liquid blob panel
 *
 * The pill/grip TRAVELS with the right edge of the panel as it grows:
 *   • Closed  → grip at left edge (x=0),  drag RIGHT to open
 *   • Opening → grip slides across to right edge as panel expands
 *   • Open    → grip at right edge of panel, drag LEFT or tap to close
 *
 * Two independent hit areas handle the two gestures so neither blocks content.
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion, useMotionValue, animate, AnimatePresence } from 'framer-motion';
import { Plus, ChevronRight, ChevronLeft } from 'lucide-react';
import { haptics } from '@/lib/haptics';
import { useSidebarPages } from '@/hooks/use-sidebar-pages';
import { ModuleType } from '@/lib/store';
import ModuleRenderer from '@/components/sidebar/ModuleRenderer';

const MODULE_OPTIONS: { type: ModuleType; label: string }[] = [
  { type: 'todo',       label: 'To-Do List' },
  { type: 'pomodoro',   label: 'Pomodoro Timer' },
  { type: 'alarms',     label: 'Alarms' },
  { type: 'reminders',  label: 'Reminders' },
  { type: 'eisenhower', label: 'Eisenhower Matrix' },
  { type: 'invites',    label: 'Invites' },
];

// ── Constants ─────────────────────────────────────────────────────────────────
const PANEL_RATIO = 0.82;
const OPEN_THRESH = 0.75;
const SMALL_W     = 18;    // pill width (px)
const SMALL_H     = 72;    // pill half-height → 144px total
const CORNER_R    = 22;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp  = (a: number, b: number, t: number)   => a + (b - a) * clamp(t, 0, 1);

// ── Shape math ────────────────────────────────────────────────────────────────
function computeShapes(x: number, panelW: number, sh: number) {
  const cy = sh / 2;
  const p  = clamp(x / (panelW * OPEN_THRESH), 0, 1);

  const yTop = lerp(cy - SMALL_H, 0,      p);
  const yBot = lerp(cy + SMALL_H, sh,     p);
  const w    = lerp(SMALL_W,      panelW, p);
  const h    = yBot - yTop;
  const r    = lerp(SMALL_W / 2,  CORNER_R, p);
  const cr   = Math.min(r, w * 0.499, h * 0.499);

  const fill = [
    `M 0 ${yTop}`,
    `L ${w - cr} ${yTop}`,
    `A ${cr} ${cr} 0 0 1 ${w} ${yTop + cr}`,
    `L ${w} ${yBot - cr}`,
    `A ${cr} ${cr} 0 0 1 ${w - cr} ${yBot}`,
    `L 0 ${yBot}`,
    `Z`,
  ].join(' ');

  const crT = Math.min(cr, (cy - yTop) * 0.999);
  const arcTop = [
    `M 0 ${cy}`,
    `L 0 ${yTop}`,
    `L ${w - crT} ${yTop}`,
    `A ${crT} ${crT} 0 0 1 ${w} ${yTop + crT}`,
    `L ${w} ${cy}`,
  ].join(' ');

  const crB = Math.min(cr, (yBot - cy) * 0.999);
  const arcBot = [
    `M 0 ${cy}`,
    `L 0 ${yBot}`,
    `L ${w - crB} ${yBot}`,
    `A ${crB} ${crB} 0 0 1 ${w} ${yBot - crB}`,
    `L ${w} ${cy}`,
  ].join(' ');

  // Grip X: moves from 0 (left edge) to panelW - SMALL_W (right edge flush)
  const gripX = lerp(0, panelW - SMALL_W, p);

  return { fill, arcTop, arcBot, p, gripX };
}

// ── Component ─────────────────────────────────────────────────────────────────
const MobileModuleSheet: React.FC = () => {
  const {
    pages, activePage, activePageId,
    setActivePageId, createPage,
    addModule, removeModule, updateModule,
  } = useSidebarPages();

  const panelWRef = useRef(window.innerWidth  * PANEL_RATIO);
  const shRef     = useRef(window.innerHeight);

  const [screenW, setScreenW] = useState(window.innerWidth);
  const [screenH, setScreenH] = useState(window.innerHeight);

  const dragX     = useMotionValue(0);
  const isOpenRef = useRef(false);
  const [isOpen,  setIsOpen]  = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const backdropRef = useRef<HTMLDivElement>(null);
  const panelRef    = useRef<HTMLDivElement>(null);
  const innerRef    = useRef<HTMLDivElement>(null);
  const topArcRef   = useRef<SVGPathElement>(null);
  const botArcRef   = useRef<SVGPathElement>(null);
  const gripRef     = useRef<SVGGElement>(null);

  // Drag tracking
  const dragStartX      = useRef(0);
  const dragStartedOpen = useRef(false);
  const wasDragging     = useRef(false);

  // ── Resize ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const update = () => {
      panelWRef.current = window.innerWidth * PANEL_RATIO;
      shRef.current     = window.innerHeight;
      setScreenW(window.innerWidth);
      setScreenH(window.innerHeight);
    };
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // ── Mount: set resting shapes ────────────────────────────────────────────────
  useEffect(() => {
    const { fill, arcTop, arcBot } = computeShapes(0, panelWRef.current, shRef.current);
    if (panelRef.current) {
      panelRef.current.style.clipPath = `path("${fill}")`;
      (panelRef.current.style as any).webkitClipPath = `path("${fill}")`;
    }
    topArcRef.current?.setAttribute('d', arcTop);
    botArcRef.current?.setAttribute('d', arcBot);
    if (topArcRef.current) topArcRef.current.style.opacity = '0';
    if (botArcRef.current) botArcRef.current.style.opacity = '0';
    gripRef.current?.setAttribute('transform', 'translate(0, 0)');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Animation subscription ───────────────────────────────────────────────────
  useEffect(() => {
    const unsub = dragX.on('change', (x) => {
      const { fill, arcTop, arcBot, p, gripX } = computeShapes(x, panelWRef.current, shRef.current);

      // Panel body
      if (panelRef.current) {
        panelRef.current.style.clipPath = `path("${fill}")`;
        (panelRef.current.style as any).webkitClipPath = `path("${fill}")`;
      }

      // Racing arcs
      topArcRef.current?.setAttribute('d', arcTop);
      botArcRef.current?.setAttribute('d', arcBot);
      const arcOp = p < 0.06 ? p / 0.06 : p > 0.88 ? Math.max(0, 1 - (p - 0.88) / 0.12) : 1;
      if (topArcRef.current) topArcRef.current.style.opacity = `${arcOp}`;
      if (botArcRef.current) botArcRef.current.style.opacity = `${arcOp}`;

      // Grip travels with right edge of panel
      gripRef.current?.setAttribute('transform', `translate(${gripX}, 0)`);
      if (gripRef.current) {
        // Glow intensifies when open (at right edge = clearly tappable)
        gripRef.current.style.opacity = p > 0.9 ? `${0.55 + (p - 0.9) * 4.5}` : '0.55';
      }

      // Content fade-in
      if (innerRef.current) {
        const op = p > 0.82 ? Math.min(1, (p - 0.82) / 0.18) : 0;
        innerRef.current.style.opacity = `${op}`;
        innerRef.current.style.pointerEvents = isOpenRef.current ? 'auto' : 'none';
      }

      // Backdrop
      if (backdropRef.current) {
        backdropRef.current.style.opacity = `${clamp(p * 0.5, 0, 0.5)}`;
        backdropRef.current.style.pointerEvents = p > 0.02 ? 'auto' : 'none';
      }
    });
    return () => unsub();
  }, [dragX]);

  // ── Open / Close ─────────────────────────────────────────────────────────────
  const openPanel = useCallback(() => {
    animate(dragX, panelWRef.current, {
      type: 'spring', stiffness: 210, damping: 14, mass: 1.15,
    });
    isOpenRef.current = true;
    setIsOpen(true);
    if (innerRef.current) innerRef.current.style.pointerEvents = 'auto';
    haptics.light();
  }, [dragX]);

  const closePanel = useCallback(() => {
    animate(dragX, 0, {
      type: 'spring', stiffness: 280, damping: 22, mass: 0.85,
    });
    isOpenRef.current = false;
    setIsOpen(false);
    if (innerRef.current) innerRef.current.style.pointerEvents = 'none';
    haptics.light();
  }, [dragX]);

  // ── Shared pointer handlers (used by both hit areas) ─────────────────────────
  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartX.current      = e.clientX;
    dragStartedOpen.current = isOpenRef.current;
    wasDragging.current     = false;
    if (!isOpenRef.current) haptics.selection();
  };

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const delta = e.clientX - dragStartX.current;
    if (Math.abs(delta) > 5) wasDragging.current = true;

    if (!dragStartedOpen.current) {
      // Opening: absolute x = how far panel is open
      dragX.set(clamp(e.clientX, 0, panelWRef.current * 1.08));
    } else {
      // Closing: absolute x dragged leftward from right edge
      // No amplification needed — starting from right side gives full travel range
      dragX.set(clamp(e.clientX, 0, panelWRef.current));
    }
  };

  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    e.currentTarget.releasePointerCapture(e.pointerId);

    if (!dragStartedOpen.current) {
      // Tap (no drag) OR dragged past threshold → open
      if (!wasDragging.current || dragX.get() >= panelWRef.current * OPEN_THRESH) {
        openPanel();
      } else {
        closePanel();
      }
    } else {
      // Tap on grip when open, OR dragged back past halfway → close
      if (!wasDragging.current || dragX.get() <= panelWRef.current * 0.5) {
        closePanel();
      } else {
        openPanel(); // snap back to open
      }
    }
  };

  const onCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
    dragStartedOpen.current ? openPanel() : closePanel();
  };

  // ── Page navigation ───────────────────────────────────────────────────────────
  const activeIdx = pages.findIndex((p) => p.id === activePageId);
  const safeIdx   = activeIdx >= 0 ? activeIdx : 0;
  const goToPrev  = () => { if (safeIdx > 0) { setActivePageId(pages[safeIdx - 1].id); haptics.selection(); } };
  const goToNext  = () => { if (safeIdx < pages.length - 1) { setActivePageId(pages[safeIdx + 1].id); haptics.selection(); } };

  const onPanEnd = (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
    if (info.offset.x < -100 || info.velocity.x < -500) {
      safeIdx === 0 ? closePanel() : goToNext();
    } else if (info.offset.x > 50 || info.velocity.x > 300) {
      goToPrev();
    } else if (info.offset.x < -50 || info.velocity.x < -300) {
      goToNext();
    }
  };

  const handleAdd = async (type: ModuleType) => {
    if (!activePageId) return;
    const label = MODULE_OPTIONS.find((m) => m.type === type)?.label ?? type;
    await addModule(activePageId, { type, title: label });
    setShowAdd(false);
    haptics.success();
  };

  const modules    = activePage?.modules ?? [];
  const panelWidth = screenW * PANEL_RATIO;
  const moduleW    = Math.min(panelWidth - 32, 340);
  const moduleH    = Math.max(200, screenH - 160);

  // Hit area vertical bounds (centered on pill)
  const hitTop    = screenH / 2 - SMALL_H - 24;
  const hitHeight = SMALL_H * 2 + 48;

  // Pill shape drawn at x=0 in local coords; group is translated each frame
  const blobCy  = screenH / 2;
  const pillCr  = SMALL_W / 2;
  const pillPath = [
    `M 0 ${blobCy - SMALL_H}`,
    `L ${SMALL_W - pillCr} ${blobCy - SMALL_H}`,
    `A ${pillCr} ${pillCr} 0 0 1 ${SMALL_W} ${blobCy - SMALL_H + pillCr}`,
    `L ${SMALL_W} ${blobCy + SMALL_H - pillCr}`,
    `A ${pillCr} ${pillCr} 0 0 1 ${SMALL_W - pillCr} ${blobCy + SMALL_H}`,
    `L 0 ${blobCy + SMALL_H}`,
    `Z`,
  ].join(' ');

  return (
    <div className="absolute inset-0 z-30" style={{ pointerEvents: 'none' }}>

      {/* Backdrop */}
      <div
        ref={backdropRef}
        className="absolute inset-0"
        style={{ opacity: 0, background: 'black', pointerEvents: 'none' }}
        onClick={closePanel}
      />

      {/* Frosted glass panel body */}
      <div
        ref={panelRef}
        className="absolute inset-0"
        style={{
          background:           'hsl(var(--card) / 0.95)',
          backdropFilter:       'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          boxShadow:            '8px 0 64px rgba(0,0,0,0.3)',
          clipPath:             'path("M 0 0 Z")',
          pointerEvents:        'none',
          zIndex:               1,
        }}
      />

      {/* SVG: racing arcs + travelling grip pill */}
      <svg
        className="absolute inset-0 pointer-events-none"
        width={screenW}
        height={screenH}
        style={{ zIndex: 2, overflow: 'visible' }}
      >
        <defs>
          <filter id="arc-glow" x="-60%" y="-40%" width="220%" height="180%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="pill-glow" x="-120%" y="-30%" width="340%" height="160%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="pill-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="hsl(var(--primary))" stopOpacity="0.6" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
          </linearGradient>
        </defs>

        {/* Racing arc top */}
        <path ref={topArcRef} fill="none" stroke="hsl(var(--primary))" strokeWidth={2.5}
          strokeLinecap="round" strokeLinejoin="round"
          style={{ filter: 'url(#arc-glow)', opacity: 0 }} />
        {/* Racing arc bottom */}
        <path ref={botArcRef} fill="none" stroke="hsl(var(--primary))" strokeWidth={2.5}
          strokeLinecap="round" strokeLinejoin="round"
          style={{ filter: 'url(#arc-glow)', opacity: 0 }} />

        {/* Grip pill — translates from left edge (closed) → right edge (open) */}
        <g ref={gripRef} style={{ filter: 'url(#pill-glow)', opacity: 0.55 }}>
          <path d={pillPath} fill="hsl(var(--primary) / 0.12)" stroke="none" />
          <path d={pillPath} fill="url(#pill-grad)" stroke="hsl(var(--primary) / 0.7)" strokeWidth="1.5" />
          {[-10, 0, 10].map((dy) => (
            <circle key={dy} cx={SMALL_W / 2} cy={blobCy + dy} r={1.8} fill="hsl(var(--primary) / 0.9)" />
          ))}
        </g>
      </svg>

      {/* Content layer */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 3 }}>
        <div
          className="absolute top-0 left-0 bottom-0 flex flex-col overflow-hidden"
          style={{ width: panelWidth }}
        >
          <div ref={innerRef} className="flex h-full flex-col" style={{ opacity: 0, pointerEvents: 'none' }}>

            {/* Header */}
            <div
              className="flex items-center justify-between px-4 pb-2"
              style={{ paddingTop: 'max(48px, calc(env(safe-area-inset-top) + 12px))' }}
            >
              <button onClick={goToPrev} disabled={safeIdx <= 0}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-background/80 disabled:opacity-30">
                <ChevronLeft size={18} />
              </button>
              <div className="min-w-0 flex-1 px-3 text-center">
                <div className="truncate text-sm font-semibold">{activePage?.title ?? 'Modules'}</div>
                <div className="text-[11px] text-muted-foreground">
                  Page {safeIdx + 1} of {Math.max(pages.length, 1)}
                </div>
              </div>
              <button onClick={goToNext} disabled={safeIdx >= pages.length - 1}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-background/80 disabled:opacity-30">
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Modules */}
            <motion.div className="min-h-0 flex-1 overflow-hidden px-3" onPanEnd={onPanEnd}>
              <AnimatePresence mode="wait">
                <motion.div key={activePageId}
                  initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.18 }}
                  className="h-full"
                >
                  {modules.length === 0 ? (
                    <div className="flex h-full items-center justify-center px-6 pb-8 text-center text-sm text-muted-foreground">
                      Add a module to get started.
                    </div>
                  ) : (
                    <div className="h-full overflow-y-auto overscroll-y-contain pb-4 snap-y snap-mandatory"
                      style={{ WebkitOverflowScrolling: 'touch' }}>
                      {modules.map((mod, idx) => (
                        <div key={mod.id} className="snap-start flex items-start justify-center"
                          style={{ minHeight: `${moduleH}px` }}>
                          <div style={{ width: `${moduleW}px`, maxWidth: '100%' }}>
                            <ModuleRenderer module={mod} index={idx} moduleWidth={moduleW}
                              onRemove={() => activePageId && removeModule(activePageId, idx)}
                              onTitleChange={(t) => activePageId && updateModule(activePageId, idx, { title: t })}
                              onToggleMinimize={() => undefined} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </motion.div>

            {/* Add Module */}
            <div className="flex justify-center px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-2">
              <button onClick={() => { setShowAdd(true); haptics.light(); }}
                className="flex items-center gap-1.5 rounded-full border border-border/70 bg-background/80 px-4 py-2 text-xs font-medium shadow-sm">
                <Plus size={14} />
                Add Module
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Add Module picker */}
      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-end bg-black/40"
            style={{ pointerEvents: 'auto' }} onClick={() => setShowAdd(false)}>
            <motion.div initial={{ y: 200 }} animate={{ y: 0 }} exit={{ y: 200 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full rounded-t-2xl bg-background p-4 pb-[env(safe-area-inset-bottom)]"
              onClick={(e) => e.stopPropagation()}>
              <h3 className="mb-3 text-sm font-semibold">Add Module</h3>
              <div className="grid grid-cols-2 gap-2">
                {MODULE_OPTIONS.map((opt) => (
                  <button key={opt.type} onClick={() => handleAdd(opt.type)}
                    className="rounded-lg bg-muted p-3 text-sm font-medium transition hover:bg-muted/80 active:scale-95">
                    {opt.label}
                  </button>
                ))}
              </div>
              <button onClick={async () => { await createPage('New Page'); setShowAdd(false); haptics.success(); }}
                className="mt-3 w-full text-center text-xs text-muted-foreground underline">
                + New Page
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/*
        LEFT hit area — opening gesture (drag right or tap to open).
        Active only when panel is closed.
      */}
      <div
        style={{
          position:      'absolute',
          left:          0,
          top:           hitTop,
          height:        hitHeight,
          width:         44,
          pointerEvents: isOpen ? 'none' : 'auto',
          zIndex:        40,
          touchAction:   'none',
          cursor:        'grab',
        }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onCancel}
      />

      {/*
        RIGHT hit area — closing gesture (drag left or tap to close).
        Positioned at the right edge of the panel where the grip lands.
        Active only when panel is open.
      */}
      <div
        style={{
          position:      'absolute',
          left:          panelWidth - SMALL_W - 14,
          top:           hitTop,
          height:        hitHeight,
          width:         SMALL_W + 28,
          pointerEvents: isOpen ? 'auto' : 'none',
          zIndex:        40,
          touchAction:   'none',
          cursor:        'pointer',
        }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onCancel}
      />
    </div>
  );
};

export default MobileModuleSheet;
