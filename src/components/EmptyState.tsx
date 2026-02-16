import styles from './EmptyState.module.css';

interface EmptyStateProps {
  icon?: string;
  title: string;
  message: string;
}

export default function EmptyState({
  icon = '📋',
  title,
  message,
}: EmptyStateProps) {
  return (
    <div className={styles.container}>
      <div className={styles.icon}>{icon}</div>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.message}>{message}</p>
    </div>
  );
}
