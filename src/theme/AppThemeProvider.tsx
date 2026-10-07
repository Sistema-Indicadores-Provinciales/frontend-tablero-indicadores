import { PropsWithChildren } from 'react';
import { CssBaseline, GlobalStyles } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { appColors } from './palette';
import { appTheme } from './theme';

const scrollbarArrowImage = (path: string, color: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="${path}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
};

const scrollbarArrows = {
  up: 'm4 10 4-4 4 4',
  down: 'm4 6 4 4 4-4',
  left: 'm10 4-4 4 4 4',
  right: 'm6 4 4 4-4 4',
};

const scrollbarButtonStyle = (path: string, color: string) => ({
  width: '14px',
  height: '14px',
  backgroundColor: 'transparent',
  backgroundImage: scrollbarArrowImage(path, color),
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'center',
  backgroundSize: '12px 12px',
});

const themedScrollbarArrows = (mode: 'light' | 'dark', color = appColors[mode].scrollbarArrow) => ({
  [`html.${mode} *::-webkit-scrollbar-button:vertical:decrement`]: scrollbarButtonStyle(scrollbarArrows.up, color),
  [`html.${mode} *::-webkit-scrollbar-button:vertical:increment`]: scrollbarButtonStyle(scrollbarArrows.down, color),
  [`html.${mode} *::-webkit-scrollbar-button:horizontal:decrement`]: scrollbarButtonStyle(scrollbarArrows.left, color),
  [`html.${mode} *::-webkit-scrollbar-button:horizontal:increment`]: scrollbarButtonStyle(scrollbarArrows.right, color),
});

const scrollbarBaseStyles = {
  '*': { scrollbarColor: 'auto', scrollbarWidth: 'auto' },
  '*::-webkit-scrollbar': { width: '14px', height: '14px' },
  '*::-webkit-scrollbar-track': {
    backgroundColor: 'var(--app-scrollbar-track)',
    borderRadius: '999px',
  },
  '*::-webkit-scrollbar-thumb': {
    backgroundColor: 'var(--app-scrollbar-thumb)',
    border: '3px solid transparent',
    borderRadius: '999px',
    backgroundClip: 'padding-box',
    minHeight: '28px',
    minWidth: '28px',
  },
  '*::-webkit-scrollbar-thumb:hover': {
    backgroundColor: 'var(--app-scrollbar-thumb-hover)',
  },
  '*::-webkit-scrollbar-thumb:active': {
    backgroundColor: 'var(--app-scrollbar-thumb-hover)',
  },
};

const scrollbarInteractionStyles = {
  '*::-webkit-scrollbar-button:hover': { opacity: 0.75 },
  '*::-webkit-scrollbar-button:active': { opacity: 0.55 },
  '*::-webkit-scrollbar-corner': { backgroundColor: 'var(--app-scrollbar-track)' },
};

const scrollbarExtraButtons = {
  '*::-webkit-scrollbar-button:vertical:increment:start': { display: 'none' },
  '*::-webkit-scrollbar-button:vertical:decrement:end': { display: 'none' },
  '*::-webkit-scrollbar-button:horizontal:increment:start': { display: 'none' },
  '*::-webkit-scrollbar-button:horizontal:decrement:end': { display: 'none' },
};

const scrollbarForcedColors = {
  '*::-webkit-scrollbar-track': { backgroundColor: 'Canvas' },
  '*::-webkit-scrollbar-thumb': {
    backgroundColor: 'Highlight',
    borderColor: 'Canvas',
  },
  '*::-webkit-scrollbar-corner': { backgroundColor: 'Canvas' },
  ...themedScrollbarArrows('light', 'ButtonText'),
  ...themedScrollbarArrows('dark', 'ButtonText'),
};

const scrollbarStyles = {
  ...scrollbarBaseStyles,
  ...scrollbarInteractionStyles,
  ...scrollbarExtraButtons,
  ...themedScrollbarArrows('light'),
  ...themedScrollbarArrows('dark'),
  '@media (forced-colors: active)': scrollbarForcedColors,
};

const appTokens = {
  ':root': {
    '--app-background': 'var(--mui-palette-background-default)',
    '--app-paper': 'var(--mui-palette-background-paper)',
    '--app-elevated': 'var(--mui-palette-app-elevated)',
    '--app-text': 'var(--mui-palette-text-primary)',
    '--app-text-secondary': 'var(--mui-palette-text-secondary)',
    '--app-border': 'var(--mui-palette-divider)',
    '--app-control-border': 'var(--mui-palette-app-controlBorder)',
    '--app-primary': 'var(--mui-palette-primary-main)',
    '--app-primary-hover': 'var(--mui-palette-app-primaryHover)',
    '--app-on-primary': 'var(--mui-palette-app-onPrimary)',
    '--app-secondary': 'var(--mui-palette-secondary-main)',
    '--app-header-background': 'linear-gradient(110deg, var(--mui-palette-app-headerStart), var(--mui-palette-app-headerEnd))',
    '--app-on-header': 'var(--mui-palette-common-white)',
    '--app-header-text': 'var(--mui-palette-app-headerText)',
    '--app-hover': 'var(--mui-palette-app-hover)',
    '--app-selected': 'var(--mui-palette-app-selected)',
    '--app-focus': 'var(--mui-palette-app-focus)',
    '--app-error-bg': 'var(--mui-palette-app-errorBackground)',
    '--app-error-text': 'var(--mui-palette-app-errorText)',
    '--app-error': 'var(--mui-palette-error-main)',
    '--app-success-bg': 'var(--mui-palette-app-successBackground)',
    '--app-success-text': 'var(--mui-palette-app-successText)',
    '--app-success': 'var(--mui-palette-success-main)',
    '--app-warning-bg': 'var(--mui-palette-app-warningBackground)',
    '--app-warning-text': 'var(--mui-palette-app-warningText)',
    '--app-warning': 'var(--mui-palette-warning-main)',
    '--app-grid': 'var(--mui-palette-app-grid)',
    '--app-scrollbar-track': 'var(--mui-palette-app-scrollbarTrack)',
    '--app-scrollbar-thumb': 'var(--mui-palette-app-scrollbarThumb)',
    '--app-scrollbar-thumb-hover': 'var(--mui-palette-app-scrollbarThumbHover)',
    '--app-shadow': '0 1px 4px rgba(0, 0, 0, 0.22)',
  },
  'html, body, #root': { minHeight: '100%' },
  'html': { backgroundColor: 'var(--app-background)' },
  'body': { color: 'var(--app-text)', backgroundColor: 'var(--app-background)' },
  'button, input, select, textarea': { colorScheme: 'inherit' },
  ...scrollbarStyles,
};

export default function AppThemeProvider({ children }: PropsWithChildren) {
  return (
    <ThemeProvider theme={appTheme} defaultMode="light" modeStorageKey="sip-theme-mode" colorSchemeStorageKey="sip-theme-color-scheme">
      <CssBaseline enableColorScheme />
      <GlobalStyles styles={appTokens} />
      {children}
    </ThemeProvider>
  );
}
