import type {
  EditableElementId, Platform, ScreenId, ThemeProject,
} from '../../domain/theme/model';

export interface PreviewProps {
  project: ThemeProject;
  platform: Platform;
  screen: ScreenId;
  selected: EditableElementId;
  onSelect: (id: EditableElementId) => void;
  onNavigateScreen?: (screen: ScreenId) => void;
  previewScale?: number;
}

export const PROFILE_RESOURCE_IDS = [
  'main.profile.01',
  'main.profile.02',
  'main.profile.03',
] as const;

export type ProfileResourceId = typeof PROFILE_RESOURCE_IDS[number];
