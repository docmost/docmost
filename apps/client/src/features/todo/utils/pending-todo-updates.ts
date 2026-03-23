/**
 * Module-level store for todo updates that happened while the editor was not
 * mounted (e.g. toggled from the space todos board). Survives React navigation
 * because it lives outside the component lifecycle.
 */
export const pendingTodoUpdates = new Map<string, boolean>(); // todoId → completed
