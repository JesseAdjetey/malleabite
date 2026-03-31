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
 * MallyAI — 19s clip
 *
 * Base screenshot: public/mally-base.png (12-37-31.png)
 *   → Week view, Todo modules on left, calendar on right
 *   → Source: 3024×1964 rendered as 1920×1080 (objectFit: cover)
 *   → Scale: 0.6349×, vertical crop: 131.5px off top & bottom of original
 *
 * POSITION TUNING:
 *   Open `npm run dev` in remotion/ and adjust the constants below.
 *   The chat panel is a SYNTHETIC overlay — it doesn't exist in the screenshot.
 */

// ─── Design tokens ────────────────────────────────────────────────────────────
const PURPLE     = "#8B5CF6";
const PURPLE_DIM = "#6D28D9";
const BG         = "#0f0d16";
const SURFACE2   = "#221e31";
const BORDER     = "rgba(139,92,246,0.35)";
const TEXT       = "#f8f8f8";
const MUTED      = "#9ca3af";
const FONT       = '"ui-sans-serif","Inter","system-ui",sans-serif';
const MONO       = '"ui-monospace","Cascadia Code","Fira Mono",monospace';

// ─── Positions (tune in studio) ───────────────────────────────────────────────
const CHAT_PANEL = { x: 340, y: 920, width: 1240, height: 66, fontSize: 22 };
const EVENT_CARD = { x: 820, y: 318, width: 218, height: 74 };
const CURSOR     = { startX: 1540, startY: 940, endX: 890, endY: 358 };

// ─── Timing (frames @ 30fps) ──────────────────────────────────────────────────
const SCREENSHOT_IN   = 0;
const PANEL_SLIDE_IN  = 20;
const CURSOR_APPEAR   = 40;
const TYPING_START    = 55;
const TYPING_FRAMES   = 110;
const SEND_FRAME      = 170;
const THINKING_START  = 180;
const THINKING_FRAMES = 50;
const EVENT_POP       = 235;
const PANEL_SLIDE_OUT = 300;
const TAGLINE_IN      = 400;

const FULL_TEXT   = "Schedule team standup tomorrow at 9am";
const MALLY_REPLY = "Done! Team Standup added for tomorrow at 9:00 AM ✓";

export const MallyAI = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const screenshotOpacity = interpolate(frame, [SCREENSHOT_IN, SCREENSHOT_IN + 25], [0, 1], {
    extrapolateRight: "clamp", extrapolateLeft: "clamp",
  });

  // Panel slides up from below
  const panelY = interpolate(
    frame,
    [PANEL_SLIDE_IN, PANEL_SLIDE_IN + 22],
    [CHAT_PANEL.y + 80, CHAT_PANEL.y],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp", easing: Easing.out(Easing.back(1.4)) }
  );
  const panelOpacity = interpolate(
    frame,
    [PANEL_SLIDE_IN, PANEL_SLIDE_IN + 12, PANEL_SLIDE_OUT, PANEL_SLIDE_OUT + 15],
    [0, 1, 1, 0],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );

  // Typing
  const charsPerFrame  = FULL_TEXT.length / TYPING_FRAMES;
  const charsVisible   = Math.min(Math.floor(Math.max(0, frame - TYPING_START) * charsPerFrame), FULL_TEXT.length);
  const typedText      = FULL_TEXT.slice(0, charsVisible);
  const showBlinker    = frame >= TYPING_START - 5 && frame < SEND_FRAME + 5;

  // Reply
  const replyStart         = THINKING_START + THINKING_FRAMES;
  const replyCharsPerFrame = MALLY_REPLY.length / 40;
  const replyCharsVisible  = Math.min(Math.floor(Math.max(0, frame - replyStart) * replyCharsPerFrame), MALLY_REPLY.length);
  const replyText          = MALLY_REPLY.slice(0, replyCharsVisible);
  const showReply          = frame >= replyStart;

  // Thinking dots
  const thinkingOpacity = interpolate(
    frame,
    [THINKING_START, THINKING_START + 10, THINKING_START + THINKING_FRAMES - 10, THINKING_START + THINKING_FRAMES],
    [0, 1, 1, 0],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );

  // Event card spring
  const eventScale   = spring({ frame: frame - EVENT_POP, fps, config: { damping: 12, stiffness: 240 } });
  const eventOpacity = interpolate(frame, [EVENT_POP, EVENT_POP + 8], [0, 1], {
    extrapolateRight: "clamp", extrapolateLeft: "clamp",
  });

  // Cursor
  const phase2Start = SEND_FRAME + 35;
  const cursorX = interpolate(
    frame,
    [CURSOR_APPEAR, CURSOR_APPEAR + 8, phase2Start, phase2Start + 65],
    [CURSOR.startX, CURSOR.startX, CURSOR.startX, CURSOR.endX],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp", easing: Easing.inOut(Easing.cubic) }
  );
  const cursorY = interpolate(
    frame,
    [CURSOR_APPEAR, CURSOR_APPEAR + 8, phase2Start, phase2Start + 65],
    [CURSOR.startY, CURSOR.startY, CURSOR.startY, CURSOR.endY],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp", easing: Easing.inOut(Easing.cubic) }
  );
  const cursorOpacity = interpolate(
    frame,
    [CURSOR_APPEAR - 5, CURSOR_APPEAR, EVENT_POP + 30, EVENT_POP + 50],
    [0, 1, 1, 0],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );

  // Tagline
  const taglineOpacity = interpolate(frame, [TAGLINE_IN, TAGLINE_IN + 25], [0, 1], {
    extrapolateRight: "clamp", extrapolateLeft: "clamp",
  });
  const mainOpacity = interpolate(frame, [TAGLINE_IN - 10, TAGLINE_IN + 10], [1, 0], {
    extrapolateRight: "clamp", extrapolateLeft: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: BG, fontFamily: FONT }}>

      {/* ── App screenshot ── */}
      <div style={{ opacity: mainOpacity }}>
        <Img
          src={staticFile("mally-base.png")}
          style={{ width: 1920, height: 1080, objectFit: "cover", opacity: screenshotOpacity }}
        />

        {/* ── Bottom fade so chat panel pops ── */}
        {frame >= PANEL_SLIDE_IN && (
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            background: "linear-gradient(to top, rgba(15,13,22,0.55) 0%, transparent 55%)",
            opacity: panelOpacity,
          }} />
        )}

        {/* ── Floating Mally chat panel ── */}
        {frame >= PANEL_SLIDE_IN && (
          <div style={{
            position: "absolute",
            left: CHAT_PANEL.x,
            top: panelY,
            width: CHAT_PANEL.width,
            height: CHAT_PANEL.height,
            opacity: panelOpacity,
            background: SURFACE2,
            border: `1.5px solid ${BORDER}`,
            borderRadius: 16,
            boxShadow: "0 0 40px rgba(139,92,246,0.25), 0 8px 32px rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            padding: "0 18px",
            gap: 14,
          }}>
            {/* Mally icon */}
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: `linear-gradient(135deg, ${PURPLE}, ${PURPLE_DIM})`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ color: "#fff", fontSize: 19, fontWeight: 700, fontFamily: MONO }}>M</span>
            </div>

            {/* Text area */}
            <div style={{ flex: 1, overflow: "hidden" }}>
              {!showReply ? (
                <span style={{ color: TEXT, fontSize: CHAT_PANEL.fontSize, fontFamily: FONT }}>
                  {typedText}
                  {showBlinker && (
                    <span style={{
                      display: "inline-block", width: 2, height: "1.05em",
                      background: PURPLE, marginLeft: 2, verticalAlign: "text-bottom",
                    }} />
                  )}
                </span>
              ) : (
                <span style={{ color: "#a78bfa", fontSize: CHAT_PANEL.fontSize - 2, fontFamily: FONT }}>
                  {replyText}
                </span>
              )}
            </div>

            {/* Thinking dots inside panel */}
            {thinkingOpacity > 0.05 && (
              <div style={{ display: "flex", gap: 6, alignItems: "center", opacity: thinkingOpacity }}>
                {[0, 1, 2].map((i) => {
                  const dot = interpolate((frame + i * 8) % 24, [0, 8, 16, 24], [0.25, 1, 0.25, 0.25], {
                    extrapolateRight: "clamp",
                  });
                  return <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: PURPLE, opacity: dot }} />;
                })}
              </div>
            )}

            {/* Send button */}
            {frame < THINKING_START && (
              <div style={{
                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                background: frame >= TYPING_START + 10 ? PURPLE : "rgba(139,92,246,0.18)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M22 2L11 13" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                  <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            )}
          </div>
        )}

        {/* ── Event card springs onto the calendar ── */}
        {frame >= EVENT_POP && (
          <div style={{
            position: "absolute",
            left: EVENT_CARD.x,
            top: EVENT_CARD.y,
            width: EVENT_CARD.width,
            height: EVENT_CARD.height,
            borderRadius: 10,
            background: `linear-gradient(135deg, ${PURPLE}, ${PURPLE_DIM})`,
            padding: "9px 13px",
            transform: `scale(${eventScale})`,
            opacity: eventOpacity,
            transformOrigin: "top center",
            boxShadow: "0 0 36px rgba(139,92,246,0.65), 0 4px 22px rgba(0,0,0,0.5)",
            pointerEvents: "none",
          }}>
            <div style={{ color: "#fff", fontSize: 15, fontFamily: FONT, fontWeight: 700, lineHeight: 1.3 }}>
              Team Standup
            </div>
            <div style={{ color: "rgba(255,255,255,0.78)", fontSize: 12, fontFamily: FONT, marginTop: 2 }}>
              9:00 – 9:30 AM
            </div>
          </div>
        )}

        {/* ── Cursor ── */}
        <div style={{
          position: "absolute", left: cursorX, top: cursorY,
          opacity: cursorOpacity, pointerEvents: "none", zIndex: 30,
        }}>
          <CursorSVG grabbed={frame >= SEND_FRAME - 5 && frame < EVENT_POP + 20} />
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
                Schedule anything,<br />
                <span style={{ color: PURPLE }}>just say it.</span>
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
