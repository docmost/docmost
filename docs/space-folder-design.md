# Space Folder Design

## Goal

Add folder-style classification inside a space so users can create nested folders and place documents under them without introducing a second tree system.

## Current State

- Space content is stored in `pages`
- Hierarchy is already represented by `parentPageId`
- Sidebar ordering is already represented by `position`
- Tree rendering, drag-and-drop, websocket sync, and cache invalidation already operate on page nodes

This means the lowest-risk implementation is to extend the existing page tree instead of creating separate `folders` tables and APIs.

## Proposed Model

Use a single tree with two node types:

- `page`: regular document
- `folder`: organizational container

Folders live in the same `pages` table and reuse:

- `spaceId`
- `parentPageId`
- `position`
- `icon`
- permission inheritance through the existing space/page model

## Data Model Changes

Add `nodeType` to `pages`:

- column: `node_type`
- values: `page`, `folder`
- default: `page`

Backwards compatibility:

- all existing records are treated as `page`
- existing nested pages continue to work
- new folders can be introduced incrementally

## Behavior Rules

### Creation

- root level can contain both pages and folders
- folders can contain both pages and folders
- existing pages are still allowed to contain children for compatibility

### Editing

- folders support rename, move, delete, icon update
- folders do not support rich text content updates

### Navigation

- clicking a page opens the document
- clicking a folder toggles expand/collapse and does not navigate away

### Deletion

- deleting a folder reuses the current subtree delete behavior
- nested children are removed together, matching current page subtree semantics

## API Changes

No separate folder resource is introduced in phase 1.

Existing `/pages/create` accepts:

- `nodeType?: "page" | "folder"`

Existing sidebar/tree queries return:

- `nodeType`

## Frontend Changes

### Tree node rendering

- folder nodes display a folder icon when no custom icon is set
- page nodes keep the document icon fallback

### New actions

Add folder creation entry points:

- space sidebar root actions
- node context menu for child folder creation

### Tree interactions

- folder node click toggles open state
- page node click keeps current navigation behavior

## Phase 1 Scope

- schema change for `nodeType`
- backend support for folder creation and folder content protection
- sidebar tree support for displaying and creating folders
- nested folder structure through existing drag-and-drop

## Deferred Work

- hard restriction that regular pages cannot have children
- folder-specific permissions
- folder-specific metadata
- folder-only list views / filters
- dedicated move validation that blocks cyclic moves more explicitly

## Why Not A Separate `folders` Table

That approach would require:

- merging `pages` and `folders` in one tree query
- duplicated move/sort rules
- websocket payload changes across two resource types
- more cache invalidation complexity

Using `nodeType` keeps the implementation aligned with the current architecture and is the fastest path to a usable nested classification system.
