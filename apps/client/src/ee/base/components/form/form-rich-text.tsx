import { Fragment } from "react";
import clsx from "clsx";
import classes from "@/ee/base/styles/form.module.css";

const URL_PATTERN = /(https?:\/\/[^\s<>"']*[^\s<>"'.,;:!?)\]}])/g;

type FormRichTextProps = {
  text: string;
  className?: string;
  id?: string;
};

export function FormRichText({ text, className, id }: FormRichTextProps) {
  const parts = text.split(URL_PATTERN);
  return (
    <div id={id} className={clsx(classes.richText, className)}>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer nofollow"
          >
            {part}
          </a>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </div>
  );
}
