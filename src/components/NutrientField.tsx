'use client';

import styles from './NutrientField.module.css';

interface NutrientFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export default function NutrientField({ label, value, onChange }: NutrientFieldProps) {
  return (
    <div className={styles.row}>
      <label className={styles.label}>{label}</label>
      <input
        className={styles.input}
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="--"
      />
    </div>
  );
}
