import {
  Modal,
  Button,
  Group,
  Text,
} from "@mantine/core";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { searchUnsplashImages, IImage } from "./cover-photo.service.tsx";
import classes from "./cover-photo.module.css";

interface CoverPhotoSelectorModalProps {
  open: boolean;
  onClose: (img: IImage | null) => void;
}

export default function CoverPhotoSelectorModal({
  open,
  onClose,
}: CoverPhotoSelectorModalProps) {
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [images, setImages] = useState<IImage[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const { t } = useTranslation();

  const handleSearchTermChange = async (query: string) => {
    setSearchTerm(query);
    if(query.length > 2) {
      setImages(await searchUnsplashImages(query));
    }
  };

  const handleSelected = (index : number) => {
    setSelectedIndex(index);
    return images[index];
  }

  const handleClose = () => {
    if(selectedIndex > -1) {
      const img = images[selectedIndex];
      img.sourceSystem = "unsplash";
      onClose(img);
    } else {
      onClose(null);
    }
    setSelectedIndex(-1);
    setImages([]);
  }

  return (
    <Modal.Root
      opened={open}
      onClose={handleClose}
      size={500}
      padding="xl"
      yOffset="10vh"
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
              <Text>{t("Search for a cover photo")}</Text>
              <input
                type="text"
                placeholder={t("Search...")}
                onChange={(event) => {handleSearchTermChange(event.target.value)}}
                className={classes.searchInput}
              />
            <div className={classes.imageGrid}>
                {Array.from({ length: 12 }).map((_, index) => (
                    <div
                        key={index}
                        onClick={() => {handleSelected(index)}}
                        className={classes.imageFrame}
                    >{images[index]?.thumbnailUrl ? <img className={selectedIndex === index ? classes.selected : ""} height={98} src={images[index]?.thumbnailUrl} alt={images[index]?.altText} title={`${images[index]?.title} by ${images[index]?.attribution}`} /> : index + 1}
                    </div>
                ))}
            </div>
          <Group justify="center" mt="md">
            <Button onClick={handleClose} variant="default">
              {t("Cancel")}
            </Button>
            <Button onClick={handleClose}>{t("Save")}</Button>
          </Group>
        </Modal.Body>
      </Modal.Content>
    </Modal.Root>
  );
}
