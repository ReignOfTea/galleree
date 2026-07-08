import '../models/gallery_meta.dart';

class TagFragment {
  const TagFragment({
    required this.fragment,
    required this.fragmentStart,
    required this.fragmentEnd,
  });

  final String fragment;
  final int fragmentStart;
  final int fragmentEnd;
}

TagFragment tagFragmentAt(String value, int caret) {
  final safeCaret = caret.clamp(0, value.length);
  var start = safeCaret;
  while (start > 0 && value[start - 1] != ',') {
    start--;
  }
  while (start < value.length && value[start] == ' ') {
    start++;
  }
  var end = safeCaret;
  while (end < value.length && value[end] != ',') {
    end++;
  }
  return TagFragment(
    fragment: value.substring(start, end),
    fragmentStart: start,
    fragmentEnd: end,
  );
}

({String value, int caret}) applySuggestedTag(String value, int caret, String tag) {
  final frag = tagFragmentAt(value, caret);
  final before = value.substring(0, frag.fragmentStart);
  final after = frag.fragmentEnd < value.length
      ? value.substring(frag.fragmentEnd).replaceFirst(RegExp(r'^,\s*'), '')
      : '';
  final newValue = after.isNotEmpty ? '$before$tag, $after' : '$before$tag, ';
  final newCaret = before.length + tag.length + 2;
  return (value: newValue, caret: newCaret);
}

List<String> filterTagSuggestions(
  List<String> knownTags,
  String value,
  int caret, {
  int limit = 8,
}) {
  final frag = tagFragmentAt(value, caret);
  final needle = frag.fragment.trim().toLowerCase();
  final used = parseTagsInput(value).map((t) => t.toLowerCase()).toSet();
  final out = <String>[];
  for (final tag in knownTags) {
    final key = tag.toLowerCase();
    if (used.contains(key)) continue;
    if (needle.isNotEmpty && !key.startsWith(needle)) continue;
    out.add(tag);
    if (out.length >= limit) break;
  }
  return out;
}

List<String> normalizeKnownTags(List<String> tags) => normalizeGalleryTags(tags);
