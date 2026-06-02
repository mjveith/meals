import recipesJson from "@/data/recipes.json";
import { MealProfileId, Recipe } from "@/types";

const homeRecipes = recipesJson as Recipe[];

const bajanRecipes: Recipe[] = [
  {
    id: "bajan-flying-fish-cutters",
    name: "Flying Fish Cutters",
    description: "Bajan salt bread sandwiches with seasoned flying fish, lettuce, tomato, and pepper sauce.",
    mealType: ["lunch", "dinner"],
    proteins: ["fish"],
    cuisine: "Bajan",
    prepTime: 20,
    cookTime: 15,
    servings: 4,
    difficulty: "easy",
    ingredients: [
      { name: "flying fish fillets", quantity: 1.5, unit: "lb", category: "protein" },
      { name: "Bajan seasoning", quantity: 3, unit: "tbsp", category: "spice" },
      { name: "salt bread rolls", quantity: 4, unit: "", category: "bakery" },
      { name: "lettuce", quantity: 1, unit: "head", category: "produce" },
      { name: "tomato", quantity: 2, unit: "", category: "produce" },
      { name: "pepper sauce", quantity: 1, unit: "bottle", category: "spice" },
      { name: "lime", quantity: 2, unit: "", category: "produce" }
    ],
    instructions: ["Season fish with Bajan seasoning and lime.", "Pan-fry until cooked through.", "Build cutters on salt bread with lettuce, tomato, and pepper sauce."]
  },
  {
    id: "bajan-blackened-mahi-mahi",
    name: "Blackened Dolphin / Mahi Mahi",
    description: "Local-style blackened mahi mahi with lime, herbs, and Scotch bonnet heat.",
    mealType: ["lunch", "dinner"],
    proteins: ["fish"],
    cuisine: "Bajan",
    prepTime: 15,
    cookTime: 12,
    servings: 4,
    difficulty: "easy",
    ingredients: [
      { name: "mahi mahi fillets", quantity: 1.5, unit: "lb", category: "protein" },
      { name: "paprika", quantity: 2, unit: "tsp", category: "spice" },
      { name: "thyme", quantity: 1, unit: "tsp", category: "spice" },
      { name: "Scotch bonnet pepper", quantity: 1, unit: "", category: "produce" },
      { name: "lime", quantity: 2, unit: "", category: "produce" },
      { name: "sweet potato", quantity: 2, unit: "", category: "produce" }
    ],
    instructions: ["Rub fish with spices, minced Scotch bonnet, and lime.", "Sear hard in a hot pan until blackened and flaky.", "Serve with roasted sweet potato."]
  },
  {
    id: "bajan-fried-sweet-plantain",
    name: "Fried Sweet Ripe Plantain",
    description: "Soft, mushy, sweet ripe plantain fried until caramelized.",
    mealType: ["breakfast", "brunch", "lunch"],
    proteins: [],
    cuisine: "Bajan",
    prepTime: 5,
    cookTime: 10,
    servings: 4,
    difficulty: "easy",
    ingredients: [
      { name: "very ripe plantains", quantity: 4, unit: "", category: "produce" },
      { name: "coconut oil", quantity: 3, unit: "tbsp", category: "pantry" },
      { name: "sea salt", quantity: 0.5, unit: "tsp", category: "spice" }
    ],
    instructions: ["Slice very ripe plantains thickly.", "Fry gently until deeply caramelized and soft.", "Finish with a tiny pinch of salt."]
  },
  {
    id: "bajan-pumpkin-fritters",
    name: "Pumpkin Fritters",
    description: "Sweet-spiced Bajan pumpkin fritters with cinnamon and nutmeg.",
    mealType: ["breakfast", "brunch", "lunch"],
    proteins: [],
    cuisine: "Bajan",
    prepTime: 15,
    cookTime: 15,
    servings: 4,
    difficulty: "easy",
    ingredients: [
      { name: "pumpkin", quantity: 2, unit: "cup", category: "produce" },
      { name: "flour", quantity: 1, unit: "cup", category: "pantry" },
      { name: "brown sugar", quantity: 2, unit: "tbsp", category: "pantry" },
      { name: "cinnamon", quantity: 1, unit: "tsp", category: "spice" },
      { name: "nutmeg", quantity: 0.5, unit: "tsp", category: "spice" }
    ],
    instructions: ["Mash cooked pumpkin with sugar and spices.", "Fold in flour to make a spoonable batter.", "Fry spoonfuls until crisp outside and tender inside."]
  },
  {
    id: "bajan-saltfish-cakes",
    name: "Saltfish Cakes",
    description: "Crisp Bajan saltfish cakes with herbs, onion, and pepper sauce.",
    mealType: ["brunch", "lunch", "dinner"],
    proteins: ["fish"],
    cuisine: "Bajan",
    prepTime: 20,
    cookTime: 15,
    servings: 4,
    difficulty: "easy",
    ingredients: [
      { name: "saltfish", quantity: 1, unit: "lb", category: "protein" },
      { name: "flour", quantity: 1.5, unit: "cup", category: "pantry" },
      { name: "green onion", quantity: 4, unit: "", category: "produce" },
      { name: "thyme", quantity: 1, unit: "tsp", category: "spice" },
      { name: "pepper sauce", quantity: 2, unit: "tbsp", category: "spice" }
    ],
    instructions: ["Soak and flake saltfish.", "Mix with herbs, flour, and water into batter.", "Fry small cakes until golden."]
  },
  {
    id: "bajan-breadfruit-cou-cou",
    name: "Breadfruit Cou Cou",
    description: "Breadfruit and okra cou cou served with seasoned fish gravy.",
    mealType: ["dinner"],
    proteins: ["fish"],
    cuisine: "Bajan",
    prepTime: 25,
    cookTime: 35,
    servings: 4,
    difficulty: "medium",
    ingredients: [
      { name: "breadfruit", quantity: 1, unit: "", category: "produce" },
      { name: "okra", quantity: 12, unit: "", category: "produce" },
      { name: "flying fish fillets", quantity: 1, unit: "lb", category: "protein" },
      { name: "Bajan seasoning", quantity: 2, unit: "tbsp", category: "spice" },
      { name: "lime", quantity: 1, unit: "", category: "produce" }
    ],
    instructions: ["Boil breadfruit and okra until tender.", "Mash into a cou cou texture.", "Serve with seasoned fish gravy."]
  },
  {
    id: "bajan-cheesy-baked-christophine",
    name: "Cheesy Baked Christophine",
    description: "Christophine baked with cheese, herbs, and a crisp breadcrumb top.",
    mealType: ["lunch", "dinner"],
    proteins: [],
    cuisine: "Bajan",
    prepTime: 20,
    cookTime: 30,
    servings: 4,
    difficulty: "easy",
    ingredients: [
      { name: "christophine", quantity: 3, unit: "", category: "produce" },
      { name: "cheddar cheese", quantity: 1.5, unit: "cup", category: "dairy" },
      { name: "breadcrumbs", quantity: 0.5, unit: "cup", category: "pantry" },
      { name: "thyme", quantity: 1, unit: "tsp", category: "spice" },
      { name: "garlic", quantity: 2, unit: "clove", category: "produce" }
    ],
    instructions: ["Steam and scoop christophine.", "Mix with cheese, garlic, and thyme.", "Bake with breadcrumbs until bubbling."]
  },
  {
    id: "bajan-chicken-roti",
    name: "Chicken Roti with Curry and Chutney",
    description: "Curried chicken and potatoes wrapped in roti with bright chutney sauce.",
    mealType: ["lunch", "dinner"],
    proteins: ["chicken"],
    cuisine: "Bajan",
    prepTime: 20,
    cookTime: 30,
    servings: 4,
    difficulty: "medium",
    ingredients: [
      { name: "chicken thighs", quantity: 1.5, unit: "lb", category: "protein" },
      { name: "roti skins", quantity: 4, unit: "", category: "bakery" },
      { name: "potatoes", quantity: 3, unit: "", category: "produce" },
      { name: "curry powder", quantity: 2, unit: "tbsp", category: "spice" },
      { name: "mango chutney", quantity: 0.5, unit: "cup", category: "pantry" }
    ],
    instructions: ["Simmer chicken and potatoes with curry powder.", "Warm roti skins.", "Wrap curry with chutney or sauce."]
  },
  {
    id: "bajan-beef-roti",
    name: "Beef Roti with Curry and Pepper Sauce",
    description: "Curried beef roti with potatoes, chutney, and pepper sauce.",
    mealType: ["lunch", "dinner"],
    proteins: ["red-meat"],
    cuisine: "Bajan",
    prepTime: 20,
    cookTime: 40,
    servings: 4,
    difficulty: "medium",
    ingredients: [
      { name: "stew beef", quantity: 1.5, unit: "lb", category: "protein" },
      { name: "roti skins", quantity: 4, unit: "", category: "bakery" },
      { name: "potatoes", quantity: 3, unit: "", category: "produce" },
      { name: "curry powder", quantity: 2, unit: "tbsp", category: "spice" },
      { name: "pepper sauce", quantity: 2, unit: "tbsp", category: "spice" }
    ],
    instructions: ["Braise beef with curry and potatoes until tender.", "Wrap in roti skins.", "Serve with pepper sauce and chutney."]
  },
  {
    id: "bajan-rice-peas-chicken",
    name: "Bajan Chicken with Rice and Peas",
    description: "Seasoned chicken with coconut rice, pigeon peas, thyme, and lime.",
    mealType: ["dinner"],
    proteins: ["chicken"],
    cuisine: "Bajan",
    prepTime: 15,
    cookTime: 35,
    servings: 4,
    difficulty: "easy",
    ingredients: [
      { name: "chicken drumsticks", quantity: 2, unit: "lb", category: "protein" },
      { name: "rice", quantity: 1.5, unit: "cup", category: "pantry" },
      { name: "pigeon peas", quantity: 1, unit: "can", category: "pantry" },
      { name: "coconut milk", quantity: 1, unit: "can", category: "pantry" },
      { name: "thyme", quantity: 1, unit: "tsp", category: "spice" }
    ],
    instructions: ["Roast seasoned chicken.", "Cook rice with peas, coconut milk, and thyme.", "Serve with lime and pepper sauce."]
  },
  {
    id: "bajan-pepperpot-pork",
    name: "Bajan Pepperpot Pork Stew",
    description: "Slow pork stew with cassareep-style depth, sweet potato, and Scotch bonnet warmth.",
    mealType: ["dinner"],
    proteins: ["pork"],
    cuisine: "Bajan",
    prepTime: 20,
    cookTime: 60,
    servings: 4,
    difficulty: "medium",
    ingredients: [
      { name: "pork shoulder", quantity: 2, unit: "lb", category: "protein" },
      { name: "sweet potato", quantity: 2, unit: "", category: "produce" },
      { name: "cassareep", quantity: 3, unit: "tbsp", category: "pantry" },
      { name: "Scotch bonnet pepper", quantity: 1, unit: "", category: "produce" },
      { name: "thyme", quantity: 1, unit: "tsp", category: "spice" }
    ],
    instructions: ["Brown pork shoulder.", "Simmer with cassareep, sweet potato, thyme, and Scotch bonnet.", "Serve when rich and tender."]
  },
  {
    id: "bajan-grilled-snapper",
    name: "Grilled Snapper with Bajan Seasoning",
    description: "Fresh snapper grilled with Bajan seasoning, lime, cucumber, and herbs.",
    mealType: ["lunch", "dinner"],
    proteins: ["fish"],
    cuisine: "Bajan",
    prepTime: 15,
    cookTime: 15,
    servings: 4,
    difficulty: "easy",
    ingredients: [
      { name: "snapper fillets", quantity: 1.5, unit: "lb", category: "protein" },
      { name: "Bajan seasoning", quantity: 2, unit: "tbsp", category: "spice" },
      { name: "lime", quantity: 2, unit: "", category: "produce" },
      { name: "cucumber", quantity: 1, unit: "", category: "produce" },
      { name: "cilantro", quantity: 1, unit: "bunch", category: "produce" }
    ],
    instructions: ["Season snapper with Bajan seasoning and lime.", "Grill until flaky.", "Serve with cucumber herb salad."]
  },
  {
    id: "bajan-macaroni-pie-fish",
    name: "Macaroni Pie with Seasoned Fish",
    description: "Comforting macaroni pie alongside Bajan-seasoned fresh fish.",
    mealType: ["dinner"],
    proteins: ["fish"],
    cuisine: "Bajan",
    prepTime: 25,
    cookTime: 35,
    servings: 4,
    difficulty: "medium",
    ingredients: [
      { name: "mahi mahi fillets", quantity: 1, unit: "lb", category: "protein" },
      { name: "macaroni", quantity: 12, unit: "oz", category: "pantry" },
      { name: "cheddar cheese", quantity: 2, unit: "cup", category: "dairy" },
      { name: "evaporated milk", quantity: 1, unit: "can", category: "pantry" },
      { name: "Bajan seasoning", quantity: 2, unit: "tbsp", category: "spice" }
    ],
    instructions: ["Bake macaroni with cheese and evaporated milk.", "Cook fish with Bajan seasoning.", "Serve together with pepper sauce."]
  },
  {
    id: "bajan-pudding-souse",
    name: "Pudding and Souse",
    description: "Bajan-style pork souse with pickled cucumber, lime, and sweet potato pudding.",
    mealType: ["lunch", "dinner"],
    proteins: ["pork"],
    cuisine: "Bajan",
    prepTime: 30,
    cookTime: 45,
    servings: 4,
    difficulty: "medium",
    ingredients: [
      { name: "pork shoulder", quantity: 1.5, unit: "lb", category: "protein" },
      { name: "sweet potato", quantity: 3, unit: "", category: "produce" },
      { name: "cucumber", quantity: 2, unit: "", category: "produce" },
      { name: "lime", quantity: 4, unit: "", category: "produce" },
      { name: "parsley", quantity: 1, unit: "bunch", category: "produce" }
    ],
    instructions: ["Cook pork until tender and chill with lime pickle.", "Make sweet potato pudding.", "Serve with cucumber, parsley, and lime."]
  },
  {
    id: "bajan-coconut-oats-guava",
    name: "Coconut Oats with Guava",
    description: "Creamy coconut oats topped with guava and banana.",
    mealType: ["breakfast", "brunch"],
    proteins: [],
    cuisine: "Bajan",
    prepTime: 10,
    cookTime: 10,
    servings: 4,
    difficulty: "easy",
    ingredients: [
      { name: "rolled oats", quantity: 2, unit: "cup", category: "pantry" },
      { name: "coconut milk", quantity: 1, unit: "can", category: "pantry" },
      { name: "guava", quantity: 2, unit: "", category: "produce" },
      { name: "banana", quantity: 2, unit: "", category: "produce" },
      { name: "cinnamon", quantity: 1, unit: "tsp", category: "spice" }
    ],
    instructions: ["Cook oats with coconut milk and cinnamon.", "Top with guava and banana.", "Serve warm."]
  },
  {
    id: "bajan-bakes-eggs",
    name: "Bajan Bakes with Eggs",
    description: "Warm bakes with eggs, tomato, avocado, and pepper sauce.",
    mealType: ["breakfast", "brunch"],
    proteins: [],
    cuisine: "Bajan",
    prepTime: 15,
    cookTime: 20,
    servings: 4,
    difficulty: "easy",
    ingredients: [
      { name: "flour", quantity: 2, unit: "cup", category: "pantry" },
      { name: "eggs", quantity: 8, unit: "", category: "dairy" },
      { name: "tomato", quantity: 2, unit: "", category: "produce" },
      { name: "avocado", quantity: 2, unit: "", category: "produce" },
      { name: "pepper sauce", quantity: 1, unit: "bottle", category: "spice" }
    ],
    instructions: ["Make quick bakes and pan-fry until puffed.", "Scramble or fry eggs.", "Serve with tomato, avocado, and pepper sauce."]
  },
  {
    id: "bajan-soursop-smoothie-bowl",
    name: "Soursop Smoothie Bowl",
    description: "Soursop, banana, coconut, and lime breakfast bowl.",
    mealType: ["breakfast"],
    proteins: [],
    cuisine: "Bajan",
    prepTime: 10,
    cookTime: 0,
    servings: 4,
    difficulty: "easy",
    ingredients: [
      { name: "soursop pulp", quantity: 2, unit: "cup", category: "produce" },
      { name: "banana", quantity: 3, unit: "", category: "produce" },
      { name: "coconut milk", quantity: 1, unit: "cup", category: "pantry" },
      { name: "lime", quantity: 1, unit: "", category: "produce" },
      { name: "toasted coconut", quantity: 0.5, unit: "cup", category: "pantry" }
    ],
    instructions: ["Blend soursop, banana, coconut milk, and lime.", "Pour into bowls.", "Top with toasted coconut."]
  },
  {
    id: "bajan-cassava-chicken-bowl",
    name: "Cassava and Jerk Chicken Bowl",
    description: "Roasted cassava with Bajan-seasoned chicken, cabbage, and lime.",
    mealType: ["lunch", "dinner"],
    proteins: ["chicken"],
    cuisine: "Bajan",
    prepTime: 20,
    cookTime: 35,
    servings: 4,
    difficulty: "easy",
    ingredients: [
      { name: "chicken thighs", quantity: 1.5, unit: "lb", category: "protein" },
      { name: "cassava", quantity: 2, unit: "lb", category: "produce" },
      { name: "cabbage", quantity: 1, unit: "head", category: "produce" },
      { name: "Bajan seasoning", quantity: 2, unit: "tbsp", category: "spice" },
      { name: "lime", quantity: 2, unit: "", category: "produce" }
    ],
    instructions: ["Roast seasoned chicken and cassava.", "Shred cabbage with lime.", "Serve as bowls with pepper sauce."]
  },
  {
    id: "bajan-tamarind-pork-chops",
    name: "Tamarind Pork Chops with Plantain",
    description: "Pork chops glazed with tamarind and served with sweet ripe plantain.",
    mealType: ["dinner"],
    proteins: ["pork"],
    cuisine: "Bajan",
    prepTime: 15,
    cookTime: 25,
    servings: 4,
    difficulty: "easy",
    ingredients: [
      { name: "pork chops", quantity: 4, unit: "", category: "protein" },
      { name: "tamarind concentrate", quantity: 3, unit: "tbsp", category: "pantry" },
      { name: "ripe plantains", quantity: 3, unit: "", category: "produce" },
      { name: "ginger", quantity: 1, unit: "tbsp", category: "produce" },
      { name: "lime", quantity: 1, unit: "", category: "produce" }
    ],
    instructions: ["Sear pork chops.", "Glaze with tamarind, ginger, and lime.", "Serve with fried ripe plantain."]
  },
  {
    id: "bajan-curry-shrimp-breadfruit",
    name: "Curry Shrimp with Breadfruit",
    description: "Shrimp curry with breadfruit, coconut, and Scotch bonnet.",
    mealType: ["lunch", "dinner"],
    proteins: ["fish"],
    cuisine: "Bajan",
    prepTime: 15,
    cookTime: 25,
    servings: 4,
    difficulty: "easy",
    ingredients: [
      { name: "shrimp", quantity: 1.5, unit: "lb", category: "protein" },
      { name: "breadfruit", quantity: 1, unit: "", category: "produce" },
      { name: "coconut milk", quantity: 1, unit: "can", category: "pantry" },
      { name: "curry powder", quantity: 2, unit: "tbsp", category: "spice" },
      { name: "Scotch bonnet pepper", quantity: 1, unit: "", category: "produce" }
    ],
    instructions: ["Simmer breadfruit in coconut curry.", "Add shrimp near the end.", "Serve with lime and herbs."]
  },
  {
    id: "bajan-okra-fish-stew",
    name: "Okra Fish Stew",
    description: "Fresh fish stew with okra, tomato, lime, and Bajan seasoning.",
    mealType: ["lunch", "dinner"],
    proteins: ["fish"],
    cuisine: "Bajan",
    prepTime: 15,
    cookTime: 25,
    servings: 4,
    difficulty: "easy",
    ingredients: [
      { name: "white fish fillets", quantity: 1.5, unit: "lb", category: "protein" },
      { name: "okra", quantity: 12, unit: "", category: "produce" },
      { name: "tomato", quantity: 3, unit: "", category: "produce" },
      { name: "Bajan seasoning", quantity: 2, unit: "tbsp", category: "spice" },
      { name: "lime", quantity: 2, unit: "", category: "produce" }
    ],
    instructions: ["Simmer tomato, okra, and seasoning.", "Add fish and cook gently.", "Finish with lime."]
  }
];

export interface MealProfile {
  id: MealProfileId;
  name: string;
  description: string;
  recipes: Recipe[];
  inheritedRecipeIds?: string[];
  boosts?: {
    cuisines?: string[];
    proteins?: Partial<Record<Recipe["proteins"][number], number>>;
    keywords?: Record<string, number>;
    penalties?: Record<string, number>;
  };
}

export const MEAL_PROFILES: MealProfile[] = [
  {
    id: "home",
    name: "Home",
    description: "Current family recipe repository and default LA planning behavior.",
    recipes: homeRecipes
  },
  {
    id: "bajan",
    name: "Bajan",
    description: "Barbados-focused planning near Massy Holetown: Bajan local meals plus feasible Home overlap, with fish/chicken/lamb favored and ground-beef-heavy meals down-ranked.",
    recipes: bajanRecipes,
    inheritedRecipeIds: homeRecipes.map((recipe) => recipe.id),
    boosts: {
      cuisines: ["Bajan", "Caribbean"],
      proteins: { fish: 28, chicken: 18, pork: 4, "red-meat": 2 },
      keywords: {
        lamb: 16,
        fish: 12,
        mahi: 16,
        snapper: 16,
        plantain: 18,
        breadfruit: 18,
        christophine: 18,
        pumpkin: 10,
        saltfish: 18,
        roti: 16,
        coconut: 8,
        lime: 6,
        okra: 8,
        cassava: 8,
        "sweet potato": 6,
        chicken: 8
      },
      penalties: {
        "ground beef": -45,
        hamburger: -45,
        meatball: -20,
        bolognese: -20
      }
    }
  }
];

export const DEFAULT_MEAL_PROFILE_ID: MealProfileId = "home";

export function normalizeMealProfileId(value: unknown): MealProfileId {
  return MEAL_PROFILES.some((profile) => profile.id === value)
    ? value as MealProfileId
    : DEFAULT_MEAL_PROFILE_ID;
}

export function getMealProfile(profileId: unknown): MealProfile {
  const normalized = normalizeMealProfileId(profileId);
  return MEAL_PROFILES.find((profile) => profile.id === normalized) ?? MEAL_PROFILES[0];
}

export function getProfileRecipes(profileId: unknown = DEFAULT_MEAL_PROFILE_ID): Recipe[] {
  const profile = getMealProfile(profileId);

  if (profile.id === "home") {
    return homeRecipes;
  }

  // Location profiles inherit Home so mainstream Massy Holetown-available meals remain feasible,
  // while profile scoring nudges generation toward local candidates.
  return [...profile.recipes, ...homeRecipes];
}

export function getAllProfileRecipes(): Recipe[] {
  const byId = new Map<string, Recipe>();

  MEAL_PROFILES.forEach((profile) => {
    getProfileRecipes(profile.id).forEach((recipe) => byId.set(recipe.id, recipe));
  });

  return [...byId.values()];
}

export function scoreRecipeForMealProfile(recipe: Recipe, profileId: unknown): number {
  const profile = getMealProfile(profileId);

  if (profile.id === "home") {
    return 0;
  }

  const boosts = profile.boosts;
  const text = [recipe.name, recipe.description, recipe.cuisine, ...recipe.ingredients.map((ingredient) => ingredient.name)]
    .join(" ")
    .toLowerCase();
  let score = 0;

  if (boosts?.cuisines?.some((cuisine) => recipe.cuisine.toLowerCase().includes(cuisine.toLowerCase()))) {
    score += 36;
  }

  recipe.proteins.forEach((protein) => {
    score += boosts?.proteins?.[protein] ?? 0;
  });

  Object.entries(boosts?.keywords ?? {}).forEach(([keyword, value]) => {
    if (text.includes(keyword.toLowerCase())) {
      score += value;
    }
  });

  Object.entries(boosts?.penalties ?? {}).forEach(([keyword, value]) => {
    if (text.includes(keyword.toLowerCase())) {
      score += value;
    }
  });

  return score;
}
