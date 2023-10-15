import React, { ReactElement } from 'react';
import mergeRefs from './merge-refs';
import { useElementSize } from '@mantine/hooks';

type Props = {
  children: (dimens: { width: number; height: number }) => ReactElement;
};

const style = {
  flex: 1,
  width: '100%',
  height: '100%',
  minHeight: 0,
  minWidth: 0,
};

export const FillFlexParent = React.forwardRef(function FillFlexParent(
  props: Props,
  forwardRef
) {
  const { ref, width, height } = useElementSize();
  return (
    <div style={style} ref={mergeRefs(ref, forwardRef)}>
      {width && height ? props.children({ width, height }) : null}
    </div>
  );
});
