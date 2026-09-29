import { IconButton, Tooltip } from '@mui/material';
import { useColorScheme } from '@mui/material/styles';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';

export default function ThemeToggle() {
  const { mode, setMode } = useColorScheme();
  const activeMode = mode ?? (document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  const isDark = activeMode === 'dark';
  const label = isDark ? 'Activar modo claro' : 'Activar modo oscuro';
  const toggleMode = () => {
    const nextMode = isDark ? 'light' : 'dark';
    setMode(nextMode);
    document.documentElement.style.colorScheme = nextMode;
    const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (themeColor) themeColor.content = nextMode === 'dark' ? '#0b1729' : '#eeeeee';
  };

  return (
    <Tooltip title={label}>
      <IconButton aria-label={label} aria-pressed={isDark} color="inherit" onClick={toggleMode}>
        {isDark ? <LightModeOutlinedIcon /> : <DarkModeOutlinedIcon />}
      </IconButton>
    </Tooltip>
  );
}
