import { ISpace } from "@/features/space/types/space.types";
import { IPage } from "@/features/page/types/page.types";

export type DestinationSelection =
  | { type: "space"; spaceId: string; space: ISpace }
  | {
      type: "page";
      spaceId: string;
      pageId: string;
      page: Partial<IPage>;
      space: Partial<ISpace>;
    };

export type DestinationPickerModalProps = {
  opened: boolean;
  onClose: () => void;
  title: string;
  actionLabel: string;
  onSelect: (selection: DestinationSelection) => void | Promise<void>;
  loading?: boolean;
  excludePageId?: string;
  pageLimit?: number;
};
