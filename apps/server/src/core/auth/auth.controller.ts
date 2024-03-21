import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { AuthService } from './services/auth.service';
import { CreateUserDto } from './dto/create-user.dto';
import { SetupGuard } from './guards/setup.guard';
import { EnvironmentService } from '../../integrations/environment/environment.service';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private environmentService: EnvironmentService,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Req() req, @Body() loginInput: LoginDto) {
    return this.authService.login(loginInput, req.raw.workspaceId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('register')
  async register(@Req() req, @Body() createUserDto: CreateUserDto) {
    return this.authService.register(createUserDto, req.raw.workspaceId);
  }

  @UseGuards(SetupGuard)
  @HttpCode(HttpStatus.OK)
  @Post('setup')
  async setupWorkspace(
    @Req() req,
    @Body() createAdminUserDto: CreateAdminUserDto,
  ) {
    if (this.environmentService.isCloud()) throw new NotFoundException();
    return this.authService.setup(createAdminUserDto);
  }
}
