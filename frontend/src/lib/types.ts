// Tipe-tipe ini sengaja dicocokkan persis dengan struktur JSON
// yang dikembalikan Laravel, supaya autocomplete TypeScript akurat.

export interface User {
  id: number;
  name: string;
  email: string;
  email_verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active";

export type Goal = "lose_weight" | "maintain" | "gain_muscle";

export type MineralType = "natrium" | "kalium" | "magnesium";

export interface MineralEntry {
  id: string;
  type: MineralType;
  amount_mg: number;
  source: string;
  consumed_at: string;
}

export interface HealthProfile {
  id: number;
  user_id: number;
  age: number;
  gender: "male" | "female";
  weight_kg: number;
  height_cm: number;
  activity_level: ActivityLevel;
  goal: Goal;
  bmr?: number;
  tdee?: number;
  calorie_target?: number;
  created_at: string;
  updated_at: string;
}

export interface FoodMicronutrients {
  natrium_mg?: number;
  kalium_mg?: number;
  magnesium_mg?: number;
}

export interface FoodItem {
  id: number;
  nutrition_log_id: number;
  food_name: string;
  image_url: string | null;
  calories: number;
  carbs_g: string;
  protein_g: string;
  fat_g: string;
  portion_estimate: string | null;
  source_type: "SCAN" | "MANUAL" | "RECIPE";
  created_at: string;
  micronutrients?: FoodMicronutrients | null;
}

export interface NutritionLog {
  id: number;
  user_id: number;
  date: string;
  total_calories: number;
  carbs_g: string;
  protein_g: string;
  fat_g: string;
  water_intake_ml: number;
  food_items?: FoodItem[];
}

export interface HealthInsight {
  id: number;
  user_id: number;
  insight_text: string;
  category: "WARNING" | "TIP" | "PRAISE";
  period_start: string | null;
  period_end: string | null;
  created_at: string;
}
