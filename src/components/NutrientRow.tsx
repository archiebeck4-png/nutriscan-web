import styles from './NutrientRow.module.css';

interface NutrientRowProps {
  label: string;
  value: number | null;
  unit: string;
}

export default function NutrientRow({ label, value, unit }: NutrientRowProps) {
  const display =
    value != null
      ? `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)} ${unit}`
      : '--';

  return (
    <div className={styles.row}>
      <span className={styles.label}>{label}</span>
      <span className={value == null ? styles.placeholder : styles.value}>
        {display}
      </span>
    </div>
  );
}
