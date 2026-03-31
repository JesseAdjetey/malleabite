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
 * TodoDrag — 16s clip
 *
 * Screenshot needed: remotion/public/todo-drag-base.png
 *   → App with todo module visible on the left, calendar visible on the right,
 *     a few todo items listed, at least one empty time slot on the calendar
 *
 * POSITION TUNING:
 *   Adjust POSITIONS below to match the actual element locations in your screenshot.
 */

const POSITIONS = {
  // The todo item we're dragging (top-left corner of the row)
  todoItem: { x: 60, y: 430, width: 340, height: 48 },
  // The calendar drop target slot (e.g. 2:00 PM slot)
  calendarSlot: { x: 900, y: 560, width: 280, height: 80 },
  // Cursor path: starts near the todo item, ends at the calendar slot
  cursor: { startX: 90, startY: 450, endX: 1020, endY: 580 },
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
const CURSOR_APPEAR = 20;    // 0.6s — cursor drifts over todo item
const PICKUP = 60;           // 2s   — drag starts
const DRAG_END = 200;        // 6.6s — cursor arrives at calendar slot
const DROP = 205;            // 6.8s — drop: todo ghost disappears, event pops in
const HOLD = 360;            // 12s  — hold on the result
const TAGLINE_IN = 380;      // 12.6s

export const TodoDrag = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const screenshotOpacity = interpolate(frame, [SCREENSHOT_IN, SCREENSHOT_IN + 20], [0, 1], {
    extrapolateRight: "clamp", extrapolateLeft: "clamp",
  });

  const isDragging = frame >= PICKUP && frame < DROP;

  // Cursor
  const cursorX = interpolate(
    frame,
    [CURSOR_APPEAR, PICKUP, DRAG_END],
    [POSITIONS.cursor.startX - 30, POSITIONS.cursor.startX, POSITIONS.cursor.endX],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp", easing: Easing.inOut(Easing.quad) }
  );
  const cursorY = interpolate(
    frame,
    [CURSOR_APPEAR, PICKUP, DRAG_END],
    [POSITIONS.cursor.startY + 10, POSITIONS.cursor.startY, POSITIONS.cursor.endY],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp", easing: Easing.inOut(Easing.quad) }
  );
  const cursorOpacity = interpolate(
    frame,
    [CURSOR_APPEAR - 5, CURSOR_APPEAR, DROP + 30, DROP + 50],
    [0, 1, 1, 0],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );

  // Drag progress (0 → 1)
  const dragProgress = interpolate(frame, [PICKUP, DRAG_END], [0, 1], {
    extrapolateRight: "clamp", extrapolateLeft: "clamp",
    easing: Easing.inOut(Easing.quad),
  });

  // Dragged ghost pill position
  const ghostX = interpolate(dragProgress, [0, 1], [POSITIONS.todoItem.x, POSITIONS.calendarSlot.x - 20]);
  const ghostY = interpolate(dragProgress, [0, 1], [POSITIONS.todoItem.y, POSITIONS.calendarSlot.y + 10]);
  const ghostOpacity = isDragging ? 0.9 : 0;
  const ghostScale = interpolate(frame, [PICKUP, PICKUP + 8, DRAG_END - 5, DRAG_END], [1, 1.04, 1.04, 0.95]);

  // Original todo item dims while being dragged
  const dimOverlayOpacity = interpolate(frame, [PICKUP, PICKUP + 10, DROP, DROP + 5], [0, 0.5, 0.5, 0], {
    extrapolateRight: "clamp", extrapolateLeft: "clamp",
  });

  // Calendar slot glow on hover
  const slotGlow = interpolate(
    frame,
    [PICKUP + 60, PICKUP + 90, DRAG_END - 10, DROP],
    [0, 0.7, 0.7, 0],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );

  // New event pop
  const eventScale = spring({ frame: frame - DROP, fps, config: { damping: 14, stiffness: 230 } });
  const eventOpacity = interpolate(frame, [DROP, DROP + 8], [0, 1], {
    extrapolateRight: "clamp", extrapolateLeft: "clamp",
  });
  const showEvent = frame >= DROP;

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
          src={staticFile("todo-drag-base.png")}
          style={{ width: 1920, height: 1080, objectFit: "cover", opacity: screenshotOpacity }}
        />

        {/* Dim overlay over the original todo item during drag */}
        <div style={{
          position: "absolute",
          left: POSITIONS.todoItem.x,
          top: POSITIONS.todoItem.y,
          width: POSITIONS.todoItem.width,
          height: POSITIONS.todoItem.height,
          background: `rgba(15,13,22,${dimOverlayOpacity})`,
          borderRadius: 8,
          pointerEvents: "none",
        }} />

        {/* Calendar slot drop target glow */}
        <div style={{
          position: "absolute",
          left: POSITIONS.calendarSlot.x,
          top: POSITIONS.calendarSlot.y,
          width: POSITIONS.calendarSlot.width,
          height: POSITIONS.calendarSlot.height,
          borderRadius: 10,
          background: `rgba(139,92,246,${slotGlow * 0.15})`,
          border: slotGlow > 0.05 ? `2px dashed rgba(139,92,246,${slotGlow})` : "none",
          pointerEvents: "none",
        }} />

        {/* Dragged ghost pill */}
        {isDragging && (
          <div style={{
            position: "absolute",
            left: ghostX,
            top: ghostY,
            width: POSITIONS.todoItem.width + 20,
            height: POSITIONS.todoItem.height,
            opacity: ghostOpacity,
            transform: `scale(${ghostScale})`,
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: SURFACE2,
            border: `1px solid rgba(139,92,246,0.6)`,
            borderRadius: 10,
            padding: "0 14px",
            boxShadow: "0 10px 32px rgba(0,0,0,0.55), 0 0 16px rgba(139,92,246,0.2)",
            pointerEvents: "none",
            zIndex: 20,
          }}>
            <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${MUTED}`, flexShrink: 0 }} />
            <span style={{ color: TEXT, fontSize: 17, fontFamily: FONT, whiteSpace: "nowrap" }}>Call with Sarah — prep</span>
          </div>
        )}

        {/* New event on calendar */}
        {showEvent && (
          <div style={{
            position: "absolute",
            left: POSITIONS.calendarSlot.x,
            top: POSITIONS.calendarSlot.y,
            width: POSITIONS.calendarSlot.width,
            height: POSITIONS.calendarSlot.height,
            borderRadius: 10,
            background: `linear-gradient(135deg, ${PURPLE}, ${PURPLE_DIM})`,
            padding: "10px 14px",
            transform: `scale(${eventScale})`,
            opacity: eventOpacity,
            transformOrigin: "top left",
            boxShadow: `0 0 28px rgba(139,92,246,0.55), 0 4px 20px rgba(0,0,0,0.4)`,
            pointerEvents: "none",
            zIndex: 15,
          }}>
            <div style={{ color: "#fff", fontSize: 16, fontFamily: FONT, fontWeight: 700 }}>Call with Sarah — prep</div>
            <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 13, fontFamily: FONT, marginTop: 2 }}>2:00 PM</div>
          </div>
        )}

        {/* Cursor */}
        <div style={{ position: "absolute", left: cursorX, top: cursorY, opacity: cursorOpacity, pointerEvents: "none", zIndex: 30 }}>
          <CursorSVG grabbed={isDragging} />
        </div>
      </div>

      {/* Tagline outro */}
      <Sequence from={TAGLINE_IN} premountFor={fps}>
        <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center", background: BG }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28, opacity: taglineOpacity }}>
            <AppLogo />
            <div style={{ textAlign: "center" }}>
              <div style={{ color: TEXT, fontSize: 64, fontFamily: FONT, fontWeight: 700, lineHeight: 1.2, letterSpacing: "-1px" }}>
                Turn todos into<br />
                <span style={{ color: PURPLE }}>scheduled events.</span>
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
