'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useProfile } from '../../context/ProfileContext';
import { useAuth } from '../../context/AuthContext';
import { calculateDailyTargets, intensityToGoal, goalToIntensity } from '../../lib/macros';
import { deleteAllFoodLog, deleteAllEntries } from '../../lib/db';
import type { ActivityLevel, Gender, EnergyUnit, WeightUnit } from '../../models/types';
import { formatEnergy, kgToDisplay, weightLabel, cmToDisplay, displayToKg } from '../../lib/units';
import GoalSlider from '../../components/GoalSlider';
import styles from './page.module.css';

const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary',
  light: 'Lightly Active',
  moderate: 'Moderately Active',
  active: 'Active',
  veryActive: 'Very Active',
};

export default function SettingsPage() {
  const router = useRouter();
  const { profile, setProfile } = useProfile();
  const { user, signOut } = useAuth();
  const [editing, setEditing] = useState(false);

  // Editable form state
  const [gender, setGender] = useState<Gender>(profile?.gender ?? 'male');
  const [age, setAge] = useState(String(profile?.age ?? ''));
  const [height, setHeight] = useState(String(profile?.heightCm ?? ''));
  const [weight, setWeight] = useState(String(profile?.weightKg ?? ''));
  const [activity, setActivity] = useState<ActivityLevel>(
    profile?.activityLevel ?? 'moderate'
  );
  const [goalIntensity, setGoalIntensity] = useState(profile?.goalIntensity ?? goalToIntensity(profile?.goal ?? 'maintain'));

  if (!profile) return null;

  const eu = profile.energyUnit ?? 'kj';
  const wu = profile.weightUnit ?? 'kg';

  const handleSave = async () => {
    // Convert weight from display unit to kg for storage
    const rawWeight = parseFloat(weight) || (wu === 'lbs' ? kgToDisplay(profile.weightKg, 'lbs') : profile.weightKg);
    const weightKg = displayToKg(rawWeight, wu);

    const targets = calculateDailyTargets(
      gender,
      weightKg,
      parseFloat(height) || profile.heightCm,
      parseInt(age) || profile.age,
      activity,
      goalIntensity
    );
    await setProfile({
      ...profile,
      gender,
      age: parseInt(age) || profile.age,
      weightKg,
      heightCm: parseFloat(height) || profile.heightCm,
      activityLevel: activity,
      goal: intensityToGoal(goalIntensity),
      goalIntensity,
      dailyEnergyTargetKj: targets.energyKj,
      dailyProteinTargetG: targets.proteinG,
      dailyFatTargetG: targets.fatG,
      dailyCarbsTargetG: targets.carbsG,
      dailyFiberTargetG: targets.fiberG,
      dailySaturatedFatTargetG: targets.saturatedFatG,
      updatedAt: new Date().toISOString(),
    });
    setEditing(false);
  };

  // Start editing — pre-fill weight in display unit
  const handleStartEditing = () => {
    setWeight(String(Math.round(kgToDisplay(profile.weightKg, wu) * 10) / 10));
    setHeight(String(profile.heightCm));
    setAge(String(profile.age));
    setGender(profile.gender);
    setActivity(profile.activityLevel);
    setGoalIntensity(profile.goalIntensity ?? goalToIntensity(profile.goal));
    setEditing(true);
  };

  const handleEnergyUnitChange = async (unit: EnergyUnit) => {
    await setProfile({ ...profile, energyUnit: unit, updatedAt: new Date().toISOString() });
  };

  const handleWeightUnitChange = async (unit: WeightUnit) => {
    await setProfile({ ...profile, weightUnit: unit, updatedAt: new Date().toISOString() });
  };

  const handleTrackingChange = async (
    key: 'trackProtein' | 'trackFat' | 'trackCarbs' | 'trackFiber' | 'trackSaturatedFat',
    value: boolean
  ) => {
    await setProfile({ ...profile, [key]: value, updatedAt: new Date().toISOString() });
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
            onClick={handleStartEditing}
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
              <span className={styles.label}>Weight ({weightLabel(wu)})</span>
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
            <div className={styles.row} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 0 }}>
              <span className={styles.label}>Goal</span>
              <GoalSlider value={goalIntensity} onChange={setGoalIntensity} />
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
              <span className={styles.value}>{cmToDisplay(profile.heightCm, wu)}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>Weight</span>
              <span className={styles.value}>
                {Math.round(kgToDisplay(profile.weightKg, wu) * 10) / 10} {weightLabel(wu)}
              </span>
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
                {(() => {
                  const gi = profile.goalIntensity ?? goalToIntensity(profile.goal);
                  const adj = Math.round(gi * 7.5);
                  if (Math.abs(adj) < 50) return 'Maintenance';
                  return `${adj > 0 ? '+' : ''}${adj} kcal/day`;
                })()}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Measurements section */}
      <div className="sectionHeader">MEASUREMENTS</div>
      <div className="section">
        <div className={styles.row}>
          <span className={styles.label}>Energy</span>
          <div className={styles.miniSegmented}>
            <button
              className={`${styles.miniSeg} ${eu === 'kj' ? styles.miniSegActive : ''}`}
              onClick={() => handleEnergyUnitChange('kj')}
            >
              kJ
            </button>
            <button
              className={`${styles.miniSeg} ${eu === 'cal' ? styles.miniSegActive : ''}`}
              onClick={() => handleEnergyUnitChange('cal')}
            >
              Calories
            </button>
          </div>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Weight</span>
          <div className={styles.miniSegmented}>
            <button
              className={`${styles.miniSeg} ${wu === 'kg' ? styles.miniSegActive : ''}`}
              onClick={() => handleWeightUnitChange('kg')}
            >
              kg
            </button>
            <button
              className={`${styles.miniSeg} ${wu === 'lbs' ? styles.miniSegActive : ''}`}
              onClick={() => handleWeightUnitChange('lbs')}
            >
              lbs
            </button>
          </div>
        </div>
      </div>

      {/* Tracking toggles */}
      <div className="sectionHeader">TRACKING</div>
      <div className="section">
        {([
          ['Protein', 'trackProtein'],
          ['Fat', 'trackFat'],
          ['Saturated Fat', 'trackSaturatedFat'],
          ['Carbs', 'trackCarbs'],
          ['Fiber', 'trackFiber'],
        ] as const).map(([label, key]) => {
          const on = profile[key] ?? false;
          return (
            <div className={styles.row} key={key}>
              <span className={styles.label}>{label}</span>
              <div className={styles.miniSegmented}>
                <button
                  className={`${styles.miniSeg} ${on ? styles.miniSegActive : ''}`}
                  onClick={() => handleTrackingChange(key, true)}
                >
                  On
                </button>
                <button
                  className={`${styles.miniSeg} ${!on ? styles.miniSegActive : ''}`}
                  onClick={() => handleTrackingChange(key, false)}
                >
                  Off
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Daily targets */}
      <div className="sectionHeader">DAILY TARGETS</div>
      <div className="section">
        <div className={styles.row}>
          <span className={styles.label}>Energy</span>
          <span className={styles.value}>
            {formatEnergy(profile.dailyEnergyTargetKj, eu)}
          </span>
        </div>
        {profile.trackProtein && (
          <div className={styles.row}>
            <span className={styles.label}>Protein</span>
            <span className={styles.value}>{profile.dailyProteinTargetG}g</span>
          </div>
        )}
        {profile.trackFat && (
          <div className={styles.row}>
            <span className={styles.label}>Fat</span>
            <span className={styles.value}>{profile.dailyFatTargetG}g</span>
          </div>
        )}
        {profile.trackSaturatedFat && (
          <div className={styles.row}>
            <span className={styles.label}>Saturated Fat</span>
            <span className={styles.value}>{profile.dailySaturatedFatTargetG}g</span>
          </div>
        )}
        {profile.trackCarbs && (
          <div className={styles.row}>
            <span className={styles.label}>Carbs</span>
            <span className={styles.value}>{profile.dailyCarbsTargetG}g</span>
          </div>
        )}
        {profile.trackFiber && (
          <div className={styles.row}>
            <span className={styles.label}>Fiber</span>
            <span className={styles.value}>{profile.dailyFiberTargetG}g</span>
          </div>
        )}
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

      {user && (
        <>
          <div className="sectionHeader">ACCOUNT</div>
          <div className="section">
            <div className={styles.row}>
              <span className={styles.label}>Email</span>
              <span className={styles.value}>{user.email}</span>
            </div>
            <button className={styles.dangerRow} onClick={signOut}>
              Sign Out
            </button>
          </div>
        </>
      )}

      <div style={{ height: 40 }} />
    </div>
  );
}
