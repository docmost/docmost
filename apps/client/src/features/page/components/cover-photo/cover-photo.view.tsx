import { useAtom } from "jotai";
import { userAtom } from "@/features/user/atoms/current-user-atom.ts";
import classes from "./cover-photo.module.css";
import CoverPhotoSelectorModal from "./cover-photo-selector.modal";
import React, { useEffect, useRef } from "react";
import { IAttachment } from "@/lib/types";
import { IPage} from "@/features/page/types/page.types";
import { getAttachment } from "@/features/page/services/page-service";
import { useTranslation } from "react-i18next";

export interface CoverPhotoProps {
    page: IPage;
}

export default function CoverPhoto({page}: CoverPhotoProps) {
  const [user] = useAtom(userAtom);
  const fullPageWidth = user.settings?.preferences?.fullPageWidth;
  const [isCoverMenuOpen, setIsCoverMenuOpen] = React.useState(false);
  const [currentAttachment, setCurrentAttachment] = React.useState<IAttachment | null>(null);
  const coverMenuRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();
  
  useEffect(() => {
    setCurrentAttachment(null);
    if(page?.coverPhoto) {
      (async () => {
        const attachment = await getAttachment(page.coverPhoto);
        setCurrentAttachment(attachment);
      })();
    }
  }, [page]);

  const handleAddEditCoverPhoto = async (attachment : IAttachment | null) => {
    setCurrentAttachment(attachment);      
    setIsCoverMenuOpen(false);
  }

  const containerClass = currentAttachment ? classes.container : classes.empty;
  return (
    <div className={containerClass}
      onMouseEnter={() => {
        if (coverMenuRef) {
          coverMenuRef.current.classList.remove(classes.hidden);
        }
      }}
      onMouseLeave={() => {
        if (coverMenuRef) {
          coverMenuRef.current.classList.add(classes.hidden);
        } 
      }}>
      <CoverPhotoSelectorModal pageId={page.id} spaceId={page.spaceId} open={isCoverMenuOpen} onClose={(attachment) => {handleAddEditCoverPhoto(attachment)}} />
      {currentAttachment ? 
        <>
          <img src={`/api/files/${currentAttachment.id}/${currentAttachment.fileName}`} alt={currentAttachment.description || ""} className={classes.coverPhoto} />
          <div ref={coverMenuRef} className={`${classes.overlay} ${classes.hidden}`}>
          <div className={classes.coverMenu} onClick={() => {setIsCoverMenuOpen(true)}}>{t("Edit Cover Image")}</div>
          {currentAttachment.descriptionUrl ? <a target="_blank" rel="noopener noreferrer" href={currentAttachment.descriptionUrl} className={classes.coverPhotoAttribution}>{currentAttachment.description}</a> :
            <span className={classes.coverPhotoAttribution}>{currentAttachment.description}</span>}
            </div>
        </> :
        <div ref={coverMenuRef} className={`${classes.coverMenuInverted} ${classes.hidden}`} onClick={() => {setIsCoverMenuOpen(true)}}>{t("Add Cover Image")}</div>
      }
    </div>
  );
}
