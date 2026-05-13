import styles from './doc-tree-drag-preview.module.css';

type Props = {
  label: string;
};

export function DocTreeDragPreview({ label }: Props) {
  return <div className={styles.preview}>{label || 'Untitled'}</div>;
}
