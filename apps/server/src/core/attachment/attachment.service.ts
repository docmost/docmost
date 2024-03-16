import { BadRequestException, Injectable } from '@nestjs/common';
import { StorageService } from '../../integrations/storage/storage.service';
import { MultipartFile } from '@fastify/multipart';
import { AttachmentRepository } from './repositories/attachment.repository';
import { Attachment } from './entities/attachment.entity';
import { UserService } from '../user/user.service';
import { UpdateUserDto } from '../user/dto/update-user.dto';
import {
  AttachmentType,
  getAttachmentPath,
  PreparedFile,
  prepareFile,
  validateFileType,
} from './attachment.utils';
import { v4 as uuid4 } from 'uuid';
import { WorkspaceService } from '../workspace/services/workspace.service';
import { UpdateWorkspaceDto } from '../workspace/dto/update-workspace.dto';

@Injectable()
export class AttachmentService {
  constructor(
    private readonly storageService: StorageService,
    private readonly attachmentRepo: AttachmentRepository,
    private readonly workspaceService: WorkspaceService,
    private readonly userService: UserService,
  ) {}

  async uploadToDrive(preparedFile: PreparedFile, filePath: string) {
    try {
      await this.storageService.upload(filePath, preparedFile.buffer);
    } catch (err) {
      console.error('Error uploading file to drive:', err);
      throw new BadRequestException('Error uploading file to drive');
    }
  }

  async updateUserAvatar(userId: string, avatarUrl: string) {
    const updateUserDto = new UpdateUserDto();
    updateUserDto.avatarUrl = avatarUrl;
    await this.userService.update(userId, updateUserDto);
  }

  async updateWorkspaceLogo(workspaceId: string, logoUrl: string) {
    const updateWorkspaceDto = new UpdateWorkspaceDto();
    updateWorkspaceDto.logo = logoUrl;
    await this.workspaceService.update(workspaceId, updateWorkspaceDto);
  }

  async uploadAvatar(filePromise: Promise<MultipartFile>, userId: string) {
    try {
      const preparedFile: PreparedFile = await prepareFile(filePromise);
      const allowedImageTypes = ['.jpg', '.jpeg', '.png'];

      validateFileType(preparedFile.fileExtension, allowedImageTypes);

      preparedFile.fileName = uuid4() + preparedFile.fileExtension;

      const attachmentPath = getAttachmentPath(AttachmentType.Avatar);
      const filePath = `${attachmentPath}/${preparedFile.fileName}`;

      await this.uploadToDrive(preparedFile, filePath);

      const attachment = new Attachment();

      attachment.creatorId = userId;
      attachment.pageId = null;
      attachment.workspaceId = null;
      attachment.type = AttachmentType.Avatar;
      attachment.filePath = filePath;
      attachment.fileName = preparedFile.fileName;
      attachment.fileSize = preparedFile.fileSize;
      attachment.mimeType = preparedFile.mimeType;
      attachment.fileExt = preparedFile.fileExtension;

      await this.updateUserAvatar(userId, filePath);

      return attachment;
    } catch (err) {
      console.log(err);
      throw new BadRequestException(err.message);
    }
  }

  async uploadWorkspaceLogo(
    filePromise: Promise<MultipartFile>,
    workspaceId: string,
    userId: string,
  ) {
    try {
      const preparedFile: PreparedFile = await prepareFile(filePromise);
      const allowedImageTypes = ['.jpg', '.jpeg', '.png'];

      validateFileType(preparedFile.fileExtension, allowedImageTypes);

      preparedFile.fileName = uuid4() + preparedFile.fileExtension;

      const attachmentPath = getAttachmentPath(
        AttachmentType.WorkspaceLogo,
        workspaceId,
      );
      const filePath = `${attachmentPath}/${preparedFile.fileName}`;

      await this.uploadToDrive(preparedFile, filePath);

      const attachment = new Attachment();

      attachment.creatorId = userId;
      attachment.pageId = null;
      attachment.workspaceId = workspaceId;
      attachment.type = AttachmentType.WorkspaceLogo;
      attachment.filePath = filePath;
      attachment.fileName = preparedFile.fileName;
      attachment.fileSize = preparedFile.fileSize;
      attachment.mimeType = preparedFile.mimeType;
      attachment.fileExt = preparedFile.fileExtension;

      await this.updateWorkspaceLogo(workspaceId, filePath);

      return attachment;
    } catch (err) {
      console.log(err);
      throw new BadRequestException(err.message);
    }
  }

  async uploadFile(
    filePromise: Promise<MultipartFile>,
    pageId: string,
    workspaceId: string,
    userId: string,
  ) {
    try {
      const preparedFile: PreparedFile = await prepareFile(filePromise);
      const allowedImageTypes = ['.jpg', '.jpeg', '.png', '.pdf'];

      validateFileType(preparedFile.fileExtension, allowedImageTypes);

      const attachmentPath = getAttachmentPath(
        AttachmentType.WorkspaceLogo,
        workspaceId,
      );
      const filePath = `${attachmentPath}/${preparedFile.fileName}`;

      await this.uploadToDrive(preparedFile, filePath);

      const attachment = new Attachment();

      attachment.creatorId = userId;
      attachment.pageId = pageId;
      attachment.workspaceId = workspaceId;
      attachment.type = AttachmentType.WorkspaceLogo;
      attachment.filePath = filePath;
      attachment.fileName = preparedFile.fileName;
      attachment.fileSize = preparedFile.fileSize;
      attachment.mimeType = preparedFile.mimeType;
      attachment.fileExt = preparedFile.fileExtension;

      return attachment;
    } catch (err) {
      console.log(err);
      throw new BadRequestException(err.message);
    }
  }
}
