import 'package:flutter_test/flutter_test.dart';
import 'package:gallery_uploader_android/utils/app_semver.dart';

void main() {
  test('compareAppSemver orders dotted versions', () {
    expect(compareAppSemver('1.0.2', '1.0.10'), lessThan(0));
    expect(compareAppSemver('1.0.10', '1.0.2'), greaterThan(0));
    expect(compareAppSemver('1.0.2', '1.0.2'), 0);
  });

  test('isAppVersionOlder only flags genuinely newer android versions', () {
    expect(isAppVersionOlder('1.0.2', '0.1.4'), isFalse);
    expect(isAppVersionOlder('1.0.2', '1.0.2'), isFalse);
    expect(isAppVersionOlder('1.0.1', '1.0.2'), isTrue);
  });
}
