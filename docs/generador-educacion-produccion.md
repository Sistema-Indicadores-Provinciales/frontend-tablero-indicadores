# Generador de Educación sobre producción

La rama de trabajo de ambos repositorios es `codex/generador-educacion-produccion`, abierta en los directorios habituales del proyecto. Las bases son exclusivamente:

- Frontend: `feat/arreglo-componentes`, commit `4a4baeb1623f55c274c3f2f1461fa75cb4b81459`.
- Backend: `feat/arreglo-users`, commit `bfa07711327849fea5ea8b79d9cf07deb12c02c0`.

No se incorporó código de `carga-secciones/educacion` ni de la implementación anterior. Este desarrollo y sus pruebas se realizaron nuevamente desde los archivos de producción. No se hicieron commits ni push.

Frontend y backend están aplicados en sus directorios habituales del proyecto, ambos en `codex/generador-educacion-produccion`. El parche del backend fue comprobado y aplicado después de autorizar la escritura en ese directorio.

## Crear y utilizar campos calculados

Dentro del gráfico, abrir **Campos calculados y condiciones**. Agregar un campo, darle un nombre y elegir una configuración común o escribir una expresión. Aplicar incorpora el campo al borrador; cancelar descarta los cambios del modal.

Las opciones guiadas son cociente, diferencia, variación porcentual, IF, CASE y fórmula personalizada. Los operandos permiten elegir valores por fila o SUM, AVG, MIN, MAX, MEDIAN, COUNT y COUNT_DISTINCT.

| Cálculo | Expresión | Uso |
| --- | --- | --- |
| Cociente por fila | `[NUNCA ASISTIERON] / [MATRICULA]` | Evaluación por fila, categoría DELEGACION, operación Máximo y formato porcentual |
| Cociente agregado | `SUM([NUNCA ASISTIERON]) / SUM([MATRICULA])` | Evaluación agregada: cada grupo usa el cociente de sus totales |
| Variación como proporción | `(SUM([CANTIDAD HORAS]) - SUM([HORAS DE MES ANTERIOR])) / SUM([HORAS DE MES ANTERIOR])` | Formato Proporción × 100 y % |
| Variación ya multiplicada por 100 | La expresión anterior seguida de `* 100` | Formato Valor nominal con % literal |
| Dependencia | `[Tasa] * 2` | Crear también Tasa; la validación detecta referencias faltantes y ciclos |

Un campo por fila puede utilizarse como dimensión o métrica. Un campo agregado puede utilizarse como métrica en los gráficos compatibles y las tablas de resumen. Los indicadores pueden presentar un resultado de texto único. Una tabla por filas utiliza cálculos por fila.

**Copiar desde otro gráfico** recupera todos los campos calculados y sus formatos desde otro gráfico del borrador o una sección propia guardada. Se copia la cadena completa de dependencias. Las copias quedan independientes; no existe propagación automática entre secciones.

Las expresiones personalizadas conservan espacios y saltos de línea al reabrirse. Las configuraciones guiadas guardan sus controles; también se reconocen expresiones aritméticas simples que corresponden a las plantillas.

## CASE por año

En Filtros de la sección, configurar AÑO con selección **Individual**. Se puede elegir un valor inicial, por ejemplo 2025; también se admite comenzar sin selección.

En el editor CASE, agregar las condiciones en el orden deseado y elegir resultados de texto:

```sql
CASE
WHEN [AÑO] = 2024 THEN "$ 61 M"
WHEN [AÑO] = 2025 THEN "$ 891 M"
WHEN [AÑO] = 2026 THEN "$ 581 M"
ELSE NULL
END
```

Elegir ese campo como valor del indicador. Los resultados de CASE también pueden ser números, otro campo o NULL. Cada condición permite elegir el campo, la comparación y el resultado. Cancelar no conserva el borrador.

## Condiciones de visualización

El mismo modal tiene un apartado independiente para decidir cuándo mostrar el valor y qué texto alternativo presentar. Se pueden agregar conteos con AND u OR, escribir una condición personalizada, ocultar ceros y configurar el texto para vacíos.

| Necesidad | Condición para mostrar |
| --- | --- |
| Hasta un registro con MES | `COUNT([MES]) <= 1` |
| Un único MES aunque haya varias delegaciones | `COUNT_DISTINCT([MES]) = 1` |
| Una opción incluida en el filtro AÑO | `SELECTED_COUNT([AÑO]) = 1` |
| Docentes cuando no hay más de un registro y el total no es cero | `COUNT([ESTABLECIMIENTO]) <= 1 AND SUM([DOCENTES]) != 0` |
| Un resultado calculado no nulo | `[Total] IS NOT NULL`, con Total agregado |

COUNT cuenta registros con valor, incluidas repeticiones. COUNT_DISTINCT cuenta valores distintos presentes en los datos. SELECTED_COUNT consulta las opciones incluidas en el filtro; sin selección o con exclusiones devuelve cero. La condición se evalúa sobre los datos filtrados y no sustituye la fórmula del valor.

En **Opciones del gráfico** se conservan y pueden editarse los mecanismos originales de producción: condición mínima del contador, reglas de conteo y suma, cocientes, asignación por categoría, sumandos, texto publicado y condiciones de valor único. Las combinaciones incompatibles generan un mensaje; no se eliminan configuraciones automáticamente para cambiar el tipo de gráfico.

## Filtros, fuentes y hojas

Los filtros de sección permiten elegir campos, selección individual o múltiple, valores iniciales, búsqueda, nombres visibles y orden por un campo de la fuente. Elegir una opción individual reemplaza la anterior. Los valores iniciales se aplican al entrar; limpiar, modificar y actualizar datos respetan el estado posterior del usuario.

En **Filtros propios del gráfico**, agregar un campo y elegir Incluir o Excluir. Se pueden seleccionar o escribir varios valores. Por ejemplo, excluir PRIVADA conserva ESTATAL y cualquier tercera categoría. Excluir ESTATAL conserva PRIVADA y las demás categorías. Estas restricciones se combinan con las restricciones originales y los filtros de sección.

Los gráficos informan qué filtros de sección no tienen en sus columnas. Las opciones de los filtros respetan las restricciones propias de cada gráfico.

**Revisar la lectura** permite recorrer hojas y preparar el próximo gráfico. Cambiar esa hoja no modifica los gráficos existentes. Agregar gráfico toma la fuente y la lectura vigentes. En **Opciones del gráfico** se edita su fuente individual, hoja, encabezado, separador decimal y tipos, y se muestra una vista previa identificada de esa lectura.

Las opciones adicionales existentes —columnas de texto preparadas, combinaciones de hojas y resúmenes de Google— se conservan. Su estructura se puede editar en el apartado avanzado. Las respuestas atrasadas se abortan o descartan. El servicio comparte tablas solamente entre lecturas equivalentes del mismo contexto de usuario y sección; un error de fuente individual se informa sin descartar los demás gráficos.

## Tablas y presentación

- En Opciones del gráfico, seleccionar las columnas visibles de una tabla por filas y activar combinaciones únicas. Los filtros se aplican antes de obtener las combinaciones y limitar las filas.
- Las tablas de resumen mantienen sus dimensiones y ordenamientos. Se pueden elegir dimensiones y utilizar métricas calculadas agregadas.
- Agregar métrica permite varias métricas en los tipos compatibles. **Sin agregación** acepta un único valor distinto por categoría y serie; las repeticiones iguales son válidas y los valores diferentes generan un error.
- El orden de categorías y series permite elegir campo, operación y dirección, conservando los desempates de producción.
- Al limitar categorías, **Otros** vuelve a calcular sobre la unión de los registros restantes. No suma recuentos distintos ni promedios ya resumidos.
- Circulares y anillos permiten valor nominal o porcentaje dentro de cada porción.
- Las barras ECharts permiten etiquetas de valor, etiquetas de una segunda métrica con dos métricas sin agrupación adicional y porcentajes para barras apiladas al 100 %.

Los gráficos nuevos usan ECharts. Los existentes conservan la biblioteca guardada. Los botones para agregar, quitar y reordenar mantienen medidas y alineaciones coherentes. En pantallas pequeñas la configuración y la vista previa pasan a una columna. Un cambio de configuración invalida el resultado anterior.

## Formatos

En el modal de cálculos o en Opciones del gráfico, elegir una métrica o columna y configurar:

- Número sin decimales o con dos decimales.
- Proporción presentada como porcentaje, sin decimales o con dos decimales.
- Valor ya multiplicado por 100, con porcentaje literal.
- Decimales personalizados, separadores de miles y decimales, prefijo, sufijo y texto para vacíos.

Un valor 0,42 con estilo porcentual se presenta como 42 %. Un valor 42 con porcentaje literal se presenta como 42 %. Los números permanecen numéricos durante el cálculo. El formato se aplica en indicadores, tablas, etiquetas, ayudas emergentes y ejes donde corresponde. Si varias métricas tienen formatos diferentes, el eje compartido permanece numérico general y cada ayuda emergente utiliza el formato de su métrica.

Un formato nuevo del indicador sustituye visualmente su formato original. Las propiedades originales permanecen guardadas, incluido su sufijo, sin duplicarlo en la presentación.

## Evaluación, guardado y compatibilidad

El lenguaje admite aritmética, signos, paréntesis, comparaciones, AND, OR, NOT, NULL, IS NULL, IS NOT NULL, IF, CASE, SUM, AVG, MIN, MAX, MEDIAN, COUNT, COUNT_DISTINCT, NULLIF, COALESCE, ROUND, CONCAT y SELECTED_COUNT. Un corchete de cierre en un nombre se escribe como `]]`.

Se utiliza un intérprete con operaciones explícitas, sin ejecutar código arbitrario. Los límites son 2.000 caracteres y 256 elementos por expresión, 40 niveles de sintaxis, 20 campos por gráfico y 1.024 operaciones al expandir dependencias. Se reutilizan hasta 512 árboles compilados, que no contienen datos de usuarios. CONCAT limita sus resultados a 10.000 caracteres. Se rechazan nombres duplicados, referencias inexistentes o circulares, agregaciones anidadas y tipos incompatibles.

La división por cero y los resultados numéricos no finitos producen valores ausentes. Las comparaciones con ausentes son falsas, salvo las comprobaciones de nulidad. ROUND admite entre -10 y 10 posiciones. El formato visual admite hasta 20 decimales.

**Probar expresión en muestra** lee la fuente autorizada, aplica las restricciones y los filtros relevantes y utiliza hasta 20 registros resultantes. La interfaz informa fuente, hoja, tamaño de muestra y cantidad de registros coincidentes. Un agregado probado representa esa muestra; generar el gráfico utiliza la lectura completa dentro de los límites del servicio.

El editor conserva el documento recibido y una revisión. Los valores predeterminados se interpretan en memoria. Al guardar, envía operaciones PATCH únicamente para las propiedades editadas, usando identificadores estables de gráficos. No hay conversión de fórmulas ni migración de documentos.

Guardar sin cambios evita la escritura. Cambiar solamente un título escribe únicamente ese título y no exige leer las fuentes. Una revisión y una comparación atómica detectan conflictos, devuelven 409 y conservan el borrador. Los permisos de fuentes, los accesos de publicación y el aislamiento por usuario se reutilizan de producción.

## Archivos

| Repositorio y archivo | Finalidad |
| --- | --- |
| Frontend: `src/containers/ChartGenerator.tsx` | Borrador original, fuentes y hojas, filtros, métricas, modales, vistas previas y PATCH |
| `src/utils/editorDraft.ts` | Valores de interpretación en memoria, diferencias y aplicación de ediciones explícitas |
| `src/components/analytics/CalculationDialog.tsx` | Campos, condiciones, copia, muestra y formatos con aplicar/cancelar |
| `src/utils/calculationTemplates.ts` | Catálogo y construcción de plantillas, separado de la ejecución |
| `src/components/analytics/WidgetOptionsDialog.tsx` | Lectura por gráfico, preparación, opciones originales, tablas y formatos |
| `src/utils/metricPresentation.ts` | Formato numérico sin modificar el valor calculado |
| `src/components/analytics/GeneratorChart.tsx` | Indicadores, tablas, formatos, etiquetas y bibliotecas existentes |
| `src/components/analytics/SavedChart.tsx` | Presentación de resultados vacíos o alternativos |
| `src/components/analytics/SectionFilterBar.tsx` | Reemplazo de selección individual sobre el control existente |
| `src/containers/SavedDashboard.tsx` | Uso de la configuración individual del filtro publicado |
| `src/components/analytics/SaveDashboardDialog.tsx` | Publicación y accesos solamente cuando se editan explícitamente |
| `src/types/Generator.ts` | Contratos de campos, formatos, filtros y revisión de edición |
| `src/containers/chart-generator.css` | Distribución, temas, medidas de controles y adaptación móvil |
| `tests/browser/education-editor.spec.ts` | Recorridos nuevos de Educación, conservación, fuentes, formatos y modales |
| `tests/browser/editorTestApi.ts` | Simulación del contrato PATCH |
| `tests/browser/generator.spec.ts` | Regresiones del generador y conservación sin escritura |
| `tests/browser/publication.spec.ts` | Publicación explícita y accesos |
| `tests/browser/section-filters.spec.ts` | Selecciones individuales, iniciales, limpieza y filtros existentes |
| `tests/browser/sections.spec.ts` | Creación, guardado y reapertura de secciones |
| `tests/browser/source-availability.spec.ts` | Fuentes ausentes, reemplazo y conservación de opciones |
| `playwright.config.ts` | Inicio directo del servidor Vite de pruebas |
| `README.md` y esta guía | Uso y resultados |
| Backend: `analytics-service/app/expression_engine.py` | Sintaxis, tipos, dependencias, complejidad y evaluación |
| `analytics-service/app/chart_calculations.py` | Cálculos por fila/agregados, condiciones, tablas y recálculo de Otros |
| `analytics-service/app/chart_dependencies.py` | Dependencias de opciones originales y nuevas |
| `analytics-service/app/editor_storage.py` | Documento original, revisión, operaciones parciales y comparación atómica |
| `analytics-service/app/data_engine.py` | Integración sobre el motor original, filtros y ordenamientos |
| `analytics-service/app/generator.py` | Contratos HTTP, prueba de fórmulas, validación, lectura equivalente y PATCH |
| `analytics-service/app/section_snapshots.py` | Fuente efectiva e información de errores por gráfico |
| `analytics-service/app/workspace_access.py` | Conservación de ícono y accesos no editados |
| `analytics-service/tests/test_expression_extensions.py` | Cálculos, tipos, límites, dependencias, tablas y Otros |
| `analytics-service/tests/test_editor_contract.py` | Persistencia exacta, conflictos, fuentes y catálogo de producción |
| `analytics-service/tests/test_education_behaviors.py` | Los ocho escenarios funcionales de Educación con datos sintéticos |
| `analytics-service/tests/test_migration_semantics.py` | Ampliación de Otros a promedios manteniendo las regresiones de producción |
| `README.md` | Contrato de edición y ejecución de pruebas |

## Verificación y límites

Se ejecutaron 218 pruebas del servicio de análisis y 64 pruebas de navegador, todas correctas. El catálogo de solo lectura utilizado es `migrations/looker/salud.json`, incluido en la rama de producción: se verificó la conservación de sus 166 gráficos. Las escrituras se prueban con Mongo en memoria y respuestas HTTP simuladas. Las capturas del editor se revisaron en tema claro y en tema oscuro a 390 px, sin desbordamiento horizontal.

Las tablas por filas conservan el límite de 500 registros y la paginación de 100 por página. Las tablas de resumen y los gráficos conservan el límite de 10.000 valores. Las configuraciones especializadas profundas se editan en su estructura original dentro del apartado avanzado. Los campos copiados no se actualizan automáticamente al editar el origen.

Las conexiones reales a Google y todas las configuraciones de una base desplegada requieren una validación integrada en un entorno de pruebas. Los clientes antiguos que usan PUT sin revisión mantienen su contrato; el control de concurrencia completo corresponde al PATCH del editor nuevo. No se escribieron configuraciones reales durante este desarrollo.

La compilación frontend (`npm run build`, TypeScript y Vite) terminó correctamente; Vite advierte sobre fragmentos mayores de 500 kB. Después de la suite de 64 casos se verificó nuevamente el caso porcentual con sufijo original: correcto.

Después de aplicar el parche, se repitieron las verificaciones en el backend habitual: 218 pruebas de análisis correctas, compilación Python (`python -m compileall -q app`) correcta y compilación Nest (`npm run build`) correcta. La ejecución utilizó una conexión de base ficticia y almacenamiento temporal para impedir escrituras en los datos reales. `git diff --check` terminó sin errores en ambos repositorios.

Las pruebas Nest (`npm test -- --runInBand`) registran 10 suites correctas y 4 fallidas: 34 pruebas correctas y 2 fallidas, con otras dos suites que no cargan. Los fallos corresponden a importaciones `src/sections/sections.schema` y dependencias sin simular en las pruebas de servicios. Los archivos de Nest y su configuración son los de producción, sin modificaciones: `git diff HEAD -- src package.json tsconfig.json tsconfig.build.json` no muestra cambios. Estas fallas quedan registradas por separado de las pruebas de la ampliación.
