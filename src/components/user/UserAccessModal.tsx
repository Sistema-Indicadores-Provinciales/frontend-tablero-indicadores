import React, { useContext, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Switch,
  FormControlLabel,
  Collapse,
  Box,
  IconButton,
  Typography,
} from '@mui/material';
import { ExpandMore, ExpandLess } from '@mui/icons-material';
import { Icon } from '@iconify/react';
import User from 'types/User';
import { AuthContext } from 'contexts/AuthContext';
import { getAllDashboards } from 'services/DashboardServices';
import {
  updateUserAccess,
} from 'services/UserServices';

interface SectionType {
  _id: string;
  keyname: string;
  name: string
}

interface DashboardType {
  generatedWorkspaceId?: string;
  _id: string;
  keyname: string;
  icon: string;
  sections: SectionType[];
  name: string
}

interface AccessState {
  [dashboardId: string]: {
    enabled: boolean;
    sections: { [sectionId: string]: boolean };
  };
}

interface UserAccessModalProps {
  item?: User;
  show: boolean;
  onAccept: () => any;
  onClose: () => any;
}

const UserAccessModal: React.FC<UserAccessModalProps> = ({
  item,
  show,
  onAccept,
  onClose,
}) => {
  const [dashboards, setDashboards] = useState<DashboardType[]>([]);
  const [accessState, setAccessState] = useState<AccessState>({});
  const [expanded, setExpanded] = useState<{ [dashId: string]: boolean }>({});

  const { refreshAccessKeynames } = useContext(AuthContext);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (show && item) {
      loadDashboards();
    }
  }, [show, item]);

  const loadDashboards = async () => {
    setLoading(true); setLoaded(false); setError('');
    try {
      const res = await getAllDashboards();
      if (!res.success) throw new Error(res.error || 'No se pudieron cargar los tableros.');
      if (res.data) {
        const dashboardsData = res.data as DashboardType[];
        setDashboards(dashboardsData);

        const init: AccessState = {};
        dashboardsData.forEach((dash) => {
          const acc = item?.access.find((a) => a.dashboard === dash._id);
          init[dash._id] = {
            enabled: !!acc,
            sections: dash.sections.reduce((m, sec) => {
              m[sec._id] = acc ? acc.sections.includes(sec._id) : false;
              return m;
            }, {} as Record<string, boolean>),
          };
        });

        setAccessState(init);
        setLoaded(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los tableros.');
    } finally { setLoading(false); }
  };

  // const getAccessChanges = () => {
  //   const added: DashboardAccess[] = [];
  //   const removed: string[] = [];
  //   const updated: DashboardAccess[] = [];

  //   for (const dashId of Object.keys(accessState)) {
  //     const before = initialAccessState[dashId];
  //     const now = accessState[dashId];
  //     const selectedSecs = Object.keys(now.sections).filter((s) => now.sections[s]);

  //     if (!before.enabled && now.enabled) {
  //       added.push({ dashboard: dashId, sections: selectedSecs });
  //     }
  //     if (before.enabled && !now.enabled) {
  //       removed.push(dashId);
  //     }
  //     if (before.enabled && now.enabled) {
  //       const diff = selectedSecs.filter((s) => before.sections[s] !== now.sections[s]);
  //       if (diff.length) {
  //         updated.push({ dashboard: dashId, sections: selectedSecs });
  //       }
  //     }
  //   }

  //   return { added, removed, updated };
  // };

  const handleDashboardToggle = (dashId: string) =>
    setAccessState((prev) => {
      const cur = prev[dashId];
      const en = !cur.enabled;
      const generated = dashboards.find(d => d._id === dashId)?.generatedWorkspaceId;
      const secs = en ? (generated ? Object.fromEntries(Object.keys(cur.sections).map(s => [s, true])) : cur.sections) : Object.fromEntries(Object.keys(cur.sections).map((s) => [s, false]));
      return { ...prev, [dashId]: { enabled: en, sections: secs } };
    });

  const handleSectionToggle = (dashId: string, secId: string) =>
    setAccessState((prev) => {
      const cur = prev[dashId];
      const newVal = !cur.sections[secId];
      return {
        ...prev,
        [dashId]: {
          enabled: cur.enabled || newVal,
          sections: { ...cur.sections, [secId]: newVal },
        },
      };
    });

  const handleSave = async () => {
    if (!item?._id || !loaded || saving) return;
    const userId = item._id;

    // Construir el array completo a partir de accessState:
    const fullAccess = Object.entries(accessState)
    .filter(([_, state]) => state.enabled) // Solo tomamos dashboards habilitados
    .map(([dashboard, state]) => ({
      dashboard,
      sections: Object.entries(state.sections)
        .filter(([, hasAccess]) => hasAccess)
        .map(([sectionId]) => sectionId),
    }));

    setSaving(true); setError('');

    try {
      const response = await updateUserAccess(userId, fullAccess);
      if (!response.success) throw new Error(response.error || 'No se pudieron guardar los accesos.');
      await refreshAccessKeynames();
      onAccept();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron actualizar los accesos. Reintentá.');
    } finally { setSaving(false); }
  };


  return (
    <Dialog open={show} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Gestionar Accesos</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error">{error}</Alert>}
        {loading && <Typography role="status">Cargando tableros…</Typography>}
        <Container>
          {dashboards.map((dash) => (
            <Box key={dash._id} mb={2} border={1} borderRadius={2} p={1} borderColor="grey.300">
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box display="flex" alignItems="center">
                  {dash.icon && <Icon icon={dash.icon} style={{ fontSize: 24, marginRight: 8 }} />}
                  <Typography variant="subtitle1">{dash.name}</Typography>
                </Box>
                <Box display="flex" alignItems="center">
                  <FormControlLabel
                    control={
                      <Switch
                        disabled={loading || saving}
                        checked={accessState[dash._id]?.enabled || false}
                        onChange={() => handleDashboardToggle(dash._id)}
                      />
                    }
                    label="Acceso"
                  />
                  <IconButton aria-label={`Secciones de ${dash.name}`} onClick={() => setExpanded((e) => ({ ...e, [dash._id]: !e[dash._id] }))}>
                    {expanded[dash._id] ? <ExpandLess /> : <ExpandMore />}
                  </IconButton>
                </Box>
              </Box>
              <Collapse in={expanded[dash._id]}>
                <Box ml={4} mt={1}>
                  {dash.sections.map((sec) => (
                    <FormControlLabel
                      key={sec._id}
                      control={
                        <Switch
                          disabled={loading || saving || !accessState[dash._id]?.enabled}
                          checked={accessState[dash._id]?.sections[sec._id] || false}
                          onChange={() => handleSectionToggle(dash._id, sec._id)}
                        />
                      }
                      label={sec.name}
                    />
                  ))}
                </Box>
              </Collapse>
            </Box>
          ))}
        </Container>
      </DialogContent>
      <DialogActions>
        <Button disabled={saving} onClick={onClose}>Cancelar</Button>
        <Button disabled={saving || loading || !loaded} onClick={handleSave}>{saving ? 'Guardando…' : 'Guardar'}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default UserAccessModal;
