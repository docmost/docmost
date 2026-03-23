# Todo-Feature – Entwicklungsstand

> Erstellt: 2026-03-20
> Zuletzt aktualisiert: 2026-03-20
> Branch: `feat/todo-system`
> Fork: `https://github.com/alltogo91/docmost`
> Status: **Funktionsfähig inkl. Editor-Sync** ✓

---

## Was wurde gebaut

Ein vollständiges Todo-System für Docmost-Pages. Jede Page kann eine eigene Todo-Liste haben, die über ein Seitenpanel erreichbar ist. Todos die im Editor via `/` → „To-do list" erstellt werden, erscheinen automatisch im Panel – und umgekehrt: Checkbox im Panel synct zurück in den Editor.

### Features
- Todos erstellen (Titel eingeben, Enter oder Button)
- Todos abhaken (Checkbox) – synct bidirektional mit Editor-TaskItems
- Todos inline bearbeiten (Klick auf Text)
- Todos löschen (Trash-Icon, nur eigene)
- Offene und erledigte Todos getrennt anzeigen
- Editor-Integration: TaskItems via `/`-Menü werden automatisch als Todos angelegt
- Subtasks (verschachtelte TaskItems) werden korrekt als eigene Todos behandelt
- Nur Bearbeiter können Todos anlegen/ändern (Reader: read-only)

---

## Geänderte / neue Dateien

### Backend (Server)

| Datei | Status | Beschreibung |
|---|---|---|
| `apps/server/src/database/migrations/20260320T000000-todos.ts` | NEU | Kysely-Migration: `todos`-Tabelle |
| `apps/server/src/database/types/db.d.ts` | GEÄNDERT | `Todos`-Interface + `todos`-Eintrag in `DB` |
| `apps/server/src/database/types/entity.types.ts` | GEÄNDERT | `Todo`, `InsertableTodo`, `UpdatableTodo` |
| `apps/server/src/database/repos/todo/todo.repo.ts` | NEU | TodoRepo mit CRUD + Pagination |
| `apps/server/src/database/database.module.ts` | GEÄNDERT | TodoRepo registriert + exportiert |
| `apps/server/src/core/todo/dto/create-todo.dto.ts` | NEU | DTO: pageId + title |
| `apps/server/src/core/todo/dto/update-todo.dto.ts` | NEU | DTO: todoId + title? + completed? |
| `apps/server/src/core/todo/dto/todo.input.ts` | NEU | PageIdDto + TodoIdDto |
| `apps/server/src/core/todo/todo.service.ts` | NEU | CRUD-Logik, Permission-Checks |
| `apps/server/src/core/todo/todo.controller.ts` | NEU | REST-Endpoints: create, /, update, delete |
| `apps/server/src/core/todo/todo.module.ts` | NEU | NestJS-Modul |
| `apps/server/src/core/core.module.ts` | GEÄNDERT | TodoModule registriert |

### Frontend (Client)

| Datei | Status | Beschreibung |
|---|---|---|
| `apps/client/src/features/todo/types/todo.types.ts` | NEU | `ITodo`, `ITodoParams` |
| `apps/client/src/features/todo/services/todo-service.ts` | NEU | API-Calls: create, update, delete, getPageTodos |
| `apps/client/src/features/todo/queries/todo-query.ts` | NEU | React Query Hooks |
| `apps/client/src/features/todo/components/todo-item.tsx` | NEU | Einzelnes Todo: Checkbox, Inline-Edit, Delete + Editor-Sync |
| `apps/client/src/features/todo/components/todo-list.tsx` | NEU | Todo-Panel: Liste + Neues Todo hinzufügen |
| `apps/client/src/components/layouts/global/aside.tsx` | GEÄNDERT | Tab `todos` hinzugefügt |
| `apps/client/src/features/page/components/header/page-header-menu.tsx` | GEÄNDERT | `IconCheckbox`-Button öffnet Todo-Panel |
| `apps/client/src/features/editor/extensions/synced-task-item.ts` | NEU | TipTap-Extension: TaskItem + todoId-Attribut + ProseMirror-Plugin für Event-Dispatch |
| `apps/client/src/features/editor/hooks/use-task-sync.ts` | NEU | React Hook: lauscht auf taskitem-Events, synct mit API |
| `apps/client/src/features/editor/extensions/extensions.ts` | GEÄNDERT | `SyncedTaskItem` statt `TaskItem` |
| `apps/client/src/features/editor/page-editor.tsx` | GEÄNDERT | `useTaskSync(editor, pageId)` eingebunden |

---

## API-Endpoints (Server)

```
POST /todos/create   { pageId, title }              → ITodo
POST /todos          { pageId, cursor?, limit? }     → IPagination<ITodo>
POST /todos/update   { todoId, title?, completed? }  → ITodo
POST /todos/delete   { todoId }                      → void
```

---

## Datenbankschema

```sql
CREATE TABLE todos (
  id           UUID PRIMARY KEY DEFAULT gen_uuid_v7(),
  title        TEXT NOT NULL,
  completed    BOOLEAN NOT NULL DEFAULT false,
  page_id      UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  creator_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  space_id     UUID REFERENCES spaces(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_todos_page_id ON todos (page_id, id ASC);
```

---

## Editor-Sync Architektur

```
Editor (TipTap)
  └── SyncedTaskItem (Extension)
        └── ProseMirrorPlugin
              ├── appendTransaction: löscht duplizierte todoId bei Enter-Split
              └── state.apply: vergleicht prev/next Snapshots
                    ├── taskitem:created  → neues Item, Text von "" auf non-empty
                    ├── taskitem:toggled  → checked geändert (mit todoId)
                    ├── taskitem:renamed  → Text geändert (mit todoId)
                    └── taskitem:deleted  → Node verschwunden (mit todoId)

useTaskSync (Hook in page-editor.tsx)
  ├── taskitem:created  → createTodo API → todoId zurück in Node schreiben
  ├── taskitem:toggled  → updateTodo API
  ├── taskitem:renamed  → updateTodo API
  └── taskitem:deleted  → deleteTodo API

TodoItem (Panel-Komponente)
  └── handleToggle: updateTodo API + editor.commands → Node per todoId finden + checked setzen
```

### Wichtige Design-Entscheidungen
- **Key = `node:${pos}`** (positions-basiert, nicht text-basiert) → stabil beim Tippen und bei todoId-Rückschreibung
- **`getDirectText()`** statt `node.textContent` → verhindert dass Subtask-Text den Parent-Task als geändert erscheinen lässt
- **`isChangeOrigin(tr)` Guard** → Remote-Yjs-Transaktionen lösen keine API-Calls aus
- **Duplicate-todoId-Erkennung** via `appendTransaction` → verhindert dass Enter-Split die todoId vererbt

---

## Commit-Historie (feature branch)

```
d7ed9e90 fix: empty todos, duplicates and subtask text bleed in editor sync
c823b547 sync editor task items with todo panel
a38be14f fix: rename prop todoItem to todo in TodoItem component
d9865e67 rename loadTodos to findPageTodos in TodoRepo
f523ef5c integrate todo panel in page aside and header
1660f2ca add TodoItem and TodoList componnents
c7252bc6 add todo react query hooks
128597be add fronend todo types and api service
3140d125 register TodoModuel in CoreModule
93dc1eb9 add todo DTOs, servce and controller
8656dcc9 register TodoRepo in database module
c923660b add TodoRepo
7bcfd800 add Todos interface to db types and entity types
9617351f add migration for todos tabel
```

---

## App starten (Entwicklung)

```bash
# Terminal 1 – Backend
pnpm --filter ./apps/server run start:dev

# Terminal 2 – Frontend
pnpm --filter ./apps/client run dev

# Migration (einmalig / nach DB-Reset)
pnpm --filter ./apps/server run migration:latest

# Editor-Extension bauen (nach Änderungen an @docmost/editor-ext)
pnpm --filter @docmost/editor-ext build
```

Frontend: `http://localhost:5173`
Backend: `http://localhost:3000`

---

## Was noch fehlt / nächste Schritte

### Nice to have
- [ ] **Fälligkeitsdatum** – `due_date`-Spalte in Migration + UI (DatePicker)
- [ ] **Assignee** – Todo einer anderen Person zuweisen
- [ ] **Reihenfolge ändern** – Drag & Drop (z.B. mit `@dnd-kit`)
- [ ] **WebSocket-Events** – Echtzeit-Updates wenn anderer User Todo ändert
- [ ] **Zentrales Task-Board** – Todos über alle Pages einer Space hinweg anzeigen
- [ ] **Benachrichtigungen** – bei Zuweisung
- [ ] **Todo-Zähler im Header-Button** – Anzahl offener Todos
- [ ] **i18n** – Texte in Übersetzungsdateien eintragen (aktuell hardcodiert Englisch)
- [ ] **Permissions testen** – Reader kann nicht bearbeiten, Owner kann nur eigene löschen

### Bekannte Einschränkungen
- Keine Echtzeit-Synchronisation zwischen zwei Usern (kein WebSocket – Panel muss manuell refresht werden)
- Todos können nur vom Ersteller selbst bearbeitet/gelöscht werden
- Permission-Check nutzt `space.membership.role !== "reader"` – funktioniert nicht bei Page-spezifischen Berechtigungen

---

## GitHub

- Fork: `https://github.com/alltogo91/docmost`
- Branch: `feat/todo-system`
- Upstream Issue: `https://github.com/docmost/docmost/issues/629`
- Maintainer kontaktiert via Kommentar in Issue #629 (noch keine Antwort)

---

## Architektur-Referenz

Das Feature folgt dem Muster des `comment`-Features:
- Server: `CommentRepo` → `TodoRepo`, `CommentService` → `TodoService`, etc.
- Client: `features/comment/` → `features/todo/`

Bei Fragen zur Struktur einfach die Comment-Dateien als Referenz nehmen.
