'use client';

import styles from './MacroProgressBar.module.css';

interface MacroProgressBarProps {
  label: string;
  current: number;
  target: number;
  unit: string;
  color: string;
}

export default function MacroProgressBar({
  label,
  current,
  target,
  unit,
  color,
}: MacroProgressBarProps) {
  const ratio = target > 0 ? current / target : 0;
  const pct = Math.min(ratio * 100, 100);
  const isOver = current > target;

  const barColor = isOver ? 'var(--danger)' : color;

  return (
    <div className={styles.container}>
      <div className={styles.labelRow}>
        <span className={styles.label}>{label}</span>
        <span className={styles.values}>
          {Math.round(current)} / {target}
          {unit}
        </span>
      </div>
      <div className={styles.track}>
        <div
          className={styles.fill}
          style={{
            width: `${pct}%`,
            backgroundColor: barColor,
          }}
        />
      </div>
    </div>
  );
}
