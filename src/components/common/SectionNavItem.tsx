import { ListItem, ListItemButton, ListItemIcon, Typography } from '@mui/material'
import { Icon } from '@iconify/react'
import { Location, NavigateFunction } from 'react-router-dom';
import IndicatorRoute from 'types/IndicatorRoutes.types';
import { baseIconIconify } from 'config/constants';

interface SectionNavItemProps extends IndicatorRoute {
  location: Location;
  navigate: NavigateFunction;
}

const SectionNavItem: React.FC<SectionNavItemProps> = ({ icon, path, title, location, navigate }) => {
  return (
    <ListItem disablePadding>
      <ListItemButton selected={location.pathname === path || location.pathname.startsWith(path + '/')} onClick={() => navigate(path)}>
        <ListItemIcon><Icon icon={icon ?? baseIconIconify} fontSize={24} /></ListItemIcon>
        <Typography fontSize={18} textTransform='uppercase'>{title}</Typography>
      </ListItemButton>
    </ListItem>
  )
}

export default SectionNavItem
