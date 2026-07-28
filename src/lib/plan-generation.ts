export async function finishPlanGeneration(
  mutation: Promise<boolean>,
  onSuccess: () => void
): Promise<boolean> {
  const generated = await mutation;
  if (generated) onSuccess();
  return generated;
}
