import type { Widget } from 'types/Generator';

// Original artwork from the Salud report. These keys refer only to bundled assets;
// no report URLs, credentials or captured chart values are needed at runtime.
export const healthIllustrations = {
  covidSymptoms: { file: 'covid-sintomas.png', label: 'Persona con síntomas de COVID-19' },
  covidTest: { file: 'covid-hisopado.png', label: 'Realización de un hisopado' },
  recovery: { file: 'covid-recuperacion.png', label: 'Recuperación de la salud' },
  denguePrevention: { file: 'dengue-prevencion.png', label: 'Prevención del dengue' },
  neighborhoods: { file: 'barrios.png', label: 'Barrios', monochrome: true },
  home: { file: 'vivienda.png', label: 'Vivienda', monochrome: true },
  visitedHome: { file: 'vivienda-trabajada.png', label: 'Vivienda trabajada', monochrome: true },
  closedHome: { file: 'vivienda-cerrada.png', label: 'Vivienda cerrada', monochrome: true },
  mosquito: { file: 'mosquito.png', label: 'Presencia de mosquitos', monochrome: true },
  hospital: { file: 'hospital.png', label: 'Hospital', monochrome: true },
  vehicle: { file: 'movil-sanitario.png', label: 'Móvil sanitario', monochrome: true },
  virus: { file: 'covid-virus.png', label: 'Ilustración de coronavirus' },
  vaccine: { file: 'vacuna.png', label: 'Vacunación', monochrome: true },
  handwashing: { file: 'lavado-manos.png', label: 'Lavado de manos' },
  mask: { file: 'barbijo.png', label: 'Uso de barbijo' },
  dengueVaccine: { file: 'dengue-vacunacion.png', label: 'Protección frente al dengue' },
} satisfies Record<string, { file: string; label: string; monochrome?: boolean }>;

export type HealthIllustration = keyof typeof healthIllustrations;
export type HealthDesignGroup = {
  title: string;
  artwork?: HealthIllustration[];
  widgets: string[];
  beside?: string[];
};
type HealthSectionDesign = {
  key: string;
  groups: HealthDesignGroup[];
  icons?: Record<string, HealthIllustration>;
};

// Stable IDs were retained when the Looker sections were imported. Matching the
// IDs (not section names or routes) also works after renaming, editing or publishing.
export const healthSectionDesigns: HealthSectionDesign[] = [
  {
    key: 'covid-diario',
    groups: [
      { title: 'Situación epidemiológica', artwork: ['covidSymptoms'], widgets: ['covid-diagnosticados', 'covid-casos-dia', 'covid-activos'], beside: ['covid-localidades'] },
      { title: 'Evolución de los pacientes', artwork: ['recovery'], widgets: ['covid-altas', 'covid-recuperados', 'covid-fallecimientos'] },
      { title: 'Tests y positividad', artwork: ['covidTest'], widgets: ['covid-tests-total', 'covid-tests-dia', 'covid-positividad', 'covid-positividad-dia'] },
    ],
  },
  {
    key: 'dengue-diario',
    groups: [
      { title: 'Situación epidemiológica', artwork: ['denguePrevention'], widgets: ['dengue-nuevos', 'dengue-activos', 'dengue-capital', 'dengue-interior', 'dengue-hospitalizados'], beside: ['dengue-localidades'] },
      { title: 'Actividad de la brigada sanitaria', widgets: ['dengue-barrios', 'dengue-visitadas', 'dengue-trabajadas', 'dengue-cerradas', 'dengue-positivas', 'dengue-renuentes', 'dengue-moviles', 'dengue-fumigados', 'dengue-barrios-detalle'] },
    ],
    icons: { 'dengue-barrios': 'neighborhoods', 'dengue-visitadas': 'home', 'dengue-trabajadas': 'visitedHome', 'dengue-cerradas': 'closedHome', 'dengue-positivas': 'mosquito', 'dengue-hospitalizados': 'hospital', 'dengue-moviles': 'vehicle' },
  },
  {
    key: 'vacunacion-covid',
    groups: [{ title: 'Vacunación y prevención', artwork: ['mask', 'handwashing', 'virus'], widgets: ['vac-covid-total'] }],
    icons: { 'vac-covid-total': 'vaccine' },
  },
  {
    key: 'vacunacion-dengue',
    groups: [{ title: 'Cobertura de vacunación', artwork: ['dengueVaccine'], widgets: ['vac-dengue-poblacion', 'vac-dengue-dosis', 'vac-dengue-cobertura'] }],
    icons: { 'vac-dengue-poblacion': 'vaccine', 'vac-dengue-dosis': 'vaccine' },
  },
];

export function healthDesignFor(widgets: Widget[]) {
  const ids = new Set(widgets.map(widget => widget.id));
  return healthSectionDesigns.find(design => design.groups.some(group => group.widgets.some(id => ids.has(id))));
}
