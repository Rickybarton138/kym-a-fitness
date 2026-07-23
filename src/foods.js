// Built-in common foods & drinks for instant type-search logging. Values are
// standard per-100g (or per-100ml for drinks): k=kcal, p=protein, c=carbs,
// f=fat; s=a sensible default portion in grammes/ml. The long tail of branded
// products is handled live by the food-search function (Open Food Facts).

export const FOODS = [
  // Meat, fish, eggs
  { n: 'Chicken breast, grilled', k: 165, p: 31, c: 0, f: 3.6, s: 150 },
  { n: 'Chicken thigh, cooked', k: 209, p: 26, c: 0, f: 11, s: 120 },
  { n: 'Turkey breast', k: 135, p: 30, c: 0, f: 1, s: 120 },
  { n: 'Beef mince, 5% cooked', k: 170, p: 26, c: 0, f: 7, s: 125 },
  { n: 'Beef steak, lean cooked', k: 210, p: 30, c: 0, f: 10, s: 150 },
  { n: 'Pork loin, cooked', k: 210, p: 29, c: 0, f: 10, s: 130 },
  { n: 'Bacon, cooked', k: 540, p: 37, c: 1.4, f: 42, s: 40 },
  { n: 'Sausage, pork cooked', k: 300, p: 18, c: 8, f: 22, s: 60 },
  { n: 'Ham, sliced', k: 145, p: 18, c: 1.5, f: 7, s: 40 },
  { n: 'Salmon, cooked', k: 208, p: 20, c: 0, f: 13, s: 130 },
  { n: 'Tuna, canned in water', k: 116, p: 26, c: 0, f: 1, s: 100 },
  { n: 'Cod, cooked', k: 105, p: 23, c: 0, f: 1, s: 130 },
  { n: 'Prawns, cooked', k: 99, p: 24, c: 0, f: 0.3, s: 100 },
  { n: 'Egg, whole', k: 143, p: 13, c: 1.1, f: 9.5, s: 50 },
  { n: 'Egg white', k: 52, p: 11, c: 0.7, f: 0.2, s: 33 },
  { n: 'Tofu, firm', k: 144, p: 17, c: 3, f: 9, s: 100 },

  // Dairy & alternatives
  { n: 'Milk, whole', k: 61, p: 3.2, c: 4.8, f: 3.3, s: 200 },
  { n: 'Milk, semi-skimmed', k: 47, p: 3.4, c: 4.8, f: 1.7, s: 200 },
  { n: 'Milk, skimmed', k: 34, p: 3.4, c: 5, f: 0.1, s: 200 },
  { n: 'Oat milk', k: 45, p: 1, c: 7, f: 1.5, s: 200 },
  { n: 'Greek yoghurt, 0% fat', k: 59, p: 10, c: 3.6, f: 0.4, s: 170 },
  { n: 'Greek yoghurt, full fat', k: 97, p: 9, c: 4, f: 5, s: 170 },
  { n: 'Natural yoghurt', k: 61, p: 3.5, c: 4.7, f: 3.3, s: 150 },
  { n: 'Cheddar cheese', k: 402, p: 25, c: 1.3, f: 33, s: 30 },
  { n: 'Mozzarella', k: 280, p: 22, c: 2.2, f: 22, s: 30 },
  { n: 'Cottage cheese', k: 98, p: 11, c: 3.4, f: 4.3, s: 100 },
  { n: 'Cream cheese', k: 342, p: 6, c: 4, f: 34, s: 30 },
  { n: 'Butter', k: 717, p: 0.9, c: 0.1, f: 81, s: 10 },
  { n: 'Whey protein powder', k: 400, p: 80, c: 8, f: 6, s: 30 },

  // Grains & carbs
  { n: 'White rice, cooked', k: 130, p: 2.7, c: 28, f: 0.3, s: 180 },
  { n: 'Brown rice, cooked', k: 111, p: 2.6, c: 23, f: 0.9, s: 180 },
  { n: 'Pasta, cooked', k: 158, p: 6, c: 31, f: 0.9, s: 180 },
  { n: 'Wholemeal pasta, cooked', k: 149, p: 6, c: 27, f: 1.5, s: 180 },
  { n: 'Potato, boiled', k: 87, p: 1.9, c: 20, f: 0.1, s: 200 },
  { n: 'Sweet potato, cooked', k: 90, p: 2, c: 21, f: 0.1, s: 180 },
  { n: 'Bread, white', k: 265, p: 9, c: 49, f: 3.2, s: 40 },
  { n: 'Bread, wholemeal', k: 247, p: 10, c: 41, f: 3, s: 40 },
  { n: 'Bagel', k: 250, p: 10, c: 48, f: 1.5, s: 90 },
  { n: 'Tortilla wrap', k: 310, p: 8, c: 50, f: 8, s: 60 },
  { n: 'Oats, rolled (dry)', k: 379, p: 13, c: 67, f: 7, s: 50 },
  { n: 'Weetabix', k: 362, p: 12, c: 69, f: 2, s: 38 },
  { n: 'Cornflakes', k: 357, p: 7, c: 84, f: 0.9, s: 30 },
  { n: 'Couscous, cooked', k: 112, p: 3.8, c: 23, f: 0.2, s: 150 },
  { n: 'Quinoa, cooked', k: 120, p: 4.4, c: 21, f: 1.9, s: 150 },

  // Legumes & veg
  { n: 'Baked beans', k: 78, p: 4.8, c: 13, f: 0.5, s: 200 },
  { n: 'Chickpeas, cooked', k: 164, p: 9, c: 27, f: 2.6, s: 120 },
  { n: 'Lentils, cooked', k: 116, p: 9, c: 20, f: 0.4, s: 150 },
  { n: 'Kidney beans, cooked', k: 127, p: 8.7, c: 22, f: 0.5, s: 120 },
  { n: 'Peas', k: 81, p: 5, c: 14, f: 0.4, s: 80 },
  { n: 'Broccoli', k: 34, p: 2.8, c: 7, f: 0.4, s: 80 },
  { n: 'Carrots', k: 41, p: 0.9, c: 10, f: 0.2, s: 80 },
  { n: 'Spinach', k: 23, p: 2.9, c: 3.6, f: 0.4, s: 80 },
  { n: 'Tomato', k: 18, p: 0.9, c: 3.9, f: 0.2, s: 100 },
  { n: 'Mixed salad', k: 20, p: 1.5, c: 3, f: 0.3, s: 80 },
  { n: 'Avocado', k: 160, p: 2, c: 9, f: 15, s: 100 },
  { n: 'Mushrooms', k: 22, p: 3.1, c: 3.3, f: 0.3, s: 80 },
  { n: 'Sweetcorn', k: 86, p: 3.3, c: 19, f: 1.2, s: 80 },

  // Fruit
  { n: 'Banana', k: 89, p: 1.1, c: 23, f: 0.3, s: 120 },
  { n: 'Apple', k: 52, p: 0.3, c: 14, f: 0.2, s: 150 },
  { n: 'Orange', k: 47, p: 0.9, c: 12, f: 0.1, s: 130 },
  { n: 'Strawberries', k: 33, p: 0.7, c: 8, f: 0.3, s: 100 },
  { n: 'Blueberries', k: 57, p: 0.7, c: 14, f: 0.3, s: 80 },
  { n: 'Grapes', k: 69, p: 0.7, c: 18, f: 0.2, s: 100 },
  { n: 'Pineapple', k: 50, p: 0.5, c: 13, f: 0.1, s: 100 },
  { n: 'Mango', k: 60, p: 0.8, c: 15, f: 0.4, s: 120 },
  { n: 'Raisins', k: 299, p: 3, c: 79, f: 0.5, s: 30 },
  { n: 'Dates', k: 277, p: 1.8, c: 75, f: 0.2, s: 30 },

  // Nuts, seeds, fats
  { n: 'Almonds', k: 579, p: 21, c: 22, f: 50, s: 30 },
  { n: 'Peanuts', k: 567, p: 26, c: 16, f: 49, s: 30 },
  { n: 'Peanut butter', k: 588, p: 25, c: 20, f: 50, s: 20 },
  { n: 'Walnuts', k: 654, p: 15, c: 14, f: 65, s: 30 },
  { n: 'Cashews', k: 553, p: 18, c: 30, f: 44, s: 30 },
  { n: 'Chia seeds', k: 486, p: 17, c: 42, f: 31, s: 15 },
  { n: 'Olive oil', k: 884, p: 0, c: 0, f: 100, s: 15 },

  // Snacks & sweets
  { n: 'Milk chocolate', k: 535, p: 7.6, c: 59, f: 30, s: 30 },
  { n: 'Dark chocolate', k: 546, p: 5, c: 61, f: 31, s: 30 },
  { n: 'Crisps', k: 536, p: 7, c: 53, f: 34, s: 25 },
  { n: 'Digestive biscuit', k: 480, p: 6.5, c: 62, f: 21, s: 15 },
  { n: 'Protein bar', k: 350, p: 30, c: 35, f: 8, s: 60 },
  { n: 'Cereal bar', k: 380, p: 5, c: 70, f: 8, s: 30 },
  { n: 'Ice cream', k: 207, p: 3.5, c: 24, f: 11, s: 60 },
  { n: 'Flapjack', k: 450, p: 5, c: 60, f: 20, s: 60 },

  // Meals & misc
  { n: 'Pizza, cheese', k: 266, p: 11, c: 33, f: 10, s: 125 },
  { n: 'Beef burger (patty & bun)', k: 250, p: 15, c: 24, f: 11, s: 200 },
  { n: 'Chicken curry', k: 150, p: 10, c: 8, f: 8, s: 350 },
  { n: 'Scrambled eggs', k: 148, p: 10, c: 1.6, f: 11, s: 120 },
  { n: 'Porridge (made with milk)', k: 90, p: 4, c: 12, f: 3, s: 250 },
  { n: 'Hummus', k: 166, p: 8, c: 14, f: 10, s: 40 },
  { n: 'Vegetable soup', k: 45, p: 1.5, c: 7, f: 1.2, s: 300 },

  // Drinks (per 100ml)
  { n: 'Orange juice', k: 45, p: 0.7, c: 10, f: 0.2, s: 200 },
  { n: 'Apple juice', k: 46, p: 0.1, c: 11, f: 0.1, s: 200 },
  { n: 'Cola', k: 42, p: 0, c: 10.6, f: 0, s: 330 },
  { n: 'Diet cola', k: 0.4, p: 0, c: 0, f: 0, s: 330 },
  { n: 'Sports drink', k: 28, p: 0, c: 6.4, f: 0, s: 500 },
  { n: 'Energy drink', k: 45, p: 0, c: 11, f: 0, s: 250 },
  { n: 'Beer (lager)', k: 43, p: 0.5, c: 3.6, f: 0, s: 330 },
  { n: 'Red wine', k: 85, p: 0.1, c: 2.6, f: 0, s: 175 },
  { n: 'White wine', k: 82, p: 0.1, c: 2.6, f: 0, s: 175 },
  { n: 'Coffee, black', k: 2, p: 0.1, c: 0, f: 0, s: 250 },
  { n: 'Latte (whole milk)', k: 60, p: 3.2, c: 4.8, f: 3.3, s: 250 },
  { n: 'Tea with milk', k: 13, p: 0.7, c: 1, f: 0.5, s: 250 },
  { n: 'Coconut water', k: 19, p: 0.7, c: 3.7, f: 0.2, s: 250 },
  { n: 'Fruit smoothie', k: 55, p: 1, c: 13, f: 0.3, s: 250 },
]

export function searchFoods(q, limit = 12) {
  const t = q.trim().toLowerCase()
  if (!t) return []
  const starts = [], contains = []
  for (const f of FOODS) {
    const name = f.n.toLowerCase()
    if (name.startsWith(t)) starts.push(f)
    else if (name.includes(t)) contains.push(f)
  }
  return [...starts, ...contains].slice(0, limit)
}
