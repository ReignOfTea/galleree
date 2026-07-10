/// Compare dotted semver strings (e.g. 1.0.2 vs 1.0.10). Non-numeric parts become 0.
int compareAppSemver(String a, String b) {
  final pa = _parseSemverParts(a);
  final pb = _parseSemverParts(b);
  final len = pa.length > pb.length ? pa.length : pb.length;
  for (var i = 0; i < len; i++) {
    final va = i < pa.length ? pa[i] : 0;
    final vb = i < pb.length ? pb[i] : 0;
    if (va != vb) return va.compareTo(vb);
  }
  return 0;
}

bool isAppVersionOlder(String current, String latest) => compareAppSemver(current, latest) < 0;

List<int> _parseSemverParts(String value) {
  final trimmed = value.trim();
  if (trimmed.isEmpty) return const [0];
  return trimmed.split('.').map((part) {
    final match = RegExp(r'^\d+').firstMatch(part);
    return match == null ? 0 : int.parse(match.group(0)!);
  }).toList();
}
