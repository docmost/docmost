import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { BaseRowRepo } from '@docmost/db/repos/base/base-row.repo';
import { BasePropertyRepo } from '@docmost/db/repos/base/base-property.repo';
import { BaseViewRepo } from '@docmost/db/repos/base/base-view.repo';
import { CreateRowDto } from '../dto/create-row.dto';
import {
  UpdateRowDto,
  ListRowsDto,
  ReorderRowDto,
} from '../dto/update-row.dto';
import {
  BasePropertyTypeValue,
  validateCellValue,
  isSystemPropertyType,
} from '../base.schemas';
import { generateJitteredKeyBetween } from 'fractional-indexing-jittered';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { BaseProperty } from '@docmost/db/types/entity.types';

@Injectable()
export class BaseRowService {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly baseRowRepo: BaseRowRepo,
    private readonly basePropertyRepo: BasePropertyRepo,
    private readonly baseViewRepo: BaseViewRepo,
  ) {}

  async create(userId: string, workspaceId: string, dto: CreateRowDto) {
    let position: string;

    if (dto.afterRowId) {
      const afterRow = await this.baseRowRepo.findById(dto.afterRowId);
      if (!afterRow || afterRow.baseId !== dto.baseId) {
        throw new BadRequestException('Invalid afterRowId');
      }
      position = generateJitteredKeyBetween(afterRow.position, null);
    } else {
      const lastPosition = await this.baseRowRepo.getLastPosition(dto.baseId);
      position = generateJitteredKeyBetween(lastPosition, null);
    }

    let validatedCells: Record<string, unknown> = {};
    if (dto.cells && Object.keys(dto.cells).length > 0) {
      const properties = await this.basePropertyRepo.findByBaseId(dto.baseId);
      validatedCells = this.validateCells(dto.cells, properties);
    }

    return this.baseRowRepo.insertRow({
      baseId: dto.baseId,
      cells: validatedCells as any,
      position,
      creatorId: userId,
      workspaceId,
    });
  }

  async getRowInfo(rowId: string, baseId: string) {
    const row = await this.baseRowRepo.findById(rowId);
    if (!row || row.baseId !== baseId) {
      throw new NotFoundException('Row not found');
    }
    return row;
  }

  async update(dto: UpdateRowDto, userId?: string) {
    const row = await this.baseRowRepo.findById(dto.rowId);
    if (!row || row.baseId !== dto.baseId) {
      throw new NotFoundException('Row not found');
    }

    const properties = await this.basePropertyRepo.findByBaseId(dto.baseId);
    const validatedCells = this.validateCells(dto.cells, properties);

    await this.baseRowRepo.updateCells(dto.rowId, validatedCells, userId);

    return this.baseRowRepo.findById(dto.rowId);
  }

  async delete(rowId: string, baseId: string) {
    const row = await this.baseRowRepo.findById(rowId);
    if (!row || row.baseId !== baseId) {
      throw new NotFoundException('Row not found');
    }

    await this.baseRowRepo.softDelete(rowId);
  }

  async list(dto: ListRowsDto, pagination: PaginationOptions) {
    const hasFilters = dto.filters && dto.filters.length > 0;
    const hasSorts = dto.sorts && dto.sorts.length > 0;

    if (!hasFilters && !hasSorts) {
      return this.baseRowRepo.findByBaseId(dto.baseId, pagination);
    }

    const properties = await this.basePropertyRepo.findByBaseId(dto.baseId);
    const propertyTypeMap = new Map(properties.map((p) => [p.id, p.type]));

    return this.baseRowRepo.findByBaseIdFiltered(
      dto.baseId,
      dto.filters ?? [],
      dto.sorts ?? [],
      propertyTypeMap,
      pagination,
    );
  }

  async reorder(dto: ReorderRowDto) {
    const row = await this.baseRowRepo.findById(dto.rowId);
    if (!row || row.baseId !== dto.baseId) {
      throw new NotFoundException('Row not found');
    }

    try {
      generateJitteredKeyBetween(dto.position, null);
    } catch {
      throw new BadRequestException('Invalid position value');
    }

    await this.baseRowRepo.updatePosition(dto.rowId, dto.position);
  }

  private validateCells(
    cells: Record<string, unknown>,
    properties: BaseProperty[],
  ): Record<string, unknown> {
    const propertyMap = new Map(properties.map((p) => [p.id, p]));
    const validatedCells: Record<string, unknown> = {};
    const errors: string[] = [];

    for (const [propertyId, value] of Object.entries(cells)) {
      const property = propertyMap.get(propertyId);
      if (!property) {
        errors.push(`Unknown property: ${propertyId}`);
        continue;
      }

      if (isSystemPropertyType(property.type)) {
        continue;
      }

      if (value === null || value === undefined) {
        validatedCells[propertyId] = null;
        continue;
      }

      const result = validateCellValue(
        property.type as BasePropertyTypeValue,
        value,
      );

      if (!result.success) {
        errors.push(
          `Invalid value for property "${property.name}" (${property.type}): ${result.error.issues[0]?.message}`,
        );
        continue;
      }

      validatedCells[propertyId] = result.data;
    }

    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'Cell validation failed',
        errors,
      });
    }

    return validatedCells;
  }
}
