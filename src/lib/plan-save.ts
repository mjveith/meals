export async function finalizePlanSave<T>(mutation: Promise<boolean>, archive: T | null, setPlanSavedSinceLastChange: (saved: boolean) => void): Promise<T | null> {
  if (!await mutation) return null;
  setPlanSavedSinceLastChange(true);
  return archive;
}
