export const springs = {
  gentle: { type: "spring" as const, damping: 20, stiffness: 150 },
  snappy: { type: "spring" as const, damping: 25, stiffness: 300 },
  bouncy: { type: "spring" as const, damping: 15, stiffness: 200 },
  sheet: { type: "spring" as const, damping: 30, stiffness: 250 },
  page: { type: "spring" as const, damping: 28, stiffness: 220 },
  // Apple-style springs
  ios: { type: "spring" as const, damping: 26, stiffness: 380, mass: 1 },
  modal: { type: "spring" as const, damping: 22, stiffness: 280 },
  tabIndicator: { type: "spring" as const, damping: 30, stiffness: 400 },
};

// Smooth tween easing for exits (springs ignore duration, so use tween for exits)
const exitEase = [0.4, 0, 0.2, 1] as const;

// Page transition: focus-pull crossfade.
// Exit blurs + scales slightly away, enter sharpens into focus.
// mode="popLayout" in AnimatePresence ensures both overlap — no background gap.
export const wrapTransition = {
  initial: { opacity: 0, scale: 0.98, filter: 'blur(6px)' },
  animate: {
    opacity: 1,
    scale: 1,
    filter: 'blur(0px)',
    transition: { duration: 0.24, ease: [0.25, 0.46, 0.45, 0.94] },
  },
  exit: {
    opacity: 0,
    scale: 1.015,
    filter: 'blur(8px)',
    transition: { duration: 0.18, ease: [0.4, 0, 1, 1] },
  },
};

// Modal scale-spring reveal
export const modalTransition = {
  initial: { opacity: 0, scale: 0.94 },
  animate: { opacity: 1, scale: 1, transition: { type: "spring" as const, damping: 24, stiffness: 300 } },
  exit: { opacity: 0, scale: 0.96, transition: { duration: 0.14, ease: exitEase } },
};

// Sheet wrap-up from bottom
export const sheetWrapTransition = {
  initial: { opacity: 0, y: "100%", scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { type: "spring" as const, damping: 30, stiffness: 260 } },
  exit: { opacity: 0, y: "60%", transition: { duration: 0.2, ease: exitEase } },
};

// Stagger container variants
export const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.02 } },
};

export const staggerItem = {
  hidden: { opacity: 0, y: 10, scale: 0.95 },
  show: { opacity: 1, y: 0, scale: 1, transition: springs.gentle },
};

export const pageTransition = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
  transition: springs.page,
};

export const sheetTransition = {
  initial: { opacity: 0, y: "100%" },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: "100%" },
  transition: springs.sheet,
};

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2 },
};
