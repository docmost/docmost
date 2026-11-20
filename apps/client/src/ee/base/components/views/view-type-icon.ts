import {
  IconCalendar,
  IconForms,
  IconLayoutKanban,
  IconTable,
} from "@tabler/icons-react";
import { BaseViewType } from "@/ee/base/types/base.types";

export const VIEW_TYPE_ICONS: Record<BaseViewType, typeof IconTable> = {
  table: IconTable,
  kanban: IconLayoutKanban,
  calendar: IconCalendar,
  form: IconForms,
};
