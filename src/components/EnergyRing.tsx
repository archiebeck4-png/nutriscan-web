'use client';

import styles from './EnergyRing.module.css';

interface EnergyRingProps {
  current: number;
  target: number;
}

export default function EnergyRing({ current, target }: EnergyRingProps) {
  const ratio = target > 0 ? Math.min(current / target, 1.2) : 0;
  const isOver = current > target;

  // SVG circle math
  const size = 160;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(ratio, 1));

  const remaining = Math.max(0, target - current);

  return (
    <div className={styles.container}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className={styles.svg}
      >
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={isOver ? 'var(--danger)' : 'var(--accent)'}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <div className={styles.inner}>
        <span className={styles.currentValue}>
          {current.toLocaleString()}
        </span>
        <span className={styles.unit}>kJ</span>
        <span className={styles.remaining}>
          {isOver
            ? `${(current - target).toLocaleString()} over`
            : `${remaining.toLocaleString()} left`}
        </span>
      </div>
    </div>
  );
}
