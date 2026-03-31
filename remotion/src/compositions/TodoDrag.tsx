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
 * Base screenshot: public/todo-drag-base.png (12-47-05.png)
 *   → 5-day calendar view, Pomodoro + ToDo + School modules on left
 *   → Mostly empty calendar — good for visible drop target
 *   → Source: 3024×1964 → rendered 1920×1080 (objectFit: cover)
 *   → Scale: 0.6349×, vertical crop: 131.5px top & bottom of original
 *
 * POSITION TUNING:
 *   Open `npm run dev` and scrub to relevant frames, then adjust POSITIONS.
 *
 *   render_x = orig_x * 0.6349
 *   render_y = (orig_y - 131.5) * 0.6349
 *
 *   Key landmarks (approx):
 *     Sidebar right edge:  ~330px rendered
 *     "Write Notes" item:  x~50, y~520
 *     Thu column (3rd):    center ~1125px
 *     10AM row:            ~660px
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
  // "Write Notes" todo item in the To-Do List module (left sidebar)
  todoItem:     { x: 18, y: 516, width: 272, height: 44 },
  // Drop target: Thu column, ~10AM row
  calendarSlot: { x: 964, y: 648, width: 298, height: 64 },
  // Cursor path
  cursor:       { startX: 40, startY: 535, endX: 1112, endY: 672 },
};

// ─── Timing (frames @ 30fps) ──────────────────────────────────────────────────
const SCREENSHOT_IN = 0;
const CURSOR_APPEAR = 20;   // 0.67s — cursor drifts over todo item
const PICKUP        = 60;   // 2s    — drag starts (grab animation)
const DRAG_END      = 200;  // 6.67s — cursor reaches calendar slot
const DROP          = 205;  // 6.83s — item drops; event pops in
const HOLD          = 360;  // 12s   — hold on result
const TAGLINE_IN    = 380;  // 12.7s

export const TodoDrag = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const screenshotOpacity = interpolate(frame, [SCREENSHOT_IN, SCREENSHOT_IN + 22], [0, 1], {
    extrapolateRight: "clamp", extrapolateLeft: "clamp",
  });

  const isDragging = frame >= PICKUP && frame < DROP;

  // ── Cursor ────────────────────────────────────────────────────────────────
  const cursorX = interpolate(
    frame,
    [CURSOR_APPEAR, PICKUP, DRAG_END],
    [POSITIONS.cursor.startX - 28, POSITIONS.cursor.startX, POSITIONS.cursor.endX],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp", easing: Easing.inOut(Easing.quad) }
  );
  const cursorY = interpolate(
    frame,
    [CURSOR_APPEAR, PICKUP, DRAG_END],
    [POSITIONS.cursor.startY + 12, POSITIONS.cursor.startY, POSITIONS.cursor.endY],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp", easing: Easing.inOut(Easing.quad) }
  );
  const cursorOpacity = interpolate(
    frame,
    [CURSOR_APPEAR - 5, CURSOR_APPEAR, DROP + 30, DROP + 50],
    [0, 1, 1, 0],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );

  // ── Drag ghost pill ───────────────────────────────────────────────────────
  const dragProgress = interpolate(frame, [PICKUP, DRAG_END], [0, 1], {
    extrapolateRight: "clamp", extrapolateLeft: "clamp",
    easing: Easing.inOut(Easing.quad),
  });
  const ghostX     = interpolate(dragProgress, [0, 1], [POSITIONS.todoItem.x, POSITIONS.calendarSlot.x - 18]);
  const ghostY     = interpolate(dragProgress, [0, 1], [POSITIONS.todoItem.y, POSITIONS.calendarSlot.y + 8]);
  const ghostScale = interpolate(frame, [PICKUP, PICKUP + 8, DRAG_END - 5, DRAG_END], [1, 1.05, 1.05, 0.96]);

  // ── Todo item dim while dragging ──────────────────────────────────────────
  const dimOpacity = interpolate(frame, [PICKUP, PICKUP + 10, DROP, DROP + 5], [0, 0.52, 0.52, 0], {
    extrapolateRight: "clamp", extrapolateLeft: "clamp",
  });

  // ── Calendar slot glow on approach ───────────────────────────────────────
  const slotGlow = interpolate(
    frame,
    [PICKUP + 55, PICKUP + 90, DRAG_END - 8, DROP],
    [0, 0.75, 0.75, 0],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );

  // ── Event card spring ──────────────────────────────────────────────────────
  const eventScale   = spring({ frame: frame - DROP, fps, config: { damping: 12, stiffness: 240 } });
  const eventOpacity = interpolate(frame, [DROP, DROP + 8], [0, 1], {
    extrapolateRight: "clamp", extrapolateLeft: "clamp",
  });

  // ── Label popups ──────────────────────────────────────────────────────────
  const pickupLabelOpacity = interpolate(
    frame,
    [CURSOR_APPEAR + 5, CURSOR_APPEAR + 18, PICKUP - 5, PICKUP + 5],
    [0, 1, 1, 0],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const successLabelOpacity = interpolate(
    frame,
    [DROP + 10, DROP + 22, HOLD + 30, HOLD + 45],
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

        {/* ── Screenshot ── */}
        <Img
          src={staticFile("todo-drag-base.png")}
          style={{ width: 1920, height: 1080, objectFit: "cover", opacity: screenshotOpacity }}
        />

        {/* ── Hover highlight on todo item before drag ── */}
        {frame >= CURSOR_APPEAR && frame < PICKUP && (
          <div style={{
            position: "absolute",
            left: POSITIONS.todoItem.x - 4,
            top:  POSITIONS.todoItem.y - 2,
            width:  POSITIONS.todoItem.width + 8,
            height: POSITIONS.todoItem.height + 4,
            borderRadius: 8,
            background: "rgba(139,92,246,0.12)",
            border: "1px solid rgba(139,92,246,0.3)",
            opacity: interpolate(frame, [CURSOR_APPEAR, CURSOR_APPEAR + 12], [0, 1], {
              extrapolateRight: "clamp", extrapolateLeft: "clamp",
            }),
            pointerEvents: "none",
          }} />
        )}

        {/* ── "Drag to calendar" label ── */}
        {pickupLabelOpacity > 0.05 && (
          <div style={{
            position: "absolute",
            left: POSITIONS.todoItem.x + POSITIONS.todoItem.width + 12,
            top:  POSITIONS.todoItem.y - 12,
            background: "rgba(26,22,46,0.92)",
            border: "1px solid rgba(139,92,246,0.4)",
            borderRadius: 8,
            padding: "5px 12px",
            opacity: pickupLabelOpacity,
            pointerEvents: "none",
          }}>
            <span style={{ color: TEXT, fontSize: 14, fontFamily: FONT, whiteSpace: "nowrap" }}>
              Drag to calendar →
            </span>
          </div>
        )}

        {/* ── Original todo item dims while being dragged ── */}
        <div style={{
          position: "absolute",
          left:   POSITIONS.todoItem.x,
          top:    POSITIONS.todoItem.y,
          width:  POSITIONS.todoItem.width,
          height: POSITIONS.todoItem.height,
          background: `rgba(15,13,22,${dimOpacity})`,
          borderRadius: 8,
          pointerEvents: "none",
        }} />

        {/* ── Calendar slot drop-target glow ── */}
        <div style={{
          position: "absolute",
          left:   POSITIONS.calendarSlot.x,
          top:    POSITIONS.calendarSlot.y,
          width:  POSITIONS.calendarSlot.width,
          height: POSITIONS.calendarSlot.height,
          borderRadius: 10,
          background: `rgba(139,92,246,${slotGlow * 0.14})`,
          border: slotGlow > 0.06 ? `2px dashed rgba(139,92,246,${slotGlow})` : "none",
          pointerEvents: "none",
        }} />

        {/* ── Dragged ghost pill ── */}
        {isDragging && (
          <div style={{
            position: "absolute",
            left: ghostX,
            top:  ghostY,
            width:  POSITIONS.todoItem.width + 22,
            height: POSITIONS.todoItem.height,
            opacity: 0.93,
            transform: `scale(${ghostScale})`,
            display: "flex", alignItems: "center", gap: 11,
            background: SURFACE2,
            border: "1.5px solid rgba(139,92,246,0.65)",
            borderRadius: 10,
            padding: "0 14px",
            boxShadow: "0 12px 36px rgba(0,0,0,0.55), 0 0 16px rgba(139,92,246,0.2)",
            pointerEvents: "none",
            zIndex: 20,
          }}>
            <div style={{
              width: 17, height: 17, borderRadius: 5,
              border: "2px solid rgba(139,92,246,0.7)", flexShrink: 0,
            }} />
            <span style={{ color: TEXT, fontSize: 16, fontFamily: FONT, whiteSpace: "nowrap" }}>
              Write Notes
            </span>
          </div>
        )}

        {/* ── New event card pops onto calendar ── */}
        {frame >= DROP && (
          <div style={{
            position: "absolute",
            left:   POSITIONS.calendarSlot.x,
            top:    POSITIONS.calendarSlot.y,
            width:  POSITIONS.calendarSlot.width,
            height: POSITIONS.calendarSlot.height,
            borderRadius: 10,
            background: `linear-gradient(135deg, ${PURPLE}, ${PURPLE_DIM})`,
            padding: "10px 14px",
            transform: `scale(${eventScale})`,
            opacity: eventOpacity,
            transformOrigin: "top left",
            boxShadow: "0 0 30px rgba(139,92,246,0.6), 0 4px 22px rgba(0,0,0,0.45)",
            pointerEvents: "none",
            zIndex: 15,
          }}>
            <div style={{ color: "#fff", fontSize: 15, fontFamily: FONT, fontWeight: 700 }}>Write Notes</div>
            <div style={{ color: "rgba(255,255,255,0.76)", fontSize: 12, fontFamily: FONT, marginTop: 2 }}>
              10:00 AM
            </div>
          </div>
        )}

        {/* ── "Added to calendar!" success label ── */}
        {successLabelOpacity > 0.05 && (
          <div style={{
            position: "absolute",
            left: POSITIONS.calendarSlot.x + POSITIONS.calendarSlot.width + 14,
            top:  POSITIONS.calendarSlot.y - 10,
            background: "rgba(16,185,129,0.15)",
            border: "1px solid rgba(16,185,129,0.5)",
            borderRadius: 8,
            padding: "6px 14px",
            opacity: successLabelOpacity,
            pointerEvents: "none",
          }}>
            <span style={{ color: "#34d399", fontSize: 14, fontFamily: FONT, whiteSpace: "nowrap" }}>
              ✓ Added to calendar
            </span>
          </div>
        )}

        {/* ── Cursor ── */}
        <div style={{
          position: "absolute", left: cursorX, top: cursorY,
          opacity: cursorOpacity, pointerEvents: "none", zIndex: 30,
        }}>
          <CursorSVG grabbed={isDragging} />
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
                Turn todos into<br />
                <span style={{ color: PURPLE }}>scheduled events.</span>
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
