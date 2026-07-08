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
  @override
  Widget build(BuildContext context) {
    final d = widget.draft;
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
        _field('Site title', d.title, (v) => widget.onChanged(d.copyWith(title: v))),
        _field('Kicker', d.kicker, (v) => widget.onChanged(d.copyWith(kicker: v))),
        _field('Tagline', d.tagline, (v) => widget.onChanged(d.copyWith(tagline: v))),
        _field('About', d.about, (v) => widget.onChanged(d.copyWith(about: v)), maxLines: 4),
        _field('Site URL', d.siteUrl, (v) => widget.onChanged(d.copyWith(siteUrl: v))),
        _field('Language (BCP 47)', d.lang, (v) => widget.onChanged(d.copyWith(lang: v))),
        _field('Contact email', d.contactEmail, (v) => widget.onChanged(d.copyWith(contactEmail: v))),
        _field('Footer copyright', d.copyright, (v) => widget.onChanged(d.copyWith(copyright: v))),
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
    String value,
    ValueChanged<String> onChanged, {
    int maxLines = 1,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextFormField(
        key: ValueKey('$label-$value'),
        initialValue: value,
        onChanged: onChanged,
        maxLines: maxLines,
        decoration: InputDecoration(labelText: label),
      ),
    );
  }
}
