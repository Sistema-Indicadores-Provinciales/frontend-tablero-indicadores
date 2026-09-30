import { styled } from '@mui/material/styles';
import { drawerWidth } from '../../config/constants';

const Main = styled('main', { shouldForwardProp: (prop) => prop !== 'open' })<{
  open?: boolean;
}>(({ theme, open }) => ({
  // backgroundColor: 'red',
  minHeight: '100vh',
  minWidth: 0,
  flexGrow: 1,
  padding: theme.spacing(3),
  paddingTop: theme.spacing(11),
  transition: theme.transitions.create('margin', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  marginLeft: `-${drawerWidth}px`,
  ...(open && {
    transition: theme.transitions.create('margin', {
      easing: theme.transitions.easing.easeOut,
      duration: theme.transitions.duration.enteringScreen,
    }),
    marginLeft: 0,
  }),
}));

export default Main
