// All UI text lives here so another language can be added later.
import type { MealType, SugarContext, SugarUnit } from '../models/types'

export const S = {
  appName: 'GGB Food Log', brandShort: 'GUGUBEE', brandRest: 'Food Log',
  ok: 'OK', cancel: 'Cancel', undo: 'Undo', delete: 'Delete', back: 'Back', save: 'Save', dismiss: 'Dismiss',
  genericError: 'Something went wrong. Nothing was changed.',
  storageFull: 'The phone has no room left for this app to save. Nothing already saved was lost. Free some space on the phone, or export and remove old photos, then try again.',
  deletedMessage: { day: 'Day deleted', meal: 'Meal deleted', reading: 'Reading deleted', photo: 'Photo deleted', a1c: 'Result deleted', activity: 'Activity deleted', bp: 'Blood pressure reading deleted' },
  tabs: { today: 'Today', timeline: 'Timeline', report: 'Report', search: 'Search', settings: 'Settings' },

  mealType: { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' } satisfies Record<MealType, string>,
  context: { fasting: 'Fasting', before_meal: 'Before meal', after_meal: 'After meal', bedtime: 'Bedtime', other: 'Other' } satisfies Record<SugarContext, string>,
  noContext: 'No context',
  unitName: { mmol_l: 'mmol/L', mg_dl: 'mg/dL' } satisfies Record<SugarUnit, string>,
  kg: 'kg', kcal: 'kcal',

  // Photos
  photo: 'Photo', openPhoto: 'Open photo', photos: 'Photos', processingPhotos: 'Preparing photos…',
  takePhoto: 'Take photo', choosePhotos: 'Choose photos',

  // Today
  today: 'Today', prevDay: 'Previous day', nextDay: 'Next day',
  startToday: "Start today's log", nothingLogged: 'Nothing logged for this day',
  logPad: { title: 'Log', meal: 'Meal', weight: 'Weight', sugar: 'Sugar', bp: 'BP', sport: 'Sport' },
  addMeal: '+ Add meal', addMealPlain: 'Add meal', logWeight: 'Log weight', logSugar: 'Log blood sugar', editDay: 'Edit day',
  weight: 'Weight', calories: 'Calories', bloodSugar: 'Blood sugar', meals: 'Meals', activity: 'Activity', dayNote: 'Day note',
  fromMeals: 'from meals',
  changeVs: (diff: string, date: string) => `${diff} kg vs ${date}`,
  readingsHidden: (n: number) => `${n} ${n === 1 ? 'reading' : 'readings'} · tap to show`,
  hideReadings: 'Hide',

  // Dream weight card
  dreamWeight: (v: string) => `Dream weight: ${v} kg`,
  latestWeight: (v: string, date: string) => `Latest: ${v} kg (${date})`,
  aboveGoal: (d: string) => `${d} kg above dream weight`,
  belowGoal: (d: string) => `${d} kg below dream weight`,
  atGoal: 'At dream weight',
  setGoalPrompt: 'Set your dream weight',
  bp: {
    title: 'Blood pressure', log: 'Log blood pressure', newTitle: 'New blood pressure', editTitle: 'Edit blood pressure',
    sys: 'SYS', dia: 'DIA', pulse: 'Pulse', mmHg: 'mmHg', perMin: '/min', sysLong: 'Systolic (top number)', diaLong: 'Diastolic (bottom number)', pulseLong: 'Pulse',
    photoLabel: 'Read from a photo', takePhoto: 'Take photo', choosePhoto: 'Choose photo', reading: 'Reading the photo…',
    photoHelp: 'Hold the phone straight in front of the monitor so the screen fills most of the photo, with no glare on the numbers. The photo is read on this phone and is not kept.',
    photoFound: (sys: string, dia: string, pulse: string) => `Read ${sys} / ${dia}, pulse ${pulse}. Check the numbers below before saving.`,
    photoPartial: 'Some numbers could not be read. Fill in the empty boxes, or take the photo again.',
    photoNone: 'The numbers could not be read. Take the photo again, straight on and without glare, or type them below.',
    checkPrior: 'Make sure these are the big numbers, not the smaller PRIOR reading.',
    sysError: 'Enter SYS as a whole number from 60 to 260.', diaError: 'Enter DIA as a whole number from 30 to 160.',
    pulseError: 'Enter pulse as a whole number from 30 to 220, or leave it empty.', orderError: 'SYS (top number) should be higher than DIA.',
    saved: 'Blood pressure saved', delete: 'Delete reading', confirmDelete: 'Delete this blood pressure reading?',
    noneToday: 'No blood pressure readings for this day.', add: '+ Add blood pressure',
    band: { low: 'Low', optimal: 'Optimal', normal: 'Normal', high_normal: 'High-normal', stage1: 'High · stage 1', stage2: 'High · stage 2', stage3: 'High · stage 3' } as Record<string, string>,
    aria: (sys: number, dia: number, pulse: number | null, band: string) => `${sys} over ${dia} millimetres of mercury${pulse != null ? `, pulse ${pulse}` : ''}, ${band}`,
    rangesNote: 'Bands from the Malaysian Clinical Practice Guidelines on Hypertension (2018): Optimal under 120/80 · Normal 120–129/80–84 · High-normal 130–139/85–89 · High stage 1 140–159/90–99 · stage 2 160–179/100–109 · stage 3 180/110 and above. The higher of the two numbers decides. Low: under 90/60. A single reading is not a diagnosis; talk to your doctor about your readings.',
    highAdvice: 'This reading is very high (180/110 or above). Rest quietly for 5 minutes and measure again. If it stays this high, or you have chest pain, shortness of breath, a severe headache, weakness, or trouble speaking or seeing, get medical help now.',
  },
  weightCardTitle: 'Weight', noWeightYet: 'No weight logged yet',
  dreamLabel: 'Dream weight', latestLabel: 'Latest weight', toGo: (d: string) => `${d} kg`,
  atGoalShort: 'Reached!', gainLabel: (d: string) => `${d} kg below`,
  bmiLabel: 'BMI', bmiBand: { under: 'Underweight', healthy: 'Healthy', over: 'Overweight', obese: 'Obese' } as Record<string, string>,
  bmiShort: { under: 'Under', healthy: 'Healthy', over: 'Over', obese: 'Obese' } as Record<string, string>,
  bmiExplain: 'BMI compares your weight with your height.',
  bmiAria: (v: string, band: string) => `BMI ${v}, ${band}`,
  bmiNeedsHeight: 'Add your height in Settings to see BMI',
  kcalTargetField: 'Daily calorie goal (kcal)', kcalTargetNote: 'Optional. Shows how many calories are left today.',
  kcalTargetError: 'Enter a whole number from 800 to 5000.',
  cal: { title: 'Calorie intake', remaining: 'Calories remaining', over: 'Over goal', eatenToday: 'Eaten', ofGoal: (v: string) => `of ${v} goal`,
    burned: 'Burned', net: 'Eaten − burned', setGoal: 'Set a daily calorie goal in Settings to see what is left',
    remainingAria: (v: string) => `${v} kcal remaining`, overAria: (v: string) => `${v} kcal over goal`, eatenAria: (v: string) => `${v} kcal eaten`,
    noKcal: 'No calories entered for meals yet' },
  body: 'Body', heightField: 'Height (cm)', heightNote: 'Used for BMI only.',
  heightError: 'Enter a height from 100 to 250 cm, with at most one decimal place.',
  bmiScaleNote: 'BMI bands for Malaysian adults: under 18.5 underweight, 18.5–22.9 healthy, 23.0–27.4 overweight, 27.5 and above obese.',

  // Day editor
  weightKg: 'Weight (kg)', weightError: 'Enter a weight from 20.0 to 300.0 kg, with at most one decimal place.',
  caloriesKcal: 'Calories (kcal)', caloriesError: 'Enter a whole number from 0 to 10000.',
  saved: 'Saved', mealsAddUp: (v: string) => `Meals add up to ${v} kcal`, mealsTotal: (v: string) => `${v} kcal eaten`,
  activityNote: 'Activity note', activityPlaceholder: 'For example: 30 min walk',
  addReading: '+ Add reading', noReadings: 'No readings for this day.', noMeals: 'No meals for this day.',
  moveUp: 'Move up', moveDown: 'Move down', dayPhotos: 'Photos for the day', addDayPhoto: 'Add a photo that is not tied to a meal:',
  deleteDay: 'Delete this day', confirmDeleteDay: (date: string) => `Delete everything logged on ${date}? This removes its meals, readings and photos.`,
  futureDate: 'Future dates cannot be opened or logged.',

  // Meal editor
  newMeal: 'New meal', editMeal: 'Edit meal', mealTypeLabel: 'Meal', time: 'Time', optional: 'optional',
  description: 'Description', descriptionPlaceholder: 'For example: roast chicken, zucchini, cherry tomato',
  deleteMeal: 'Delete meal', confirmDeleteMeal: 'Delete this meal and its photos?',
  discardConfirm: 'Discard changes?', discard: 'Discard', removePhoto: 'Remove photo', moveLeft: 'Move earlier', moveRight: 'Move later',
  notFound: 'This item no longer exists.', clearTime: 'Clear time',

  // Blood sugar entry
  sugarScan: {
    label: 'Scan from the meter', placeholder: 'Tap, then Scan Text',
    help: 'iPhone: tap this box, then the Scan Text button (or tap the box again and choose Scan Text). Point the camera at the meter, select the big number, then tap Insert.',
    found: (v: string, unit: string) => `Found ${v} ${unit}. Check the value below.`,
    guessed: (v: string, unit: string) => `Read as ${v} ${unit} (the decimal point was not scanned). Check the value below.`,
    none: 'No reading found in that text. Try again, or type the value below.',
  },
  newReading: 'New reading', editReading: 'Edit reading', value: 'Value',
  sugarFormat: { mmol_l: 'Enter a number with at most one decimal place, for example 7.0.', mg_dl: 'Enter a whole number, for example 126.' } satisfies Record<SugarUnit, string>,
  sugarReject: 'That value looks like a typing mistake. Enter a value above 0 and up to 60.0 mmol/L (1080 mg/dL).',
  sugarCheck: (value: string, unit: string) => `You entered ${value} ${unit}. Save this value?`,
  saveValue: 'Save this value', timeRequired: 'Choose the time of this reading.',
  contextLabel: 'Context', note: 'Note', saveAndAdd: 'Save and add another', readingSaved: 'Reading saved',
  deleteReading: 'Delete reading', confirmDeleteReading: 'Delete this reading?',

  // Goal settings
  goalTitle: 'Dream weight', goalField: 'Dream weight (kg)',
  goalNote: 'This is a number you choose. The app does not suggest a goal, a deadline, or a rate of change.',
  goalSaved: 'Dream weight saved', goalHistory: 'History', goalCleared: 'Goal cleared', noGoalHistory: 'No changes yet.',
  clearGoal: 'Clear goal', confirmClearGoal: 'Clear your dream weight? The history is kept.', clear: 'Clear',

  // Photo viewer
  prevPhoto: 'Previous photo', nextPhoto: 'Next photo', deletePhoto: 'Delete photo', confirmDeletePhoto: 'Delete this photo?',
  dayPhoto: 'Day photo', photoCount: (i: number, n: number) => `${i} of ${n}`, close: 'Close',

  // Timeline
  calendar: 'Calendar', list: 'List', prevMonth: 'Previous month', nextMonth: 'Next month',
  legendLogged: 'Logged', legendPhotos: 'Photos', legendSugar: 'Blood sugar',
  noDays: 'No days logged yet.', showMore: 'Show more', avgSugar: 'avg',
  cellLabel: (date: string, logged: boolean, photos: boolean, sugar: boolean) =>
    [date, logged ? 'logged' : 'not logged', photos ? 'has photos' : '', sugar ? 'has blood sugar readings' : ''].filter(Boolean).join(', '),

  // Weekly report
  reportTitle: 'Weekly report', prevWeek: 'Previous week', nextWeek: 'Next week', weekInProgress: 'Week in progress',
  daysLogged: (n: number) => `${n} of 7 days logged`,
  noData: 'No data this week', notEnough: 'Not enough data',
  firstWeight: 'First weight', lastWeight: 'Last weight', change: 'Change', average: 'Average', lowest: 'Lowest', highest: 'Highest',
  daysWithWeight: 'Days with a weight', readingsCount: 'Readings', daysWithReadings: 'Days with readings',
  averageFor: (context: string, n: number) => `${context} average (${n} ${n === 1 ? 'reading' : 'readings'})`,
  averageOf: (n: number, what: 'days' | 'readings') => `Average (${n} ${n === 1 ? what.slice(0, -1) : what})`,
  mealsLogged: 'Meals logged', daysWithPhotos: 'Days with photos',
  avgDailyCalories: (n: number) => `Average daily calories (${n} ${n === 1 ? 'day' : 'days'} used)`,
  totalCalories: 'Total calories', caloriesFromMeals: (n: number) => `${n} ${n === 1 ? 'day uses' : 'days use'} the sum of meal calories.`,
  daysWithActivity: 'Days with an activity note', notes: 'Notes', food: 'Food',
  print: 'Print or save as PDF', printFooter: 'Personal log. Not medical advice.',
  reminderHint: 'To be reminded to review the week, set a repeating event in your phone calendar.',
  chartHint: 'Tap a point to see its value.',
  dreamWeightLine: (v: string) => `Dream weight ${v}`,
  weightChartSummary: (n: number, first: string, last: string) => `Line chart of ${n} daily ${n === 1 ? 'weight' : 'weights'} this week, from ${first} kg to ${last} kg.`,
  sugarChartSummary: (n: number, lo: string, hi: string, unit: string) => `Dot chart of ${n} blood sugar ${n === 1 ? 'reading' : 'readings'} this week, from ${lo} to ${hi} ${unit}.`,

  // Search
  searchPlaceholder: 'Search meals and notes', from: 'From', to: 'To',
  hasPhotos: 'Has photos', hasWeight: 'Has weight', hasSugar: 'Has blood sugar',
  searchHint: 'Type a word, or choose a filter.', noResults: 'Nothing found.',
  kind: { meal: 'Meal', dayNote: 'Day note', activity: 'Activity', readingNote: 'Reading note', day: 'Day' },
  resultCount: (n: number) => `${n} ${n === 1 ? 'result' : 'results'}`,

  // Profile photo
  profile: 'Profile', profilePhoto: 'Your photo', choosePhoto: 'Choose photo', changePhoto: 'Change photo', removeProfilePhoto: 'Remove photo',
  confirmRemoveProfilePhoto: 'Remove your photo?', remove: 'Remove', profileNote: 'Shown at the top of Today. It stays on this phone and is included in your export.',
  profileSaved: 'Photo saved', openSettings: 'Open settings',

  colour: 'Colour', colourNote: 'Changes the colour of the whole app.',

  // Settings
  units: 'Units', weightUnit: 'Weight unit', weightUnitFixed: 'kg', sugarUnit: 'Blood sugar unit',
  weekStartsOn: 'Week starts on', monday: 'Monday', sunday: 'Sunday',
  hideSugar: 'Hide blood sugar on Today', hideSugarNote: 'Readings stay hidden on the Today screen until you tap them.',
  backup: 'Backup', exportData: 'Export data', importData: 'Import data',
  lastExport: (when: string) => `Last export: ${when}`, neverExported: 'Last export: never',
  daysAgo: (n: number) => (n === 0 ? 'today' : n === 1 ? '1 day ago' : `${n} days ago`),
  exportDue: (n: number | null) => (n == null ? 'You have not exported yet. Export now?' : `Last export: ${n} days ago. Export now?`),
  exportNow: 'Export now',
  exportWarning: 'The export file contains your health data and is not encrypted. Keep it somewhere safe, such as your own cloud drive.',
  exportContinue: 'Create export', exporting: 'Creating export…',
  exportReady: (mb: string) => `Export ready (${mb} MB). Save it somewhere safe.`, exportSave: 'Save or share file',
  exportDone: 'Export saved', nothingToExport: 'There is nothing to export yet.',
  importReading: 'Reading file…', importing: 'Importing…',
  importNew: (days: number) => `This export has ${days} ${days === 1 ? 'day' : 'days'}. Import ${days === 1 ? 'it' : 'them'}?`,
  importConflict: (conflicts: number, fresh: number) =>
    `${conflicts} ${conflicts === 1 ? 'day in this export already exists' : 'days in this export already exist'} on this phone. ${fresh} ${fresh === 1 ? 'day is' : 'days are'} new.\n\nWhat should happen to the days that already exist?`,
  importSkip: 'Skip days that already exist', importReplace: 'Replace them', importGo: 'Import',
  importDone: (r: { daysAdded: number; daysReplaced: number; daysSkipped: number; photos: number }) =>
    `Import finished.\nDays added: ${r.daysAdded}\nDays replaced: ${r.daysReplaced}\nDays skipped: ${r.daysSkipped}\nPhotos: ${r.photos}`,
  storage: 'Storage', storageUsed: (mb: string) => `Space used by this app: ${mb} MB`,
  storageKept: 'The browser has agreed to keep this data.', storageNotKept: 'The browser has not promised to keep this data. Add the app to your home screen and export regularly.',
  storageRisk: 'Your data lives only in this browser on this phone. It is erased if you remove the home-screen icon (iPhone), clear website data, or lose the phone. Export is the only backup.',
  clearAll: 'Clear all data', clearAll1: 'Delete every day, meal, reading, photo and the goal history from this phone?',
  clearAll2: 'This cannot be undone. Have you exported what you want to keep?', clearAllYes: 'Yes, delete everything', clearAllFinal: 'Delete everything now', cleared: 'All data cleared',
  about: 'About', version: (v: string) => `Version ${v}`,
  privacy: 'Privacy: this app has no accounts, no analytics and no tracking. It does not send your data anywhere. An iPhone or computer backup of the phone may include this app\'s data under your own account; do not rely on that as a backup.',
  medical: 'This app is a personal log. The ranges are general reference values, not medical advice or a diagnosis. For blood sugar concerns, talk to your doctor.',

  // Blood sugar ranges
  level: { very_low: 'Very low', low: 'Low', in_range: 'In range', above: 'Above range', high: 'High' },
  levelNone: 'Not rated',
  ofRated: (n: number, total: number) => `${n} of ${total}`,
  notRated: (n: number) => `${n} ${n === 1 ? 'reading is' : 'readings are'} not rated, because no range applies to that kind of reading.`,
  advice: {
    low: 'This reading is low (below 3.9 mmol/L, or 70 mg/dL).\n\nTake about 15 g of fast-acting sugar, such as 150 ml of juice or 4 glucose tablets. Recheck in 15 minutes, and repeat if it is still low.\n\nSeek urgent care if a low reading does not improve with treatment.',
    veryLow: 'This reading is very low (below 3.0 mmol/L, or 54 mg/dL). This is serious.\n\nTake about 15 g of fast-acting sugar now, such as 150 ml of juice or 4 glucose tablets. Recheck in 15 minutes, and repeat if it is still low.\n\nSeek urgent care if it does not improve with treatment.',
    high: 'This reading is in the high range.\n\nSeek urgent care if a high reading comes with vomiting, confusion, drowsiness, fruity-smelling breath, or trouble breathing.\n\nOne reading is not a diagnosis. Your doctor may set different targets for you.',
  },
  rangeSettings: {
    title: 'Blood sugar ranges', general: 'General', diabetes: 'Diabetes targets', custom: 'My own', off: 'Off',
    beforeMax: 'Before meals, up to', afterMax: 'After meals, under',
    explain: {
      general: 'Readings are coloured against the general ranges: fasting under 5.6, and under 7.8 two hours after eating (mmol/L).',
      diabetes: 'Readings are coloured against common targets for adults with diabetes: 4.0 to 7.0 before meals, and under 10.0 two hours after eating (mmol/L).',
      custom: 'Readings are coloured against the targets you type here, for example the ones your doctor gave you.',
      off: 'Readings are shown as plain numbers, with no colours or labels.',
    } satisfies Record<'general' | 'diabetes' | 'custom' | 'off', string>,
  },
  ranges: {
    title: 'Blood sugar ranges', link: 'About the ranges',
    intro: 'Commonly used ranges for blood glucose in mmol/L (1 mmol/L = 18 mg/dL). These follow ADA-style thresholds, and your doctor may set different targets for you.',
    head: ['Category', 'Fasting (no food for 8+ hours)', '2 hours after eating'],
    rows: [['Normal', 'Under 5.6', 'Under 7.8'], ['Prediabetes', '5.6 to 6.9', '7.8 to 11.0'], ['Diabetes range', '7.0 or higher', '11.1 or higher']],
    notes: [
      ['Random reading:', 'a reading of 11.1 or higher with symptoms such as thirst, frequent urination, or blurred vision also points to diabetes.'],
      ['Low (hypoglycaemia):', 'below 3.9. Below 3.0 is serious. Take about 15 g of fast-acting sugar, such as 150 ml of juice or 4 glucose tablets, then recheck in 15 minutes and repeat if still low.'],
      ['If you already have diabetes,', 'common targets for many adults are about 4.0 to 7.0 before meals and under 10.0 two hours after eating. Your own targets depend on your medication and health, so check them with your doctor.'],
      ['Seek urgent care', 'if a high reading comes with vomiting, confusion, drowsiness, fruity-smelling breath, or trouble breathing, or if a low reading does not improve with treatment.'],
    ],
    howTitle: 'How the app uses them',
    how: [
      'Each reading gets a colour and a word: In range, Above range, High, Low, or Very low. In the general ranges, "Above range" is the middle row of the table and "High" is the bottom row.',
      'Fasting readings use the fasting column. After-meal readings use the "2 hours after eating" column. Other readings are only marked when they are low, or 11.1 or higher.',
      'A single reading is not a diagnosis. The app uses "Above range" and "High" on readings, and leaves the words in the table to your doctor.',
      'You can switch to diabetes targets or your own targets, or turn the colours off, in Settings.',
    ],
  },

  // Activities and calories
  eaten: 'Eaten', burned: 'Burned', estimate: 'estimate', difference: 'Difference', differenceNote: 'eaten minus burned',
  act: {
    title: 'Activities', add: 'Add activity', edit: 'Edit activity', none: 'No activities for this day.',
    type: 'Activity', name: 'Name of the activity', minutes: 'Minutes', kcal: 'Calories burned (kcal)', min: 'min',
    minutesError: 'Enter the minutes as a whole number from 1 to 1440.', nameError: 'Give the activity a name.',
    estimateNote: (kg: string) => `Estimated from the activity, the minutes and your weight (${kg} kg). It is a rough figure and can be 20 to 30 percent off.`,
    manualNote: 'You typed this figure. The app will not change it.',
    noWeight: 'Log a weight first and the app can estimate the calories. Until then you can type a figure.',
    otherNote: 'The app cannot estimate this activity. Type the calories if you know them.',
    useEstimate: (kcal: number) => `Use estimate (${kcal})`,
    total: (kcal: string) => `${kcal} kcal burned`,
    delete: 'Delete activity', confirmDelete: 'Delete this activity?',
    daysWith: 'Days with activity', count: 'Activities', totalMinutes: 'Total time', totalBurned: 'Estimated calories burned',
  },
  foodFind: 'Find a food', foodFindPlaceholder: 'For example: nasi lemak, 鸡饭, teh tarik',
  foodNone: 'Not in the list. Type the food and its calories below.',
  foodNote: 'Typical calories per serving. Portions and recipes vary, so change the number if yours is different.',
  foodAddHalf: (name: string) => `Add half a serving of ${name}`, foodAddOne: (name: string) => `Add one serving of ${name}`,
  foodAdded: (label: string, kcal: number) => `Added ${label} (${kcal} kcal)`,

  // HbA1c
  a1c: {
    title: 'HbA1c', intro: 'Record each HbA1c blood test result, with the date the test was taken.',
    addResult: 'Add a result', editResult: 'Edit result', value: 'HbA1c (%)', date: 'Date of the blood test',
    valueError: 'Enter a value from 3.0 to 20.0, with at most one decimal place.', dateError: 'Choose the date of the test. It cannot be in the future.',
    notePlaceholder: 'For example: clinic name', saved: 'Result saved', history: 'Results', none: 'No results yet.',
    deleteResult: 'Delete result', confirmDelete: 'Delete this HbA1c result?', record: 'Record a result',
    latest: (value: string, date: string) => `${value}% · ${date}`,
    band: { normal: 'Normal range', prediabetes: 'Prediabetes range', diabetes: 'Diabetes range' },
    bandShort: { normal: 'Normal · below 5.7', prediabetes: 'Prediabetes · 5.7 to 6.4', diabetes: 'Diabetes · 6.5 or higher' },
    latestTitle: (date: string) => `Latest result · ${date}`, bandsTitle: 'HbA1c bands',
    bandsText: 'HbA1c bands: normal below 5.7%, prediabetes 5.7 to 6.4%, diabetes 6.5% or higher.',
    bandsNote: 'Standard diagnostic bands (ADA criteria): below 5.7% normal, 5.7 to 6.4% prediabetes, 6.5% or higher diabetes. A single high result is usually confirmed with a second test before a diagnosis is made. Your doctor sets any treatment targets for you.',
    trend: 'Over time', trendSummary: (n: number) => `Line chart of ${n} HbA1c results over time, drawn over the normal, prediabetes and diabetes bands.`,
    trendOff: 'Turn on blood sugar ranges in Settings to see the chart with its bands.',
    tableHead: ['Band', 'HbA1c (%)', 'mmol/mol'],
    tableRows: [['Normal', 'Below 5.7', 'Below 39'], ['Prediabetes', '5.7 to 6.4', '39 to 47'], ['Diabetes', '6.5 or higher', '48 or higher']],
  },

  // Install and update
  installTitle: 'Add this app to your home screen',
  installIos: 'In Safari, tap Share, then "Add to Home Screen". Open it from the new icon so your data is kept.',
  installOther: 'Open the browser menu and choose "Install app" or "Add to Home screen".',
  updateReady: 'New version available.', reload: 'Reload',
}
