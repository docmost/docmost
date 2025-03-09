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
    const req = await api.get<IImage[]>(`/images/search?type=unsplash&query=${query}&orientation=landscape&limit=12`);
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

export async function uploadLocalImage(pageId: string, spaceId: string, file: File): Promise<IAttachment> {
    const formData = new FormData();
    formData.append('type', 'cover-photo');
    formData.append('pageId', pageId);
    formData.append('spaceId', spaceId);
    formData.append('file', file);

    const attachment = await api.post<IAttachment>(`/files/upload`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });

    return attachment as unknown as IAttachment;;
}
