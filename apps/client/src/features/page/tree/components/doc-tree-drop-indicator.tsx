import type { Instruction } from '@atlaskit/pragmatic-drag-and-drop-hitbox/tree-item';
import styles from '../styles/tree.module.css';

type Props = {
  instruction: Instruction;
  indentPx: number;
};

export function DocTreeDropIndicator({ instruction, indentPx }: Props) {
  const blocked = instruction.type === 'instruction-blocked';
  const inst = blocked ? instruction.desired : instruction;

  const style = {
    ['--drop-line-indent' as never]: `${indentPx}px`,
  } as React.CSSProperties;

  if (inst.type === 'reorder-above') {
    return (
      <div
        className={styles.dropLine}
        data-edge="top"
        data-blocked={blocked || undefined}
        style={style}
      />
    );
  }
  if (inst.type === 'reorder-below') {
    return (
      <div
        className={styles.dropLine}
        data-edge="bottom"
        data-blocked={blocked || undefined}
        style={style}
      />
    );
  }
  // 'combine' (make-child) is rendered via [data-receiving-drop] on the row itself.
  return null;
}
