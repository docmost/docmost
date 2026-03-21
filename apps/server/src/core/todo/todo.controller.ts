import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { TodoService } from './todo.service';
import { CreateTodoDto } from './dto/create-todo.dto';
import { UpdateTodoDto } from './dto/update-todo.dto';
import { PageIdDto, SpaceIdDto, TodoIdDto } from './dto/todo.input';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { TodoRepo } from '@docmost/db/repos/todo/todo.repo';
import { PageAccessService } from '../page/page-access/page-access.service';
import SpaceAbilityFactory from '../casl/abilities/space-ability.factory';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../casl/interfaces/space-ability.type';

@UseGuards(JwtAuthGuard)
@Controller('todos')
export class TodoController {
  constructor(
    private readonly todoService: TodoService,
    private readonly todoRepo: TodoRepo,
    private readonly pageRepo: PageRepo,
    private readonly pageAccessService: PageAccessService,
    private readonly spaceAbility: SpaceAbilityFactory,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('create')
  async create(
    @Body() createTodoDto: CreateTodoDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const page = await this.pageRepo.findById(createTodoDto.pageId);
    if (!page || page.deletedAt) {
      throw new NotFoundException('Page not found');
    }

    await this.pageAccessService.validateCanEdit(page, user);

    return this.todoService.create(
      { userId: user.id, page, workspaceId: workspace.id },
      createTodoDto,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('/')
  async findPageTodos(
    @Body() input: PageIdDto,
    @Body() pagination: PaginationOptions,
    @AuthUser() user: User,
  ) {
    const page = await this.pageRepo.findById(input.pageId);
    if (!page) {
      throw new NotFoundException('Page not found');
    }

    await this.pageAccessService.validateCanView(page, user);

    return this.todoService.findByPageId(page.id, pagination);
  }

  @HttpCode(HttpStatus.OK)
  @Post('space')
  async findSpaceTodos(
    @Body() input: SpaceIdDto,
    @Body() pagination: PaginationOptions,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const ability = await this.spaceAbility.createForUser(user, input.spaceId);
    if (ability.cannot(SpaceCaslAction.Read, SpaceCaslSubject.Page)) {
      throw new ForbiddenException();
    }

    return this.todoService.findBySpaceId(input.spaceId, workspace.id, pagination);
  }

  @HttpCode(HttpStatus.OK)
  @Post('update')
  async update(@Body() dto: UpdateTodoDto, @AuthUser() user: User) {
    const todo = await this.todoRepo.findById(dto.todoId, {
      includeCreator: true,
    });
    if (!todo) {
      throw new NotFoundException('Todo not found');
    }

    const page = await this.pageRepo.findById(todo.pageId);
    if (!page) {
      throw new NotFoundException('Page not found');
    }

    await this.pageAccessService.validateCanEdit(page, user);

    return this.todoService.update(todo, dto, user);
  }

  @HttpCode(HttpStatus.OK)
  @Post('delete')
  async delete(@Body() input: TodoIdDto, @AuthUser() user: User) {
    const todo = await this.todoRepo.findById(input.todoId);
    if (!todo) {
      throw new NotFoundException('Todo not found');
    }

    const page = await this.pageRepo.findById(todo.pageId);
    if (!page) {
      throw new NotFoundException('Page not found');
    }

    await this.pageAccessService.validateCanEdit(page, user);

    await this.todoService.delete(todo, user);
  }
}
