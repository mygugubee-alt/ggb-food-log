import type { ReactNode } from 'react'
import type { MealType } from '../models/types'

const PATHS: Record<string, ReactNode> = {
  plus: <path d="M12 5v14M5 12h14" />,
  scale: <><rect x="4" y="4" width="16" height="16" rx="4.5" /><path d="M8.500 10.500a5 5 0 0 1 7 0M12 11l1.600-2.400" /></>,
  drop: <path d="M12 3.500c-3 4-5.500 6.800-5.500 10a5.500 5.500 0 0 0 11 0c0-3.200-2.500-6-5.500-10z" />,
  flame: <path d="M12 3c.800 3.600 5 5.200 5 10.200a5 5 0 0 1-10 0c0-2 .900-3.400 2-4.500.300 1.500 1 2.500 2 3 0-3.200.400-5.700 1-8.700z" />,
  utensils: <path d="M7 3v8a2 2 0 0 0 2 2v8M5 3v5.500M9 3v5.500M16.500 3c-1.800 1.600-2.700 4.200-2.700 7.500h2.700V21" />,
  note: <path d="M6 4h9l4 4v12H6zM9.500 12h6M9.500 16h4" />,
  pulse: <path d="M3.500 12h4l2.500-6 4 12 2.500-6h4" />,
  camera: <><path d="M4 8h3l1.500-2h7L17 8h3v11H4z" /><circle cx="12" cy="13.300" r="3.300" /></>,
  chevron: <path d="m9 6 6 6-6 6" />,
  cherry: <><circle cx="8" cy="16.500" r="3.600" /><circle cx="16.500" cy="17.200" r="3.600" /><path d="M8.500 13c.800-3.800 3.800-6.800 8.500-9M16.500 13.600c-.300-3.400 0-6.600.500-9.600" /></>,
  flask: <path d="M9 3h6M10 3v6l-5.200 9a2 2 0 0 0 1.700 3h11a2 2 0 0 0 1.700-3L14 9V3M7.800 15h8.400" />,
  info: <><circle cx="12" cy="12" r="8.500" /><path d="M12 11v5M12 8h.010" /></>,
  user: <><circle cx="12" cy="8.500" r="3.700" /><path d="M4.500 20a7.500 7.500 0 0 1 15 0" /></>,
  breakfast: <path d="M4 17.500h16M7 17.500a5 5 0 0 1 10 0M12 6v2.500M5.500 10l1.600 1.600M18.500 10l-1.600 1.600" />,
  lunch: <><circle cx="12" cy="12" r="3.800" /><path d="M12 3.500v2M12 18.500v2M3.500 12h2M18.500 12h2M6 6l1.400 1.400M16.600 16.600 18 18M6 18l1.400-1.400M16.600 7.400 18 6" /></>,
  dinner: <path d="M19 14.500A7.500 7.500 0 0 1 9.500 5a7.500 7.500 0 1 0 9.500 9.500z" />,
  snack: <><circle cx="12" cy="12" r="8" /><path d="M9.500 10h.010M14.200 9.200h.010M13.300 14.600h.010M9.300 14.800h.010" strokeWidth="2.400" /></>,
}

export type IconName = 'plus' | 'scale' | 'drop' | 'flame' | 'utensils' | 'note' | 'pulse' | 'camera' | 'chevron' | 'user' | 'cherry' | 'flask' | 'info' | MealType

/** Small line icons, drawn in the app (nothing is loaded from other sites). */
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">{PATHS[name]}</svg>
  )
}

/** A round tinted badge with an icon. Tone picks the colour family. */
export function Badge({ name, tone }: { name: IconName; tone: 'green' | 'warm' | 'blue' | 'plain' }) {
  return <span className={`badge ${tone}`}><Icon name={name} size={18} /></span>
}
