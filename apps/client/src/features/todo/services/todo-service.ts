import api from "@/lib/api-client";
import { ITodo, ITodoParams } from "@/features/todo/types/todo.types";
import { IPagination } from "@/lib/types.ts";

export async function createTodo(data: {
  pageId: string;
  title: string;
}): Promise<ITodo> {
  const req = await api.post<ITodo>("/todos/create", data);
  return req.data;
}

export async function updateTodo(data: {
  todoId: string;
  title?: string;
  completed?: boolean;
}): Promise<ITodo> {
  const req = await api.post<ITodo>("/todos/update", data);
  return req.data;
}

export async function getPageTodos(
  data: ITodoParams,
): Promise<IPagination<ITodo>> {
  const req = await api.post("/todos", data);
  return req.data;
}

export async function deleteTodo(todoId: string): Promise<void> {
  await api.post("/todos/delete", { todoId });
}
