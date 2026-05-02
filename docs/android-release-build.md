# Android Release Build Notes

This repository now includes a GitHub Actions workflow at `.github/workflows/android-release.yml` that builds a signed Android release.

## Build outputs

- AAB: `android/app/build/outputs/bundle/release/app-release.aab`
- APK: `android/app/build/outputs/apk/release/app-release.apk`

## Required GitHub secrets

Add these repository secrets before running the workflow:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

## Keystore notes

- Generate a private upload keystore with `keytool`.
- Keep the keystore file out of git.
- Store the keystore file content as base64 in `ANDROID_KEYSTORE_BASE64`.
- The store password and key password can be the same, but keep both secrets configured separately.
- The alias must match the alias used when the keystore was created.

## Build behavior

- If the release signing secrets are present, the release build uses that keystore.
- If the secrets are missing, the app still falls back to the debug keystore for local builds.
- The workflow fails early if the required secrets are not available.
- Use JDK 17 for Android release builds. The GitHub Actions workflow sets this automatically.

## Local release build command

From the project root:

```bash
cd android
./gradlew clean bundleRelease assembleRelease \
  -PMYAPP_UPLOAD_STORE_FILE=release-upload.keystore \
  -PMYAPP_UPLOAD_STORE_PASSWORD=your-store-password \
  -PMYAPP_UPLOAD_KEY_ALIAS=your-key-alias \
  -PMYAPP_UPLOAD_KEY_PASSWORD=your-key-password
```
