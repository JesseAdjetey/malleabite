import { isNative } from './platform';

type ImpactStyle = 'Heavy' | 'Medium' | 'Light';
type NotificationType = 'Success' | 'Warning' | 'Error';

const impact = (style: ImpactStyle) => {
  if (!isNative) return;
  import('@capacitor/haptics').then(({ Haptics, ImpactStyle }) => {
    Haptics.impact({ style: ImpactStyle[style] });
  }).catch(() => {});
};

const notification = (type: NotificationType) => {
  if (!isNative) return;
  import('@capacitor/haptics').then(({ Haptics, NotificationType }) => {
    Haptics.notification({ type: NotificationType[type] });
  }).catch(() => {});
};

const selection = () => {
  if (!isNative) return;
  import('@capacitor/haptics').then(({ Haptics }) => {
    Haptics.selectionChanged();
  }).catch(() => {});
};

export const haptics = {
  light: () => impact('Light'),
  medium: () => impact('Medium'),
  heavy: () => impact('Heavy'),
  selection,
  success: () => notification('Success'),
  warning: () => notification('Warning'),
  error: () => notification('Error'),
};
