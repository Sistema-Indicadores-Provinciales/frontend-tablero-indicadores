import { Box } from '@mui/material'
import Grid from '@mui/material/Grid2'
import SectionCard from 'components/common/SectionCard'
import { AuthContext } from 'contexts/AuthContext';
import NavbarContext from 'contexts/NavbarContext';
import { useContext, useEffect, useState } from 'react';
import IndicatorRoute from 'types/IndicatorRoutes.types'

interface IndexerProps {
  title?: string;
  routes: IndicatorRoute[];
  main?: boolean;
  action?: React.ReactNode;
}

const headTitle = 'indice tablero de'
const cardTransitionDelay = 60;

const Indexer: React.FC<IndexerProps> = (props) => {
  const [listRoutes, setListRoutes] = useState<IndicatorRoute[]>([])
  const { authUser, accessKeynames } = useContext(AuthContext);
  const { changeNavTitle } = useContext(NavbarContext);

  useEffect(() => {
    changeNavTitle(props.title ? `${headTitle} ${props.title}` : '')
  }, [props.title])

  // console.log('Consola de Indexer.tsx:', accessKeynames)

  useEffect(() => {
    if (props.main) {
      if (authUser) {
        const list = props.routes
          .filter(route => route.show)
          .filter(route => accessKeynames.includes(route.keyname ?? ''));
        setListRoutes(list);
      }
    } else {
      setListRoutes(props.routes);
    }
  }, [props.routes, accessKeynames]);

  return (
    <Box sx={{ flexGrow: 1 }}>
      <Grid container spacing={5}>
        {props.action && <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3, xl: 2 }}>{props.action}</Grid>}
        {
          listRoutes?.map((route, index) => (
            <Grid key={route.path} size={{ xs: 12, sm: 6, md: 4, lg: 3, xl: 2 }}>
              <SectionCard key={`sectioncard-${route.title}-${index}`} {...route} transitionDelay={(index + 1) * cardTransitionDelay} />
            </Grid>
          ))
        }
      </Grid>
    </Box>
  )
}

export default Indexer
