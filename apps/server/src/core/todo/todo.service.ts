import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateTodoDto } from './dto/create-todo.dto';
import { UpdateTodoDto } from './dto/update-todo.dto';
import { TodoRepo } from '@docmost/db/repos/todo/todo.repo';
import { Page, Todo, User } from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { CursorPaginationResult } from '@docmost/db/pagination/cursor-pagination';

@Injectable()
export class TodoService {
  constructor(private todoRepo: TodoRepo) {}

  async findById(todoId: string): Promise<Todo> {
    const todo = await this.todoRepo.findById(todoId, { includeCreator: true });
    if (!todo) {
      throw new NotFoundException('Todo not found');
    }
    return todo;
  }

  async create(
    opts: { userId: string; page: Page; workspaceId: string },
    createTodoDto: CreateTodoDto,
  ): Promise<Todo> {
    const { userId, page, workspaceId } = opts;

    const inserted = await this.todoRepo.insertTodo({
      title: createTodoDto.title,
      pageId: page.id,
      creatorId: userId,
      workspaceId: workspaceId,
      spaceId: page.spaceId,
    });

    return this.todoRepo.findById(inserted.id, { includeCreator: true });
  }

  async findByPageId(
    pageId: string,
    pagination: PaginationOptions,
  ): Promise<CursorPaginationResult<Todo>> {
    return this.todoRepo.loadTodos(pageId, pagination);
  }

  async update(
    todo: Todo,
    updateTodoDto: UpdateTodoDto,
    authUser: User,
  ): Promise<Todo> {
    if (todo.creatorId !== authUser.id) {
      throw new ForbiddenException('You can only edit your own todos');
    }

    const updatedAt = new Date();
    const updates: Record<string, any> = { updatedAt };

    if (updateTodoDto.title !== undefined) {
      updates.title = updateTodoDto.title;
    }

    if (updateTodoDto.completed !== undefined) {
      updates.completed = updateTodoDto.completed;
      updates.completedAt = updateTodoDto.completed ? new Date() : null;
    }

    await this.todoRepo.updateTodo(updates, todo.id);

    return this.todoRepo.findById(todo.id, { includeCreator: true });
  }

  async delete(todo: Todo, authUser: User): Promise<void> {
    if (todo.creatorId !== authUser.id) {
      throw new ForbiddenException('You can only delete your own todos');
    }
    await this.todoRepo.deleteTodo(todo.id);
  }
}
