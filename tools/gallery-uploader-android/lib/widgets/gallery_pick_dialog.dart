import 'package:flutter/material.dart';

import '../models/models.dart';

Future<GalleryPhotoSummary?> showGalleryPickDialog(
  BuildContext context,
  List<GalleryPhotoSummary> photos,
) {
  return showDialog<GalleryPhotoSummary>(
    context: context,
    builder: (context) => _GalleryPickDialog(photos: photos),
  );
}

class _GalleryPickDialog extends StatefulWidget {
  const _GalleryPickDialog({required this.photos});

  final List<GalleryPhotoSummary> photos;

  @override
  State<_GalleryPickDialog> createState() => _GalleryPickDialogState();
}

class _GalleryPickDialogState extends State<_GalleryPickDialog> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final q = _query.trim().toLowerCase();
    final filtered = q.isEmpty
        ? widget.photos
        : widget.photos.where((p) => p.title.toLowerCase().contains(q) || p.id.contains(q)).toList();

    return AlertDialog(
      title: const Text('Edit gallery photo'),
      content: SizedBox(
        width: 480,
        height: 420,
        child: Column(
          children: [
            TextField(
              decoration: const InputDecoration(
                labelText: 'Search',
                prefixIcon: Icon(Icons.search),
              ),
              onChanged: (v) => setState(() => _query = v),
            ),
            const SizedBox(height: 12),
            Expanded(
              child: filtered.isEmpty
                  ? const Center(child: Text('No matching photos.'))
                  : ListView.builder(
                      itemCount: filtered.length,
                      itemBuilder: (context, index) {
                        final photo = filtered[index];
                        return ListTile(
                          title: Text(photo.title),
                          subtitle: Text(photo.id),
                          onTap: () => Navigator.pop(context, photo),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
      ],
    );
  }
}
