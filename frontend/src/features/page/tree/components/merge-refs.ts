import React from "react";

type AnyRef = React.MutableRefObject<any> | React.RefCallback<any> | null;

export default function mergeRefs(...refs: AnyRef[]) {
  return (instance: any) => {
    refs.forEach((ref) => {
      if (typeof ref === "function") {
        ref(instance);
      } else if (ref != null) {
        ref.current = instance;
      }
    });
  };
}