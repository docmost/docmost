import { BadRequestException, Injectable } from '@nestjs/common';
import { StorageService } from '../../integrations/storage/storage.service';
import { MultipartFile } from '@fastify/multipart';
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
import { AttachmentRepo } from '@docmost/db/repos/attachment/attachment.repo';

// TODO: make code better
@Injectable()
export class AttachmentService {
  constructor(
    private readonly storageService: StorageService,
    private readonly workspaceService: WorkspaceService,
    private readonly userService: UserService,
    private readonly attachmentRepo: AttachmentRepo,
  ) {}

  async uploadToDrive(preparedFile: PreparedFile, filePath: string) {
    try {
      await this.storageService.upload(filePath, preparedFile.buffer);
    } catch (err) {
      console.error('Error uploading file to drive:', err);
      throw new BadRequestException('Error uploading file to drive');
    }
  }

  async updateUserAvatar(avatarUrl: string, userId: string, workspaceId) {
    const updateUserDto = new UpdateUserDto();
    updateUserDto.avatarUrl = avatarUrl;
    await this.userService.update(updateUserDto, userId, workspaceId);
  }

  async updateWorkspaceLogo(workspaceId: string, logoUrl: string) {
    const updateWorkspaceDto = new UpdateWorkspaceDto();
    updateWorkspaceDto.logo = logoUrl;
    await this.workspaceService.update(workspaceId, updateWorkspaceDto);
  }

  async uploadAvatar(
    filePromise: Promise<MultipartFile>,
    userId: string,
    workspaceId: string,
  ) {
    try {
      const preparedFile: PreparedFile = await prepareFile(filePromise);
      const allowedImageTypes = ['.jpg', '.jpeg', '.png'];

      validateFileType(preparedFile.fileExtension, allowedImageTypes);

      preparedFile.fileName = uuid4() + preparedFile.fileExtension;

      const attachmentPath = getAttachmentPath(AttachmentType.Avatar);
      const filePath = `${attachmentPath}/${preparedFile.fileName}`;

      await this.uploadToDrive(preparedFile, filePath);

      // todo: in transaction
      const attachment = await this.attachmentRepo.insertAttachment({
        creatorId: userId,
        type: AttachmentType.Avatar,
        filePath: filePath,
        fileName: preparedFile.fileName,
        fileSize: preparedFile.fileSize,
        mimeType: preparedFile.mimeType,
        fileExt: preparedFile.fileExtension,
        workspaceId: workspaceId,
      });

      await this.updateUserAvatar(filePath, userId, workspaceId);

      return attachment;
    } catch (err) {
      console.log(err);
      throw new BadRequestException('Failed to upload file');
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

      // todo: in trx
      const attachment = await this.attachmentRepo.insertAttachment({
        creatorId: userId,
        type: AttachmentType.WorkspaceLogo,
        filePath: filePath,
        fileName: preparedFile.fileName,
        fileSize: preparedFile.fileSize,
        mimeType: preparedFile.mimeType,
        fileExt: preparedFile.fileExtension,
        workspaceId: workspaceId,
      });

      await this.updateWorkspaceLogo(workspaceId, filePath);

      return attachment;
    } catch (err) {
      console.log(err);
      throw new BadRequestException('Failed to upload file');
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

      const attachment = await this.attachmentRepo.insertAttachment({
        creatorId: userId,
        pageId: pageId,
        type: AttachmentType.File,
        filePath: filePath,
        fileName: preparedFile.fileName,
        fileSize: preparedFile.fileSize,
        mimeType: preparedFile.mimeType,
        fileExt: preparedFile.fileExtension,
        workspaceId: workspaceId,
      });

      return attachment;
    } catch (err) {
      console.log(err);
      throw new BadRequestException('Failed to upload file');
    }
  }
}
