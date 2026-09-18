import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
// import LightModeIcon from '@mui/icons-material/LightMode';
// import DarkModeIcon from '@mui/icons-material/DarkMode';
import MenuIcon from '@mui/icons-material/Menu';
import AppBar from 'styled-components/base/AppBar';
import { navbarBackground } from 'config/constants';
import UserMenu from './UserMenu';
import { useContext } from 'react';
import NavbarContext from 'contexts/NavbarContext';

interface propTypes {
  open: boolean
  handleOpen: () => void
}

const NavBar = ({ open, handleOpen }: propTypes) => {
  const navbarContext = useContext(NavbarContext);

  return (
    <AppBar position="fixed" style={navbarBackground} open={open} >
      <Toolbar > {/* variant="dense" */}
        <IconButton aria-label="Abrir menú" color="inherit" onClick={handleOpen} edge="start" sx={{ mr: 2, ...(open && { display: 'none' }) }}>
          <MenuIcon />
        </IconButton>
        <Typography variant="h6" textTransform='uppercase' fontWeight='bold' noWrap component="div" sx={{ flexGrow: 1 }} >{navbarContext.navTitle ?? 'TABLERO INDICADORES'}</Typography>
        {/* <IconButton
          size="large"
          aria-label="light or night"
          color="inherit"
          onClick={() => setMode(!mode)}
        >
          {mode ? <DarkModeIcon /> : <LightModeIcon />}
        </IconButton> */}
        <UserMenu />
      </Toolbar>
    </AppBar>
  )
}

export default NavBar
