// OpenClutch Design System
// Inspired by Kailash Nadh's minimal philosophy (oat.ink, listmonk)
// Primary brand: #6C63FF (modern, 28-35 Indian fintech audience)

export const colors = {
  // Brand
  primary: '#6C63FF',
  primaryLight: 'rgba(108, 99, 255, 0.08)',
  primaryDim: 'rgba(108, 99, 255, 0.15)',

  // Financial — green/red for gain/loss (universal finance language)
  gain: '#16a34a',
  gainBg: 'rgba(22, 163, 74, 0.08)',
  loss: '#dc2626',
  lossBg: 'rgba(220, 38, 38, 0.08)',
  neutral: '#f59e0b',

  // Neutrals (Kailash-style minimal grayscale)
  bg: '#ffffff',
  bgMuted: '#f9f9f9',
  bgSubtle: '#f4f4f4',
  surface: '#f0f0f0',
  border: '#e8e8e8',
  borderStrong: '#d4d4d4',

  // Text hierarchy
  text: '#1a1a1a',
  textSecondary: '#555555',
  textMuted: '#888888',
  textFaint: '#aaaaaa',

  // Status
  online: '#16a34a',
  offline: '#dc2626',
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
    color: '#16a34a',
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  lossStyle: {
    color: '#dc2626',
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
};
