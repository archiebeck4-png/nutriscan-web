'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useProfile } from '../../context/ProfileContext';
import { calculateDailyTargets } from '../../lib/macros';
import { deleteAllFoodLog, deleteAllEntries } from '../../lib/db';
import type { ActivityLevel, Gender, WeightGoal } from '../../models/types';
import styles from './page.module.css';

const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary',
  light: 'Lightly Active',
  moderate: 'Moderately Active',
  active: 'Active',
  veryActive: 'Very Active',
};

const GOAL_LABELS: Record<WeightGoal, string> = {
  lose: 'Lose Weight',
  maintain: 'Maintain Weight',
  gain: 'Gain Weight',
};

export default function SettingsPage() {
  const router = useRouter();
  const { profile, setProfile } = useProfile();
  const [editing, setEditing] = useState(false);

  // Editable form state
  const [gender, setGender] = useState<Gender>(profile?.gender ?? 'male');
  const [age, setAge] = useState(String(profile?.age ?? ''));
  const [height, setHeight] = useState(String(profile?.heightCm ?? ''));
  const [weight, setWeight] = useState(String(profile?.weightKg ?? ''));
  const [activity, setActivity] = useState<ActivityLevel>(
    profile?.activityLevel ?? 'moderate'
  );
  const [goal, setGoal] = useState<WeightGoal>(profile?.goal ?? 'maintain');

  if (!profile) return null;

  const handleSave = async () => {
    const targets = calculateDailyTargets(
      gender,
      parseFloat(weight) || profile.weightKg,
      parseFloat(height) || profile.heightCm,
      parseInt(age) || profile.age,
      activity,
      goal
    );
    await setProfile({
      ...profile,
      gender,
      age: parseInt(age) || profile.age,
      weightKg: parseFloat(weight) || profile.weightKg,
      heightCm: parseFloat(height) || profile.heightCm,
      activityLevel: activity,
      goal,
      dailyEnergyTargetKj: targets.energyKj,
      dailyProteinTargetG: targets.proteinG,
      dailyFatTargetG: targets.fatG,
      dailyCarbsTargetG: targets.carbsG,
      dailyFiberTargetG: targets.fiberG,
      updatedAt: new Date().toISOString(),
    });
    setEditing(false);
  };

  const handleClearFoodLog = async () => {
    if (confirm('Delete all diary entries? This cannot be undone.')) {
      await deleteAllFoodLog();
    }
  };

  const handleClearSavedFoods = async () => {
    if (confirm('Delete all saved foods? This cannot be undone.')) {
      await deleteAllEntries();
    }
  };

  const handleResetProfile = async () => {
    if (
      confirm(
        'Reset your profile? This will take you back to onboarding.'
      )
    ) {
      await deleteAllFoodLog();
      await deleteAllEntries();
      // Delete profile by saving with cleared data — or we delete it
      const { db } = await import('../../lib/db');
      await db.profile.delete('default');
      window.location.href = '/onboarding';
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Settings</h1>

      {/* Profile section */}
      <div className="sectionHeader">
        PROFILE
        {!editing && (
          <button
            className={styles.editBtn}
            onClick={() => setEditing(true)}
          >
            Edit
          </button>
        )}
      </div>
      <div className="section">
        {editing ? (
          <>
            <div className={styles.row}>
              <span className={styles.label}>Gender</span>
              <div className={styles.miniSegmented}>
                <button
                  className={`${styles.miniSeg} ${gender === 'male' ? styles.miniSegActive : ''}`}
                  onClick={() => setGender('male')}
                >
                  Male
                </button>
                <button
                  className={`${styles.miniSeg} ${gender === 'female' ? styles.miniSegActive : ''}`}
                  onClick={() => setGender('female')}
                >
                  Female
                </button>
              </div>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>Age</span>
              <input
                className={styles.input}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                inputMode="numeric"
              />
            </div>
            <div className={styles.row}>
              <span className={styles.label}>Height (cm)</span>
              <input
                className={styles.input}
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                inputMode="numeric"
              />
            </div>
            <div className={styles.row}>
              <span className={styles.label}>Weight (kg)</span>
              <input
                className={styles.input}
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                inputMode="decimal"
              />
            </div>
            <div className={styles.row}>
              <span className={styles.label}>Activity</span>
              <select
                className={styles.select}
                value={activity}
                onChange={(e) => setActivity(e.target.value as ActivityLevel)}
              >
                {Object.entries(ACTIVITY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>Goal</span>
              <select
                className={styles.select}
                value={goal}
                onChange={(e) => setGoal(e.target.value as WeightGoal)}
              >
                {Object.entries(GOAL_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.editActions}>
              <button className={styles.cancelBtn} onClick={() => setEditing(false)}>
                Cancel
              </button>
              <button className={styles.saveBtn} onClick={handleSave}>
                Save
              </button>
            </div>
          </>
        ) : (
          <>
            <div className={styles.row}>
              <span className={styles.label}>Gender</span>
              <span className={styles.value}>
                {profile.gender === 'male' ? 'Male' : 'Female'}
              </span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>Age</span>
              <span className={styles.value}>{profile.age} years</span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>Height</span>
              <span className={styles.value}>{profile.heightCm} cm</span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>Weight</span>
              <span className={styles.value}>{profile.weightKg} kg</span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>Activity</span>
              <span className={styles.value}>
                {ACTIVITY_LABELS[profile.activityLevel]}
              </span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>Goal</span>
              <span className={styles.value}>
                {GOAL_LABELS[profile.goal]}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Daily targets */}
      <div className="sectionHeader">DAILY TARGETS</div>
      <div className="section">
        <div className={styles.row}>
          <span className={styles.label}>Energy</span>
          <span className={styles.value}>
            {profile.dailyEnergyTargetKj.toLocaleString()} kJ
          </span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Protein</span>
          <span className={styles.value}>{profile.dailyProteinTargetG}g</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Fat</span>
          <span className={styles.value}>{profile.dailyFatTargetG}g</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Carbs</span>
          <span className={styles.value}>{profile.dailyCarbsTargetG}g</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Fiber</span>
          <span className={styles.value}>{profile.dailyFiberTargetG}g</span>
        </div>
      </div>

      {/* Data management */}
      <div className="sectionHeader">DATA</div>
      <div className="section">
        <button className={styles.dangerRow} onClick={handleClearFoodLog}>
          Clear Food Diary
        </button>
        <button className={styles.dangerRow} onClick={handleClearSavedFoods}>
          Clear Saved Foods
        </button>
        <button className={styles.dangerRow} onClick={handleResetProfile}>
          Reset Profile
        </button>
      </div>

      {/* About */}
      <div className="sectionHeader">ABOUT</div>
      <div className="section">
        <div className={styles.row}>
          <span className={styles.label}>App</span>
          <span className={styles.value}>ScaleShift</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Version</span>
          <span className={styles.value}>1.0.0</span>
        </div>
      </div>

      <div style={{ height: 40 }} />
    </div>
  );
}
