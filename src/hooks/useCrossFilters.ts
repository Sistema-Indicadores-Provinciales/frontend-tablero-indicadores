// src/hooks/useCrossFilters.ts
import { useState, useEffect, useMemo, useRef } from "react";

type DefaultValue = "latest" | "max" | "all" | string | number;
type SortOrder = "asc" | "desc" | "none";

interface SingleFilterDef {
    type: "single";
    col: string;
    default: DefaultValue;
    labelCol?: string;
    sort?: SortOrder;
}

interface MultipleFilterDef {
    type: "multiple";
    col: string;
    default: "all";
    labelCol?: string;
    sort?: SortOrder;
}

type FilterDef = SingleFilterDef | MultipleFilterDef;
type FilterValue = string | number | (string | number)[];

interface FilterOption {
    value: string | number;
    label: string;
}

type FiltersConfig = Record<string, FilterDef>;
type FiltersState = Record<string, FilterValue>;
type AvailableOptions = Record<string, FilterOption[]>;

// Ordena las opciones según el sort configurado
const sortOptions = (options: FilterOption[], sort: SortOrder = "none"): FilterOption[] => {
    if (sort === "none") return options;

    return [...options].sort((a, b) => {
        const aNum = Number(a.value);
        const bNum = Number(b.value);
        const isNumeric = !isNaN(aNum) && !isNaN(bNum);

        const comparison = isNumeric
            ? aNum - bNum
            : String(a.label).localeCompare(String(b.label));

        return sort === "desc" ? -comparison : comparison;
    });
};

// Devuelve opciones únicas de una columna dado un subset de datos
const getUniqueOptions = (
    data: Record<string, any>[],
    def: FilterDef,
): FilterOption[] => {
    const seen = new Set<string>();
    const options: FilterOption[] = [];

    data.forEach(row => {
        const value = row[def.col];
        const label = def.labelCol ? row[def.labelCol] : value;
        const key = String(value);
        if (value !== null && value !== undefined && !seen.has(key)) {
            seen.add(key);
            options.push({ value, label: String(label) });
        }
    });

    return sortOptions(options, def.sort);
};

// Filtra el dataset aplicando todos los filtros EXCEPTO el targetKey
const filterExcluding = (
    data: Record<string, any>[],
    config: FiltersConfig,
    state: FiltersState,
    targetKey: string,
): Record<string, any>[] => {
    return data.filter(row =>
        Object.entries(config).every(([key, def]) => {
            if (key === targetKey) return true;
            const val = state[key];
            if (val === undefined || val === null) return true;
            const rowVal = row[def.col];
            if (Array.isArray(val)) {
                return val.length === 0 || val.map(String).includes(String(rowVal));
            }
            return String(rowVal) === String(val);
        })
    );
};

// Calcula el valor default para un filtro dado sus opciones
const computeDefault = (
    def: FilterDef,
    options: FilterOption[],
): FilterValue => {
    if (options.length === 0) return def.type === "multiple" ? [] : "";

    if (def.type === "multiple") return options.map(o => o.value);

    if (def.default === "latest") {
        const sorted = [...options].sort((a, b) => {
            const aNum = Number(a.value);
            const bNum = Number(b.value);
            if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
            return String(a.value).localeCompare(String(b.value));
        });
        return sorted[sorted.length - 1].value;
    }

    if (def.default === "max") {
        return options.reduce((max, o) =>
            Number(o.value) > Number(max) ? o.value : max,
            options[0].value
        );
    }

    const found = options.find(o => String(o.value) === String(def.default));
    return found ? found.value : options[0].value;
};

export const useCrossFilters = (
    data: Record<string, any>[] | null,
    config: FiltersConfig,
) => {
    const [state, setState] = useState<FiltersState>({});
    const [initialized, setInitialized] = useState(false);

    // Guarda las opciones anteriores para detectar cuáles son nuevas
    const prevAvailableRef = useRef<AvailableOptions>({});

    // Inicialización
    useEffect(() => {
        if (!data || data.length === 0 || initialized) return;

        const initial: FiltersState = {};

        Object.entries(config).forEach(([key, def]) => {
            const subset = filterExcluding(data, config, initial, key);
            const options = getUniqueOptions(subset, def);
            initial[key] = computeDefault(def, options);
        });

        setState(initial);
        setInitialized(true);
    }, [data]);

    // Opciones disponibles para cada filtro considerando el estado actual
    const availableOptions = useMemo<AvailableOptions>(() => {
        if (!data || Object.keys(state).length === 0) return {};

        return Object.keys(config).reduce((acc, key) => {
            const subset = filterExcluding(data, config, state, key);
            acc[key] = getUniqueOptions(subset, config[key]);
            return acc;
        }, {} as AvailableOptions);
    }, [data, state]);

    // Cuando cambian las opciones disponibles, corrige y expande selecciones
    useEffect(() => {
        if (!initialized || Object.keys(availableOptions).length === 0) return;

        // Capturamos las opciones anteriores ANTES de cualquier setState
        const prevAvailable = prevAvailableRef.current;

        setState(prev => {
            const next = { ...prev };
            let changed = false;

            Object.entries(config).forEach(([key, def]) => {
                const options = availableOptions[key];
                const prevOptions = prevAvailable[key] ?? [];
                if (!options || options.length === 0) return;

                const current = next[key];

                if (def.type === "single") {
                    const exists = options.some(o => String(o.value) === String(current));
                    if (!exists) {
                        next[key] = options[0].value;
                        changed = true;
                    }
                } else {
                    const currentArr = current as (string | number)[];

                    // Solo agregamos opciones nuevas que aparecieron (expandir).
                    // Nunca sacamos valores ya seleccionados por más que momentáneamente
                    // no figuren en las opciones disponibles: eso era lo que hacía que,
                    // al tocar un filtro, otros filtros correlacionados perdieran
                    // selecciones en cascada.
                    const prevValues = new Set(prevOptions.map(o => String(o.value)));
                    const newOptions = options.filter(o => !prevValues.has(String(o.value)));

                    const newValues = newOptions
                        .map(o => o.value)
                        .filter(v => !currentArr.map(String).includes(String(v)));

                    if (newValues.length > 0) {
                        next[key] = [...currentArr, ...newValues];
                        changed = true;
                    }
                }
            });

            return changed ? next : prev;
        });

        // Actualizamos la referencia DESPUÉS del setState, no dentro
        prevAvailableRef.current = availableOptions;

    }, [availableOptions]);
    
    // Cambia un filtro individual
    const setFilter = (key: string, value: FilterValue) => {
    setState(prev => {
        const def = config[key];
        const next = { ...prev, [key]: value };

        // Si es múltiple y se deseleccionan todos → seleccionar todos
        if (def.type === "multiple") {
            const arr = value as (string | number)[];
            if (arr.length === 0) {
                next[key] = availableOptions[key]?.map(o => o.value) ?? [];
            }
        }

        // Recalcula y corrige los demás filtros en el mismo render
        Object.entries(config).forEach(([otherKey, otherDef]) => {
            if (otherKey === key) return;
            if (otherDef.type !== "multiple") return;

            const subset = filterExcluding(data!, config, next, otherKey);
            const newOptions = getUniqueOptions(subset, otherDef);
            const prevOptions = prevAvailableRef.current[otherKey] ?? [];

            const prevValues = new Set(prevOptions.map(o => String(o.value)));
            const addedOptions = newOptions.filter(o => !prevValues.has(String(o.value)));

            if (addedOptions.length === 0) return;

            const currentArr = (next[otherKey] ?? []) as (string | number)[];
            const addedValues = addedOptions
                .map(o => o.value)
                .filter(v => !currentArr.map(String).includes(String(v)));

            if (addedValues.length > 0) {
                next[otherKey] = [...currentArr, ...addedValues];
            }
        });

        return next;
    });
};

    // Resetea todos los filtros a sus defaults
    const clearFilters = () => {
        if (!data) return;

        const reset: FiltersState = {};
        Object.entries(config).forEach(([key, def]) => {
            const subset = filterExcluding(data, config, reset, key);
            const options = getUniqueOptions(subset, def);
            reset[key] = computeDefault(def, options);
        });
        setState(reset);
    };

    // Datos filtrados por todos los filtros activos
    const filteredData = useMemo(() => {
        if (!data || Object.keys(state).length === 0) return [];

        return data.filter(row =>
            Object.entries(config).every(([key, def]) => {
                const val = state[key];
                if (val === undefined || val === null) return true;
                const rowVal = row[def.col];
                if (Array.isArray(val)) {
                    return val.map(String).includes(String(rowVal));
                }
                return String(rowVal) === String(val);
            })
        );
    }, [data, state]);

    return {
        filters: state,
        setFilter,
        clearFilters,
        availableOptions,
        filteredData,
        initialized,
    };
};