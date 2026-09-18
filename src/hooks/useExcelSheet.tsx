import { useState, useEffect } from "react";
import { analytics } from "config/Analytics";

interface ColumnMeta {
    type: string;
    unique_values: (string | number)[];
}

export interface ExcelSheetData {
    columns: string[];
    column_meta: Record<string, ColumnMeta>;
    data: Record<string, any>[];
}

export const useExcelSheet = (filename: string, sheetName: string) => {
    const [data, setData] = useState<ExcelSheetData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!filename || !sheetName) return;

        setLoading(true);
        setError(null);

        const formData = new FormData();
        formData.append("filename", filename);
        formData.append("sheet_name", sheetName);

        analytics.post(`/system-data/read-columns/`, formData)
            .then(res => setData(res.data))
            .catch(err => {
                const msg =
                    err?.response?.data?.detail ||
                    "Error al cargar los datos";

                setError(msg);
            })
            .finally(() => setLoading(false));

    }, [filename, sheetName]);

    return { data, loading, error };
};