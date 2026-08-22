export const tokens = {
  spacing: { xs: 4, sm: 8, md: 12, lg: 20, xl: 28, "2xl": 40 },
  radii: { sm: 12, md: 18, lg: 24, xl: 32, pill: 999 },
  motion: { fast: 140, normal: 240, slow: 420, spring: { stiffness: 300, damping: 28 } },
  glass: { depth1: 0.58, depth2: 0.68, depth3: 0.78, blur1: 16, blur2: 24, blur3: 32 },
  elevation: { low: "0 8px 24px rgba(17,24,39,.06)", medium: "0 18px 50px rgba(17,24,39,.10)", high: "0 30px 80px rgba(17,24,39,.16)" }
} as const;
