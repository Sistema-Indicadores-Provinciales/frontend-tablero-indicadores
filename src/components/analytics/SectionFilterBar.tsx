import { useId, useState } from 'react';
import { Box, Button, Checkbox, Divider, FormControlLabel, InputAdornment, Popover, TextField, Typography } from '@mui/material';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import SearchIcon from '@mui/icons-material/Search';
import { FilterOptions, SectionFilters } from 'types/Generator';
import { sortFilterValues } from 'utils/sectionFilters';

const searchable = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');

function FilterControl({ column, options, selected, onChange }: {
  column: string; options?: FilterOptions[string]; selected: string[]; onChange: (values: string[]) => void;
}) {
  const id = useId();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [search, setSearch] = useState('');
  const close = () => { setAnchor(null); setSearch(''); };
  const all = sortFilterValues(column, [...new Set([...(options?.values || []), ...selected])]);
  const shown = all.filter(value => searchable(value).includes(searchable(search)));
  const custom = search.trim();
  const addCustom = () => {
    if (custom && !selected.includes(custom) && selected.length < 100) { onChange([...selected, custom]); setSearch(''); }
  };
  const label = selected.length === 1 ? `${column}: ${selected[0]}` : `${column}${selected.length ? ` (${selected.length})` : ''}`;
  return <>
    <Button variant="outlined" className="section-filter-control" data-active={!!selected.length}
      aria-label={`Filtrar por ${column}`} title={`${column}: ${selected.length ? selected.join(', ') : 'Todos'}`}
      aria-haspopup="dialog" aria-expanded={!!anchor} aria-controls={anchor ? id : undefined}
      disabled={!options && !selected.length} endIcon={<ArrowDropDownIcon />}
      onClick={event => setAnchor(event.currentTarget)}><span className="section-filter-label">{label}</span></Button>
    <Popover open={!!anchor} anchorEl={anchor} onClose={close} disableScrollLock
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }} transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      slotProps={{ paper: { id, role: 'dialog', 'aria-label': `Filtrar por ${column}`, sx: {
        width: 310, maxWidth: 'calc(100vw - 24px)', maxHeight: 'min(460px, calc(100dvh - 100px))',
        display: 'flex', flexDirection: 'column', border: 1, borderColor: 'divider', mt: .5,
      } } }}>
      <Typography fontWeight={600} fontSize={13} sx={{ px: 2, py: 1, bgcolor: 'app.elevated' }}>{column}</Typography>
      <Box sx={{ px: 1.5, pt: 1 }}>
        <TextField autoFocus fullWidth size="small" value={search} placeholder="Buscar un valor"
          onChange={event => setSearch(event.target.value)} onKeyDown={event => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            if (shown.length === 1 && !selected.includes(shown[0]) && selected.length < 100) onChange([...selected, shown[0]]);
            else if (!shown.length) addCustom();
          }}
          inputProps={{ 'aria-label': `Buscar en ${column}`, maxLength: 2000 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} />
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <FormControlLabel control={<Checkbox size="small" checked={!selected.length} onChange={() => onChange([])} />} label={<Typography fontSize={13}>Todos</Typography>} />
          <Typography fontSize={11} color="text.secondary">{selected.length ? `${selected.length} seleccionados` : 'Sin restricciones'}</Typography>
        </Box>
      </Box>
      <Divider />
      <Box component="ul" aria-label={`Valores de ${column}`} sx={{ listStyle: 'none', p: .5, m: 0, overflowY: 'auto', minHeight: 0 }}>
        {shown.map(value => <Box component="li" key={value} sx={{ display: 'flex', alignItems: 'center', px: 1, '&:hover': { bgcolor: 'action.hover' } }}>
          <FormControlLabel sx={{ m: 0, flex: 1, minWidth: 0, '.MuiFormControlLabel-label': { minWidth: 0 } }}
            control={<Checkbox size="small" checked={selected.includes(value)} disabled={selected.length >= 100 && !selected.includes(value)}
              onChange={(_, checked) => onChange(checked ? [...selected, value] : selected.filter(item => item !== value))} />}
            label={<Typography fontSize={12} noWrap title={value}>{value || '(Vacío)'}</Typography>} />
          <Button size="small" aria-label={`Solamente ${value || '(Vacío)'}`} sx={{ fontSize: 10, minWidth: 66, ml: .5 }}
            onClick={() => { onChange([value]); close(); }}>Solamente</Button>
        </Box>)}
        {!shown.length && <Typography component="li" fontSize={12} color="text.secondary" sx={{ p: 1 }}>Sin coincidencias</Typography>}
      </Box>
      {custom && !shown.length && <Button size="small" disabled={selected.length >= 100} onClick={addCustom} sx={{ flexShrink: 0 }}>Usar «{custom}»</Button>}
      {(options?.total || 0) > 100 && <Typography fontSize={11} color="text.secondary" sx={{ px: 1.5, py: 1 }}>Se muestran 100 sugerencias. Podés escribir otro valor y presionar Enter.</Typography>}
    </Popover>
  </>;
}

export default function SectionFilterBar({ columns, options, values, onChange }: {
  columns: string[]; options: FilterOptions; values: SectionFilters; onChange: (values: SectionFilters) => void;
}) {
  const count = Object.values(values).filter(v => v.length).length;
  return <Box component="section" aria-label="Filtros de la sección" className="section-filter-bar">
    <div className="section-filter-controls">
      {columns.map(column => <FilterControl key={column} column={column} options={options[column]} selected={values[column] || []}
        onChange={selected => onChange({ ...values, [column]: selected })} />)}
    </div>
    <Button className="section-filter-clear" size="small" variant="contained" disabled={!count} onClick={() => onChange({})}>Limpiar filtros</Button>
  </Box>;
}
