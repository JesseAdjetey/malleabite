import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  Sequence,
  Easing,
} from "remotion";

/**
 * SidebarRules — 22s clip
 *
 * Screenshots:
 *   public/sidebar-base.png  (12-42-00.png) — Pomodoro + ToDo + School
 *   public/sidebar-after.png (12-42-36.png) — Countdown + Pomodoro + ToDo + School
 *
 * Source: 3024×1964 → rendered 1920×1080 (objectFit: cover)
 * Scale: 0.6349×, vertical crop: 131.5px top & bottom of original.
 *
 * POSITION TUNING:
 *   Open `npm run dev` and adjust POSITIONS below.
 *   Coordinates are in 1920×1080 render-space.
 *
 *   render_x = orig_x * 0.6349
 *   render_y = (orig_y - 131.5) * 0.6349
 */

// ─── Design tokens ────────────────────────────────────────────────────────────
const PURPLE     = "#8B5CF6";
const PURPLE_DIM = "#6D28D9";
const BG         = "#0f0d16";
const SURFACE2   = "#1e1a2e";
const TEXT       = "#f8f8f8";
const MUTED      = "#9ca3af";
const FONT       = '"ui-sans-serif","Inter","system-ui",sans-serif';
const MONO       = '"ui-monospace","Cascadia Code","Fira Mono",monospace';

// ─── Positions (tune in studio) ───────────────────────────────────────────────
const POSITIONS = {
  // "+ Add" button (barely visible at top of sidebar)
  addBtn:        { x: 135, y: 16 },
  // New module pill slides in from above — matches where Countdown appears in sidebar-after.png
  newModuleSlot: { x: 8, y: 44, width: 290, height: 54 },
  // Drag handle pill to resize sidebar (bottom of left panel)
  dragPill:      { x: 148, y: 760 },
  expandedBottom:{ x: 148, y: 900 },
  // Module drag-to-reorder: grab Pomodoro row, move it down past ToDo
  reorderFrom:   { x: 55, y: 190 },
  reorderTo:     { x: 55, y: 490 },
  // Sidebar panel bounds (for glow effect)
  sidebar:       { x: 6, y: 30, width: 305, height: 960 },
};

// ─── Timing (frames @ 30fps) ──────────────────────────────────────────────────
const SCREENSHOT_IN     = 0;
const ADD_BTN_HIGHLIGHT = 25;   // 0.8s  — ring glows on +Add btn
const MODULE_SLIDE_IN   = 62;   // 2.1s  — new module pill slides in
const CROSSFADE_START   = 100;  // 3.3s  — crossfade to sidebar-after.png
const CROSSFADE_DONE    = 125;  // 4.2s
const PAUSE_1           = 145;  // 4.8s
const CURSOR_TO_PILL    = 165;  // 5.5s
const DRAG_DOWN         = 210;  // 7s    — drag pill down (expand)
const EXPAND_DONE       = 270;  // 9s
const PAUSE_2           = 295;  // 9.8s
const REORDER_START     = 320;  // 10.7s
const REORDER_DONE      = 430;  // 14.3s
const TAGLINE_IN        = 500;  // 16.7s

export const SidebarRules = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const screenshotOpacity = interpolate(frame, [SCREENSHOT_IN, SCREENSHOT_IN + 22], [0, 1], {
    extrapolateRight: "clamp", extrapolateLeft: "clamp",
  });

  // ── Crossfade: base → after (commits the new module) ──────────────────────
  const afterOpacity = interpolate(frame, [CROSSFADE_START, CROSSFADE_DONE], [0, 1], {
    extrapolateRight: "clamp", extrapolateLeft: "clamp",
    easing: Easing.inOut(Easing.quad),
  });

  // ── + button ring glow ────────────────────────────────────────────────────
  const addBtnGlow = interpolate(
    frame,
    [ADD_BTN_HIGHLIGHT, ADD_BTN_HIGHLIGHT + 18, MODULE_SLIDE_IN + 20, MODULE_SLIDE_IN + 35],
    [0, 1, 1, 0],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );

  // ── New module pill slides in from above ──────────────────────────────────
  const newModuleOffsetY = interpolate(
    frame,
    [MODULE_SLIDE_IN, MODULE_SLIDE_IN + 26],
    [-65, 0],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp", easing: Easing.out(Easing.back(1.2)) }
  );
  const newModuleOpacity = interpolate(
    frame,
    [MODULE_SLIDE_IN, MODULE_SLIDE_IN + 14, CROSSFADE_START - 5, CROSSFADE_START + 5],
    [0, 1, 1, 0],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const showNewModule = frame >= MODULE_SLIDE_IN && frame < CROSSFADE_START + 5;

  // ── Cursor path ─────────────────────────────────────────────────────────
  const cursorX = interpolate(
    frame,
    [20, 30, ADD_BTN_HIGHLIGHT, CURSOR_TO_PILL, DRAG_DOWN, REORDER_START, REORDER_START + 22, REORDER_DONE - 20],
    [
      POSITIONS.addBtn.x + 90, POSITIONS.addBtn.x, POSITIONS.addBtn.x,
      POSITIONS.dragPill.x,    POSITIONS.expandedBottom.x,
      POSITIONS.reorderFrom.x, POSITIONS.reorderFrom.x, POSITIONS.reorderTo.x,
    ],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp", easing: Easing.inOut(Easing.quad) }
  );
  const cursorY = interpolate(
    frame,
    [20, 30, ADD_BTN_HIGHLIGHT, CURSOR_TO_PILL, DRAG_DOWN, REORDER_START, REORDER_START + 22, REORDER_DONE - 20],
    [
      POSITIONS.addBtn.y + 55, POSITIONS.addBtn.y, POSITIONS.addBtn.y,
      POSITIONS.dragPill.y,    POSITIONS.expandedBottom.y,
      POSITIONS.reorderFrom.y, POSITIONS.reorderFrom.y, POSITIONS.reorderTo.y,
    ],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp", easing: Easing.inOut(Easing.quad) }
  );
  const cursorOpacity = interpolate(
    frame,
    [15, 25, TAGLINE_IN - 20, TAGLINE_IN - 5],
    [0, 1, 1, 0],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const isGrabbing =
    (frame >= CURSOR_TO_PILL && frame < EXPAND_DONE + 10) ||
    (frame >= REORDER_START + 12 && frame < REORDER_DONE);

  // ── Dragged module ghost (reorder) ────────────────────────────────────────
  const dragProgress = interpolate(frame, [REORDER_START + 22, REORDER_DONE - 20], [0, 1], {
    extrapolateRight: "clamp", extrapolateLeft: "clamp",
    easing: Easing.inOut(Easing.quad),
  });
  const draggedPillY      = interpolate(dragProgress, [0, 1], [POSITIONS.reorderFrom.y, POSITIONS.reorderTo.y]);
  const draggedPillOpacity = interpolate(
    frame,
    [REORDER_START, REORDER_START + 10, REORDER_DONE - 10, REORDER_DONE],
    [0, 0.92, 0.92, 0],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );

  // ── Label popups ──────────────────────────────────────────────────────────
  const addLabelOpacity = interpolate(
    frame,
    [ADD_BTN_HIGHLIGHT - 5, ADD_BTN_HIGHLIGHT + 8, MODULE_SLIDE_IN - 5, MODULE_SLIDE_IN],
    [0, 1, 1, 0],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const reorderLabelOpacity = interpolate(
    frame,
    [REORDER_START - 5, REORDER_START + 10, REORDER_DONE + 10, REORDER_DONE + 25],
    [0, 1, 1, 0],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );

  // ── Tagline ───────────────────────────────────────────────────────────────
  const taglineOpacity = interpolate(frame, [TAGLINE_IN, TAGLINE_IN + 25], [0, 1], {
    extrapolateRight: "clamp", extrapolateLeft: "clamp",
  });
  const mainOpacity = interpolate(frame, [TAGLINE_IN - 10, TAGLINE_IN + 10], [1, 0], {
    extrapolateRight: "clamp", extrapolateLeft: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: BG, fontFamily: FONT }}>

      <div style={{ opacity: mainOpacity }}>

        {/* ── Base screenshot (before adding module) ── */}
        <Img
          src={staticFile("sidebar-base.png")}
          style={{ position: "absolute", width: 1920, height: 1080, objectFit: "cover", opacity: screenshotOpacity }}
        />

        {/* ── After screenshot (Countdown module now at top) ── */}
        <Img
          src={staticFile("sidebar-after.png")}
          style={{
            position: "absolute", width: 1920, height: 1080, objectFit: "cover",
            opacity: interpolate(screenshotOpacity, [0, 1], [0, afterOpacity]),
          }}
        />

        {/* ── + Add button glow ring ── */}
        <div style={{
          position: "absolute",
          left:   POSITIONS.addBtn.x - 20,
          top:    POSITIONS.addBtn.y - 20,
          width:  40, height: 40,
          borderRadius: "50%",
          border: `2px solid rgba(139,92,246,${addBtnGlow})`,
          boxShadow: `0 0 ${18 * addBtnGlow}px rgba(139,92,246,${addBtnGlow * 0.6})`,
          opacity: addBtnGlow,
          pointerEvents: "none",
        }} />

        {/* ── "Add module" label ── */}
        {addLabelOpacity > 0.05 && (
          <div style={{
            position: "absolute",
            left: POSITIONS.addBtn.x + 24,
            top:  POSITIONS.addBtn.y - 14,
            background: "rgba(26,22,46,0.92)",
            border: "1px solid rgba(139,92,246,0.4)",
            borderRadius: 8,
            padding: "5px 12px",
            opacity: addLabelOpacity,
            pointerEvents: "none",
          }}>
            <span style={{ color: TEXT, fontSize: 14, fontFamily: FONT, whiteSpace: "nowrap" }}>
              Add module
            </span>
          </div>
        )}

        {/* ── New module pill sliding in ── */}
        {showNewModule && (
          <div style={{
            position: "absolute",
            left:  POSITIONS.newModuleSlot.x,
            top:   POSITIONS.newModuleSlot.y + newModuleOffsetY,
            width: POSITIONS.newModuleSlot.width,
            height: POSITIONS.newModuleSlot.height,
            opacity: newModuleOpacity,
            display: "flex", alignItems: "center", gap: 11,
            background: SURFACE2,
            border: "1.5px solid rgba(139,92,246,0.55)",
            borderRadius: 12,
            padding: "0 16px",
            boxShadow: "0 0 20px rgba(139,92,246,0.28)",
          }}>
            <span style={{ fontSize: 18 }}>⏱</span>
            <span style={{ color: TEXT, fontFamily: FONT, fontSize: 17, fontWeight: 600 }}>Countdown</span>
            <div style={{ marginLeft: "auto", width: 7, height: 7, borderRadius: "50%", background: "#10b981" }} />
          </div>
        )}

        {/* ── Dragged module ghost (reorder) ── */}
        {draggedPillOpacity > 0.02 && (
          <div style={{
            position: "absolute",
            left: POSITIONS.reorderFrom.x - 10,
            top:  draggedPillY,
            width: POSITIONS.newModuleSlot.width + 10,
            height: POSITIONS.newModuleSlot.height,
            opacity: draggedPillOpacity,
            display: "flex", alignItems: "center", gap: 11,
            background: SURFACE2,
            border: "1.5px solid rgba(139,92,246,0.65)",
            borderRadius: 12,
            padding: "0 16px",
            boxShadow: "0 10px 28px rgba(0,0,0,0.55)",
            transform: "scale(1.03)",
            pointerEvents: "none",
            zIndex: 20,
          }}>
            <span style={{ fontSize: 18 }}>🍅</span>
            <span style={{ color: TEXT, fontFamily: FONT, fontSize: 17, fontWeight: 600 }}>Pomodoro</span>
          </div>
        )}

        {/* ── Reorder label ── */}
        {reorderLabelOpacity > 0.05 && (
          <div style={{
            position: "absolute",
            left: POSITIONS.reorderFrom.x + POSITIONS.newModuleSlot.width + 14,
            top:  (POSITIONS.reorderFrom.y + POSITIONS.reorderTo.y) / 2 - 16,
            background: "rgba(26,22,46,0.92)",
            border: "1px solid rgba(139,92,246,0.4)",
            borderRadius: 8,
            padding: "5px 12px",
            opacity: reorderLabelOpacity,
            pointerEvents: "none",
          }}>
            <span style={{ color: TEXT, fontSize: 14, fontFamily: FONT, whiteSpace: "nowrap" }}>
              Drag to reorder
            </span>
          </div>
        )}

        {/* ── Cursor ── */}
        <div style={{
          position: "absolute", left: cursorX, top: cursorY,
          opacity: cursorOpacity, pointerEvents: "none", zIndex: 30,
        }}>
          <CursorSVG grabbed={isGrabbing} />
        </div>

      </div>

      {/* ── Tagline outro ── */}
      <Sequence from={TAGLINE_IN} premountFor={fps}>
        <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center", background: BG }}>
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            gap: 28, opacity: taglineOpacity,
          }}>
            <AppLogo />
            <div style={{ textAlign: "center" }}>
              <div style={{
                color: TEXT, fontSize: 66, fontFamily: FONT, fontWeight: 700,
                lineHeight: 1.18, letterSpacing: "-1.5px",
              }}>
                Your sidebar,<br />
                <span style={{ color: PURPLE }}>your rules.</span>
              </div>
            </div>
            <span style={{ color: MUTED, fontSize: 28, fontFamily: FONT, letterSpacing: "0.04em" }}>
              malleabite.app
            </span>
          </div>
        </AbsoluteFill>
      </Sequence>

    </AbsoluteFill>
  );
};

function CursorSVG({ grabbed }: { grabbed: boolean }) {
  return (
    <svg width="28" height="28" viewBox="0 0 20 20"
      fill={grabbed ? PURPLE : "white"}
      style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.75))" }}>
      <path d="M3 0 L3 15 L6 12 L8.5 17.5 L10.5 16.5 L8 11 L12 11 Z" />
    </svg>
  );
}

function AppLogo() {
  return (
    <div style={{
      width: 80, height: 80, borderRadius: 20,
      background: `linear-gradient(135deg, ${PURPLE}, ${PURPLE_DIM})`,
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: "0 0 56px rgba(139,92,246,0.55)",
    }}>
      <span style={{ color: "#fff", fontSize: 42, fontWeight: 700, fontFamily: MONO }}>M</span>
    </div>
  );
}
