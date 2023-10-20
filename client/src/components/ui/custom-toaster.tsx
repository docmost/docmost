import t, { Toaster, useToasterStore } from "react-hot-toast";
import { useEffect, useState } from "react";

export default function CustomToaster() {
  const { toasts } = useToasterStore();
  const TOAST_LIMIT = 3;
  const [toastLimit, setToastLimit] = useState<number>(TOAST_LIMIT);

  useEffect(() => {
    toasts
      .filter((tt) => tt.visible)
      .filter((_, i) => i >= toastLimit)
      .forEach((tt) => {
        t.dismiss(tt.id);
      });
  }, [toastLimit, toasts]);

  return <Toaster position={"top-right"}/>;
}
