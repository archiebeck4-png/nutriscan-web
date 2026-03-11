'use client';

import { useState, useMemo, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, insertEntry, saveRecipeIngredients } from '../../../lib/db';
import { useProfile } from '../../../context/ProfileContext';
import { useScanData } from '../../../context/ScanContext';
import { kjToDisplay, energyLabel } from '../../../lib/units';
import type { WebFoodEntry, RecipeIngredient } from '../../../models/types';
import styles from './page.module.css';

const RECIPE_STATE_KEY = 'recipe-draft-state';

interface IngredientItem {
  entry: WebFoodEntry;
  servings: number;
}

export default function RecipePage() {
  return (
    <Suspense>
      <RecipePageContent />
    </Suspense>
  );
}

function RecipePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const newIngredientId = searchParams.get('newIngredientId');
  const { profile } = useProfile();
  const { setScanData } = useScanData();
  const eu = profile?.energyUnit ?? 'kj';

  const [recipeName, setRecipeName] = useState('');
  const [numServings, setNumServings] = useState('1');
  const [ingredients, setIngredients] = useState<IngredientItem[]>([]);
  const [search, setSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [restoredState, setRestoredState] = useState(false);

  const allEntries = useLiveQuery(
    () => db.entries.orderBy('dateScanned').reverse().toArray()
  );

  // Restore recipe state from sessionStorage on mount
  useEffect(() => {
    if (restoredState || !allEntries) return;
    try {
      const saved = sessionStorage.getItem(RECIPE_STATE_KEY);
      if (saved) {
        const state = JSON.parse(saved);
        setRecipeName(state.recipeName ?? '');
        setNumServings(state.numServings ?? '1');
        // Restore ingredients by matching IDs to current DB entries
        if (state.ingredientIds && Array.isArray(state.ingredientIds)) {
          const restored: IngredientItem[] = [];
          for (const item of state.ingredientIds) {
            const entry = allEntries.find((e) => e.id === item.id);
            if (entry) {
              restored.push({ entry, servings: item.servings });
            }
          }
          setIngredients(restored);
        }
        sessionStorage.removeItem(RECIPE_STATE_KEY);
      }
    } catch {
      // ignore parse errors
    }
    setRestoredState(true);
  }, [allEntries, restoredState]);

  // Auto-add newly created ingredient from manual entry
  useEffect(() => {
    if (!newIngredientId || !allEntries || !restoredState) return;
    const entry = allEntries.find((e) => e.id === newIngredientId);
    if (entry) {
      setIngredients((prev) => {
        // Don't add if already present
        if (prev.some((i) => i.entry.id === newIngredientId)) return prev;
        return [...prev, { entry, servings: 1 }];
      });
    }
    // Clear the param from the URL without navigation
    window.history.replaceState({}, '', '/add/recipe');
  }, [newIngredientId, allEntries, restoredState]);

  // Save recipe state to sessionStorage before navigating away
  const saveStateAndNavigate = useCallback((path: string, setRecipeFlag = false) => {
    const state = {
      recipeName,
      numServings,
      ingredientIds: ingredients.map((i) => ({ id: i.entry.id, servings: i.servings })),
    };
    sessionStorage.setItem(RECIPE_STATE_KEY, JSON.stringify(state));
    // Set fromRecipe flag in ScanContext so it persists through barcode-lookup etc.
    if (setRecipeFlag) {
      const emptyNutrition = {
        foodName: '', servingSize: '', servingsPerPackage: '',
        energyPerServing: '', proteinPerServing: '', fatPerServing: '',
        carbsPerServing: '', fiberPerServing: '',
        energyPer100g: '', proteinPer100g: '', fatPer100g: '',
        carbsPer100g: '', fiberPer100g: '', rawText: '',
      };
      setScanData({ nutrition: emptyNutrition, imageBlob: null, fromRecipe: true });
    }
    router.push(path);
  }, [recipeName, numServings, ingredients, router, setScanData]);

  // Deduplicate library items by food name (keep most recent)
  const libraryItems = useMemo(() => {
    if (!allEntries) return [];
    const seen = new Set<string>();
    return allEntries.filter((e) => {
      const key = e.foodName.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [allEntries]);

  // Filter library by search, exclude already-added ingredients
  const addedIds = new Set(ingredients.map((i) => i.entry.id));
  const filtered = libraryItems.filter(
    (e) =>
      !addedIds.has(e.id) &&
      e.foodName.toLowerCase().includes(search.toLowerCase())
  );

  const totals = useMemo(() => {
    return ingredients.reduce(
      (acc, ing) => ({
        energy: acc.energy + (ing.entry.energyPerServing ?? 0) * ing.servings,
        protein: acc.protein + (ing.entry.proteinPerServing ?? 0) * ing.servings,
        fat: acc.fat + (ing.entry.fatPerServing ?? 0) * ing.servings,
        carbs: acc.carbs + (ing.entry.carbsPerServing ?? 0) * ing.servings,
        fiber: acc.fiber + (ing.entry.fiberPerServing ?? 0) * ing.servings,
      }),
      { energy: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 }
    );
  }, [ingredients]);

  const servingCount = parseFloat(numServings) || 1;
  const perServing = {
    energy: totals.energy / servingCount,
    protein: totals.protein / servingCount,
    fat: totals.fat / servingCount,
    carbs: totals.carbs / servingCount,
    fiber: totals.fiber / servingCount,
  };

  const canSave = recipeName.trim().length > 0 && ingredients.length > 0 && !isSaving;

  const addIngredient = (entry: WebFoodEntry) => {
    setIngredients((prev) => [...prev, { entry, servings: 1 }]);
    setSearch('');
  };

  const removeIngredient = (id: string) => {
    setIngredients((prev) => prev.filter((i) => i.entry.id !== id));
  };

  const updateServings = (id: string, value: string) => {
    setIngredients((prev) =>
      prev.map((i) =>
        i.entry.id === id ? { ...i, servings: parseFloat(value) || 0 } : i
      )
    );
  };

  const handleSave = async () => {
    if (!canSave) return;
    setIsSaving(true);
    try {
      const recipeId = crypto.randomUUID();

      const entry: WebFoodEntry = {
        id: recipeId,
        foodName: recipeName.trim(),
        dateScanned: new Date().toISOString(),
        energyPerServing: perServing.energy,
        proteinPerServing: perServing.protein,
        fatPerServing: perServing.fat,
        carbsPerServing: perServing.carbs,
        fiberPerServing: perServing.fiber,
        energyPer100g: null,
        proteinPer100g: null,
        fatPer100g: null,
        carbsPer100g: null,
        fiberPer100g: null,
        servingSize: null,
        servingsPerPackage: String(servingCount),
        rawOcrText: null,
        imageBlob: null,
        isRecipe: true,
      };
      await insertEntry(entry);

      const recipeIngredients: RecipeIngredient[] = ingredients.map((ing) => ({
        id: crypto.randomUUID(),
        recipeId,
        foodEntryId: ing.entry.id,
        servings: ing.servings,
      }));
      await saveRecipeIngredients(recipeIngredients);

      router.push('/add/library');
    } catch (error) {
      console.error('Failed to save recipe:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.cancelButton} onClick={() => router.back()}>
          Cancel
        </button>
        <span className={styles.title}>Create Recipe</span>
        <button
          className={styles.saveButton}
          disabled={!canSave}
          onClick={handleSave}
        >
          Save
        </button>
      </div>

      <div className={styles.form}>
        {/* Recipe details */}
        <div className="sectionHeader">RECIPE</div>
        <div className="section">
          <div className={styles.fieldRow}>
            <span className={styles.fieldLabel}>Name</span>
            <input
              className={styles.textInput}
              value={recipeName}
              onChange={(e) => setRecipeName(e.target.value)}
              placeholder="Recipe name"
            />
          </div>
          <div className={styles.fieldRow}>
            <span className={styles.fieldLabel}>Servings</span>
            <input
              className={styles.textInput}
              value={numServings}
              onChange={(e) => setNumServings(e.target.value)}
              placeholder="1"
              inputMode="decimal"
            />
          </div>
        </div>

        {/* Added ingredients */}
        <div className="sectionHeader">
          INGREDIENTS{ingredients.length > 0 ? ` (${ingredients.length})` : ''}
        </div>
        <div className="section">
          {ingredients.length === 0 ? (
            <div className={styles.emptyMsg}>
              Search below to add ingredients
            </div>
          ) : (
            ingredients.map((ing) => (
              <div key={ing.entry.id} className={styles.ingredientRow}>
                <button
                  className={styles.removeBtn}
                  onClick={() => removeIngredient(ing.entry.id)}
                  type="button"
                >
                  -
                </button>
                <span className={styles.ingredientName}>
                  {ing.entry.foodName}
                </span>
                <input
                  className={styles.srvInput}
                  value={ing.servings}
                  onChange={(e) => updateServings(ing.entry.id, e.target.value)}
                  inputMode="decimal"
                />
                <span className={styles.srvLabel}>srv</span>
              </div>
            ))
          )}
        </div>

        {/* Search to add */}
        <div className="sectionHeader">ADD FROM LIBRARY</div>
        <div className={styles.searchWrap}>
          <input
            className={styles.searchInput}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search foods..."
          />
        </div>
        <div className={styles.searchResults}>
          {filtered.length === 0 ? (
            <div className={styles.emptyMsg}>
              {search ? 'No foods match' : 'No foods available'}
            </div>
          ) : (
            filtered.slice(0, 20).map((entry) => (
              <button
                key={entry.id}
                className={styles.searchItem}
                onClick={() => addIngredient(entry)}
                type="button"
              >
                <div className={styles.searchItemInfo}>
                  <span className={styles.searchItemName}>
                    {entry.foodName}
                  </span>
                  <span className={styles.searchItemMeta}>
                    {entry.energyPerServing != null
                      ? Math.round(kjToDisplay(entry.energyPerServing, eu))
                      : '--'}{' '}
                    {energyLabel(eu)}/serve
                  </span>
                </div>
                <span className={styles.addBtn}>+</span>
              </button>
            ))
          )}
        </div>

        {/* Add new ingredient */}
        <div className="sectionHeader">OR ADD NEW</div>
        <div className={styles.newOptions}>
          <button
            className={styles.newOptionBtn}
            onClick={() => saveStateAndNavigate('/add/scan?from=recipe', true)}
            type="button"
          >
            <span>📷</span>
            <span>Scan a Label</span>
          </button>
          <button
            className={styles.newOptionBtn}
            onClick={() => saveStateAndNavigate('/add/manual?from=recipe')}
            type="button"
          >
            <span>✏️</span>
            <span>Manual Entry</span>
          </button>
        </div>

        {/* Nutrition totals */}
        {ingredients.length > 0 && (
          <>
            <div className="sectionHeader">NUTRITION PER SERVING</div>
            <div className="section">
              <div className={styles.totalRow}>
                <span>Energy</span>
                <span>{Math.round(kjToDisplay(perServing.energy, eu))} {energyLabel(eu)}</span>
              </div>
              <div className={styles.totalRow}>
                <span>Protein</span>
                <span>{Math.round(perServing.protein * 10) / 10}g</span>
              </div>
              <div className={styles.totalRow}>
                <span>Fat</span>
                <span>{Math.round(perServing.fat * 10) / 10}g</span>
              </div>
              <div className={styles.totalRow}>
                <span>Carbs</span>
                <span>{Math.round(perServing.carbs * 10) / 10}g</span>
              </div>
              <div className={styles.totalRow}>
                <span>Fiber</span>
                <span>{Math.round(perServing.fiber * 10) / 10}g</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
