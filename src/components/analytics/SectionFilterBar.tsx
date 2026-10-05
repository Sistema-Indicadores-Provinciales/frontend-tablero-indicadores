import { useId, useState } from 'react';
import { Box, Button, Checkbox, Divider, FormControlLabel, InputAdornment, Popover, TextField, Typography } from '@mui/material';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import SearchIcon from '@mui/icons-material/Search';
import { FilterOptions, SectionFilterSelection, SectionFilters } from 'types/Generator';
import { sortFilterValues } from 'utils/sectionFilters';

const searchable = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');

function FilterControl({ column, options, selection, loading, onChange }: {
  column: string; options?: FilterOptions[string]; selection?: SectionFilterSelection; loading: boolean;
  onChange: (selection?: SectionFilterSelection) => void;
}) {
  const id = useId();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [search, setSearch] = useState('');
  const [pendingAll, setPendingAll] = useState(false);
  const selectedValues = selection?.values || [];
  const mode = selectedValues.length ? selection?.mode : undefined;
  const close = () => { setAnchor(null); setSearch(''); setPendingAll(false); };
  const availableSelected = options?.available_selected ?? selectedValues.filter(value =>
    options?.values.includes(value) || (options?.total || 0) > (options?.values.length || 0));
  const unavailable = !loading && options
    ? selectedValues.filter(value => !availableSelected.includes(value) && !options.values.includes(value))
    : [];
  const all = sortFilterValues(column, [...new Set([...(options?.values || []), ...selectedValues])]);
  const shown = all.filter(value => searchable(value).includes(searchable(search)));
  const custom = search.trim();
  const canAddCustom = !loading && !!options && options.total > options.values.length;
  const canUseCustom = canAddCustom && (!mode || mode === 'include' || selectedValues.includes(custom));
  const allSelected = !mode || (mode === 'include' && !!options && options.total > 0 &&
    options.total <= options.values.length && options.values.every(value => selectedValues.includes(value)));
  const active = !!mode;

  const toggleValue = (value: string) => {
    if (pendingAll) {
      onChange({ mode: 'include', values: [value] });
      setPendingAll(false);
      return;
    }
    if (!mode) {
      onChange({ mode: 'exclude', values: [value] });
      return;
    }

    if (mode === 'include') {
      const next = selectedValues.includes(value)
        ? selectedValues.filter(item => item !== value)
        : [...selectedValues, value];
      if (!next.length) { onChange(); return; }
      const coversAll = !!options && options.total > 0 && options.total <= options.values.length &&
        options.values.every(item => next.includes(item));
      onChange(coversAll ? undefined : { mode: 'include', values: next });
      return;
    }

    const next = selectedValues.includes(value)
      ? selectedValues.filter(item => item !== value)
      : [...selectedValues, value];
    if (!next.length) { onChange(); return; }
    const excludesAll = !!options && options.total > 0 && options.total <= options.values.length &&
      options.values.every(item => next.includes(item));
    onChange(excludesAll ? undefined : { mode: 'exclude', values: next });
  };

  const removeValue = (value: string) => {
    const next = selectedValues.filter(item => item !== value);
    onChange(next.length ? { mode: mode || 'include', values: next } : undefined);
  };

  const addCustom = () => {
    if (!canAddCustom || !custom) return;
    if (!mode || pendingAll) onChange({ mode: 'include', values: [custom] });
    else if (mode === 'include' && !selectedValues.includes(custom) && selectedValues.length < 100) {
      onChange({ mode: 'include', values: [...selectedValues, custom] });
    } else if (mode === 'exclude' && selectedValues.includes(custom)) removeValue(custom);
    setPendingAll(false);
    setSearch('');
  };

  const label = !active ? column : mode === 'exclude'
    ? `${column} (excepto ${selectedValues.length})`
    : selectedValues.length === 1 ? `${column}: ${selectedValues[0]}` : `${column} (${selectedValues.length})`;

  return <>
    <Button variant="outlined" className="section-filter-control" data-active={active}
      aria-label={`Filtrar por ${column}`} title={`${column}: ${!active ? 'Todos' : mode === 'exclude' ? `Todos excepto ${selectedValues.join(', ')}` : selectedValues.join(', ')}`}
      aria-haspopup="dialog" aria-expanded={!!anchor} aria-controls={anchor ? id : undefined}
      disabled={!options && !selectedValues.length} endIcon={<ArrowDropDownIcon />}
      onClick={event => { setPendingAll(false); setAnchor(event.currentTarget); }}><span className="section-filter-label">{label}</span></Button>
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
            if (loading) return;
            if (shown.length === 1) toggleValue(shown[0]);
            else if (!shown.length) addCustom();
          }}
          inputProps={{ 'aria-label': `Buscar en ${column}`, maxLength: 2000 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} />
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <FormControlLabel control={<Checkbox size="small" checked={pendingAll ? false : allSelected}
            indeterminate={!pendingAll && active && !allSelected} onChange={() => {
              if (pendingAll) { onChange(); setPendingAll(false); }
              else if (allSelected) setPendingAll(true);
              else { onChange(); setPendingAll(false); }
            }} />} label={<Typography fontSize={13}>Todos</Typography>} />
          <Typography fontSize={11} color="text.secondary">
            {pendingAll ? 'Elegí al menos un valor' : !active ? 'Sin restricciones' : mode === 'exclude' ? `${selectedValues.length} excluidos` : `${selectedValues.length} seleccionados`}
          </Typography>
        </Box>
      </Box>
      <Divider />
      {loading && <Typography role="status" fontSize={12} color="text.secondary" sx={{ px: 1.5, py: 1 }}>Actualizando opciones…</Typography>}
      <Box component="ul" aria-label={`Valores de ${column}`} sx={{ listStyle: 'none', p: .5, m: 0, overflowY: 'auto', minHeight: 0 }}>
        {shown.map(value => {
          const checked = pendingAll ? false : mode === 'exclude' ? !selectedValues.includes(value) : mode === 'include' ? selectedValues.includes(value) : true;
          const adding = pendingAll || !mode || !selectedValues.includes(value);
          return <Box component="li" key={value} sx={{ display: 'flex', alignItems: 'center', px: 1, '&:hover': { bgcolor: 'action.hover' } }}>
            <FormControlLabel sx={{ m: 0, flex: 1, minWidth: 0, '.MuiFormControlLabel-label': { minWidth: 0 } }}
              control={<Checkbox size="small" checked={checked}
                disabled={loading || (adding && !pendingAll && !!mode && selectedValues.length >= 100)}
                onChange={() => toggleValue(value)} />}
              label={<Box><Typography fontSize={12} noWrap title={value}>{value || '(Vacío)'}</Typography>
                {unavailable.includes(value) && <Typography component="span" fontSize={11} color="text.secondary">Sin datos con los otros filtros</Typography>}</Box>} />
            {unavailable.includes(value)
              ? <Button size="small" aria-label={`Quitar ${value || '(Vacío)'}`} sx={{ fontSize: 10, minWidth: 66, ml: .5 }}
                  onClick={() => removeValue(value)}>Quitar</Button>
              : <Button size="small" disabled={loading || !options} aria-label={`Solamente ${value || '(Vacío)'}`} sx={{ fontSize: 10, minWidth: 66, ml: .5 }}
                  onClick={() => { onChange({ mode: 'include', values: [value] }); close(); }}>Solamente</Button>}
          </Box>;
        })}
        {!shown.length && !loading && <Typography component="li" fontSize={12} color="text.secondary" sx={{ p: 1 }}>
          {!options ? 'No se pudieron cargar las opciones. Reintentá el gráfico.' : search ? 'Sin coincidencias' : 'Sin opciones para los filtros seleccionados'}
        </Typography>}
      </Box>
      {canUseCustom && custom && !shown.length && <Button size="small"
        disabled={mode === 'include' && !selectedValues.includes(custom) && selectedValues.length >= 100}
        onClick={addCustom} sx={{ flexShrink: 0 }}>Usar «{custom}»</Button>}
      {canAddCustom && <Typography fontSize={11} color="text.secondary" sx={{ px: 1.5, py: 1 }}>Se muestran 100 sugerencias. Podés escribir otro valor y presionar Enter.</Typography>}
    </Popover>
  </>;
}

export default function SectionFilterBar({ columns, options, values, loading, onChange }: {
  columns: string[]; options: FilterOptions; values: SectionFilters; loading: boolean; onChange: (values: SectionFilters) => void;
}) {
  const update = (column: string, selection?: SectionFilterSelection) => {
    const next = { ...values };
    if (selection?.values.length) next[column] = selection;
    else delete next[column];
    onChange(next);
  };
  return <Box component="section" aria-label="Filtros de la sección" className="section-filter-bar">
    <div className="section-filter-controls">
      {columns.map(column => <FilterControl key={column} column={column} options={options[column]} selection={values[column]} loading={loading}
        onChange={selection => update(column, selection)} />)}
    </div>
    <Button className="section-filter-clear" size="small" variant="contained" onClick={() => onChange({})}>Limpiar filtros</Button>
  </Box>;
}
