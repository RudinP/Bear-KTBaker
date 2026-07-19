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
