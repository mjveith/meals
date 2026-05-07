import { HouseholdMember, HouseholdMemberKind, MealType } from "@/types";

const MEAL_TYPES: MealType[] = ["breakfast", "brunch", "lunch", "dinner"];
const DEFAULT_ADULT_NAMES = ["Paesano", "Young"];
const DEFAULT_CHILD_NAMES = ["Ronin"];

function sanitizeId(value: string, fallback: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || fallback;
}

function sanitizeMealParticipation(value: unknown): MealType[] {
  if (!Array.isArray(value)) {
    return [...MEAL_TYPES];
  }

  const seen = new Set<MealType>();
  const participation = value.filter(
    (mealType): mealType is MealType =>
      (mealType === "breakfast" || mealType === "brunch" || mealType === "lunch" || mealType === "dinner")
      && !seen.has(mealType)
      && Boolean(seen.add(mealType))
  );

  return participation;
}

function createNamedMember(name: string, kind: HouseholdMemberKind, index: number): HouseholdMember {
  return {
    id: `${kind}-${sanitizeId(name, `${kind}-${index + 1}`)}`,
    name,
    kind,
    mealParticipation: kind === "adult" && name === "Paesano"
      ? ["brunch", "lunch", "dinner"]
      : [...MEAL_TYPES]
  };
}

function getDefaultName(kind: HouseholdMemberKind, index: number) {
  const names = kind === "adult" ? DEFAULT_ADULT_NAMES : DEFAULT_CHILD_NAMES;
  return names[index] ?? `${kind === "adult" ? "Adult" : "Child"} ${index + 1}`;
}

export function createHouseholdMembers(adults = 2, children = 1): HouseholdMember[] {
  return [
    ...Array.from({ length: Math.max(0, adults) }, (_, index) =>
      createNamedMember(getDefaultName("adult", index), "adult", index)
    ),
    ...Array.from({ length: Math.max(0, children) }, (_, index) =>
      createNamedMember(getDefaultName("child", index), "child", index)
    )
  ];
}

export function normalizeHouseholdMembers(
  value: unknown,
  fallbackAdults = 2,
  fallbackChildren = 1
): HouseholdMember[] {
  if (!Array.isArray(value)) {
    return createHouseholdMembers(fallbackAdults, fallbackChildren);
  }

  const normalized = value
    .map((member, index) => {
      if (!member || typeof member !== "object") {
        return null;
      }

      const candidate = member as Partial<HouseholdMember>;
      const kind: HouseholdMemberKind = candidate.kind === "child" ? "child" : "adult";
      const fallbackName = getDefaultName(kind, index);
      const name = candidate.name?.trim() || fallbackName;

      return {
        id: sanitizeId(candidate.id ?? `${kind}-${name}`, `${kind}-${index + 1}`),
        name,
        kind,
        mealParticipation: sanitizeMealParticipation(candidate.mealParticipation)
      } satisfies HouseholdMember;
    })
    .filter((member): member is HouseholdMember => Boolean(member));

  return normalized.length > 0
    ? normalized
    : createHouseholdMembers(fallbackAdults, fallbackChildren);
}

export function countHouseholdMembers(members: HouseholdMember[]) {
  return members.reduce(
    (counts, member) => {
      if (member.kind === "child") {
        counts.children += 1;
      } else {
        counts.adults += 1;
      }

      return counts;
    },
    { adults: 0, children: 0 }
  );
}

export function getMemberMealWeight(member: HouseholdMember) {
  return member.kind === "child" ? 0.5 : 1;
}

export function getMealParticipants(members: HouseholdMember[], mealType: MealType) {
  return members.filter((member) => member.mealParticipation.includes(mealType));
}

export function getMealParticipationWeight(members: HouseholdMember[], mealType: MealType) {
  return getMealParticipants(members, mealType).reduce(
    (total, member) => total + getMemberMealWeight(member),
    0
  );
}

export function getMealParticipationAvailability(members: HouseholdMember[]) {
  return {
    breakfast: getMealParticipationWeight(members, "breakfast") > 0,
    brunch: getMealParticipationWeight(members, "brunch") > 0,
    lunch: getMealParticipationWeight(members, "lunch") > 0,
    dinner: getMealParticipationWeight(members, "dinner") > 0
  } satisfies Record<MealType, boolean>;
}

export function getServingMultiplierFromWeight(weight: number, baseServings = 4) {
  if (baseServings <= 0) {
    return 0;
  }

  return Math.max(0, weight) / baseServings;
}

export function getMealServingMultiplier(
  members: HouseholdMember[],
  mealType: MealType,
  baseServings = 4
) {
  return getServingMultiplierFromWeight(getMealParticipationWeight(members, mealType), baseServings);
}

export function getMealServingMultipliers(members: HouseholdMember[], baseServings = 4) {
  return {
    breakfast: getMealServingMultiplier(members, "breakfast", baseServings),
    brunch: getMealServingMultiplier(members, "brunch", baseServings),
    lunch: getMealServingMultiplier(members, "lunch", baseServings),
    dinner: getMealServingMultiplier(members, "dinner", baseServings)
  } satisfies Record<MealType, number>;
}

export function getFullHouseholdServingMultiplier(members: HouseholdMember[], baseServings = 4) {
  return getServingMultiplierFromWeight(
    members.reduce((total, member) => total + getMemberMealWeight(member), 0),
    baseServings
  );
}

export function createBlankHouseholdMember(existingMembers: HouseholdMember[]): HouseholdMember {
  const { adults, children } = countHouseholdMembers(existingMembers);
  const kind: HouseholdMemberKind = adults <= children ? "adult" : "child";
  const nextIndex = kind === "adult" ? adults : children;
  const name = getDefaultName(kind, nextIndex);

  return {
    id: `${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    kind,
    mealParticipation: [...MEAL_TYPES]
  };
}

export function formatParticipationCount(weight: number) {
  return Number.isInteger(weight) ? String(weight) : weight.toFixed(1).replace(/\.0$/, "");
}
