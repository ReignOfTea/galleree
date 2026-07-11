import 'package:flutter/material.dart';

import '../models/models.dart';

class SiteConfigPanel extends StatefulWidget {
  const SiteConfigPanel({
    super.key,
    required this.draft,
    required this.busy,
    required this.onChanged,
    required this.onSave,
    required this.onReload,
  });

  final SiteConfigDraft draft;
  final bool busy;
  final ValueChanged<SiteConfigDraft> onChanged;
  final VoidCallback onSave;
  final VoidCallback onReload;

  @override
  State<SiteConfigPanel> createState() => _SiteConfigPanelState();
}

class _SiteConfigPanelState extends State<SiteConfigPanel> {
  late final TextEditingController _title;
  late final TextEditingController _kicker;
  late final TextEditingController _tagline;
  late final TextEditingController _about;
  late final TextEditingController _siteUrl;
  late final TextEditingController _lang;
  late final TextEditingController _contactEmail;
  late final TextEditingController _copyright;

  @override
  void initState() {
    super.initState();
    _title = TextEditingController(text: widget.draft.title);
    _kicker = TextEditingController(text: widget.draft.kicker);
    _tagline = TextEditingController(text: widget.draft.tagline);
    _about = TextEditingController(text: widget.draft.about);
    _siteUrl = TextEditingController(text: widget.draft.siteUrl);
    _lang = TextEditingController(text: widget.draft.lang);
    _contactEmail = TextEditingController(text: widget.draft.contactEmail);
    _copyright = TextEditingController(text: widget.draft.copyright);
  }

  @override
  void didUpdateWidget(SiteConfigPanel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.draft == widget.draft) return;
    _syncController(_title, widget.draft.title);
    _syncController(_kicker, widget.draft.kicker);
    _syncController(_tagline, widget.draft.tagline);
    _syncController(_about, widget.draft.about);
    _syncController(_siteUrl, widget.draft.siteUrl);
    _syncController(_lang, widget.draft.lang);
    _syncController(_contactEmail, widget.draft.contactEmail);
    _syncController(_copyright, widget.draft.copyright);
  }

  void _syncController(TextEditingController controller, String value) {
    if (controller.text == value) return;
    controller.value = controller.value.copyWith(
      text: value,
      selection: TextSelection.collapsed(offset: value.length),
      composing: TextRange.empty,
    );
  }

  @override
  void dispose() {
    _title.dispose();
    _kicker.dispose();
    _tagline.dispose();
    _about.dispose();
    _siteUrl.dispose();
    _lang.dispose();
    _contactEmail.dispose();
    _copyright.dispose();
    super.dispose();
  }

  SiteConfigDraft _currentDraft() {
    return SiteConfigDraft(
      title: _title.text,
      kicker: _kicker.text,
      tagline: _tagline.text,
      about: _about.text,
      siteUrl: _siteUrl.text,
      lang: _lang.text,
      contactEmail: _contactEmail.text,
      copyright: _copyright.text,
    );
  }

  void _emitDraft() => widget.onChanged(_currentDraft());

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        Text('Site settings', style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 8),
        Text(
          'Edits public/site.json in your local gallery copy. Logo, social links, and filter labels are kept when you save.',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
        ),
        const SizedBox(height: 20),
        _field('Site title', _title),
        _field('Kicker', _kicker),
        _field('Tagline', _tagline),
        _field('About', _about, maxLines: 4),
        _field('Site URL', _siteUrl),
        _field('Language (BCP 47)', _lang),
        _field('Contact email', _contactEmail),
        _field('Footer copyright', _copyright),
        const SizedBox(height: 16),
        Wrap(
          spacing: 12,
          children: [
            FilledButton(
              onPressed: widget.busy ? null : widget.onSave,
              child: const Text('Save site.json'),
            ),
            OutlinedButton(
              onPressed: widget.busy ? null : widget.onReload,
              child: const Text('Reload'),
            ),
          ],
        ),
      ],
    );
  }

  Widget _field(
    String label,
    TextEditingController controller, {
    int maxLines = 1,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextFormField(
        controller: controller,
        onChanged: (_) => _emitDraft(),
        maxLines: maxLines,
        decoration: InputDecoration(labelText: label),
      ),
    );
  }
}
