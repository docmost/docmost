import { memo, useCallback, useEffect, useState } from 'react';
import { Slider } from '@mantine/core';

export type ImageWidthProps = {
  onChange: (value: number) => void;
  value: number;
  width?: string;
};

export const NodeWidthResize = memo(({ onChange, value, width }: ImageWidthProps) => {
  const [currentValue, setCurrentValue] = useState(value);

  useEffect(() => {
    setCurrentValue(value);
  }, [value]);

  const handleChange = useCallback(
    (newValue: number) => {
      onChange(newValue);
    },
    [onChange]
  );

  return (
    <Slider
      p={'sm'}
      min={10}
      value={currentValue}
      onChange={setCurrentValue}
      onChangeEnd={handleChange}
      w={width || 100}
      label={(value) => `${value}%`}
    />
  );
});
