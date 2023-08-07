import { Controller } from '@nestjs/common';
import { WorkspaceService } from '../services/workspace.service';

@Controller('workspace')
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}
}
