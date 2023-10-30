import { atomFamily } from 'jotai/utils';
import { atom } from 'jotai';
import { IPage } from '@/features/page/types/page.types';

export const pageAtom = atomFamily((pageId) => atom<IPage>(null));
