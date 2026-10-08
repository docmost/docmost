type PropLike = { id: string; type: string; typeOptions: unknown };

export class BaseFormulaGraph {
  private readonly direct = new Map<string, string[]>();
  private readonly reverse = new Map<string, Set<string>>();

  constructor(properties: PropLike[]) {
    for (const p of properties) {
      if (p.type !== "formula") continue;
      const deps: string[] = Array.isArray((p.typeOptions as any)?.dependencies)
        ? ((p.typeOptions as any).dependencies as string[])
        : [];
      this.direct.set(p.id, deps);
      for (const d of deps) {
        if (!this.reverse.has(d)) this.reverse.set(d, new Set());
        this.reverse.get(d)!.add(p.id);
      }
    }
  }

  directDeps(propId: string): string[] { return this.direct.get(propId) ?? []; }

  dependents(propId: string): string[] { return Array.from(this.reverse.get(propId) ?? []); }

  affectedFormulas(changedPropIds: string[]): string[] {
    const out = new Set<string>();
    const stack = [...changedPropIds];
    while (stack.length) {
      const id = stack.pop()!;
      for (const d of this.reverse.get(id) ?? []) {
        if (!out.has(d)) { out.add(d); stack.push(d); }
      }
    }
    return Array.from(out).sort();
  }

  evalOrder(): string[] {
    const order: string[] = [];
    const visited = new Set<string>();
    const temp = new Set<string>();
    const visit = (id: string) => {
      if (visited.has(id)) return;
      if (temp.has(id)) return;
      temp.add(id);
      for (const d of this.direct.get(id) ?? []) visit(d);
      temp.delete(id);
      visited.add(id);
      order.push(id);
    };
    for (const id of this.direct.keys()) visit(id);
    return order;
  }

  /*
   * Returns the cycle path (list of prop IDs) if introducing `newProp` (or
   * keeping its current deps) would create one, else null. `newProp` may be
   * either a property already registered or a hypothetical replacement; we
   * re-read its deps at call time, so pass the candidate object.
   */
  detectCycle(newProp: PropLike): string[] | null {
    const local = new Map(this.direct);
    if (newProp.type === "formula") {
      local.set(newProp.id, (newProp.typeOptions as any)?.dependencies ?? []);
    }
    const WHITE = 0, GRAY = 1, BLACK = 2;
    const color = new Map<string, number>();
    const path: string[] = [];
    const dfs = (id: string): string[] | null => {
      color.set(id, GRAY);
      path.push(id);
      for (const d of local.get(id) ?? []) {
        const c = color.get(d) ?? WHITE;
        if (c === GRAY) { return [...path.slice(path.indexOf(d)), d]; }
        if (c === WHITE) { const r = dfs(d); if (r) return r; }
      }
      path.pop();
      color.set(id, BLACK);
      return null;
    };
    for (const id of local.keys()) {
      if ((color.get(id) ?? WHITE) === WHITE) {
        const r = dfs(id);
        if (r) return r;
      }
    }
    return null;
  }
}
