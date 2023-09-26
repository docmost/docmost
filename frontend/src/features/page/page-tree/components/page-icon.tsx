import React from 'react';
import { IconFileDescription } from '@tabler/icons-react';

type Props = {
  droppable?: boolean;
  isEmoji?: boolean;
  fileType?: string;
};

export const PageIcon: React.FC<Props> = (props) => {
  return <IconFileDescription size={18} />;
};
