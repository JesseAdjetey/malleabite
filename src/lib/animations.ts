export const springs = {
  gentle: { type: "spring" as const, damping: 20, stiffness: 150 },
  snappy: { type: "spring" as const, damping: 25, stiffness: 300 },
  bouncy: { type: "spring" as const, damping: 15, stiffness: 200 },
  sheet: { type: "spring" as const, damping: 30, stiffness: 250 },
  page: { type: "spring" as const, damping: 28, stiffness: 220 },
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
