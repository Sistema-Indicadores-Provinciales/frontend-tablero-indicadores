import type { AppPalette } from './palette';

declare module '@mui/material/styles/createPalette' {
  interface Palette {
    app: AppPalette;
  }

  interface PaletteOptions {
    app?: AppPalette;
  }
}
