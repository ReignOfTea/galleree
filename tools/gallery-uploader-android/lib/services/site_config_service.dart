import 'dart:convert';
import 'dart:io';

import '../models/models.dart';
import 'app_storage.dart';

class SiteConfigService {
  SiteConfigDraft loadDraft(GalleryPaths paths) {
    final file = File(paths.siteJson);
    if (!file.existsSync()) return const SiteConfigDraft();
    try {
      final raw = jsonDecode(file.readAsStringSync()) as Map<String, dynamic>;
      return SiteConfigDraft(
        title: raw['title'] as String? ?? '',
        kicker: raw['kicker'] as String? ?? '',
        tagline: raw['tagline'] as String? ?? '',
        about: raw['about'] as String? ?? '',
        siteUrl: raw['siteUrl'] as String? ?? '',
        lang: raw['lang'] as String? ?? '',
        contactEmail: raw['contactEmail'] as String? ?? '',
        copyright: raw['copyright'] as String? ?? '',
      );
    } catch (_) {
      return const SiteConfigDraft();
    }
  }

  /// Merge form fields into existing site.json (keeps social, logo, labels, etc.).
  String saveDraft(GalleryPaths paths, SiteConfigDraft draft) {
    final file = File(paths.siteJson);
    Map<String, dynamic> base = {};
    if (file.existsSync()) {
      try {
        final parsed = jsonDecode(file.readAsStringSync());
        if (parsed is Map<String, dynamic>) base = parsed;
      } catch (_) {
        /* start fresh */
      }
    }

    final out = <String, dynamic>{...base, 'title': draft.title.trim().isEmpty ? 'Portfolio' : draft.title.trim()};
    _setOptionalString(out, 'kicker', draft.kicker);
    out['tagline'] = draft.tagline.trim();
    _setOptionalString(out, 'about', draft.about);
    _setOptionalString(out, 'siteUrl', draft.siteUrl);
    _setOptionalString(out, 'lang', draft.lang);
    _setOptionalString(out, 'contactEmail', draft.contactEmail);
    _setOptionalString(out, 'copyright', draft.copyright);

    final json = '${const JsonEncoder.withIndent('  ').convert(out)}\n';
    file.parent.createSync(recursive: true);
    file.writeAsStringSync(json);
    return 'public/site.json';
  }

  void _setOptionalString(Map<String, dynamic> out, String key, String value) {
    final t = value.trim();
    if (t.isEmpty) {
      out.remove(key);
    } else {
      out[key] = t;
    }
  }
}
