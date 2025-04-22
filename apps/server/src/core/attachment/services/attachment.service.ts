import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { StorageService } from '../../../integrations/storage/storage.service';
import { MultipartFile } from '@fastify/multipart';
import {
  getAttachmentFolderPath,
  PreparedFile,
  prepareFile,
  validateFileType,
} from '../attachment.utils';
import { v4 as uuid4, v7 as uuid7 } from 'uuid';
import { AttachmentRepo } from '@docmost/db/repos/attachment/attachment.repo';
import { AttachmentType, validImageExtensions } from '../attachment.constants';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { Attachment } from '@docmost/db/types/entity.types';
import { InjectKysely } from 'nestjs-kysely';
import { executeTx } from '@docmost/db/utils';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { WorkspaceRepo } from '@docmost/db/repos/workspace/workspace.repo';
import { SpaceRepo } from '@docmost/db/repos/space/space.repo';
import { PageRepo } from '@docmost/db/repos/page/page.repo';

import axios from "axios";
import {fileTypeFromBuffer} from 'file-type';

@Injectable()
export class AttachmentService {
  private readonly logger = new Logger(AttachmentService.name);
  constructor(
    private readonly storageService: StorageService,
    private readonly attachmentRepo: AttachmentRepo,
    private readonly userRepo: UserRepo,
    private readonly workspaceRepo: WorkspaceRepo,
    private readonly spaceRepo: SpaceRepo,
    private readonly pageRepo: PageRepo,
    @InjectKysely() private readonly db: KyselyDB,
  ) {}

  async uploadFile(opts: {
    filePromise: Promise<MultipartFile>;
    pageId: string;
    userId: string;
    spaceId: string;
    workspaceId: string;
    attachmentId?: string;
    type?: AttachmentType;
  }) {
    const { filePromise, pageId, spaceId, userId, workspaceId, type } = opts;
    const preparedFile: PreparedFile = await prepareFile(filePromise);

    let isUpdate = false;
    let attachmentId = null;

    // passing attachmentId to allow for updating diagrams
    // instead of creating new files for each save
    if (opts?.attachmentId) {
      const existingAttachment = await this.attachmentRepo.findById(
        opts.attachmentId,
      );
      if (!existingAttachment) {
        throw new NotFoundException(
          'Existing attachment to overwrite not found',
        );
      }

      if (
        existingAttachment.pageId !== pageId &&
        existingAttachment.fileExt !== preparedFile.fileExtension &&
        existingAttachment.workspaceId !== workspaceId
      ) {
        throw new BadRequestException('File attachment does not match');
      }
      attachmentId = opts.attachmentId;
      isUpdate = true;
    } else {
      attachmentId = uuid7();
    }

    const filePath = `${getAttachmentFolderPath(AttachmentType.File, workspaceId)}/${attachmentId}/${preparedFile.fileName}`;

    await this.uploadToDrive(filePath, preparedFile.buffer);

    let attachment: Attachment = null;
    try {
      await executeTx(this.db, async (trx) => {
        if (isUpdate) {
          attachment = await this.attachmentRepo.updateAttachment(
            {
              updatedAt: new Date(),
            },
            attachmentId,
          );
        } else {
          attachment = await this.saveAttachment({
            attachmentId,
            preparedFile,
            filePath,
            type: type || AttachmentType.File,
            userId,
            spaceId,
            workspaceId,
            pageId,
          });
        }

        if (type === AttachmentType.CoverPhoto) {
          const page = await this.pageRepo.findById(pageId, {trx});
          await this.pageRepo.updatePage({...page, coverPhoto: attachment.id}, pageId, trx);
        }
      });
    } catch (err) {
      // delete uploaded file on error
      this.logger.error(err);
    }

    return attachment;
  }

  async uploadImage(
    filePromise: Promise<MultipartFile>,
    type:
      | AttachmentType.Avatar
      | AttachmentType.WorkspaceLogo
      | AttachmentType.CoverPhoto
      | AttachmentType.SpaceLogo,
    userId: string,
    workspaceId: string,
    spaceId?: string,
    pageId?: string,
  ) {
    const preparedFile: PreparedFile = await prepareFile(filePromise);
    validateFileType(preparedFile.fileExtension, validImageExtensions);

    preparedFile.fileName = uuid4() + preparedFile.fileExtension;

    const filePath = `${getAttachmentFolderPath(type, workspaceId)}/${preparedFile.fileName}`;

    await this.uploadToDrive(filePath, preparedFile.buffer);

    let attachment: Attachment = null;
    let oldFileName: string = null;

    try {
      await executeTx(this.db, async (trx) => {
        attachment = await this.saveAttachment({
          preparedFile,
          filePath,
          type,
          userId,
          workspaceId,
          pageId,
          spaceId,
          trx,
        });

        if (type === AttachmentType.Avatar) {
          const user = await this.userRepo.findById(userId, workspaceId, {
            trx,
          });

          oldFileName = user.avatarUrl;

          await this.userRepo.updateUser(
            { avatarUrl: preparedFile.fileName },
            userId,
            workspaceId,
            trx,
          );
        } else if (type === AttachmentType.CoverPhoto) {
          const page = await this.pageRepo.findById(pageId, {trx});
          await this.pageRepo.updatePage({...page, coverPhoto: attachment.id}, pageId, trx);
        } else if (type === AttachmentType.WorkspaceLogo) {
          const workspace = await this.workspaceRepo.findById(workspaceId, {
            trx,
          });

          oldFileName = workspace.logo;

          await this.workspaceRepo.updateWorkspace(
            { logo: preparedFile.fileName },
            workspaceId,
            trx,
          );
        } else if (type === AttachmentType.SpaceLogo && spaceId) {
          const space = await this.spaceRepo.findById(spaceId, workspaceId, {
            trx,
          });

          oldFileName = space.logo;

          await this.spaceRepo.updateSpace(
            { logo: preparedFile.fileName },
            spaceId,
            workspaceId,
            trx,
          );
        } else {
          throw new BadRequestException(`Image upload aborted.`);
        }
      });
    } catch (err) {
      // delete uploaded file on db update failure
      this.logger.error('Image upload error:', err);
      await this.deleteRedundantFile(filePath);
      throw new BadRequestException('Failed to upload image');
    }

    if (oldFileName && !oldFileName.toLowerCase().startsWith('http')) {
      // delete old avatar or logo
      const oldFilePath =
        getAttachmentFolderPath(type, workspaceId) + '/' + oldFileName;
      await this.deleteRedundantFile(oldFilePath);
    }

    return attachment;
  }

  async uploadRemoteImage(
    url: string,
    type:
      | AttachmentType.Avatar
      | AttachmentType.WorkspaceLogo
      | AttachmentType.CoverPhoto
      | AttachmentType.SpaceLogo,
    userId: string,
    workspaceId: string,
    spaceId?: string,
    pageId?: string,
    description?: string, 
    descriptionUrl?: string,
  ) {
    const buffer = await this.loadImage(url);

    const { mime, ext } = await fileTypeFromBuffer(buffer);
    if (!mime || !ext) {
      throw new BadRequestException('Invalid file type');
    }
    const mimeType = mime;
    const fileExtension = `.${ext}`;
    
    const fileName = uuid4() + fileExtension;

    const filePath = `${getAttachmentFolderPath(type, workspaceId)}/${fileName}`;
    console.log("filePath", filePath, "size", buffer.length);
    await this.uploadToDrive(filePath, buffer);

    let attachment: Attachment = null;
    let oldFileName: string = null;

    try {
      await executeTx(this.db, async (trx) => {
        attachment = await this.saveRemoteAttachment({
          filePath,
          fileName,
          fileSize: buffer.length,
          mimeType,
          fileExtension,
          type,
          userId,
          workspaceId,
          spaceId,
          pageId,
          orginalPath: url,
          description, 
          descriptionUrl,
          trx,
        });

        if (type === AttachmentType.Avatar) {
          const user = await this.userRepo.findById(userId, workspaceId, {
            trx,
          });

          oldFileName = user.avatarUrl;

          await this.userRepo.updateUser(
            { avatarUrl: fileName },
            userId,
            workspaceId,
            trx,
          );
        } else if (type === AttachmentType.CoverPhoto) {
          const page = await this.pageRepo.findById(pageId, {trx});

          await this.pageRepo.updatePage({...page, coverPhoto: attachment.id}, page.id, trx);
        } else if (type === AttachmentType.WorkspaceLogo) {
          const workspace = await this.workspaceRepo.findById(workspaceId, {
            trx,
          });

          oldFileName = workspace.logo;

          await this.workspaceRepo.updateWorkspace(
            { logo: fileName },
            workspaceId,
            trx,
          );
        } else if (type === AttachmentType.SpaceLogo && spaceId) {
          const space = await this.spaceRepo.findById(spaceId, workspaceId, {
            trx,
          });

          oldFileName = space.logo;

          await this.spaceRepo.updateSpace(
            { logo: fileName },
            spaceId,
            workspaceId,
            trx,
          );
        } else {
          throw new BadRequestException(`Image upload aborted.`);
        }
      });
    } catch (err) {
      // delete uploaded file on db update failure
      this.logger.error('Image upload error:', err);
      await this.deleteRedundantFile(filePath);
      throw new BadRequestException('Failed to upload image');
    }

    if (oldFileName && !oldFileName.toLowerCase().startsWith('http')) {
      // delete old avatar or logo
      const oldFilePath =
        getAttachmentFolderPath(type, workspaceId) + '/' + oldFileName;
      await this.deleteRedundantFile(oldFilePath);
    }

    return attachment;
  }

  async deleteRedundantFile(filePath: string) {
    try {
      await this.storageService.delete(filePath);
      await this.attachmentRepo.deleteAttachmentByFilePath(filePath);
    } catch (error) {
      this.logger.error('deleteRedundantFile', error);
    }
  }

  async uploadToDrive(filePath: string, fileBuffer: any) {
    try {
      await this.storageService.upload(filePath, fileBuffer);
    } catch (err) {
      this.logger.error('Error uploading file to drive:', err);
      throw new BadRequestException('Error uploading file to drive');
    }
  }

  async loadImage(imageUrl: string): Promise<Buffer<ArrayBuffer>> {
    try {
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      return Buffer.from(response.data, 'binary');
    } catch (error) {
      this.logger.error(`Failed to load and save image: ${error}`);
      throw new BadRequestException('Failed to load and save image');
    }
  }

  async saveAttachment(opts: {
    attachmentId?: string;
    preparedFile: PreparedFile;
    filePath: string;
    type: AttachmentType;
    userId: string;
    workspaceId: string;
    pageId?: string;
    spaceId?: string;
    orginalPath?: string;
    description?: string;
    descriptionUrl?: string;
    trx?: KyselyTransaction;
  }): Promise<Attachment> {
    const {
      attachmentId,
      preparedFile,
      filePath,
      type,
      userId,
      workspaceId,
      pageId,
      spaceId,
      orginalPath,
      description,
      descriptionUrl,
      trx,
    } = opts;
    return this.attachmentRepo.insertAttachment(
      {
        id: attachmentId,
        type: type,
        filePath: filePath,
        fileName: preparedFile.fileName,
        fileSize: preparedFile.fileSize,
        mimeType: preparedFile.mimeType,
        fileExt: preparedFile.fileExtension,
        creatorId: userId,
        workspaceId: workspaceId,
        pageId: pageId,
        spaceId: spaceId,
        orginalPath,
        description,
        descriptionUrl: descriptionUrl,
      },
      trx,
    );
  }

  async saveRemoteAttachment(opts: {
    attachmentId?: string;
    filePath: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    fileExtension: string;
    type: AttachmentType;
    userId: string;
    workspaceId: string;
    pageId?: string;
    spaceId?: string;
    orginalPath?: string;
    description?: string;
    descriptionUrl?: string;
    trx?: KyselyTransaction;
  }): Promise<Attachment> {
    const {
      attachmentId,
      filePath,
      fileName,
      fileSize,
      mimeType,
      fileExtension,
      type,
      userId,
      workspaceId,
      pageId,
      spaceId,
      orginalPath,
      description,
      descriptionUrl,
      trx,
    } = opts;
    return this.attachmentRepo.insertAttachment(
      {
        id: attachmentId,
        type,
        filePath,
        fileName,
        fileSize,
        mimeType,
        fileExt: fileExtension,
        creatorId: userId,
        workspaceId: workspaceId,
        pageId: pageId,
        spaceId: spaceId,
        orginalPath,
        description,
        descriptionUrl,
      },
      trx,
    );
  }

  async handleDeleteSpaceAttachments(spaceId: string) {
    try {
      const attachments = await this.attachmentRepo.findBySpaceId(spaceId);
      if (!attachments || attachments.length === 0) {
        return;
      }

      const failedDeletions = [];

      await Promise.all(
        attachments.map(async (attachment) => {
          try {
            await this.storageService.delete(attachment.filePath);
            await this.attachmentRepo.deleteAttachmentById(attachment.id);
          } catch (err) {
            failedDeletions.push(attachment.id);
            this.logger.log(
              `DeleteSpaceAttachments: failed to delete attachment ${attachment.id}:`,
              err,
            );
          }
        }),
      );

      if (failedDeletions.length === attachments.length) {
        throw new Error(
          `Failed to delete any attachments for spaceId: ${spaceId}`,
        );
      }
    } catch (err) {
      throw err;
    }
  }

  async handleDeleteUserAvatars(userId: string) {
    try {
      const userAvatars = await this.db
        .selectFrom('attachments')
        .select(['id', 'filePath'])
        .where('creatorId', '=', userId)
        .where('type', '=', AttachmentType.Avatar)
        .execute();

      if (!userAvatars || userAvatars.length === 0) {
        return;
      }

      await Promise.all(
        userAvatars.map(async (attachment) => {
          try {
            await this.storageService.delete(attachment.filePath);
            await this.attachmentRepo.deleteAttachmentById(attachment.id);
          } catch (err) {
            this.logger.log(
              `DeleteUserAvatar: failed to delete user avatar ${attachment.id}:`,
              err,
            );
          }
        }),
      );
    } catch (err) {
      throw err;
    }
  }

  async findAndAttachThumbnails(attachments: Attachment[]) {
    const thumbnailPromises = attachments.map(async (attachment) => {
      if (attachment.fileExt === '.svg') {
        attachment.thumbnailPath = attachment.filePath;
        return;
      }
      if (attachment.thumbnailPath) {
        return;
      }
      const thumbnailPath = `/files/${attachment.id}/${attachment.fileName}`;
      // TODO: implement thumbnail generation code
      // await this.storageService.findOrCreateThumbnail(attachment.filePath);
      if (thumbnailPath) {
        attachment.thumbnailPath = thumbnailPath;
      }
      return;
    });
    await Promise.all(thumbnailPromises);
  }

  async searchAttachments(workspaceId: string, query: string, fileExts: string[], limit: number, offset: number) {
    const attachments = await this.attachmentRepo.search(query, {workspaceId, limit, offset, fileExts});
    this.findAndAttachThumbnails(attachments);
    return attachments;
  }
}
