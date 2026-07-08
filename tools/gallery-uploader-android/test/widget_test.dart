import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:gallery_uploader_android/main.dart';

void main() {
  testWidgets('App boots to setup when not configured', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: GallereeUploadApp()));
    await tester.pumpAndSettle();
    expect(find.text('Galleree Upload'), findsOneWidget);
    expect(find.text('Connect gallery project'), findsOneWidget);
  });
}
