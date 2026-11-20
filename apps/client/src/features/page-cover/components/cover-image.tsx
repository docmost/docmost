import React, { useLayoutEffect, useState } from "react";
import classes from "./page-cover.module.css";

type CoverImageProps = {
  src: string;
  position: number;
  imageRef?: React.RefObject<HTMLImageElement>;
  onError: () => void;
};

export function CoverImage({ src, position, imageRef, onError }: CoverImageProps) {
  const [loaded, setLoaded] = useState(false);
  const localRef = React.useRef<HTMLImageElement>(null);
  const ref = imageRef ?? localRef;

  useLayoutEffect(() => {
    const image = ref.current;
    if (image?.complete && image.naturalWidth > 0) setLoaded(true);
  }, [ref]);

  return (
    <img
      ref={ref}
      src={src}
      alt=""
      draggable={false}
      className={classes.image}
      data-loaded={loaded || undefined}
      style={{ objectPosition: `50% ${position}%` }}
      onLoad={() => setLoaded(true)}
      onError={onError}
    />
  );
}
