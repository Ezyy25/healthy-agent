import { api } from "@/lib/api";
import { HealthProfile } from "@/lib/types";

const HYDRATION_ACTIVITY_BOOST: Record<
  HealthProfile["activity_level"],
  number
> = {
  sedentary: 0,
  light: 350,
  moderate: 650,
  active: 950,
  very_active: 1250,
};

export function getHydrationTargetMl(
  profile: Pick<HealthProfile, "weight_kg" | "activity_level"> | null,
): number {
  if (!profile) return 2000;
  const base = profile.weight_kg * 30;
  const boost = HYDRATION_ACTIVITY_BOOST[profile.activity_level];
  const target = Math.round(base + boost);
  return Math.min(4000, Math.max(1800, target));
}

/**
 * Helper khusus profil kesehatan (BMR/TDEE/target kalori).
 *
 * Route backend yang sudah dikonfirmasi lewat pengecekan langsung:
 *   GET  /api/v1/profile  -> baca profil
 *   POST /api/v1/profile  -> simpan profil
 *
 * Endpoint ini dipakai untuk profil baru maupun profil yang sudah ada.
 */

const PROFILE_PATH = "/v1/profile";

export async function getHealthProfile(token: string): Promise<HealthProfile> {
  return api.get<HealthProfile>(PROFILE_PATH, token);
}

export async function saveHealthProfile(
  payload: Omit<
    HealthProfile,
    | "id"
    | "user_id"
    | "created_at"
    | "updated_at"
    | "bmr"
    | "tdee"
    | "calorie_target"
  > &
    Partial<
      Pick<
        HealthProfile,
        | "id"
        | "user_id"
        | "created_at"
        | "updated_at"
        | "bmr"
        | "tdee"
        | "calorie_target"
      >
    >,
  token: string,
): Promise<HealthProfile> {
  return api.post<HealthProfile>(PROFILE_PATH, payload, token);
}
