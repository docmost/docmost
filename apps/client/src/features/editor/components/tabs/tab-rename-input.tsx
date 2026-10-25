import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

type TabRenameInputProps = {
  initialValue: string;
  onDone: (value: string | null) => void;
};

export default function TabRenameInput({
  initialValue,
  onDone,
}: TabRenameInputProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState(initialValue);
  const doneRef = useRef(false);

  const finish = (result: string | null) => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone(result);
  };

  return (
    <span className="dm-tabs__rename" data-value={value}>
      <input
        aria-label={t("Tab label")}
        size={1}
        value={value}
        autoFocus
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => setValue(event.currentTarget.value)}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.nativeEvent.isComposing || event.keyCode === 229) return;
          if (event.key === "Enter") {
            event.preventDefault();
            finish(value);
          }
          if (event.key === "Escape") {
            event.preventDefault();
            finish(null);
          }
        }}
        onBlur={() => finish(value)}
      />
    </span>
  );
}
