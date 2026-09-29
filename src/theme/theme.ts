/// <reference path="./theme.d.ts" />
import { createTheme } from '@mui/material/styles';
import { appColors } from './palette';

const common = {
  typography: { fontFamily: 'IBM Plex Sans, sans-serif' },
  shape: { borderRadius: 8 },
};

export const appTheme = createTheme({
  ...common,
  cssVariables: { colorSchemeSelector: 'class' },
  colorSchemes: {
    light: {
      palette: {
        mode: 'light',
        primary: { main: '#003667', contrastText: '#ffffff' },
        secondary: { main: '#00558a', contrastText: '#ffffff' },
        background: { default: '#eeeeee', paper: '#ffffff' },
        text: { primary: '#172b4d', secondary: '#53657f' },
        divider: '#dbe3ec',
        error: { main: '#be123c' },
        success: { main: '#15803d' },
        warning: { main: '#a16207' },
        app: appColors.light,
      },
    },
    dark: {
      palette: {
        mode: 'dark',
        primary: { main: '#73b7ff', contrastText: '#0b1729' },
        secondary: { main: '#c3a2ff', contrastText: '#0b1729' },
        background: { default: '#0b1729', paper: '#12243a' },
        text: { primary: '#e8f0fa', secondary: '#b0c2d9' },
        divider: '#34506f',
        error: { main: '#ff8fa7' },
        success: { main: '#69d5a4' },
        warning: { main: '#ffc86f' },
        app: appColors.dark,
      },
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { minHeight: '100vh' },
        '::selection': { backgroundColor: '#286397', color: '#ffffff' },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: ({ theme }) => ({ backgroundImage: 'none', borderColor: theme.palette.divider }),
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        notchedOutline: ({ theme }) => ({ borderColor: theme.palette.app.controlBorder }),
      },
    },
  },
});
