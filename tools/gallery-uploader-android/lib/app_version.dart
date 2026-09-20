/// Keep in sync with `version` in pubspec.yaml (`1.0.5+6` → name `1.0.5`, build `6`).
const kAppVersion = '1.0.5';
const kAppBuildNumber = 6;

/// Display string for About / update UI.
String get kAppVersionLabel => '$kAppVersion ($kAppBuildNumber)';
