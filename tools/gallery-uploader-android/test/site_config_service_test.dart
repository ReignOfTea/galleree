import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:gallery_uploader_android/models/models.dart';
import 'package:gallery_uploader_android/services/app_storage.dart';
import 'package:gallery_uploader_android/services/site_config_service.dart';

void main() {
  test('loadDraft reads site.json fields', () {
    final dir = Directory.systemTemp.createTempSync('galleree-site-');
    addTearDown(() => dir.deleteSync(recursive: true));

    final publicDir = Directory('${dir.path}/public')..createSync(recursive: true);
    File('${publicDir.path}/site.json').writeAsStringSync(
      jsonEncode({
        'title': 'Reign of Tea',
        'kicker': 'Photography',
        'tagline': 'Just go out and do stuff — it\'s free.',
        'about': 'Based in Manchester.',
        'siteUrl': 'https://gallery.reignoftea.com',
        'lang': 'en-GB',
        'contactEmail': 'reignoftea@gmail.com',
        'copyright': '© Reign of Tea',
      }),
    );

    final service = SiteConfigService();
    final draft = service.loadDraft(GalleryPaths(dir.path));

    expect(draft.title, 'Reign of Tea');
    expect(draft.kicker, 'Photography');
    expect(draft.tagline, 'Just go out and do stuff — it\'s free.');
    expect(draft.about, 'Based in Manchester.');
    expect(draft.siteUrl, 'https://gallery.reignoftea.com');
    expect(draft.lang, 'en-GB');
    expect(draft.contactEmail, 'reignoftea@gmail.com');
    expect(draft.copyright, '© Reign of Tea');
  });

  test('saveDraft merges editable fields and keeps other keys', () {
    final dir = Directory.systemTemp.createTempSync('galleree-site-save-');
    addTearDown(() => dir.deleteSync(recursive: true));

    final publicDir = Directory('${dir.path}/public')..createSync(recursive: true);
    File('${publicDir.path}/site.json').writeAsStringSync(
      jsonEncode({
        'title': 'Old title',
        'logo': 'logo.svg',
        'social': [{'label': 'X', 'url': 'https://x.com/example'}],
      }),
    );

    const draft = SiteConfigDraft(
      title: 'Reign of Tea',
      kicker: 'Photography',
      tagline: 'New tagline',
    );

    final service = SiteConfigService();
    service.saveDraft(GalleryPaths(dir.path), draft);

    final saved = jsonDecode(File('${publicDir.path}/site.json').readAsStringSync())
        as Map<String, dynamic>;
    expect(saved['title'], 'Reign of Tea');
    expect(saved['kicker'], 'Photography');
    expect(saved['tagline'], 'New tagline');
    expect(saved['logo'], 'logo.svg');
    expect(saved['social'], isA<List<dynamic>>());
  });
}
