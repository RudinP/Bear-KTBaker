# Standalone Android export runtime

These files let the packaged Electron application export an installable APK
without Android Studio, an Android SDK, Gradle, Java, or a network connection
on the user's computer.

- `android.jar`: Android 15 / API 35 platform reference used by AAPT2 linking.
- `bin/darwin/aapt2`: official Android Build Tools 35.0.0 universal macOS binary
  (`arm64` and `x86_64`).
- `bin/win32/aapt2.exe`: official Android Build Tools 35.0.0 Windows x64 binary.
- `classes.dex`: resource-independent launcher compiled from `source/`.

The signing key is **not** bundled here. The app creates one local PKCS#12
identity in Electron's `userData` directory on first export and reuses it for
future updates.

Run `npm run verify:android-runtime` to validate the checked-in artifacts.
