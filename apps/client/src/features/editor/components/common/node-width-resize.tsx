import React, { memo, useCallback, useEffect, useState } from "react";
import { Slider } from "@mantine/core";

export type ImageWidthProps = {
  onChange: (value: number) => void;
  value: number;
};

export const NodeWidthResize = memo(({ onChange, value }: ImageWidthProps) => {
  const [currentValue, setCurrentValue] = useState(value);

  useEffect(() => {
    setCurrentValue(value);
  }, [value]);

  const handleChange = useCallback(
    (newValue: number) => {
      onChange(newValue);
    },
    [onChange],
  );

  return (
    <Slider
      p={"sm"}
      min={10}
      value={currentValue}
      onChange={setCurrentValue}
      onChangeEnd={handleChange}
      label={(value) => `${value}%`}
    />
  );
});
