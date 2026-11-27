// Simulate the partial-write contract without accessing a real service.
export function editorResponse(workspace: any) {
  const { editor_document: _document, editor_revision: _revision, ...raw } = workspace;
  return { ...raw, editor_revision: '1'.repeat(64), editor_document: structuredClone(raw) };
}

export function applyEditorChanges(workspace: any, body: any) {
  const updated = structuredClone(workspace);
  for (const change of body.changes || []) {
    if (change.action === 'insert') updated.widgets.push(change.value);
    else if (change.action === 'remove') updated.widgets = updated.widgets.filter((widget: any) => widget.id !== change.widget);
    else if (change.action === 'reorder') updated.widgets = change.value.map((id: string) => updated.widgets.find((widget: any) => widget.id === id));
    else {
      let target = change.widget ? updated.widgets.find((widget: any) => widget.id === change.widget) : updated;
      const path = change.path as string[];
      for (const key of path.slice(0, -1)) target = target[key] ||= {};
      if (change.action === 'delete') delete target[path[path.length - 1]];
      else target[path[path.length - 1]] = change.value;
    }
  }
  return updated;
}
