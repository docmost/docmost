import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ImageDto } from './dto/images-dto';

import axios, { AxiosInstance } from "axios";

/**
 * Service for handling image-related operations.
 */
@Injectable()
export class ImagesService {
  private readonly logger = new Logger(ImagesService.name);
  private readonly unsplash: AxiosInstance = axios.create({
    baseURL: process.env.UNSPLASH_BASE_URL,
    timeout: 10000,
  });

  async search(
    searchTerm: string,
    orientation: string,
    type: string,
    limit: number,
    spaceId: string,
    workspaceId: string,
  ): Promise<Array<ImageDto>> {
    if (type === 'attachment') {
      // Handle attachment search logic here
      throw new BadRequestException('Attachment search not implemented');
    } else if (type === 'unsplash') {
      // Handle Unsplash search logic here
      return await this.searchUnsplash(searchTerm, orientation, limit);
    }
    return [];
  }
  async searchUnsplash(searchTerm: string, orientation: string, limit: number): Promise<Array<ImageDto>> {
    const images = Array<ImageDto>();

    try {
      const response = await this.unsplash.get("search/photos", {
        params: {
          query: searchTerm,
          orientation,
          per_page: limit,
        },
        headers: {
          'Accept-Version': 'v1',
          'Authorization': `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`,
        }
      });

      const results = response.data.results;

      for (const result of results) {
        const image = new ImageDto();
        image.url = result.urls.regular;
        image.attribution = result.user.name;
        image.altText = result.alt_description || "untitled";
        image.thumbnailUrl = result.urls.thumb;
        image.width = result.width;
        image.height = result.height;
        image.title = result.description || result.alt_description || "untitled";
        image.attributionUrl = result.user.links.html;
        images.push(image);
      }
    } catch (err) {
      const message = 'Error processing file content';
      throw new BadRequestException(message);
    }

    return images;
  }

  async loadImage(imageUrl: string): Promise<Buffer<ArrayBuffer>> {
    try {
      const response = await this.unsplash.get(imageUrl, { responseType: 'arraybuffer' });
      const fileBuffer = Buffer.from(response.data, 'binary');

      return fileBuffer;
    } catch (error) {
      this.logger.error(`Failed to load and save image: ${error}`);
      throw new BadRequestException('Failed to load and save image');
    }
  }
}
