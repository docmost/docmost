import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import {
  ActionIcon,
  Button,
  Card,
  FocusTrap,
  Group,
  Loader,
  Popover,
  Table,
  Text,
  TextInput,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import {
  IconArrowsHorizontal,
  IconBorderAll,
  IconBorderHorizontal,
  IconBorderNone,
  IconCheck,
  IconColorSwatch,
  IconCopy,
  IconDatabase,
  IconExternalLink,
  IconEye,
  IconEyeOff,
  IconLayoutNavbar,
  IconLayoutSidebar,
  IconListNumbers,
  IconPencil,
  IconRefresh,
  IconTrash,
} from "@tabler/icons-react";
import { useForm } from "@mantine/form";
import { detectDatabaseSource, sanitizeUrl } from "@docmost/editor-ext";
import toolbarClasses from "../common/toolbar-menu.module.css";
import classes from "./database-table-view.module.css";

interface TableData { columns: string[]; rows: string[][]; count: number; title: string; editUrl: string; }
type Sel = { r1: number; c1: number; r2: number; c2: number };

const HEADER_BG = "light-dark(var(--mantine-color-gray-1), var(--mantine-color-dark-5))";
const SEL_BG = "light-dark(var(--mantine-color-blue-1), var(--mantine-color-blue-9))";

function fmt(v: any): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "✓" : "—";
  if (Array.isArray(v)) return v.map(fmt).join(", ");
  if (typeof v === "object") { if ("value" in v) return String(v.value ?? ""); if ("title" in v) return String(v.title ?? ""); return ""; }
  return String(v);
}
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function writeClipboard(tsv: string, html: string) {
  // 1) Moderne Clipboard-API — nur im secure context (HTTPS/localhost) verfügbar
  try {
    if (navigator.clipboard && (window as any).ClipboardItem) {
      navigator.clipboard.write([new ClipboardItem({ "text/plain": new Blob([tsv], { type: "text/plain" }), "text/html": new Blob([html], { type: "text/html" }) })]);
      return;
    }
  } catch { /* fallthrough */ }
  try {
    if (navigator.clipboard?.writeText) { navigator.clipboard.writeText(tsv); return; }
  } catch { /* fallthrough */ }
  // 2) Fallback für HTTP (kein secure context): execCommand über temporäres Element
  try {
    const ta = document.createElement("textarea");
    ta.value = tsv;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  } catch { /* aufgeben */ }
}
function cellsToClipboard(cols: string[], rows: string[][], withHeader: boolean) {
  const head = withHeader ? cols.join("\t") + "\n" : "";
  const tsv = head + rows.map((r) => r.join("\t")).join("\n");
  const thead = withHeader ? `<thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead>` : "";
  const html = `<table>${thead}<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  writeClipboard(tsv, html);
}

async function fetchBaserow(src: string): Promise<TableData> {
  const origin = new URL(src).origin;
  const slug = src.match(/\/public\/grid\/([^/?#]+)/)?.[1];
  if (!slug) throw new Error("Baserow-Slug nicht erkannt");
  const info = await fetch(`${origin}/api/database/views/${slug}/public/info/`).then((r) => r.json());
  const fields: { id: number; name: string }[] = (info.fields || []).map((f: any) => ({ id: f.id, name: f.name }));
  const data = await fetch(`${origin}/api/database/views/grid/${slug}/public/rows/?size=200`).then((r) => r.json());
  const results = data.results || [];
  const columns = fields.map((f) => f.name);
  const rows = results.map((r: any) => fields.map((f) => fmt(r[`field_${f.id}`])));
  const u = new URL(src);
  let editUrl = u.origin;
  try { const res = await fetch(`${u.protocol}//${u.hostname}:8090/resolve?slug=${slug}`).then((r) => r.json()); if (res?.editUrl) editUrl = res.editUrl; } catch { /* optional */ }
  return { columns, rows, count: results.length, title: info?.view?.name || "", editUrl };
}
async function fetchNocodb(src: string): Promise<TableData> {
  const origin = new URL(src).origin;
  const uuid = src.match(/\/nc\/view\/([^/?#]+)/)?.[1] || src.match(/\/shared-view\/([^/?#]+)/)?.[1];
  if (!uuid) throw new Error("NocoDB-View-UUID nicht erkannt");
  const meta = await fetch(`${origin}/api/v2/public/shared-view/${uuid}/meta`).then((r) => r.json());
  const data = await fetch(`${origin}/api/v2/public/shared-view/${uuid}/rows`).then((r) => r.json());
  const list = data.list || data.rows || (Array.isArray(data) ? data : []);
  let columns: string[] = (meta.columns || meta?.model?.columns || []).filter((c: any) => c && c.title && c.show !== false && !c.system).map((c: any) => c.title);
  if (!columns.length && list.length) columns = Object.keys(list[0]).filter((k) => !["Id", "CreatedAt", "UpdatedAt"].includes(k));
  const rows = list.map((r: any) => columns.map((c) => fmt(r[c])));
  const editUrl = meta?.base_id && meta?.fk_model_id ? `${origin}/dashboard/#/nc/${meta.base_id}/${meta.fk_model_id}` : origin;
  return { columns, rows, count: list.length, title: meta?.title || "", editUrl };
}

export default function DatabaseTableView(props: NodeViewProps) {
  const { node, selected, updateAttributes, editor, deleteNode, getPos } = props;
  const { src, title: titleOverride, widthMode, headerRow, headerColumn, rowNumbers, showTitle, bgMode, borderMode } = node.attrs as any;

  const [data, setData] = useState<TableData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const [, setTick] = useState(0);
  const [titleOpen, setTitleOpen] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const [sel, setSel] = useState<Sel | null>(null);
  const [copied, setCopied] = useState(false);
  const [active, setActive] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout>>();
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ kind: string; r?: number; c: number } | null>(null);
  const movedRef = useRef(false);
  const crossedRef = useRef(false);

  const source = useMemo(() => detectDatabaseSource(src), [src]);
  const sourceName = source === "baserow" ? "Baserow" : source === "nocodb" ? "NocoDB" : "Quelle";

  const load = useCallback(async () => {
    if (!src) return;
    setLoading(true); setError(null);
    try {
      let td: TableData;
      if (source === "baserow") td = await fetchBaserow(src);
      else if (source === "nocodb") td = await fetchNocodb(src);
      else throw new Error("Unbekannte Quelle (Baserow/NocoDB-Link erwartet)");
      setData(td); setLoadedAt(Date.now());
    } catch (e: any) { setError(e?.message || "Fehler beim Laden"); } finally { setLoading(false); }
  }, [src, source]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const id = setInterval(() => setTick((t) => t + 1), 30000); return () => clearInterval(id); }, []);
  // Klick außerhalb des Blocks -> inaktiv (Buttons aus, Markierung wird heller)
  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) { setActive(false); setSel(null); } };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function relTime() {
    if (!loadedAt) return "";
    const m = Math.floor((Date.now() - loadedAt) / 60000);
    return m < 1 ? "gerade aktualisiert" : m === 1 ? "vor 1 Minute aktualisiert" : `vor ${m} Minuten aktualisiert`;
  }

  const form = useForm<{ url: string }>({ initialValues: { url: "" } });
  function onSubmit(values: { url: string }) { const url = sanitizeUrl(values.url.trim()); updateAttributes({ src: url, source: detectDatabaseSource(url) }); }

  const displayTitle = titleOverride || data?.title || "";
  const editUrl = data?.editUrl || (src ? new URL(src).origin : "");
  const wmode = widthMode || "min";
  const WLABEL: Record<string, string> = { equal: "Normal", auto: "Angepasst", min: "Minimal" };
  function cycleWidth() { const o = ["equal", "auto", "min"]; updateAttributes({ widthMode: o[(o.indexOf(wmode) + 1) % 3] }); }
  const tableLayoutCss = wmode === "equal" ? "fixed" : "auto";
  const tableWidth = wmode === "min" ? "auto" : "100%";

  const bMode = borderMode || "all";
  function cycleBorder() { const o = ["all", "h", "none"]; updateAttributes({ borderMode: o[(o.indexOf(bMode) + 1) % 3] }); }
  const BLABEL: Record<string, string> = { all: "Rahmen: alle", h: "Rahmen: nur horizontal", none: "Rahmen: keine" };
  const BorderIcon = bMode === "all" ? IconBorderAll : bMode === "h" ? IconBorderHorizontal : IconBorderNone;
  const bgm = bgMode || "striped";
  const isStriped = bgm === "striped";
  const headerBg = bgm === "noheader" ? "transparent" : HEADER_BG;
  const BGLABEL: Record<string, string> = { striped: "Hintergrund: gestreift", plain: "Hintergrund: einfarbig", noheader: "Hintergrund: Header ohne Hintergrund" };
  function cycleBg() { const o = ["striped", "plain", "noheader"]; updateAttributes({ bgMode: o[(o.indexOf(bgm) + 1) % 3] }); }
  // Rahmen komplett über eigene CSS-Klassen steuern (Mantine-Border-Props aus):
  const borderProps = { withTableBorder: false, withColumnBorders: false, withRowBorders: false };
  const borderClass = bMode === "all" ? classes.bAll : bMode === "h" ? classes.bH : classes.bNone;

  function saveTitle() { updateAttributes({ title: titleInput.trim() }); setTitleOpen(false); }

  // ---- Auswahl ----
  const norm = (s: Sel) => ({ r1: Math.min(s.r1, s.r2), r2: Math.max(s.r1, s.r2), c1: Math.min(s.c1, s.c2), c2: Math.max(s.c1, s.c2) });
  const inSel = (r: number, c: number) => { if (!sel) return false; const n = norm(sel); return r >= n.r1 && r <= n.r2 && c >= n.c1 && c <= n.c2; };
  const sameSel = (a: Sel | null, b: Sel) => !!a && a.r1 === b.r1 && a.c1 === b.c1 && a.r2 === b.r2 && a.c2 === b.c2;
  const toggleSel = (next: Sel) => setSel((prev) => (sameSel(prev, next) ? null : next));
  function targetInfo(t: EventTarget | null): { kind: string; r?: number; c: number } | null {
    const el = (t as HTMLElement)?.closest?.("[data-cell],[data-colheader]") as HTMLElement | null;
    if (!el) return null;
    if (el.hasAttribute("data-colheader")) return { kind: "colheader", c: +el.getAttribute("data-colheader")! };
    return { kind: "cell", r: +el.getAttribute("data-r")!, c: +el.getAttribute("data-c")! };
  }
  function onMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) { dragRef.current = null; return; } // Rechtsklick/Mitte -> nicht markieren
    dragRef.current = targetInfo(e.target); movedRef.current = false; crossedRef.current = false;
    if (scrollRef.current) scrollRef.current.style.userSelect = "text";
  }
  function onMouseMove(e: React.MouseEvent) {
    const start = dragRef.current;
    if (!start || start.kind !== "cell" || e.buttons !== 1) return;
    movedRef.current = true;
    const cur = targetInfo(e.target);
    if (cur?.kind === "cell" && (cur.r !== start.r || cur.c !== start.c)) {
      crossedRef.current = true;
      window.getSelection()?.removeAllRanges();
      if (scrollRef.current) scrollRef.current.style.userSelect = "none";
      setSel({ r1: start.r!, c1: start.c, r2: cur.r!, c2: cur.c });
    }
  }
  function onMouseUp() {
    const start = dragRef.current; dragRef.current = null;
    if (scrollRef.current) scrollRef.current.style.userSelect = "text";
    if (!start || !data) return;
    const lastRow = data.rows.length - 1, lastCol = data.columns.length - 1;
    if (start.kind === "colheader") { toggleSel({ r1: 0, c1: start.c, r2: lastRow, c2: start.c }); return; }
    if (!movedRef.current) {
      if (headerColumn && start.c === 0) toggleSel({ r1: start.r!, c1: 0, r2: start.r!, c2: lastCol }); // Header-Spalte -> ganze Reihe
      else toggleSel({ r1: start.r!, c1: start.c, r2: start.r!, c2: start.c }); // Zelle (2. Klick hebt auf)
    } else if (!crossedRef.current) { setSel(null); } // Textauswahl in einer Zelle
  }
  function copySelection() { if (!sel || !data) return; const n = norm(sel); cellsToClipboard(data.columns.slice(n.c1, n.c2 + 1), data.rows.slice(n.r1, n.r2 + 1).map((r) => r.slice(n.c1, n.c2 + 1)), false); }
  function doCopy() {
    if (sel) copySelection(); else if (data) cellsToClipboard(data.columns, data.rows, true);
    clearTimeout(copyTimer.current); setCopied(true); copyTimer.current = setTimeout(() => setCopied(false), 1500);
  }
  useEffect(() => {
    if (!sel) return;
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "c" || e.key === "C")) {
        const s = window.getSelection(); if (s && s.toString()) return;
        copySelection(); e.preventDefault();
      }
    };
    document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h);
  }, [sel, data]);
  function selectContainer() { setSel(null); if (typeof getPos === "function") editor.chain().setNodeSelection(getPos()).run(); }

  if (!src) {
    return (
      <NodeViewWrapper>
        <Popover width={340} position="bottom" withArrow shadow="md" disabled={!editor.isEditable}>
          <Popover.Target>
            <Card radius="md" p="xs" withBorder className={clsx(selected ? "ProseMirror-selectednode" : "")}>
              <Group gap="xs" justify="center"><ActionIcon variant="transparent" color="gray"><IconDatabase size={18} /></ActionIcon>
                <Text component="span" c="dimmed">Datenbank-Tabelle einfügen (Baserow / NocoDB Public-Link)</Text></Group>
            </Card>
          </Popover.Target>
          <Popover.Dropdown bg="var(--mantine-color-body)">
            <form onSubmit={form.onSubmit(onSubmit)}>
              <FocusTrap active><TextInput placeholder="https://…/public/grid/…  oder  …/nc/view/…" data-autofocus {...form.getInputProps("url")} /></FocusTrap>
              <Group justify="center" mt="xs"><Button type="submit">Tabelle einfügen</Button></Group>
            </form>
          </Popover.Dropdown>
        </Popover>
      </NodeViewWrapper>
    );
  }

  const TBtn = ({ active, label, onClick, children, color }: any) => (
    <Tooltip label={label} position="top" withinPortal><ActionIcon variant="subtle" size="md" color={color} onClick={onClick} className={clsx({ [toolbarClasses.active]: active })}>{children}</ActionIcon></Tooltip>
  );
  const showBubble = (active || selected) && editor.isEditable;

  return (
    <NodeViewWrapper className={clsx(selected ? "ProseMirror-selectednode" : "")}>
      <div ref={rootRef} draggable={false} onDragStart={(e) => e.preventDefault()} style={{ position: "relative" }}
        onMouseDown={(e) => {
          setActive(true);
          const t = e.target as HTMLElement;
          // Klick im Block, aber nicht auf Zelle/Spaltenkopf/Button-Blase -> Markierung aufheben
          if (!t.closest?.("[data-cell],[data-colheader],[data-table-toolbar]")) setSel(null);
        }}>
      {showBubble && (
        <div className={classes.bubble} data-table-toolbar contentEditable={false}>
          <div className={toolbarClasses.toolbar}>
            <TBtn label={`Spaltenbreite: ${WLABEL[wmode]}`} onClick={cycleWidth}><IconArrowsHorizontal size={17} /></TBtn>
            <TBtn active={!showTitle} label={showTitle ? "Titelleiste ausblenden" : "Titelleiste einblenden"} onClick={() => updateAttributes({ showTitle: !showTitle })}>{showTitle ? <IconEye size={17} /> : <IconEyeOff size={17} />}</TBtn>
            <TBtn active={headerRow} label="Kopfzeile (Spaltennamen)" onClick={() => updateAttributes({ headerRow: !headerRow })}><IconLayoutNavbar size={17} /></TBtn>
            <TBtn active={headerColumn} label="Erste Spalte fett + fixiert" onClick={() => updateAttributes({ headerColumn: !headerColumn })}><IconLayoutSidebar size={17} /></TBtn>
            <TBtn active={rowNumbers} label="Zeilennummern" onClick={() => updateAttributes({ rowNumbers: !rowNumbers })}><IconListNumbers size={17} /></TBtn>
            <div className={toolbarClasses.divider} />
            <TBtn active={bgm !== "plain"} label={BGLABEL[bgm]} onClick={cycleBg}><IconColorSwatch size={17} /></TBtn>
            <TBtn label={BLABEL[bMode]} onClick={cycleBorder}><BorderIcon size={17} /></TBtn>
            <div className={toolbarClasses.divider} />
            <Tooltip label="Tabelle öffnen (neuer Tab)" position="top" withinPortal><ActionIcon variant="subtle" size="md" className={classes.iconLink} component="a" href={src} target="_blank" rel="noopener noreferrer"><IconExternalLink size={17} /></ActionIcon></Tooltip>
            <Tooltip label={`In ${sourceName} bearbeiten`} position="top" withinPortal><ActionIcon variant="subtle" size="md" className={classes.iconLink} component="a" href={editUrl} target="_blank" rel="noopener noreferrer"><IconPencil size={17} /></ActionIcon></Tooltip>
            <TBtn label={sel ? "Auswahl kopieren" : "Ganze Tabelle kopieren"} onClick={doCopy}>{copied ? <IconCheck size={17} color="var(--mantine-color-green-6)" /> : <IconCopy size={17} />}</TBtn>
            <TBtn label="Aktualisieren" onClick={load}><IconRefresh size={17} /></TBtn>
            <div className={toolbarClasses.divider} />
            <TBtn color="red" label="Block löschen" onClick={() => deleteNode()}><IconTrash size={17} /></TBtn>
          </div>
        </div>
      )}

      {showTitle && (
        <Text size="xs" mb={4} contentEditable={false} style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          <Popover opened={titleOpen} onChange={setTitleOpen} width={260} position="bottom-start" withArrow shadow="md" disabled={!editor.isEditable}>
            <Popover.Target>
              <Tooltip label="Titel bearbeiten" disabled={!editor.isEditable}>
                <UnstyledButton onClick={() => { setTitleInput(displayTitle); setTitleOpen((o) => !o); }} style={{ font: "inherit", fontWeight: 600, color: "var(--mantine-color-text)", cursor: editor.isEditable ? "text" : "default" }}>
                  {displayTitle || (editor.isEditable ? "Titel setzen…" : "")}
                </UnstyledButton>
              </Tooltip>
            </Popover.Target>
            <Popover.Dropdown bg="var(--mantine-color-body)">
              <FocusTrap active><TextInput size="xs" data-autofocus value={titleInput} placeholder={data?.title || "Titel"} onChange={(e) => setTitleInput(e.currentTarget.value)} onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); }} /></FocusTrap>
              <Group justify="space-between" mt="xs"><Button size="compact-xs" variant="subtle" onClick={() => { updateAttributes({ title: "" }); setTitleOpen(false); }}>Zurücksetzen</Button><Button size="compact-xs" onClick={saveTitle}>OK</Button></Group>
            </Popover.Dropdown>
          </Popover>
          <Text component="span" c="dimmed">{` · Datenbank-Tabelle · ${sourceName}`}{data ? ` · ${data.count} Zeilen` : ""}{loadedAt ? ` · ${relTime()}` : ""}</Text>
        </Text>
      )}

      {loading && !data && <Group justify="center" p="md"><Loader size="sm" /></Group>}
      {error && <Text c="red" size="sm">⚠ {error}</Text>}

      {data && (
        <div ref={scrollRef} draggable={false} onDragStart={(e) => e.preventDefault()} style={{ userSelect: "text", cursor: "default", overflowX: "auto" }} onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onDoubleClick={selectContainer}>
          <Table {...borderProps} striped={isStriped} highlightOnHover className={borderClass} style={{ tableLayout: tableLayoutCss as any, width: tableWidth }}>
            {headerRow && (
              <Table.Thead>
                <Table.Tr>
                  {rowNumbers && <Table.Th style={{ width: "1px", background: headerColumn ? headerBg : undefined }} />}
                  {data.columns.map((c, i) => (
                    <Table.Th key={i} data-colheader={i} style={{ cursor: "pointer", background: bgm === "noheader" ? "transparent" : (headerColumn && i === 0 ? HEADER_BG : undefined), ...(headerColumn && i === 0 ? { position: "sticky", left: 0, zIndex: 2 } : {}) }}>{c}</Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
            )}
            <Table.Tbody>
              {data.rows.map((row, ri) => (
                <Table.Tr key={ri}>
                  {rowNumbers && <Table.Td style={{ width: "1px", whiteSpace: "nowrap", textAlign: "right", color: "var(--mantine-color-dimmed)", background: headerColumn ? headerBg : undefined }}>{ri + 1}</Table.Td>}
                  {row.map((cell, ci) => {
                    const isHeaderCol = headerColumn && ci === 0;
                    const bg = inSel(ri, ci) ? SEL_BG : isHeaderCol ? headerBg : undefined;
                    const common = { "data-cell": "1", "data-r": ri, "data-c": ci, style: { background: bg, cursor: "pointer" } } as any;
                    return isHeaderCol
                      ? <Table.Th key={ci} {...common} style={{ ...common.style, position: "sticky", left: 0, fontWeight: 600, zIndex: 1 }}>{cell}</Table.Th>
                      : <Table.Td key={ci} {...common}>{cell}</Table.Td>;
                  })}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </div>
      )}
      </div>
    </NodeViewWrapper>
  );
}
