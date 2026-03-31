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
 * Collaborate — 20s clip
 *
 * Screenshots needed:
 *   remotion/public/collab-base.png
 *     → App with a module (e.g. Todo) visible, share/kebab button accessible
 *
 * POSITION TUNING:
 *   Adjust POSITIONS below once you've added screenshots and opened the studio.
 */

const POSITIONS = {
  // The share button / kebab icon on the module card
  shareBtn: { x: 420, y: 155 },
  // Where the share sheet slides up from (bottom center)
  sheetAnchor: { x: 160, y: 500 },
  // The email input inside the share sheet
  emailInput: { x: 180, y: 620, width: 420, height: 44, fontSize: 18 },
  // Where the notification bell is in the header
  bell: { x: 1840, y: 32 },
  // Where the notification popup appears
  notif: { x: 1440, y: 80, width: 460, height: 130 },
  // Where the "Shared — Editor" badge appears on the module
  badge: { x: 184, y: 148 },
  // Cursor start near module share button
  cursor: { startX: 500, startY: 200 },
};

const PURPLE = "#8B5CF6";
const PURPLE_DIM = "#6D28D9";
const GREEN = "#10b981";
const BG = "#0f0d16";
const SURFACE = "#1a1625";
const SURFACE2 = "#221e31";
const BORDER = "rgba(255,255,255,0.08)";
const TEXT = "#f8f8f8";
const MUTED = "#9ca3af";
const FONT = '"ui-monospace","Cascadia Code","Fira Mono",monospace';

// Timing
const SCREENSHOT_IN = 0;
const CURSOR_TO_BTN = 20;    // 0.6s
const BTN_CLICK = 50;        // 1.6s
const SHEET_IN = 65;         // 2.1s — share sheet slides up
const EMAIL_TYPE = 110;      // 3.6s
const EMAIL_FRAMES = 90;     // 3s
const INVITE_SENT = 210;     // 7s
const SHEET_OUT = 260;       // 8.6s — sheet closes
const BELL_RING = 300;       // 10s — recipient view: bell rings
const NOTIF_IN = 315;        // 10.5s — notification popup
const NOTIF_OUT = 430;       // 14.3s
const BADGE_IN = 450;        // 15s — "Shared — Editor" badge
const TAGLINE_IN = 520;      // 17.3s

const INVITE_EMAIL = "sarah@company.com";

export const Collaborate = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const screenshotOpacity = interpolate(frame, [SCREENSHOT_IN, SCREENSHOT_IN + 20], [0, 1], {
    extrapolateRight: "clamp", extrapolateLeft: "clamp",
  });

  // Share button highlight ring
  const btnGlow = interpolate(frame, [CURSOR_TO_BTN, BTN_CLICK, BTN_CLICK + 20, SHEET_IN], [0, 1, 1, 0], {
    extrapolateRight: "clamp", extrapolateLeft: "clamp",
  });

  // Sheet slide in
  const sheetY = interpolate(frame, [SHEET_IN, SHEET_IN + 30], [500, 0], {
    extrapolateRight: "clamp", extrapolateLeft: "clamp",
    easing: Easing.out(Easing.quad),
  });
  const sheetOpacity = interpolate(frame, [SHEET_IN, SHEET_IN + 20, SHEET_OUT, SHEET_OUT + 20], [0, 1, 1, 0], {
    extrapolateRight: "clamp", extrapolateLeft: "clamp",
  });
  const showSheet = frame >= SHEET_IN && frame < SHEET_OUT + 25;

  // Email typing
  const charsPerFrame = INVITE_EMAIL.length / EMAIL_FRAMES;
  const charsVisible = Math.min(
    Math.floor(Math.max(0, frame - EMAIL_TYPE) * charsPerFrame),
    INVITE_EMAIL.length
  );
  const typedEmail = INVITE_EMAIL.slice(0, charsVisible);
  const showEmailCursor = frame >= EMAIL_TYPE && frame < INVITE_SENT;

  // Confirm tick
  const confirmOpacity = interpolate(frame, [INVITE_SENT, INVITE_SENT + 15], [0, 1], {
    extrapolateRight: "clamp", extrapolateLeft: "clamp",
  });

  // Bell ring
  const bellRot = interpolate(
    frame,
    [BELL_RING, BELL_RING + 5, BELL_RING + 10, BELL_RING + 15, BELL_RING + 20],
    [0, -18, 18, -10, 0],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const bellDotOpacity = interpolate(frame, [BELL_RING, BELL_RING + 8], [0, 1], {
    extrapolateRight: "clamp", extrapolateLeft: "clamp",
  });

  // Notification popup
  const notifOpacity = interpolate(frame, [NOTIF_IN, NOTIF_IN + 20, NOTIF_OUT, NOTIF_OUT + 15], [0, 1, 1, 0], {
    extrapolateRight: "clamp", extrapolateLeft: "clamp",
  });
  const notifY = interpolate(frame, [NOTIF_IN, NOTIF_IN + 20], [-24, 0], {
    extrapolateRight: "clamp", extrapolateLeft: "clamp",
    easing: Easing.out(Easing.quad),
  });

  // Badge
  const badgeScale = spring({ frame: frame - BADGE_IN, fps, config: { damping: 14, stiffness: 220 } });
  const badgeOpacity = interpolate(frame, [BADGE_IN, BADGE_IN + 12], [0, 1], {
    extrapolateRight: "clamp", extrapolateLeft: "clamp",
  });

  // Cursor
  const cursorX = interpolate(
    frame,
    [10, CURSOR_TO_BTN, BTN_CLICK],
    [POSITIONS.cursor.startX + 80, POSITIONS.shareBtn.x, POSITIONS.shareBtn.x],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp", easing: Easing.out(Easing.quad) }
  );
  const cursorY = interpolate(
    frame,
    [10, CURSOR_TO_BTN, BTN_CLICK],
    [POSITIONS.cursor.startX + 40, POSITIONS.shareBtn.y, POSITIONS.shareBtn.y],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp", easing: Easing.out(Easing.quad) }
  );
  const cursorOpacity = interpolate(frame, [8, 18, SHEET_IN, SHEET_IN + 10], [0, 1, 1, 0], {
    extrapolateRight: "clamp", extrapolateLeft: "clamp",
  });

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
          src={staticFile("collab-base.png")}
          style={{ width: 1920, height: 1080, objectFit: "cover", opacity: screenshotOpacity }}
        />

        {/* Share button highlight */}
        <div style={{
          position: "absolute",
          left: POSITIONS.shareBtn.x - 18,
          top: POSITIONS.shareBtn.y - 18,
          width: 36,
          height: 36,
          borderRadius: "50%",
          border: `2px solid rgba(139,92,246,${btnGlow})`,
          boxShadow: `0 0 ${16 * btnGlow}px rgba(139,92,246,${btnGlow * 0.6})`,
          opacity: btnGlow,
          pointerEvents: "none",
        }} />

        {/* Bell notification dot */}
        <div style={{
          position: "absolute",
          left: POSITIONS.bell.x + 6,
          top: POSITIONS.bell.y - 4,
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: "#ef4444",
          border: `2px solid ${BG}`,
          opacity: bellDotOpacity,
          pointerEvents: "none",
        }} />

        {/* Bell rotation effect (rendered as an overlay ring) */}
        {frame >= BELL_RING && frame < BELL_RING + 30 && (
          <div style={{
            position: "absolute",
            left: POSITIONS.bell.x - 20,
            top: POSITIONS.bell.y - 20,
            width: 40,
            height: 40,
            borderRadius: "50%",
            border: `2px solid rgba(139,92,246,${interpolate(frame, [BELL_RING, BELL_RING + 30], [0.8, 0], { extrapolateRight: "clamp" })})`,
            transform: `rotate(${bellRot}deg)`,
            pointerEvents: "none",
          }} />
        )}

        {/* Notification popup */}
        <div style={{
          position: "absolute",
          left: POSITIONS.notif.x,
          top: POSITIONS.notif.y + notifY,
          width: POSITIONS.notif.width,
          opacity: notifOpacity,
          background: SURFACE2,
          borderRadius: 16,
          border: `1px solid rgba(139,92,246,0.35)`,
          padding: "18px 20px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          zIndex: 20,
          pointerEvents: "none",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: `linear-gradient(135deg, ${GREEN}, #059669)`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#fff", fontSize: 16, fontWeight: 700 }}>S</span>
            </div>
            <div>
              <div style={{ color: TEXT, fontSize: 16, fontFamily: FONT, fontWeight: 600 }}>New Module Invite</div>
              <div style={{ color: MUTED, fontSize: 14, fontFamily: FONT, marginTop: 3 }}>
                Jesse shared a <span style={{ color: TEXT }}>To-Do</span> module with you
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                <div style={{ background: PURPLE, borderRadius: 7, padding: "5px 14px" }}>
                  <span style={{ color: "#fff", fontSize: 14, fontFamily: FONT, fontWeight: 600 }}>Accept</span>
                </div>
                <div style={{ background: SURFACE, borderRadius: 7, padding: "5px 14px", border: `1px solid ${BORDER}` }}>
                  <span style={{ color: MUTED, fontSize: 14, fontFamily: FONT }}>Decline</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* "Shared — Editor" badge on module */}
        {frame >= BADGE_IN && (
          <div style={{
            position: "absolute",
            left: POSITIONS.badge.x,
            top: POSITIONS.badge.y,
            transform: `scale(${badgeScale})`,
            opacity: badgeOpacity,
            transformOrigin: "left center",
            background: "rgba(139,92,246,0.18)",
            border: `1px solid rgba(139,92,246,0.5)`,
            borderRadius: 20,
            padding: "4px 12px",
            pointerEvents: "none",
            zIndex: 15,
          }}>
            <span style={{ color: PURPLE, fontSize: 14, fontFamily: FONT, fontWeight: 600 }}>Shared — Editor</span>
          </div>
        )}

        {/* Share sheet overlay */}
        {showSheet && (
          <div style={{
            position: "absolute",
            left: POSITIONS.sheetAnchor.x,
            bottom: 0,
            width: 560,
            background: SURFACE,
            borderRadius: "20px 20px 0 0",
            border: `1px solid ${BORDER}`,
            borderBottom: "none",
            padding: "20px 28px 48px",
            transform: `translateY(${sheetY}px)`,
            opacity: sheetOpacity,
            boxShadow: "0 -8px 40px rgba(0,0,0,0.5)",
            zIndex: 25,
          }}>
            <div style={{ width: 40, height: 5, borderRadius: 3, background: BORDER, margin: "0 auto 20px" }} />
            <div style={{ color: TEXT, fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Share Module</div>
            <div style={{ color: MUTED, fontSize: 16, marginBottom: 22 }}>Invite people to collaborate</div>

            {/* Email input */}
            <div style={{ display: "flex", background: SURFACE2, border: `1px solid rgba(139,92,246,0.4)`, borderRadius: 10, overflow: "hidden", marginBottom: 16 }}>
              <div style={{ flex: 1, padding: "12px 16px" }}>
                <span style={{ color: TEXT, fontSize: 17, fontFamily: FONT }}>
                  {typedEmail}
                  {showEmailCursor && <span style={{ display: "inline-block", width: 2, height: "1em", background: PURPLE, marginLeft: 2, verticalAlign: "text-bottom" }} />}
                </span>
              </div>
              <div style={{ padding: "0 16px", background: typedEmail.includes("@") ? PURPLE : SURFACE2, display: "flex", alignItems: "center" }}>
                <span style={{ color: typedEmail.includes("@") ? "#fff" : MUTED, fontSize: 16, fontWeight: 600 }}>Invite</span>
              </div>
            </div>

            {/* Role pills */}
            <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
              {["Viewer", "Editor"].map((role) => (
                <div key={role} style={{ flex: 1, textAlign: "center", padding: "10px", borderRadius: 8, background: role === "Editor" ? "rgba(139,92,246,0.15)" : SURFACE2, border: `1px solid ${role === "Editor" ? "rgba(139,92,246,0.4)" : BORDER}` }}>
                  <span style={{ color: role === "Editor" ? PURPLE : MUTED, fontSize: 16, fontWeight: role === "Editor" ? 600 : 400 }}>{role}</span>
                </div>
              ))}
            </div>

            {/* Confirm */}
            {frame >= INVITE_SENT && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, opacity: confirmOpacity }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: GREEN, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ color: "#fff", fontSize: 12 }}>✓</span>
                </div>
                <span style={{ color: GREEN, fontSize: 16, fontFamily: FONT }}>Invite sent to {INVITE_EMAIL}</span>
              </div>
            )}
          </div>
        )}

        {/* Cursor */}
        <div style={{ position: "absolute", left: cursorX, top: cursorY, opacity: cursorOpacity, pointerEvents: "none", zIndex: 30 }}>
          <CursorSVG />
        </div>
      </div>

      {/* Tagline outro */}
      <Sequence from={TAGLINE_IN} premountFor={fps}>
        <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center", background: BG }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28, opacity: taglineOpacity }}>
            <AppLogo />
            <div style={{ textAlign: "center" }}>
              <div style={{ color: TEXT, fontSize: 64, fontFamily: FONT, fontWeight: 700, lineHeight: 1.2, letterSpacing: "-1px" }}>
                Share modules,<br />
                <span style={{ color: PURPLE }}>work together.</span>
              </div>
            </div>
            <span style={{ color: MUTED, fontSize: 28, fontFamily: FONT, letterSpacing: "0.04em" }}>malleabite.app</span>
          </div>
        </AbsoluteFill>
      </Sequence>

    </AbsoluteFill>
  );
};

function CursorSVG() {
  return (
    <svg width="28" height="28" viewBox="0 0 20 20" fill="white" style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.7))" }}>
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
