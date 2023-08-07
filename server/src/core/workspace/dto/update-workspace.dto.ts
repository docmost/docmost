import { PartialType } from '@nestjs/mapped-types';
import { CreateWorkspaceDto } from './create-workspace.dto';

export class UpdateWorkspaceDto extends PartialType(CreateWorkspaceDto) {}
