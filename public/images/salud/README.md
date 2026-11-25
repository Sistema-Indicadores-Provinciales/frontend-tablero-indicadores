# Ilustraciones originales de Salud

Recuperadas del informe de Looker el 25/11/2026, sin modificar sus archivos PNG. Son recursos decorativos: los números, filtros, gráficos y mapas siguen consultando las fuentes de datos existentes.

Informe: https://lookerstudio.google.com/reporting/3eb11b05-79b1-4942-82be-41c8048dbc53

| Página original | Recursos |
| --- | --- |
| `p_o1qe3ms9jd` — Informe diario COVID-19 | covid-sintomas, covid-hisopado, covid-recuperacion |
| `p_ajtfpcxakd` — Informe diario dengue | dengue-prevencion, barrios, vivienda, vivienda-trabajada, vivienda-cerrada, mosquito, hospital, movil-sanitario |
| `p_rt7oscakld` — Vacunación COVID-19 | covid-virus, vacuna, lavado-manos, barbijo |
| `p_04nasy8kld` — Vacunación dengue | dengue-vacunacion y dos usos del mismo recurso vacuna |

Se reutiliza el archivo de vacuna porque las tres instancias originales son idénticas. El mosquito adicional situado fuera del lienzo visible del informe diario de dengue no se incorpora. Son 16 archivos distintos y 18 apariciones visibles entre las cuatro secciones.

La asociación y distribución están en `src/components/analytics/healthSectionDesigns.ts`. Usan los identificadores estables de los gráficos importados, también conservados al publicar, sin depender del nombre o la ruta de la sección. Los gráficos nuevos mantienen la presentación habitual; al eliminar uno no se vuelve a crear. No se modifica la configuración guardada ni se necesita una migración de base de datos.

Validación: 17 pruebas de navegador (ilustraciones y filtros de sección), compilación TypeScript y build de producción satisfactorios. Revisión local con Google Sheets conectado en las cuatro páginas. Para COVID, los diez contadores del 23/11/2026 coinciden con la referencia del original. Esta entrega cambia la presentación, no constituye una nueva auditoría de todas las combinaciones de filtros.
