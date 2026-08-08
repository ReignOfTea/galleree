/// Keep in sync with `version` in pubspec.yaml (`1.0.4+5` → name `1.0.4`, build `5`).
const kAppVersion = '1.0.4';
const kAppBuildNumber = 5;

/// Display string for About / update UI.
String get kAppVersionLabel => '$kAppVersion ($kAppBuildNumber)';
