import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '../../types/kysely.types';

@Injectable()
export class PageOrderingRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}
}
