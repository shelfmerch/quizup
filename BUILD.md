# QuizUp Android (Capacitor) Build & Deployment Guide

This document describes how to build, run, and publish the QuizUp Android application using Capacitor.

---

## 📋 Prerequisites

Before building the Android app, ensure you have:
1. **Node.js** (v18+ recommended) installed.
2. **Java Development Kit (JDK) 17** installed (required by Android Gradle Plugin 8+).
3. **Android SDK** (Android Studio is highly recommended to manage SDK tools easily).

---

## 🛠️ Step-by-Step Build Instructions

### 1. Build the Web Application
Compile the React frontend with production variables:
```bash
npm run build
```
This generates the optimized production bundle inside the `dist/` directory.

### 2. Synchronize Assets with Capacitor
Copy the compiled web assets and sync Capacitor plugins to the native Android project:
```bash
npx cap sync android
```

---

## 📲 Building the Android APK/AAB

Since you do not have Android Studio installed, you have two options:

### Option A: Command Line Interface (CLI) Gradle Build
If you have JDK 17 and Android SDK environment variables configured (`ANDROID_HOME`), you can build the APK/AAB directly from the terminal without opening Android Studio.

Navigate to the `android/` folder and use the Gradle wrapper:

*   **Build Debug APK** (For local testing):
    ```bash
    cd android
    ./gradlew assembleDebug
    ```
    The generated APK will be located at:
    `android/app/build/outputs/apk/debug/app-debug.apk`

*   **Build Release Bundle (AAB)** (For Play Store upload):
    ```bash
    cd android
    ./gradlew bundleRelease
    ```
    The generated AAB will be located at:
    `android/app/build/outputs/bundle/release/app-release.aab`

### Option B: Build using Android Studio (Recommended)
Installing Android Studio is highly recommended for building release packages, configuring signing keys, running emulators, and diagnosing device issues.

1.  Download and install [Android Studio](https://developer.android.com/studio).
2.  Open the Android project:
    ```bash
    npx cap open android
    ```
3.  Let Gradle sync finish.
4.  To run on an emulator or physical device, select your target device and click the **Run** button (green play icon).
5.  To generate a signed production build:
    *   Go to **Build** > **Generate Signed Bundle / APK...**
    *   Select **Android App Bundle** and click Next.
    *   Create or select an existing Keystore file, enter credentials, and generate the final `.aab` file.

---

## 🔑 Signing Release Builds via CLI

If you choose to sign your build via the CLI, you can create a release keystore:
```bash
keytool -genkey -v -keystore my-release-key.keystore -alias alias_name -keyalg RSA -keysize 2048 -validity 10000
```
Then, configure `android/app/build.gradle` to use the keystore or sign the AAB using `apksigner`/`jarsigner`.

---

## 📱 Native Android Features & Integrations

The QuizUp Android app is equipped with custom native integrations:

*   **System Status Bar**: Custom colored matching QuizUp red `#f65357` (dark theme icons).
*   **Splash Screen**: Configured to show the brand logo on a red background before fading out.
*   **Hardware Back Button**:
    *   Pressing Back on the Home Lobby minimizes the app instead of closing it abruptly.
    *   Pressing Back on other screens behaves like browser back navigation (`navigate(-1)`).
    *   Pressing Back during a Match (`/battle`) is ignored or managed inside the page to prevent accidental forfeits.
*   **Auto-Reconnection**: Reconnects to WebSockets automatically when the app resumes from the background or the device network recovers.
*   **Safe Areas**: Responsive layouts fitted around system notches and bottom bars via CSS `safe-area-inset` styles.
