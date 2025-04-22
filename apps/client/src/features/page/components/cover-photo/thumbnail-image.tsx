import { IAttachment, IImage } from "@/lib/types";
import classes from "./cover-photo.module.css";

/**
 * 
 * 
 */
export function ThumbnailImage({image, attachment, selected}: {image?: IImage, attachment?: IAttachment, selected: boolean}) {
  let thumbnailUrl, description, title: string;
  if (image) {
    thumbnailUrl = image.thumbnailUrl;
    description = image.altText;
    title = `${image.title} by ${image.attribution}`;
  } else if (attachment) {
    thumbnailUrl = `/api${attachment.thumbnailPath}`;
    description = attachment.description || "";
    title = attachment.description || "";
  }
  
  return (
    thumbnailUrl ? 
      <img 
        className={selected ? classes.selected : ""} 
        height={98} 
        src={thumbnailUrl} 
        alt={description} 
        title={title} /> 
        : <img src="/default-thumbnail.png" />);
}

