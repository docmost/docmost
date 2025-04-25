import { memo, useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { Slider } from '@mantine/core';

export type HeightProps = {
  onChange: (value: number) => void;
  value: number;
  width?: string;
};

export const NodeHeightResize = memo(({ onChange, value, width }: HeightProps) => {
  const [currentValue, setCurrentValue] = useState(value);

  useLayoutEffect(() => {
    setCurrentValue(value);
  }, [value]);

  const handleChangeEnd = useCallback(
    (newValue: number) => {
      onChange(newValue);
    },
    [onChange]
  );

  return (
    <Slider
      p={'sm'}
      min={100}
      max={2000}
      value={currentValue}
      onChange={(value) => {
        setCurrentValue(value);
        onChange(value);  // 在拖动过程中实时触发更新
      }}
      w={width || 100}
      label={(value) => `${value}px`}
    />
  );
});