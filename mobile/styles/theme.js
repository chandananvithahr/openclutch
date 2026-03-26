// OpenClutch Design System
// Warm cocoa palette — dark mode default, no blues, no pure white/black
// Inspired by Cleo AI warmth + Kailash Nadh's minimal philosophy

export const colors = {
  // Brand
  primary: '#FFE36D',
  primaryLight: 'rgba(255, 227, 109, 0.12)',
  primaryDim: 'rgba(255, 227, 109, 0.20)',

  // Financial — green/red for gain/loss (universal finance language)
  gain: '#4CAF50',
  gainBg: 'rgba(76, 175, 80, 0.12)',
  loss: '#FF6B6B',
  lossBg: 'rgba(255, 107, 107, 0.12)',
  neutral: '#f59e0b',

  // Cocoa palette (dark mode default)
  bg: '#2D1B14',
  bgMuted: '#3A2820',
  bgSubtle: '#4A3028',
  surface: '#3A2820',
  border: '#6B4C3A',
  borderStrong: '#8B6C5A',

  // Text hierarchy (warm whites)
  text: '#F5F0EB',
  textSecondary: '#B8A99A',
  textMuted: '#8B7A6B',
  textFaint: '#6B5C4D',

  // Status
  online: '#4CAF50',
  offline: '#FF6B6B',
  warning: '#f59e0b',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
};

export const typography = {
  // Font sizes
  xs: 11,
  sm: 13,
  base: 15,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 28,

  // Weights
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',

  // Line heights
  tight: 18,
  normal: 22,
  relaxed: 26,
};

// Financial number display — tabular (monospace-like alignment)
export const financial = {
  // Use these for rupee amounts, percentages, and P&L
  amountStyle: {
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  gainStyle: {
    color: '#4CAF50',
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  lossStyle: {
    color: '#FF6B6B',
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
};
