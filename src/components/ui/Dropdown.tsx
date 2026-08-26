// src/components/ui/Dropdown.tsx
import React, { useState, useRef, useEffect } from "react";
import {
    Box,
    Typography,
    Checkbox,
    TextField,
    Divider,
    Paper,
    InputAdornment,
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import SearchIcon from "@mui/icons-material/Search";

export interface DropdownOption {
    value: string | number;
    label: string;
}

interface SingleProps {
    label: string;
    options: DropdownOption[];
    value: string | number;
    onChange: (value: string | number) => void;
    multiple?: false;
    searchable?: boolean;
    width?: number;
}

interface MultipleProps {
    label: string;
    options: DropdownOption[];
    value: (string | number)[];
    onChange: (value: (string | number)[]) => void;
    multiple: true;
    searchable?: boolean;
    width?: number;
}

type Props = SingleProps | MultipleProps;

const Dropdown: React.FC<Props> = ({
    label,
    options,
    value,
    onChange,
    multiple = false,
    searchable = false,
    width = 200,
}) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");

    // Estado interno para selección múltiple mientras el dropdown está abierto
    // null significa que no hay cambios pendientes, usa el value externo
    const [internalValue, setInternalValue] = useState<(string | number)[] | null>(null);
    const [pending, setPending] = useState(false);

    const containerRef = useRef<HTMLDivElement>(null);

    // Al abrir, sincroniza el valor interno con el externo
    const handleOpen = () => {
        if (multiple) {
            setInternalValue([...(value as (string | number)[])]);
            setPending(false);
        }
        setOpen(true);
    };

    // Al cerrar
    const handleClose = () => {
        if (multiple) {
            if (pending) {
                // Estaba pendiente y cerró sin seleccionar nada → revertir, no llamar onChange
                setInternalValue(null);
                setPending(false);
            } else if (internalValue !== null) {
                // Había cambios normales → ya se fueron aplicando en tiempo real
                setInternalValue(null);
            }
        }
        setOpen(false);
        setSearch("");
    };

    // Cierra al clickear fuera
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                handleClose();
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [pending, internalValue]);

    // Toggle de todos
    const handleToggleAll = () => {
        if (!multiple) return;
        const current = internalValue ?? (value as (string | number)[]);

        if (current.length === options.length) {
            // Destilda todos → entra en pendiente, solo cambia internamente
            setInternalValue([]);
            setPending(true);
            // NO llama onChange, el gráfico no cambia
        } else {
            // Selecciona todos → aplica inmediatamente
            const all = options.map(o => o.value);
            setInternalValue(all);
            setPending(false);
            (onChange as MultipleProps["onChange"])(all);
        }
    };

    // Toggle de una opción individual
    const handleMultiToggle = (optValue: string | number) => {
        if (!multiple) return;
        const current = internalValue ?? (value as (string | number)[]);

        const updated = current.includes(optValue)
            ? current.filter(v => v !== optValue)
            : [...current, optValue];

        setInternalValue(updated);

        if (pending) {
            // Estaba pendiente, el usuario seleccionó algo → confirma y aplica
            if (updated.length > 0) {
                setPending(false);
                (onChange as MultipleProps["onChange"])(updated);
            }
            // Si updated sigue vacío (caso imposible porque acaba de seleccionar) no hace nada
        } else {
            // Comportamiento normal → aplica inmediatamente
            if (updated.length === 0) {
                // No puede quedar vacío → selecciona todos
                const all = options.map(o => o.value);
                setInternalValue(all);
                (onChange as MultipleProps["onChange"])(all);
            } else {
                (onChange as MultipleProps["onChange"])(updated);
            }
        }
    };

    // Selecciona únicamente esta opción, descartando el resto
    const handleOnly = (optValue: string | number) => {
        if (!multiple) return;
        setInternalValue([optValue]);
        setPending(false);
        (onChange as MultipleProps["onChange"])([optValue]);
    };
    
    // Texto del botón — usa el valor externo (el confirmado), no el interno
    const getButtonText = (): string => {
        if (!multiple) {
            const selected = options.find(o => o.value === value);
            return selected ? `${label}: ${selected.label}` : label;
        }

        const selectedValues = value as (string | number)[];
        if (selectedValues.length === 0) return `${label}: Ninguno`;
        if (selectedValues.length === options.length) return label;

        const selectedLabels = options
            .filter(o => selectedValues.includes(o.value))
            .map(o => o.label);

        return `${label}: (${selectedLabels.length}) ${selectedLabels.join(", ")}`;
    };

    const filteredOptions = searchable && search
        ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
        : options;

    const selectedValues = multiple
        ? (internalValue ?? (value as (string | number)[])) 
        : [];
    const allSelected = multiple && selectedValues.length === options.length;
    const someSelected = multiple && selectedValues.length > 0 && !allSelected;

    return (
        <Box ref={containerRef} sx={{ position: "relative", width }}>

            {/* Botón */}
            <Box
                onClick={() => open ? handleClose() : handleOpen()}
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "6px 10px",
                    border: "1px solid",
                    borderColor: open ? "primary.main" : "#cbd5e1",
                    borderRadius: "6px",
                    background: "#fff",
                    cursor: "pointer",
                    userSelect: "none",
                    "&:hover": { borderColor: "primary.main" },
                }}
            >
                <Typography
                    sx={{
                        fontSize: "13px",
                        color: "#1e293b",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: width - 40,
                    }}
                >
                    {getButtonText()}
                </Typography>
                {open
                    ? <KeyboardArrowUpIcon sx={{ fontSize: 18, color: "#64748b", flexShrink: 0 }} />
                    : <KeyboardArrowDownIcon sx={{ fontSize: 18, color: "#64748b", flexShrink: 0 }} />
                }
            </Box>

            {/* Panel desplegable */}
            {open && (
                <Paper
                    elevation={4}
                    sx={{
                        position: "absolute",
                        top: "calc(100% + 4px)",
                        left: 0,
                        zIndex: 200,
                        minWidth: width,
                        maxHeight: "260px",
                        display: "flex",
                        flexDirection: "column",
                        borderRadius: "8px",
                        overflow: "hidden",
                    }}
                >
                    {/* Búsqueda */}
                    {searchable && (
                        <Box sx={{ padding: "8px 8px 4px" }}>
                            <TextField
                                size="small"
                                placeholder="Buscar..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                autoFocus
                                fullWidth
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <SearchIcon sx={{ fontSize: 16 }} />
                                        </InputAdornment>
                                    ),
                                }}
                                sx={{ "& .MuiInputBase-input": { fontSize: "13px" } }}
                            />
                        </Box>
                    )}

                    {/* Toggle todos — solo en múltiple */}
                    {multiple && (
                        <>
                            <Box
                                onClick={handleToggleAll}
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    padding: "4px 12px",
                                    cursor: "pointer",
                                    "&:hover": { background: "#f1f5f9" },
                                }}
                            >
                                <Checkbox
                                    size="small"
                                    checked={allSelected}
                                    indeterminate={someSelected || pending}
                                    sx={{ padding: "2px", marginRight: "8px" }}
                                />
                                <Typography sx={{ fontSize: "13px", fontWeight: 600 }}>
                                    Todos
                                </Typography>
                            </Box>
                            <Divider />
                        </>
                    )}

                    {/* Lista de opciones */}
                    <Box sx={{ overflowY: "auto", flex: 1 }}>
                        {filteredOptions.length === 0 ? (
                            <Typography sx={{ fontSize: "13px", color: "#94a3b8", padding: "8px 12px" }}>
                                Sin resultados
                            </Typography>
                        ) : filteredOptions.map(opt => (
                            <Box
                                key={opt.value}
                                onClick={() => {
                                    if (multiple) {
                                        handleMultiToggle(opt.value);
                                    } else {
                                        (onChange as SingleProps["onChange"])(opt.value);
                                        setOpen(false);
                                    }
                                }}
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: multiple ? "space-between" : "flex-start",
                                    padding: multiple ? "4px 12px" : "8px 12px",
                                    cursor: "pointer",
                                    background: !multiple && opt.value === value ? "#eff6ff" : "transparent",
                                    "&:hover": { background: "#f1f5f9" },
                                    "&:hover .dropdown-only-btn": { opacity: 1 },
                                }}
                            >
                                <Box sx={{ display: "flex", alignItems: "center", minWidth: 0 }}>
                                    {multiple && (
                                        <Checkbox
                                            size="small"
                                            checked={selectedValues.includes(opt.value)}
                                            sx={{ padding: "2px", marginRight: "8px" }}
                                        />
                                    )}
                                    <Typography
                                        sx={{
                                            fontSize: "13px",
                                            color: !multiple && opt.value === value ? "primary.main" : "#1e293b",
                                            fontWeight: !multiple && opt.value === value ? 600 : 400,
                                            whiteSpace: "nowrap",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                        }}
                                    >
                                        {opt.label}
                                    </Typography>
                                </Box>

                                {multiple && (
                                    <Typography
                                        className="dropdown-only-btn"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleOnly(opt.value);
                                        }}
                                        sx={{
                                            fontSize: "11px",
                                            fontWeight: 600,
                                            color: "primary.main",
                                            opacity: 0,
                                            flexShrink: 0,
                                            marginLeft: "8px",
                                            "&:hover": { textDecoration: "underline" },
                                        }}
                                    >
                                        Solamente
                                    </Typography>
                                )}
                            </Box>
                        ))}
                    </Box>
                </Paper>
            )}
        </Box>
    );
};

export default Dropdown;