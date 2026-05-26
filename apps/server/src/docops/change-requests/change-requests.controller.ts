import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ChangeRequestsService } from './change-requests.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { User } from '@docmost/db/types/entity.types';
import { CreateChangeRequestDto } from './dto/create-change-request.dto';
import { ListChangeRequestsDto } from './dto/list-change-requests.dto';
import { TransitionChangeRequestDto } from './dto/transition-change-request.dto';
import { AddExternalRefDto } from './dto/add-external-ref.dto';
import { SaveDraftContentDto } from './dto/save-draft-content.dto';

@UseGuards(JwtAuthGuard)
@Controller('docops/change-requests')
export class ChangeRequestsController {
  constructor(private readonly crService: ChangeRequestsService) {}

  @HttpCode(HttpStatus.OK)
  @Post('/')
  list(@Body() dto: ListChangeRequestsDto) {
    return this.crService.listChangeRequests(dto);
  }

  @HttpCode(HttpStatus.CREATED)
  @Post('create')
  create(@Body() dto: CreateChangeRequestDto, @AuthUser() user: User) {
    return this.crService.createChangeRequest(dto, user);
  }

  @HttpCode(HttpStatus.OK)
  @Post('info')
  info(@Body() body: { id: string }) {
    return this.crService.getChangeRequest(body.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('transition')
  transition(@Body() dto: TransitionChangeRequestDto, @AuthUser() user: User) {
    return this.crService.transition(dto, user);
  }

  @HttpCode(HttpStatus.CREATED)
  @Post('external-refs/add')
  addExternalRef(@Body() dto: AddExternalRefDto, @AuthUser() user: User) {
    return this.crService.addExternalRef(dto, user);
  }

  @HttpCode(HttpStatus.OK)
  @Post('external-refs/remove')
  removeExternalRef(
    @Body() body: { id: string },
    @AuthUser() user: User,
  ) {
    return this.crService.removeExternalRef(body.id, user);
  }

  @HttpCode(HttpStatus.OK)
  @Post('draft-content/save')
  saveDraftContent(
    @Body() dto: SaveDraftContentDto,
    @AuthUser() user: User,
  ) {
    return this.crService.saveDraftContent(dto, user);
  }

  @HttpCode(HttpStatus.OK)
  @Post('events')
  getEvents(@Body() body: { id: string }) {
    return this.crService.getEvents(body.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('available-transitions')
  availableTransitions(@Body() body: { id: string }, @AuthUser() user: User) {
    return this.crService.getAvailableTransitions(body.id, user);
  }
}
