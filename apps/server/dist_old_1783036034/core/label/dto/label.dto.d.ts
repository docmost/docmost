import { LabelType } from "../../../database/repos/label/label.repo";
import { PageIdDto } from '../../page/dto/page.dto';
export declare class AddLabelsDto extends PageIdDto {
    names: string[];
}
export declare class RemoveLabelDto extends PageIdDto {
    labelId: string;
}
export declare class FindPagesByLabelDto {
    labelId?: string;
    name?: string;
    spaceId?: string;
}
export declare class LabelInfoDto {
    name: string;
    type: LabelType;
    spaceId?: string;
}
export declare class ListLabelsDto {
    type: LabelType;
}
