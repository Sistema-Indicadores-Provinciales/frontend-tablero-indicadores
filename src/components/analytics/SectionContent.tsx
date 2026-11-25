import { ColumnAliases, SectionWidgetRender, Widget } from 'types/Generator';
import SavedChart from './SavedChart';
import SectionIllustration from './SectionIllustration';
import { healthDesignFor } from './healthSectionDesigns';
import './section-content.css';

export default function SectionContent({ widgets, results, updating, onRetry, aliases }: {
  widgets: Widget[];
  results: Record<string, SectionWidgetRender>;
  updating: boolean;
  onRetry: () => void;
  aliases?: ColumnAliases;
}) {
  const design = healthDesignFor(widgets);
  const byId = new Map(widgets.map(widget => [widget.id, widget]));
  const used = new Set<string>();
  const take = (ids: string[]) => ids.flatMap(id => {
    const widget = byId.get(id);
    if (!widget || used.has(id)) return [];
    used.add(id);
    return [widget];
  });
  const groups = (design?.groups || []).map(group => ({ ...group, entries: take(group.widgets), aside: take(group.beside || []) }));
  const remaining = widgets.filter(widget => !used.has(widget.id));
  const renderWidget = (widget: Widget) => <SavedChart key={widget.id} widget={widget} rendered={results[widget.id]}
    updating={updating} onRetry={onRetry} aliases={aliases} illustration={design?.icons?.[widget.id]} />;
  const renderGrid = (entries: Widget[]) => {
    const counters = entries.filter(widget => widget.config.chart_type === 'indicator');
    const charts = entries.filter(widget => widget.config.chart_type !== 'indicator');
    return <>
      {counters.length > 0 && <section className="generator-counters" aria-label="Contadores de la sección">{counters.map(renderWidget)}</section>}
      {charts.length > 0 && <div className="generator-grid">{charts.map(renderWidget)}</div>}
    </>;
  };

  return <div className={design ? 'illustrated-section' : undefined} data-section-design={design?.key}>
    {groups.filter(group => group.entries.length || group.aside.length).map(group => <section className="illustrated-group" key={group.title} aria-label={group.title}>
      <h2 className="illustrated-group-title">{group.title}</h2>
      <div className={group.aside.length && group.entries.length ? 'illustrated-split' : undefined}>
        {group.entries.length > 0 && <div className={`illustrated-summary${group.artwork?.length ? ' illustrated-summary-with-art' : ''}`}>
          {!!group.artwork?.length && <div className="illustrated-artwork" aria-label="Ilustraciones de la sección">
            {group.artwork.map(name => <SectionIllustration key={name} name={name} />)}
          </div>}
          <div className="illustrated-indicators">{renderGrid(group.entries)}</div>
        </div>}
        {group.aside.length > 0 && <div className="illustrated-aside">{renderGrid(group.aside)}</div>}
      </div>
    </section>)}
    {renderGrid(remaining)}
  </div>;
}
