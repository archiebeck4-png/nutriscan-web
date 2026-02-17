'use client';

import styles from './GoalSlider.module.css';

interface GoalSliderProps {
  value: number;
  onChange: (value: number) => void;
}

const KG_PER_KCAL_WEEK = 7700; // ~7700 kcal to gain/lose 1 kg

export default function GoalSlider({ value, onChange }: GoalSliderProps) {
  const kcalAdjustment = Math.round(value * 7.5);
  const weeklyKg = Math.abs(Math.round((kcalAdjustment * 7) / KG_PER_KCAL_WEEK * 10) / 10);

  let description: string;
  if (value < -60) description = 'Aggressive deficit';
  else if (value < -20) description = 'Moderate deficit';
  else if (value < -5) description = 'Mild deficit';
  else if (value <= 5) description = 'Maintenance';
  else if (value <= 20) description = 'Mild surplus';
  else if (value <= 60) description = 'Moderate surplus';
  else description = 'Aggressive surplus';

  let weeklyLabel = '';
  if (Math.abs(kcalAdjustment) >= 50) {
    weeklyLabel = `~${weeklyKg} kg/week ${value < 0 ? 'loss' : 'gain'}`;
  }

  // Calculate gradient position for the fill effect (0-100%)
  const fillPercent = ((value + 100) / 200) * 100;

  return (
    <div className={styles.container}>
      <div className={styles.labels}>
        <span className={styles.labelLeft}>Lose</span>
        <span className={styles.labelCenter}>Maintain</span>
        <span className={styles.labelRight}>Gain</span>
      </div>
      <div className={styles.trackWrap}>
        <input
          type="range"
          min={-100}
          max={100}
          step={5}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className={styles.slider}
          style={{ '--fill': `${fillPercent}%` } as React.CSSProperties}
        />
        <div className={styles.centerMark} />
      </div>
      <div className={styles.info}>
        <span className={styles.description}>{description}</span>
        <span className={styles.kcal}>
          {kcalAdjustment > 0 ? '+' : ''}{kcalAdjustment} kcal/day
        </span>
        {weeklyLabel && (
          <span className={styles.weekly}>{weeklyLabel}</span>
        )}
      </div>
    </div>
  );
}
