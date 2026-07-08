import 'package:flutter_test/flutter_test.dart';
import 'package:gallery_uploader_android/utils/tag_suggest.dart';

void main() {
  test('filterTagSuggestions matches prefix and skips used tags', () {
    const known = ['Heritage', 'Statue', 'Street'];
    expect(
      filterTagSuggestions(known, 'Her', 3),
      ['Heritage'],
    );
    expect(
      filterTagSuggestions(known, 'Heritage, St', 12),
      ['Statue', 'Street'],
    );
    expect(filterTagSuggestions(known, 'Heritage, Statue', 17), isEmpty);
  });

  test('applySuggestedTag inserts tag at caret fragment', () {
    final next = applySuggestedTag('Her', 3, 'Heritage');
    expect(next.value, 'Heritage, ');
    expect(next.caret, 'Heritage, '.length);
  });
}
