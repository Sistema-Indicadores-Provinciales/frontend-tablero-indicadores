import { PropsWithChildren } from 'react';
import { CssBaseline, GlobalStyles } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { appTheme } from './theme';

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
    '--app-shadow': '0 1px 4px rgba(0, 0, 0, 0.22)',
  },
  'html, body, #root': { minHeight: '100%' },
  'html': { backgroundColor: 'var(--app-background)' },
  'body': { color: 'var(--app-text)', backgroundColor: 'var(--app-background)' },
  'button, input, select, textarea': { colorScheme: 'inherit' },
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
