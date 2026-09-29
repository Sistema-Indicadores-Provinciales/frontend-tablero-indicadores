export type ThemeMode = 'light' | 'dark';

export interface AppPalette {
  elevated: string;
  primaryHover: string;
  onPrimary: string;
  headerStart: string;
  headerEnd: string;
  headerText: string;
  hover: string;
  selected: string;
  controlBorder: string;
  focus: string;
  grid: string;
  errorBackground: string;
  errorText: string;
  successBackground: string;
  successText: string;
  warningBackground: string;
  warningText: string;
  series: string[];
}

export const appColors: Record<ThemeMode, AppPalette> = {
  light: {
    elevated: '#f7faff',
    primaryHover: '#00558a',
    onPrimary: '#ffffff',
    headerStart: '#003667',
    headerEnd: '#00558a',
    headerText: '#dbeaf5',
    hover: '#eaf1ff',
    selected: '#eaf1ff',
    controlBorder: '#8aaac2',
    focus: '#008bc9',
    grid: '#e2e8f0',
    errorBackground: '#fff0f0',
    errorText: '#8a1634',
    successBackground: '#eaf8ee',
    successText: '#146432',
    warningBackground: '#fff7e6',
    warningText: '#7a4d00',
    series: ['#2563eb', '#e11d48', '#f97316', '#16a34a', '#9333ea', '#0891b2', '#ca8a04', '#be123c', '#15803d', '#7c3aed', '#0284c7', '#dc2626'],
  },
  dark: {
    elevated: '#1b314b',
    primaryHover: '#9acbff',
    onPrimary: '#0b1729',
    headerStart: '#102b4a',
    headerEnd: '#174b73',
    headerText: '#d6e8fa',
    hover: '#233b57',
    selected: '#254766',
    controlBorder: '#6b89aa',
    focus: '#9bd6ff',
    grid: '#34506f',
    errorBackground: '#482535',
    errorText: '#ffd5df',
    successBackground: '#1d3e3a',
    successText: '#c3f4dc',
    warningBackground: '#493a25',
    warningText: '#ffe3ad',
    series: ['#73b7ff', '#ff8fa7', '#ffb86b', '#69d5a4', '#c3a2ff', '#62d4e5', '#f2d06f', '#ffa6d5', '#98df86', '#a99bff', '#62b9ff', '#ff827d'],
  },
};
