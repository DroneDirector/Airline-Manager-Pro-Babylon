#!/usr/bin/env bash
# Prepares the Android project from app.config.json: landscape, full screen, name, id, version, icon and the fixed
# test key (so every new APK installs over the old one and keeps its settings).
set -euo pipefail
cd "$(dirname "$0")/.."
NAME=$(node -p "require('./app.config.json').appName")
VERSION=$(node -p "require('./app.config.json').version")
CODE=$(node -p "require('./app.config.json').versionCode")
APPID=$(node -p "require('./app.config.json').appId")
[ -d android ] || npx cap add android
npx cap sync android
MAN=android/app/src/main/AndroidManifest.xml
grep -q 'screenOrientation' "$MAN" || sed -i 's/<activity/<activity android:screenOrientation="sensorLandscape"/' "$MAN"
grep -q 'largeHeap' "$MAN" || sed -i 's/<application/<application android:largeHeap="true"/' "$MAN"
grep -q 'appCategory' "$MAN" || sed -i 's/<application/<application android:appCategory="game" android:isGame="true"/' "$MAN"
# game controllers (PlayStation and others) are used by the app itself
grep -q 'android.hardware.gamepad' "$MAN" || sed -i 's|</manifest>|    <uses-feature android:name="android.hardware.gamepad" android:required="false" />\n</manifest>|' "$MAN"
JDIR="android/app/src/main/java/$(echo "$APPID" | tr '.' '/')"
mkdir -p "$JDIR"
sed "s/__PACKAGE__/${APPID}/" scripts/android/MainActivity.java > "$JDIR/MainActivity.java"
for J in AppExitPlugin AppUpdatePlugin PhotoSavePlugin UpdatedReceiver; do sed "s/__PACKAGE__/${APPID}/" "scripts/android/$J.java" > "$JDIR/$J.java"; done
# updates from inside the game: permission to install them, and opening again by itself after one has installed
for P in REQUEST_INSTALL_PACKAGES UPDATE_PACKAGES_WITHOUT_USER_ACTION; do grep -q "permission.$P" "$MAN" || sed -i "s|</manifest>|    <uses-permission android:name=\"android.permission.$P\" />\n</manifest>|" "$MAN"; done
grep -q 'UpdatedReceiver' "$MAN" || sed -i 's|</application>|    <receiver android:name=".UpdatedReceiver" android:exported="false"><intent-filter><action android:name="android.intent.action.MY_PACKAGE_REPLACED" /></intent-filter></receiver>\n    </application>|' "$MAN"
RES=android/app/src/main/res
for d in mdpi hdpi xhdpi xxhdpi xxxhdpi; do mkdir -p "$RES/mipmap-$d"; cp scripts/android/res/mipmap-$d/ic_launcher*.png "$RES/mipmap-$d/"; done
mkdir -p "$RES/mipmap-anydpi-v26"; cp scripts/android/res/mipmap-anydpi-v26/ic_launcher*.xml "$RES/mipmap-anydpi-v26/"
cp scripts/android/res/values/ic_launcher_background.xml "$RES/values/"
GR=android/app/build.gradle
if ! grep -q 'airlinemanagerpro-test' "$GR"; then
  PW=$(cat signing/test-signing.password)
  sed -i "0,/^android {/s||android {\n    signingConfigs {\n        debug {\n            storeFile file('../../signing/test-signing.jks')\n            storePassword '${PW}'\n            keyAlias 'airlinemanagerpro-test'\n            keyPassword '${PW}'\n        }\n    }|" "$GR"
fi
sed -i "s/versionCode [0-9]*/versionCode ${CODE}/; s/versionName \"[^\"]*\"/versionName \"${VERSION}\"/" "$GR"
sed -i "s|<string name=\"app_name\">.*</string>|<string name=\"app_name\">${NAME}</string>|; s|<string name=\"title_activity_main\">.*</string>|<string name=\"title_activity_main\">${NAME}</string>|" android/app/src/main/res/values/strings.xml
echo "Android project ready: ${NAME} ${VERSION} (${CODE})"
