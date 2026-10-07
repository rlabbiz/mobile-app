import AsyncStorage from '@react-native-async-storage/async-storage';
export interface Progress {
  position: number;
  completed: boolean;
}
export function clampPosition(position: number, duration: number) {
  return Number.isFinite(position)
    ? Math.max(0, Math.min(position, Math.max(0, duration - 2)))
    : 0;
}
export async function readProgress(partId: string): Promise<Progress | null> {
  const value = await AsyncStorage.getItem(`progress:${partId}`);
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}
export async function saveProgress(
  partId: string,
  position: number,
  completed = false,
) {
  await AsyncStorage.setItem(
    `progress:${partId}`,
    JSON.stringify({ position, completed }),
  );
}
