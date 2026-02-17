'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useProfile } from '../../context/ProfileContext';
import { calculateDailyTargets, intensityToGoal } from '../../lib/macros';
import type {
  Gender,
  ActivityLevel,
  UserProfile,
} from '../../models/types';
import GoalSlider from '../../components/GoalSlider';
import styles from './page.module.css';

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string; desc: string }[] =
  [
    { value: 'sedentary', label: 'Sedentary', desc: 'Little to no exercise' },
    {
      value: 'light',
      label: 'Lightly Active',
      desc: 'Light exercise 1-3 days/week',
    },
    {
      value: 'moderate',
      label: 'Moderately Active',
      desc: 'Moderate exercise 3-5 days/week',
    },
    {
      value: 'active',
      label: 'Active',
      desc: 'Hard exercise 6-7 days/week',
    },
    {
      value: 'veryActive',
      label: 'Very Active',
      desc: 'Very hard exercise or physical job',
    },
  ];

export default function OnboardingPage() {
  const router = useRouter();
  const { setProfile } = useProfile();
  const [step, setStep] = useState(0);

  // Form state
  const [goalIntensity, setGoalIntensity] = useState(0);
  const [gender, setGender] = useState<Gender>('male');
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [activity, setActivity] = useState<ActivityLevel>('moderate');

  const totalSteps = 4;

  const canAdvance = (): boolean => {
    switch (step) {
      case 0:
        return true; // goal always has a default
      case 1:
        return age !== '' && height !== '' && weight !== '';
      case 2:
        return true; // activity always has a default
      case 3:
        return true; // review step
      default:
        return false;
    }
  };

  const targets = calculateDailyTargets(
    gender,
    parseFloat(weight) || 70,
    parseFloat(height) || 170,
    parseInt(age) || 25,
    activity,
    goalIntensity
  );

  const handleFinish = async () => {
    const now = new Date().toISOString();
    const profile: UserProfile = {
      id: 'default',
      name: '',
      gender,
      age: parseInt(age) || 25,
      weightKg: parseFloat(weight) || 70,
      heightCm: parseFloat(height) || 170,
      activityLevel: activity,
      goal: intensityToGoal(goalIntensity),
      goalIntensity,
      dailyEnergyTargetKj: targets.energyKj,
      dailyProteinTargetG: targets.proteinG,
      dailyFatTargetG: targets.fatG,
      dailyCarbsTargetG: targets.carbsG,
      dailyFiberTargetG: targets.fiberG,
      energyUnit: 'kj',
      weightUnit: 'kg',
      createdAt: now,
      updatedAt: now,
    };
    await setProfile(profile);
    router.replace('/');
  };

  return (
    <div className={styles.container}>
      {/* Step indicator */}
      <div className={styles.stepIndicator}>
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={`${styles.dot} ${i === step ? styles.dotActive : ''} ${
              i < step ? styles.dotDone : ''
            }`}
          />
        ))}
      </div>

      {/* Step 0: Goal */}
      {step === 0 && (
        <div className={styles.stepContent}>
          <h1 className={styles.title}>What&apos;s your goal?</h1>
          <p className={styles.subtitle}>
            Drag the slider to set how aggressively you want to lose or gain weight.
          </p>
          <GoalSlider value={goalIntensity} onChange={setGoalIntensity} />
        </div>
      )}

      {/* Step 1: Body stats */}
      {step === 1 && (
        <div className={styles.stepContent}>
          <h1 className={styles.title}>About you</h1>
          <p className={styles.subtitle}>
            We use this to calculate your daily energy needs.
          </p>

          {/* Gender toggle */}
          <div className={styles.segmentedControl}>
            <button
              className={`${styles.segment} ${
                gender === 'male' ? styles.segmentActive : ''
              }`}
              onClick={() => setGender('male')}
            >
              Male
            </button>
            <button
              className={`${styles.segment} ${
                gender === 'female' ? styles.segmentActive : ''
              }`}
              onClick={() => setGender('female')}
            >
              Female
            </button>
          </div>

          <div className={styles.inputGroup}>
            <div className={styles.inputRow}>
              <label className={styles.inputLabel}>Age</label>
              <input
                className={styles.input}
                type="text"
                inputMode="numeric"
                placeholder="25"
                value={age}
                onChange={(e) => setAge(e.target.value)}
              />
              <span className={styles.inputUnit}>years</span>
            </div>
            <div className={styles.inputRow}>
              <label className={styles.inputLabel}>Height</label>
              <input
                className={styles.input}
                type="text"
                inputMode="numeric"
                placeholder="170"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
              />
              <span className={styles.inputUnit}>cm</span>
            </div>
            <div className={styles.inputRow}>
              <label className={styles.inputLabel}>Weight</label>
              <input
                className={styles.input}
                type="text"
                inputMode="decimal"
                placeholder="70"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
              <span className={styles.inputUnit}>kg</span>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Activity level */}
      {step === 2 && (
        <div className={styles.stepContent}>
          <h1 className={styles.title}>Activity level</h1>
          <p className={styles.subtitle}>How active are you on a typical week?</p>
          <div className={styles.listGroup}>
            {ACTIVITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`${styles.listItem} ${
                  activity === opt.value ? styles.listItemSelected : ''
                }`}
                onClick={() => setActivity(opt.value)}
              >
                <span className={styles.listItemLabel}>{opt.label}</span>
                <span className={styles.listItemDesc}>{opt.desc}</span>
                {activity === opt.value && (
                  <span className={styles.checkmark}>✓</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: Review */}
      {step === 3 && (
        <div className={styles.stepContent}>
          <h1 className={styles.title}>Your daily targets</h1>
          <p className={styles.subtitle}>
            Based on your inputs, here are your recommended daily goals.
          </p>
          <div className={styles.targetsCard}>
            <div className={styles.targetRow}>
              <span className={styles.targetLabel}>Energy</span>
              <span className={styles.targetValue}>
                {targets.energyKj.toLocaleString()} kJ
              </span>
            </div>
            <div className={styles.targetRow}>
              <span className={styles.targetLabel}>Protein</span>
              <span className={styles.targetValue}>{targets.proteinG}g</span>
            </div>
            <div className={styles.targetRow}>
              <span className={styles.targetLabel}>Fat</span>
              <span className={styles.targetValue}>{targets.fatG}g</span>
            </div>
            <div className={styles.targetRow}>
              <span className={styles.targetLabel}>Carbs</span>
              <span className={styles.targetValue}>{targets.carbsG}g</span>
            </div>
            <div className={styles.targetRow}>
              <span className={styles.targetLabel}>Fiber</span>
              <span className={styles.targetValue}>{targets.fiberG}g</span>
            </div>
          </div>
          <p className={styles.hint}>
            You can adjust these later in Settings.
          </p>
        </div>
      )}

      {/* Navigation buttons */}
      <div className={styles.navButtons}>
        {step > 0 && (
          <button
            className={styles.backButton}
            onClick={() => setStep(step - 1)}
          >
            Back
          </button>
        )}
        <div className={styles.navSpacer} />
        {step < totalSteps - 1 ? (
          <button
            className={styles.nextButton}
            disabled={!canAdvance()}
            onClick={() => setStep(step + 1)}
          >
            Next
          </button>
        ) : (
          <button className={styles.nextButton} onClick={handleFinish}>
            Get Started
          </button>
        )}
      </div>
    </div>
  );
}
