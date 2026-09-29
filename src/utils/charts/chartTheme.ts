import { useTheme } from '@mui/material/styles';
import { appColors } from 'theme/palette';

export function useChartTheme() {
  const theme = useTheme();
  const mode = theme.palette.mode === 'dark' ? 'dark' : 'light';
  const app = appColors[mode];

  return {
    mode,
    colors: app.series,
    paper: theme.palette.background.paper,
    text: theme.palette.text.primary,
    textSecondary: theme.palette.text.secondary,
    grid: app.grid,
    border: theme.palette.divider,
    tooltipBackground: mode === 'dark' ? '#1b314b' : '#1e293b',
    tooltipText: mode === 'dark' ? '#f2f7ff' : '#f8fafc',
    pointBorder: theme.palette.background.paper,
    fontFamily: theme.typography.fontFamily,
    shadow: mode === 'dark' ? '0 1px 4px rgba(0,0,0,0.35)' : '0 1px 3px rgba(0,0,0,0.08)',
  };
}
