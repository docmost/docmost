import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { executeTx } from '@docmost/db/utils';
import { BasePropertyRepo } from '@docmost/db/repos/base/base-property.repo';
import { BaseRowRepo } from '@docmost/db/repos/base/base-row.repo';
import { CreatePropertyDto } from '../dto/create-property.dto';
import {
  UpdatePropertyDto,
  DeletePropertyDto,
  ReorderPropertyDto,
} from '../dto/update-property.dto';
import {
  BasePropertyTypeValue,
  parseTypeOptions,
  attemptCellConversion,
  validateTypeOptions,
  isSystemPropertyType,
} from '../base.schemas';
import { generateJitteredKeyBetween } from 'fractional-indexing-jittered';

@Injectable()
export class BasePropertyService {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly basePropertyRepo: BasePropertyRepo,
    private readonly baseRowRepo: BaseRowRepo,
  ) {}

  async create(workspaceId: string, dto: CreatePropertyDto) {
    const type = dto.type as BasePropertyTypeValue;
    let validatedTypeOptions = null;

    if (dto.typeOptions) {
      validatedTypeOptions = parseTypeOptions(type, dto.typeOptions);
    } else {
      validatedTypeOptions = parseTypeOptions(type, {});
    }

    const lastPosition = await this.basePropertyRepo.getLastPosition(
      dto.baseId,
    );
    const position = generateJitteredKeyBetween(lastPosition, null);

    return this.basePropertyRepo.insertProperty({
      baseId: dto.baseId,
      name: dto.name,
      type: dto.type,
      position,
      typeOptions: validatedTypeOptions as any,
      workspaceId,
    });
  }

  async update(dto: UpdatePropertyDto) {
    const property = await this.basePropertyRepo.findById(dto.propertyId);
    if (!property) {
      throw new NotFoundException('Property not found');
    }

    if (property.baseId !== dto.baseId) {
      throw new BadRequestException('Property does not belong to this base');
    }

    const isTypeChange = dto.type && dto.type !== property.type;
    const newType = (dto.type ?? property.type) as BasePropertyTypeValue;

    let validatedTypeOptions = property.typeOptions;
    if (dto.typeOptions !== undefined) {
      validatedTypeOptions = parseTypeOptions(newType, dto.typeOptions) as any;
    } else if (isTypeChange) {
      const result = validateTypeOptions(newType, {});
      validatedTypeOptions = result.success ? (result.data as any) : null;
    }

    let conversionSummary: {
      converted: number;
      cleared: number;
      total: number;
    } | null = null;

    if (isTypeChange) {
      const involvesSystem =
        isSystemPropertyType(property.type) || isSystemPropertyType(newType);

      if (involvesSystem) {
        conversionSummary = await this.clearCellValues(
          dto.baseId,
          dto.propertyId,
        );
      } else {
        conversionSummary = await this.convertCellValues(
          dto.baseId,
          dto.propertyId,
          property.type as BasePropertyTypeValue,
          newType,
        );
      }
    }

    await this.basePropertyRepo.updateProperty(dto.propertyId, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.type !== undefined && { type: dto.type }),
      typeOptions: validatedTypeOptions,
    });

    const updatedProperty = await this.basePropertyRepo.findById(
      dto.propertyId,
    );

    return { property: updatedProperty, conversionSummary };
  }

  async delete(dto: DeletePropertyDto) {
    const property = await this.basePropertyRepo.findById(dto.propertyId);
    if (!property) {
      throw new NotFoundException('Property not found');
    }

    if (property.baseId !== dto.baseId) {
      throw new BadRequestException('Property does not belong to this base');
    }

    if (property.isPrimary) {
      throw new BadRequestException('Cannot delete the primary property');
    }

    await executeTx(this.db, async (trx) => {
      await this.basePropertyRepo.deleteProperty(dto.propertyId, trx);
      await this.baseRowRepo.removeCellKey(dto.baseId, dto.propertyId, trx);
    });
  }

  async reorder(dto: ReorderPropertyDto) {
    const property = await this.basePropertyRepo.findById(dto.propertyId);
    if (!property) {
      throw new NotFoundException('Property not found');
    }

    if (property.baseId !== dto.baseId) {
      throw new BadRequestException('Property does not belong to this base');
    }

    await this.basePropertyRepo.updateProperty(dto.propertyId, {
      position: dto.position,
    });
  }

  private async clearCellValues(
    baseId: string,
    propertyId: string,
  ): Promise<{ converted: number; cleared: number; total: number }> {
    const rows = await this.baseRowRepo.findAllByBaseId(baseId);
    const updates: Array<{ id: string; cells: Record<string, unknown> }> = [];

    for (const row of rows) {
      const cells = row.cells as Record<string, unknown>;
      if (propertyId in cells) {
        updates.push({ id: row.id, cells: { [propertyId]: null } });
      }
    }

    if (updates.length > 0) {
      await executeTx(this.db, async (trx) => {
        await this.baseRowRepo.batchUpdateCells(updates, trx);
      });
    }

    return { converted: 0, cleared: updates.length, total: updates.length };
  }

  private async convertCellValues(
    baseId: string,
    propertyId: string,
    fromType: BasePropertyTypeValue,
    toType: BasePropertyTypeValue,
  ): Promise<{ converted: number; cleared: number; total: number }> {
    const rows = await this.baseRowRepo.findAllByBaseId(baseId);
    let converted = 0;
    let cleared = 0;
    let total = 0;

    const updates: Array<{ id: string; cells: Record<string, unknown> }> = [];

    for (const row of rows) {
      const cells = row.cells as Record<string, unknown>;
      if (!(propertyId in cells)) {
        continue;
      }

      total++;
      const currentValue = cells[propertyId];
      const result = attemptCellConversion(fromType, toType, currentValue);

      if (result.converted) {
        converted++;
        updates.push({ id: row.id, cells: { [propertyId]: result.value } });
      } else {
        cleared++;
        updates.push({ id: row.id, cells: { [propertyId]: null } });
      }
    }

    if (updates.length > 0) {
      await executeTx(this.db, async (trx) => {
        await this.baseRowRepo.batchUpdateCells(updates, trx);
      });
    }

    return { converted, cleared, total };
  }
}
