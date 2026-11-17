// Activity types and their MET values (metabolic equivalents), taken from the
// Compendium of Physical Activities. Estimated energy = MET x weight (kg) x hours.
// This is a rough estimate: the real figure depends on pace, fitness and body.
export interface ActivityType { id: string; label: string; met: number | null }

export const ACTIVITY_TYPES: ActivityType[] = [
  { id: 'walking', label: 'Walking', met: 3.5 },
  { id: 'brisk_walking', label: 'Brisk walking', met: 4.3 },
  { id: 'jogging', label: 'Jogging', met: 7.0 },
  { id: 'running', label: 'Running', met: 9.8 },
  { id: 'cycling_easy', label: 'Cycling (easy)', met: 4.0 },
  { id: 'cycling', label: 'Cycling (moderate)', met: 6.8 },
  { id: 'swimming', label: 'Swimming', met: 6.0 },
  { id: 'badminton', label: 'Badminton', met: 5.5 },
  { id: 'hiking', label: 'Hiking', met: 6.0 },
  { id: 'gym', label: 'Gym (weights)', met: 3.5 },
  { id: 'aerobics', label: 'Aerobics or Zumba', met: 6.5 },
  { id: 'yoga', label: 'Yoga', met: 2.5 },
  { id: 'tai_chi', label: 'Tai chi or qigong', met: 3.0 },
  { id: 'stairs', label: 'Climbing stairs', met: 4.0 },
  { id: 'housework', label: 'Housework', met: 3.3 },
  { id: 'gardening', label: 'Gardening', met: 3.8 },
  { id: 'other', label: 'Other', met: null }, // the user names it and types the calories
]

export const activityType = (id: string): ActivityType => ACTIVITY_TYPES.find((t) => t.id === id) ?? ACTIVITY_TYPES[ACTIVITY_TYPES.length - 1]

/** Estimated calories burned, or null when it cannot be estimated. */
export function estimateKcal(met: number | null, weightKg: number | null, minutes: number): number | null {
  if (met == null || weightKg == null || !(minutes > 0)) return null
  return Math.round(met * weightKg * (minutes / 60))
}
