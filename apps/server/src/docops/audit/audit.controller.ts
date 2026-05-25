import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { User } from '@docmost/db/types/entity.types';
import { ListAuditDto } from './dto/list-audit.dto';

@UseGuards(JwtAuthGuard)
@Controller('docops/audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @HttpCode(HttpStatus.OK)
  @Post('/')
  list(@Body() dto: ListAuditDto, @AuthUser() user: User) {
    return this.auditService.listLogs(dto, user);
  }
}
