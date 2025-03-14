import {
  Modal,
  Button,
  Container,
  Group,
  Tabs,
  Text,
} from "@mantine/core";
import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { searchUnsplashImages, IImage, uploadLocalImage, saveImageAsAttachment, searchAttachmentsWithThumbnail } from "./cover-photo.service.ts";
import classes from "./cover-photo.module.css";
import { IAttachment } from "@/lib/types.ts";

function ThumbnailImage({image, attachment, selected}: {image?: IImage, attachment?: IAttachment, selected: boolean}) {
  let thumbnailUrl, description, title: string;
  if (image) {
    thumbnailUrl = image.thumbnailUrl;
    description = image.altText;
    title = `${image.title} by ${image.attribution}`;
  } else if (attachment) {
    thumbnailUrl = `/api/${attachment.thumbnailPath}`;
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


interface CoverPhotoSelectorModalProps {
  open: boolean;
  pageId: string;
  spaceId: string;
  onClose: (attachment: IAttachment | null) => void;
}

export default function CoverPhotoSelectorModal({
  open,
  pageId,
  spaceId,
  onClose,
}: CoverPhotoSelectorModalProps) {
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [sourceSystem, setSourceSystem] = useState<string>("unsplash");
  const [images, setImages] = useState<IImage[]>([]);
  const [droppedFile, setDroppedFile] = useState<File|null>(null);
  const [attachments, setAttachments] = useState<IAttachment[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const imageRef = useRef<HTMLImageElement>(null);
  const { t } = useTranslation();


  useEffect(() => {
    setSourceSystem("unsplash");
    setSearchTerm("");
    setImages([]);
    setAttachments([]);
    setDroppedFile(null);
    setSelectedIndex(-1);
  }, [open]);

  useEffect(() => {
    setSearchTerm("");
    setImages([]);
    setAttachments([]);
    setDroppedFile(null);
    setSelectedIndex(-1);
  }, [sourceSystem]);

  const handleSearchTermChange = async (query: string) => {
    setSearchTerm(query);
    if(query.length > 2) {
      console.log("Searching for images with query: ", query);
      if(sourceSystem === "unsplash") {
        setImages(await searchUnsplashImages(query));
      } else if(sourceSystem === "attachments") {
        setAttachments(await searchAttachmentsWithThumbnail(query));
      }
    }
  };

  const handleSelected = (index : number) => {
    setSelectedIndex(index);
    return images[index];
  }

  const handleSave = async () => {
    let attachment: IAttachment | null = null;
    if(sourceSystem === "unsplash" && selectedIndex > -1) {
      const img = images[selectedIndex];
      img.sourceSystem = "unsplash";
      attachment = await saveImageAsAttachment(pageId, spaceId, img);
    } else if(sourceSystem === "upload" && droppedFile) {
      attachment = await uploadLocalImage(pageId, spaceId, droppedFile);
    } else if(sourceSystem === "attachments" && selectedIndex > -1) {
      attachment = attachments[selectedIndex];
    }

    onClose(attachment);
    setSelectedIndex(-1);
    setImages([]);
  }

  const handleCancel = async () => {
    onClose(null);
    setSelectedIndex(-1);
    setImages([]);
  }

  return (
    <Modal.Root
      opened={open}
      onClose={handleCancel}
      size={500}
      padding="xl"
      yOffset="24px"
      xOffset={0}
      mah={400}
    >
      <Modal.Overlay />
      <Modal.Content style={{ overflow: "hidden" }}>
        <Modal.Header py={0}>
          <Modal.Title fw={500}>{t("Add Cover Photo")}</Modal.Title>
          <Modal.CloseButton />
        </Modal.Header>
        <Modal.Body> {/* Display a tab header, attachments, unsplash, upload */}
        <Container size="md">
        <Tabs
          defaultValue="unsplash"
          variant="default"
          visibleFrom="sm"
          classNames={{
            root: classes.tabs,
            list: classes.tabsList,
            tab: classes.tab,
          }}
          onChange={(value : string) => {setSourceSystem(value)}}
        >
          <Tabs.List>
            <Tabs.Tab value="unsplash" key="unsplash">Unsplash</Tabs.Tab>
            <Tabs.Tab value="attachments" key="attachments">Attachments</Tabs.Tab>
            <Tabs.Tab value="upload" key="upload">Upload</Tabs.Tab>
          </Tabs.List>
            <Tabs.Panel value="unsplash">
              <Text>{t("Search for a cover photo")}</Text>
              <input
                type="text"
                placeholder={t("Search...")}
                onChange={(event) => {handleSearchTermChange(event.target.value)}}
                className={classes.searchInput}
                value={searchTerm}
              />
              <div className={classes.imageGrid}>
                {Array.from({ length: 12 }).map((_, index) => (
                    <div
                        key={index}
                        onClick={() => {handleSelected(index)}}
                        className={classes.imageFrame}>
                          <ThumbnailImage image={images[index]} selected={selectedIndex === index} />
                    </div>
                ))}
              </div>
            </Tabs.Panel>
            <Tabs.Panel value="attachments">
              <Text>{t("Search for a cover photo")}</Text>
              <input
                type="text"
                placeholder={t("Search...")}
                onChange={(event) => {handleSearchTermChange(event.target.value)}}
                className={classes.searchInput}
                value={searchTerm}
              />
                <div className={classes.imageGrid}>
                {Array.from({ length: 12 }).map((_, index) => (
                    <div
                        key={index}
                        onClick={() => {handleSelected(index)}}
                        className={classes.imageFrame}>
                          <ThumbnailImage attachment={attachments[index]} selected={selectedIndex === index} />
                    </div>
                ))}
              </div>
              </Tabs.Panel>
            <Tabs.Panel value="upload">
              <Text>{t("Drag and drop an image to use")}</Text>
                <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  width: "100%",
                  height: "400px",
                  overflowY: "auto",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  marginTop: "10px",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const files = event.dataTransfer.files;
                  if (files.length > 0) {
                    setDroppedFile(files[0]);
                    const reader = new FileReader();
                    reader.onload = (e) => {
                      imageRef.current.src = e.target?.result as string;
                    };
                    reader.readAsDataURL(files[0]);
                  }
                }
              }
                onDragOver={(event) => event.preventDefault()}> 
                <img ref={imageRef} src="/default-upload-file.png" title={t("Drag and drop an image to use")}></img>
              </div>
            </Tabs.Panel>
          </Tabs>
        </Container>

          <Group justify="center" mt="md">
            <Button onClick={handleCancel} variant="default">{t("Cancel")}</Button>
            <Button onClick={handleSave}>{t("Save")}</Button>
          </Group>
        </Modal.Body>
      </Modal.Content>
    </Modal.Root>
  );
}
