import { DEFAULT_THEME, type ThemeName } from '../theme/themes'

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export type SugarUnit = 'mmol_l' | 'mg_dl'
export type SugarContext = 'fasting' | 'before_meal' | 'after_meal' | 'bedtime' | 'other'

export type RangeMode = 'off' | 'general' | 'diabetes' | 'custom'

export const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']
export const SUGAR_CONTEXTS: SugarContext[] = ['fasting', 'before_meal', 'after_meal', 'bedtime', 'other']

export interface DayEntry {
  id: string
  date: string // YYYY-MM-DD in Asia/Kuala_Lumpur
  weight_kg: number | null
  activity_note: string
  calories_kcal: number | null
  day_note: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface Meal {
  id: string
  day_id: string
  meal_type: MealType
  time: string | null // HH:mm
  description: string
  calories_kcal: number | null
  sort_order: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface Photo {
  id: string
  meal_id: string | null
  day_id: string
  width: number
  height: number
  sort_order: number
  created_at: string
  deleted_at: string | null
}

/** Image data lives apart from Photo rows so lists never load it. */
export interface PhotoImage { photo_id: string; image: ArrayBuffer }
export interface PhotoThumb { photo_id: string; thumb: ArrayBuffer }

export interface Reading {
  id: string
  day_id: string
  measured_at: string // UTC
  value_mmol: number // full precision, used for all calculations
  entered_value: number // exactly as typed
  entered_unit: SugarUnit
  context: SugarContext | null
  note: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

/** One blood pressure reading. */
export interface BpReading {
  id: string
  day_id: string
  measured_at: string // UTC
  systolic: number // mmHg
  diastolic: number // mmHg
  pulse: number | null // beats per minute
  created_at: string
  updated_at: string
  deleted_at: string | null
}

/** One activity in a day, with the calories it is estimated to have burned. */
export interface Activity {
  id: string
  day_id: string
  activity_type: string // an id from data/activities.ts
  name: string // the label shown; typed by the user for "other"
  minutes: number
  kcal: number | null
  /** true when kcal is the app's estimate, false when the user typed it */
  kcal_auto: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
}

/** One HbA1c blood test result. */
export interface A1cResult {
  id: string
  test_date: string // the date the blood test was taken, YYYY-MM-DD
  value_percent: number // one decimal place
  note: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface GoalChange {
  id: string
  dream_weight_kg: number | null // null = goal cleared
  changed_at: string
}

export interface Settings {
  sugar_unit: SugarUnit
  week_start: 0 | 1 // 0 = Sunday, 1 = Monday
  hide_sugar: boolean
  theme: ThemeName
  /** Which reference ranges colour the blood sugar readings. */
  range_mode: RangeMode
  /** Own targets in mmol/L, used when range_mode is 'custom'. */
  custom_before_max: number
  custom_after_max: number
  /** Height in cm for BMI; null = not set. */
  height_cm: number | null
  /** Daily calorie goal in kcal; null = not set. */
  kcal_target: number | null
  last_export_at: string | null
  first_use_at: string | null
}

export const DEFAULT_SETTINGS: Settings = {
  sugar_unit: 'mmol_l',
  week_start: 1,
  hide_sugar: false,
  theme: DEFAULT_THEME,
  range_mode: 'general',
  custom_before_max: 7.0,
  custom_after_max: 10.0,
  height_cm: null,
  kcal_target: null,
  last_export_at: null,
  first_use_at: null,
}

/** A new photo that has been resized but not yet stored. */
export interface NewPhoto { image: ArrayBuffer; thumb: ArrayBuffer; width: number; height: number }

export interface DayBundle {
  day: DayEntry | null
  meals: Meal[]
  readings: Reading[]
  photos: Photo[]
  activities: Activity[]
  bp: BpReading[]
}
