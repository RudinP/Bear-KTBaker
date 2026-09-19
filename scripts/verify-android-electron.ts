import { app } from 'electron';
import { verifyStandaloneAndroidExport } from './verify-standalone-android-export';

void app.whenReady().then(async () => {
  try {
    await verifyStandaloneAndroidExport();
    app.exit(0);
  } catch (error) {
    // Keep the complete cause chain in CI output, including the failing check.
    console.error(error);
    app.exit(1);
  }
});
