import api from "@/lib/api-client";
import { IAttachment } from "@/lib/types";

export interface IImage {
    url: string;
    thumbnailUrl: string;
    sourceSystem: string;
    width: number;
    height: number;
    altText: string;
    title: string;
    attribution: string;
    attributionUrl: string;    
}

export async function searchUnsplashImages(
    query: string,
  ): Promise<IImage[]> {
    const req = await api.get<IImage[]>(`/images/search?type=unsplash&query=${query}&orientation=landscape`);
    return req.data;
}

export async function saveImageAsAttachment(pageId: string, spaceId: string, img: IImage): Promise<IAttachment> {
    const body = {
        type: "cover-photo",
        url: img.url,
        description: `Photo by ${img.attribution} on ${img.sourceSystem}`,
        descriptionUrl: img.attributionUrl,
        pageId,
        spaceId,
    }
    const attachment = await api.post<IAttachment>(`/attachments/upload-remote-image`, body);
    return attachment.data;
}
