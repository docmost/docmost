import { memo, useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { Slider } from '@mantine/core';

export type ImageWidthProps = {
  onChange: (value: number) => void;
  value: number;
  width?: string;
};

export const NodeWidthResize = memo(({ onChange, value, width }: ImageWidthProps) => {
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
      min={10}
      value={currentValue}
      onChange={setCurrentValue}
      onChangeEnd={handleChangeEnd}
      w={width || 100}
      label={(value) => `${value}%`}
    />
  );
});
