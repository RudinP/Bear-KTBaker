export const PROFILE_RESOURCE_IDS = [
  'main.profile.01',
  'main.profile.02',
  'main.profile.03',
] as const;

export type ProfileResourceId = typeof PROFILE_RESOURCE_IDS[number];
