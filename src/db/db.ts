import Dexie, { type Table } from 'dexie'
import type { A1cResult, Activity, BpReading, DayEntry, GoalChange, Meal, Photo, PhotoImage, PhotoThumb, Reading } from '../models/types'

export interface SettingRow { key: string; value: unknown }

// Schema rule: never edit an existing version. Add a new version(n) with an upgrade step.
export class FoodLogDB extends Dexie {
  days!: Table<DayEntry, string>
  meals!: Table<Meal, string>
  photos!: Table<Photo, string>
  images!: Table<PhotoImage, string>
  thumbs!: Table<PhotoThumb, string>
  readings!: Table<Reading, string>
  goalChanges!: Table<GoalChange, string>
  a1c!: Table<A1cResult, string>
  activities!: Table<Activity, string>
  bp!: Table<BpReading, string>
  settings!: Table<SettingRow, string>

  constructor() {
    super('foodlog')
    this.version(1).stores({
      days: 'id, &date',
      meals: 'id, day_id',
      photos: 'id, day_id, meal_id',
      images: 'photo_id',
      thumbs: 'photo_id',
      readings: 'id, day_id, measured_at',
      goalChanges: 'id, changed_at',
      settings: 'key',
    })
    // v2: HbA1c blood test results.
    this.version(2).stores({ a1c: 'id, test_date' })
    // v3: activities with estimated calories burned.
    this.version(3).stores({ activities: 'id, day_id' })
    // v4: blood pressure readings.
    this.version(4).stores({ bp: 'id, day_id, measured_at' })
  }
}

export const db = new FoodLogDB()
