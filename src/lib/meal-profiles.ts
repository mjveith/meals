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
    instructions: [
      "Pat the flying fish dry, then rub with Bajan seasoning and lime juice in a shallow dish. Let it sit for 10 minutes while you slice the lettuce, tomato, and salt bread rolls.",
      "Heat a large skillet over medium-high heat with a thin film of oil. Pan-fry the fish for 2 to 3 minutes per side, until lightly browned and opaque enough to flake with a fork.",
      "Warm the salt bread rolls in a dry skillet for 1 to 2 minutes, just until soft. Build the cutters with lettuce, tomato, hot fish, and pepper sauce so the bread stays tender but not soggy."
    ]
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
    instructions: [
      "Heat the oven to 425 F (220 C). Cut the sweet potatoes into wedges, toss with oil and salt on a sheet pan, and roast for 25 to 30 minutes until browned at the edges and tender inside.",
      "Pat the mahi mahi dry, then coat with paprika, thyme, minced Scotch bonnet, lime juice, and salt. Rest on a plate for 5 minutes so the seasoning clings.",
      "Heat a cast-iron skillet over high heat until it just starts to smoke. Sear the fish for 3 to 4 minutes per side, until the crust is dark and the center flakes without looking dry.",
      "Serve the blackened fish right away with the roasted sweet potato and extra lime."
    ]
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
    instructions: [
      "Peel the very ripe plantains and slice them on a bias into thick pieces, about 3/4 inch wide, so they stay soft and custardy.",
      "Heat the coconut oil in a nonstick skillet over medium-low heat. Fry the plantains for 3 to 4 minutes per side, turning gently, until deeply golden and sagging-soft in the center.",
      "Transfer to a paper towel-lined plate and finish with a tiny pinch of sea salt while warm. Serve when the edges are caramelized but the middle is still mushy and sweet."
    ]
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
    instructions: [
      "Mash the cooked pumpkin in a mixing bowl with brown sugar, cinnamon, nutmeg, and a pinch of salt until mostly smooth but still thick.",
      "Fold in the flour with a spoon until the batter is scoopable and holds a soft mound; add 1 tablespoon water only if it looks dry.",
      "Heat 1/4 inch oil in a skillet over medium heat. Fry spoonfuls for 2 to 3 minutes per side, until the fritters are browned, crisp at the edges, and tender in the center.",
      "Drain on paper towels and serve warm while the outside still has a light crust."
    ]
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
    instructions: [
      "Soak the saltfish in a bowl of cool water for 15 minutes, then drain, simmer in a small pot for 8 to 10 minutes, and flake it with a fork once cool enough to handle.",
      "In a mixing bowl, stir the saltfish with flour, sliced green onion, thyme, pepper sauce, and enough water to make a thick drop-batter.",
      "Heat 1/4 inch oil in a skillet over medium heat. Fry heaping spoonfuls for 2 to 3 minutes per side, until puffed, golden, and crisp outside.",
      "Drain on paper towels and serve while hot; the centers should be savory and moist, not doughy."
    ]
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
    instructions: [
      "Bring a large pot of salted water to a boil. Simmer peeled breadfruit pieces for 20 to 25 minutes, adding sliced okra for the last 8 minutes, until both are very tender.",
      "Drain, reserving 1 cup cooking water, then mash the breadfruit and okra in the pot over low heat. Stir firmly with a wooden spoon, adding splashes of water, until it turns thick, smooth, and stretchy like cou cou.",
      "Season the flying fish with Bajan seasoning and lime, then simmer it in a covered skillet with a little water or gravy base over medium-low heat for 5 to 7 minutes until opaque and flaky.",
      "Spoon the cou cou onto plates and top with the fish and pan juices while the texture is soft enough to mound."
    ]
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
    instructions: [
      "Heat the oven to 375 F (190 C). Halve the christophine and steam in a covered pot for 15 to 20 minutes, until a knife slides through easily.",
      "Scoop the flesh into a bowl, keeping the shells if you want to refill them. Mash with garlic, thyme, and most of the cheddar until creamy but still lightly textured.",
      "Spoon the mixture into a small baking dish or the shells, then top with breadcrumbs and the remaining cheese. Bake for 18 to 22 minutes until bubbling with a crisp golden top.",
      "Rest for 5 minutes before serving so the filling sets enough to scoop cleanly."
    ]
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
    instructions: [
      "Cut the chicken thighs and potatoes into bite-size pieces. Heat a Dutch oven or deep skillet over medium-high heat, add oil, and bloom the curry powder for 30 seconds until fragrant.",
      "Add the chicken and potatoes, stirring to coat, then add enough water to come halfway up the mixture. Cover and simmer over medium-low heat for 22 to 28 minutes, until the potatoes are tender and the chicken reaches 165 F (74 C).",
      "Uncover and simmer for 3 to 5 minutes more if needed, until the curry is saucy but not watery. Warm the roti skins in a dry skillet for 30 seconds per side.",
      "Fill each roti with curry and a spoonful of mango chutney, then fold tightly while the skins are still pliable."
    ]
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
    instructions: [
      "Cut the stew beef into small chunks and season with salt. Brown it in a Dutch oven over medium-high heat for 5 to 7 minutes, then stir in the curry powder until fragrant.",
      "Add diced potatoes and enough water to barely cover. Cover and simmer over low heat for 35 to 45 minutes, stirring occasionally, until the beef is tender and the potatoes thicken the curry.",
      "Uncover for the last 5 minutes if the sauce is loose; it should cling to a spoon. Warm the roti skins in a dry skillet for 30 seconds per side.",
      "Wrap the curry in the warm roti skins and serve with pepper sauce and chutney."
    ]
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
    instructions: [
      "Heat the oven to 400 F (205 C). Season the drumsticks with salt, pepper, and a little thyme, then roast on a sheet pan for 30 to 35 minutes until browned and 165 F (74 C) at the bone.",
      "While the chicken roasts, combine rice, drained pigeon peas, coconut milk, thyme, salt, and enough water to cook the rice in a saucepan. Bring to a simmer, cover, and cook on low for 18 minutes.",
      "Let the rice stand covered off the heat for 5 minutes, then fluff with a fork; it should be tender and lightly creamy, not wet.",
      "Serve the chicken over rice and peas with lime and pepper sauce."
    ]
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
    instructions: [
      "Cut the pork shoulder into 1 1/2-inch pieces and season with salt. Brown in a Dutch oven over medium-high heat for 6 to 8 minutes, turning until several sides are deeply colored.",
      "Add cassareep, thyme, Scotch bonnet, sweet potato chunks, and enough water to come halfway up the pork. Bring to a simmer, then cover and cook on low for 55 to 65 minutes.",
      "Uncover for the last 10 minutes if the stew needs thickening. It is ready when the pork yields to a fork and the sauce looks glossy and rich.",
      "Remove the Scotch bonnet before serving unless you want the stew very hot."
    ]
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
    instructions: [
      "Heat a grill or grill pan to medium-high and oil the grates. Pat the snapper dry, then season with Bajan seasoning, lime juice, and a little salt.",
      "Grill the snapper for 3 to 4 minutes per side, using a thin spatula to turn once, until grill marks show and the fish flakes at the thickest point.",
      "While the fish cooks, toss sliced cucumber with chopped cilantro, lime juice, and a pinch of salt in a bowl.",
      "Serve the fish hot with the cucumber herb salad so the crisp salad cuts the seasoning."
    ]
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
    instructions: [
      "Heat the oven to 375 F (190 C). Boil the macaroni in a large pot of salted water until just tender, 7 to 8 minutes, then drain well.",
      "Mix the macaroni with evaporated milk and cheddar in a baking dish. Bake for 25 to 30 minutes, until the edges bubble and the top is lightly browned.",
      "While the pie bakes, season the mahi mahi with Bajan seasoning. Pan-sear in a skillet over medium-high heat for 3 to 4 minutes per side, until opaque and flaky.",
      "Rest the macaroni pie for 5 minutes so it slices cleanly, then serve with the fish and pepper sauce."
    ]
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
    instructions: [
      "Simmer the pork shoulder in a covered pot of salted water over medium-low heat for 35 to 45 minutes, until tender enough to slice but not falling apart. Cool slightly, then cut into bite-size pieces.",
      "Toss sliced cucumber, lime juice, parsley, and a pinch of salt in a bowl, then fold in the pork. Chill for at least 20 minutes so the souse tastes bright and lightly pickled.",
      "Meanwhile, grate or mash the sweet potatoes into a small greased baking dish and bake at 375 F (190 C) for 30 to 35 minutes, until set and tender in the center.",
      "Serve the chilled pork souse with cucumber, extra lime, and warm sweet potato pudding."
    ]
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
    instructions: [
      "Combine rolled oats, coconut milk, cinnamon, a pinch of salt, and enough water to loosen in a saucepan. Bring to a gentle simmer over medium heat, stirring often.",
      "Cook for 6 to 8 minutes, lowering the heat if it bubbles hard, until the oats are creamy and thick enough to slowly fall from the spoon.",
      "Slice the guava and banana while the oats finish. Spoon the oats into bowls and top with the fruit just before serving so it stays fresh."
    ]
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
    instructions: [
      "Mix the flour with a pinch of salt and enough water to form a soft dough, then divide into small rounds. Let them rest for 5 minutes while you heat a skillet with 1/4 inch oil over medium heat.",
      "Pan-fry the bakes for 3 to 4 minutes per side, until puffed, golden, and cooked through with no raw dough in the center.",
      "In a nonstick skillet over medium-low heat, scramble or fry the eggs for 3 to 5 minutes until just set and still tender.",
      "Serve the warm bakes with eggs, sliced tomato, avocado, and pepper sauce."
    ]
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
    instructions: [
      "Chill the soursop pulp, bananas, and coconut milk before blending so the bowl sets thick without ice.",
      "Blend the soursop, banana, coconut milk, lime juice, and a pinch of salt for 30 to 45 seconds, stopping to scrape the blender if needed, until smooth and spoonable.",
      "Pour into bowls and top with toasted coconut just before serving. The texture should be thick enough to hold the topping on the surface."
    ]
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
    instructions: [
      "Heat the oven to 425 F (220 C). Cut peeled cassava into chunks, removing any tough center fibers, then toss with oil and salt on a sheet pan.",
      "Rub the chicken thighs with Bajan seasoning and place them on the pan with the cassava. Roast for 30 to 35 minutes, turning the cassava once, until the chicken reaches 165 F (74 C) and the cassava is browned and tender.",
      "Shred the cabbage into a bowl and toss with lime juice and a pinch of salt; let it sit for 10 minutes so it softens but keeps crunch.",
      "Build bowls with roasted cassava, chicken, lime cabbage, and pepper sauce."
    ]
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
    instructions: [
      "Slice the ripe plantains thickly and fry in a skillet over medium-low heat for 3 to 4 minutes per side, until caramelized and soft. Transfer to a plate and keep warm.",
      "Season the pork chops with salt. Heat a heavy skillet over medium-high heat and sear the chops for 4 to 5 minutes per side, until browned and just cooked through to 145 F (63 C).",
      "Lower the heat to medium, add tamarind concentrate, grated ginger, lime juice, and a splash of water. Simmer for 1 to 2 minutes, spooning the glaze over the pork until shiny and lightly sticky.",
      "Rest the pork for 3 minutes, then serve with the soft fried plantain."
    ]
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
    instructions: [
      "Peel and cube the breadfruit, then simmer it in a saucepan of salted water for 15 to 20 minutes until just tender. Drain and set aside.",
      "In a deep skillet over medium heat, bloom the curry powder in oil for 30 seconds, then add coconut milk, minced Scotch bonnet, and the breadfruit. Simmer for 5 to 7 minutes until the sauce lightly thickens.",
      "Add the shrimp and cook gently for 3 to 4 minutes, stirring once or twice, until they turn pink and just firm; do not boil hard or they will toughen.",
      "Finish with lime and herbs, and serve while the breadfruit is tender but still holds its shape."
    ]
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
    instructions: [
      "Heat a deep skillet over medium heat with a little oil. Add chopped tomato, sliced okra, Bajan seasoning, and a splash of water, then simmer for 8 to 10 minutes until the okra is tender and the tomatoes loosen into a sauce.",
      "Season the fish with lime and salt, then nestle it into the stew. Cover and cook over medium-low heat for 6 to 8 minutes, until the fish is opaque and flakes easily.",
      "Taste the sauce and brighten with more lime. Serve gently so the fish stays in pieces and the okra sauce remains silky."
    ]
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
