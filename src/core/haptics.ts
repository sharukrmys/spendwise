export function haptic(pattern: number | number[] = 10) {
  if ('vibrate' in navigator) {
    try { navigator.vibrate(pattern) } catch { /* unsupported */ }
  }
}

export const haptics = {
  light: () => haptic(10),
  medium: () => haptic(20),
  success: () => haptic([10, 40, 10]),
  delete: () => haptic([15, 30, 15]),
}
