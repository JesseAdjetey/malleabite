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
 * Screenshots needed:
 *   remotion/public/sidebar-base.png
 *     → App with sidebar open, 3–4 modules visible, + button visible
 *
 * POSITION TUNING:
 *   Adjust POSITIONS below once you've added the screenshot and opened the studio.
 */

const POSITIONS = {
  // The + add module button in the sidebar
  addBtn: { x: 260, y: 200 },
  // Where the new module pill appears (top-left of the slot it slides into)
  newModuleSlot: { x: 20, y: 560, width: 280, height: 52 },
  // The drag handle / pill at the bottom of the sidebar (to expand to 2 rows)
  dragPill: { x: 140, y: 780 },
  // Second row position the sidebar expands to
  expandedBottom: { x: 140, y: 920 },
  // A module pill to drag for reordering
  reorderFrom: { x: 60, y: 300 },
  reorderTo: { x: 60, y: 460 },
  // Sidebar panel bounds (for the glow ring effect)
  sidebar: { x: 8, y: 130, width: 300, height: 700 },
};

const PURPLE = "#8B5CF6";
const PURPLE_DIM = "#6D28D9";
const BG = "#0f0d16";
const SURFACE2 = "#221e31";
const BORDER = "rgba(255,255,255,0.08)";
const TEXT = "#f8f8f8";
const MUTED = "#9ca3af";
const FONT = '"ui-monospace","Cascadia Code","Fira Mono",monospace';

// Timing
const SCREENSHOT_IN = 0;
const ADD_BTN_HIGHLIGHT = 25;    // 0.8s
const MODULE_SLIDE_IN = 60;      // 2s
const PAUSE_1 = 110;             // 3.6s
const CURSOR_TO_PILL = 130;      // 4.3s
const DRAG_DOWN = 170;           // 5.6s
const EXPAND_DONE = 230;         // 7.6s — sidebar now shows 2 rows
const PAUSE_2 = 270;             // 9s
const REORDER_START = 300;       // 10s
const REORDER_DONE = 420;        // 14s
const TAGLINE_IN = 490;          // 16.3s

export const SidebarRules = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const screenshotOpacity = interpolate(frame, [SCREENSHOT_IN, SCREENSHOT_IN + 20], [0, 1], {
    extrapolateRight: "clamp", extrapolateLeft: "clamp",
  });

  // + button ring glow
  const addBtnGlow = interpolate(frame, [ADD_BTN_HIGHLIGHT, ADD_BTN_HIGHLIGHT + 15, MODULE_SLIDE_IN + 20, MODULE_SLIDE_IN + 35], [0, 1, 1, 0], {
    extrapolateRight: "clamp", extrapolateLeft: "clamp",
  });

  // New module slides in from above
  const newModuleY = interpolate(frame, [MODULE_SLIDE_IN, MODULE_SLIDE_IN + 25], [-60, 0], {
    extrapolateRight: "clamp", extrapolateLeft: "clamp",
    easing: Easing.out(Easing.quad),
  });
  const newModuleOpacity = interpolate(frame, [MODULE_SLIDE_IN, MODULE_SLIDE_IN + 15], [0, 1], {
    extrapolateRight: "clamp", extrapolateLeft: "clamp",
  });
  const showNewModule = frame >= MODULE_SLIDE_IN;

  // Cursor moves to + btn then down to pill
  const cursorX = interpolate(
    frame,
    [20, 30, ADD_BTN_HIGHLIGHT, CURSOR_TO_PILL, DRAG_DOWN, REORDER_START, REORDER_START + 20, REORDER_DONE - 20],
    [
      POSITIONS.addBtn.x + 80, POSITIONS.addBtn.x, POSITIONS.addBtn.x,
      POSITIONS.dragPill.x, POSITIONS.expandedBottom.x,
      POSITIONS.reorderFrom.x, POSITIONS.reorderFrom.x, POSITIONS.reorderTo.x,
    ],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp", easing: Easing.inOut(Easing.quad) }
  );
  const cursorY = interpolate(
    frame,
    [20, 30, ADD_BTN_HIGHLIGHT, CURSOR_TO_PILL, DRAG_DOWN, REORDER_START, REORDER_START + 20, REORDER_DONE - 20],
    [
      POSITIONS.addBtn.y + 60, POSITIONS.addBtn.y, POSITIONS.addBtn.y,
      POSITIONS.dragPill.y, POSITIONS.expandedBottom.y,
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

  const isGrabbing = frame >= CURSOR_TO_PILL && frame < EXPAND_DONE + 10
    || frame >= REORDER_START + 10 && frame < REORDER_DONE;

  // Dragged module pill during reorder
  const dragProgress = interpolate(frame, [REORDER_START + 20, REORDER_DONE - 20], [0, 1], {
    extrapolateRight: "clamp", extrapolateLeft: "clamp",
    easing: Easing.inOut(Easing.quad),
  });
  const draggedPillY = interpolate(dragProgress, [0, 1], [POSITIONS.reorderFrom.y, POSITIONS.reorderTo.y]);
  const draggedPillOpacity = interpolate(frame, [REORDER_START, REORDER_START + 10, REORDER_DONE - 10, REORDER_DONE], [0, 0.9, 0.9, 0], {
    extrapolateRight: "clamp", extrapolateLeft: "clamp",
  });
  const showDraggedPill = frame >= REORDER_START;

  const taglineOpacity = interpolate(frame, [TAGLINE_IN, TAGLINE_IN + 25], [0, 1], {
    extrapolateRight: "clamp", extrapolateLeft: "clamp",
  });
  const mainOpacity = interpolate(frame, [TAGLINE_IN - 10, TAGLINE_IN + 10], [1, 0], {
    extrapolateRight: "clamp", extrapolateLeft: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: BG, fontFamily: FONT }}>

      <div style={{ opacity: mainOpacity }}>
        {/* Screenshot */}
        <Img
          src={staticFile("sidebar-base.png")}
          style={{ width: 1920, height: 1080, objectFit: "cover", opacity: screenshotOpacity }}
        />

        {/* + button highlight ring */}
        <div style={{
          position: "absolute",
          left: POSITIONS.addBtn.x - 18,
          top: POSITIONS.addBtn.y - 18,
          width: 36,
          height: 36,
          borderRadius: "50%",
          border: `2px solid rgba(139,92,246,${addBtnGlow})`,
          boxShadow: `0 0 ${16 * addBtnGlow}px rgba(139,92,246,${addBtnGlow * 0.6})`,
          opacity: addBtnGlow,
          pointerEvents: "none",
        }} />

        {/* New module pill */}
        {showNewModule && (
          <div style={{
            position: "absolute",
            left: POSITIONS.newModuleSlot.x,
            top: POSITIONS.newModuleSlot.y + newModuleY,
            width: POSITIONS.newModuleSlot.width,
            height: POSITIONS.newModuleSlot.height,
            opacity: newModuleOpacity,
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: SURFACE2,
            border: `1px solid rgba(139,92,246,0.5)`,
            borderRadius: 12,
            padding: "0 14px",
            boxShadow: `0 0 16px rgba(139,92,246,0.25)`,
          }}>
            <span style={{ fontSize: 18 }}>⊞</span>
            <span style={{ color: TEXT, fontFamily: FONT, fontSize: 18, fontWeight: 600 }}>Eisenhower</span>
            <div style={{ marginLeft: "auto", width: 6, height: 6, borderRadius: "50%", background: "#10b981" }} />
          </div>
        )}

        {/* Dragged module ghost during reorder */}
        {showDraggedPill && (
          <div style={{
            position: "absolute",
            left: POSITIONS.reorderFrom.x,
            top: draggedPillY,
            width: POSITIONS.newModuleSlot.width,
            height: POSITIONS.newModuleSlot.height,
            opacity: draggedPillOpacity,
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: SURFACE2,
            border: `1px solid rgba(139,92,246,0.6)`,
            borderRadius: 12,
            padding: "0 14px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
            transform: "scale(1.03)",
          }}>
            <span style={{ fontSize: 18 }}>✓</span>
            <span style={{ color: TEXT, fontFamily: FONT, fontSize: 18, fontWeight: 600 }}>To-Do</span>
          </div>
        )}

        {/* Cursor */}
        <div style={{ position: "absolute", left: cursorX, top: cursorY, opacity: cursorOpacity, pointerEvents: "none", zIndex: 30 }}>
          <CursorSVG grabbed={isGrabbing} />
        </div>
      </div>

      {/* Tagline outro */}
      <Sequence from={TAGLINE_IN} premountFor={fps}>
        <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center", background: BG }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28, opacity: taglineOpacity }}>
            <AppLogo />
            <div style={{ textAlign: "center" }}>
              <div style={{ color: TEXT, fontSize: 64, fontFamily: FONT, fontWeight: 700, lineHeight: 1.2, letterSpacing: "-1px" }}>
                Your sidebar,<br />
                <span style={{ color: PURPLE }}>your rules.</span>
              </div>
            </div>
            <span style={{ color: MUTED, fontSize: 28, fontFamily: FONT, letterSpacing: "0.04em" }}>malleabite.app</span>
          </div>
        </AbsoluteFill>
      </Sequence>

    </AbsoluteFill>
  );
};

function CursorSVG({ grabbed }: { grabbed: boolean }) {
  return (
    <svg width="28" height="28" viewBox="0 0 20 20" fill={grabbed ? PURPLE : "white"} style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.7))" }}>
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
      boxShadow: `0 0 48px rgba(139,92,246,0.5)`,
    }}>
      <span style={{ color: "#fff", fontSize: 40, fontWeight: 700, fontFamily: FONT }}>M</span>
    </div>
  );
}

const PURPLE_VAR = PURPLE;
