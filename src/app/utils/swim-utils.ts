export function getLevelFocus(level: number): string {
  const focus: Record<number, string> = {
    1: 'Water comfort and confidence',
    2: 'Independent buoyancy and simple movement',
    3: 'COMFORT',
    4: 'Coordinated strokes and stamina',
    5: 'Refine strokes and increase endurance',
    6: 'Master strokes and prepare for competitive'
  };
  return focus[level] || '';
}

export function getChildInitial(name: string): string {
  return (name || '?').charAt(0).toUpperCase();
}
