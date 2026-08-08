import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers/app_controller.dart';
import '../models/models.dart';
import '../services/app_storage.dart';
import 'about_screen.dart';
import 'settings_screen.dart';
import '../widgets/batch_edit_bar.dart';
import '../widgets/bulk_title_bar.dart';
import '../widgets/display_preview_dialog.dart';
import '../widgets/onboarding_hint_card.dart';
import '../widgets/photo_accordion_list.dart';
import '../widgets/photo_compact_list.dart';
import '../widgets/photo_detail_pane.dart';
import '../widgets/photo_master_list.dart';
import '../widgets/publish_panel.dart';
import '../widgets/queue_toolbar.dart';
import '../widgets/registry_create_dialog.dart';
import '../widgets/registry_lists_panel.dart';
import '../widgets/session_defaults_card.dart';
import '../widgets/site_config_panel.dart';

enum HomeSection { upload, defaults, registries, site, publish }

class HomeShell extends ConsumerStatefulWidget {
  const HomeShell({super.key});

  @override
  ConsumerState<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends ConsumerState<HomeShell> {
  HomeSection _section = HomeSection.upload;
  bool _showStatus = true;
  String? _expandedCompactRowId;
  bool _showUploadHint = true;
  bool _uploadTabMounted = true;

  @override
  void initState() {
    super.initState();
    _loadUploadHint();
  }

  Future<void> _loadUploadHint() async {
    final dismissed = await AppStorage().isOnboardingDismissed('onboarding_upload_dismissed');
    if (!mounted) return;
    if (dismissed) setState(() => _showUploadHint = false);
  }

  Future<void> _pickPhotos() async {
    final result = await FilePicker.platform.pickFiles(
      allowMultiple: true,
      type: FileType.image,
    );
    if (result == null) return;
    final paths = result.paths.whereType<String>().toList();
    await ref.read(appControllerProvider.notifier).addPhotos(paths);
  }

  Future<void> _discardDraft() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Discard draft?'),
        content: const Text(
          'This clears the photo queue and commit note on this device. Autosaved draft will be deleted.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Discard')),
        ],
      ),
    );
    if (ok == true) {
      await ref.read(appControllerProvider.notifier).discardDraft();
    }
  }

  void _openDisplayPreview(List<UploadRow> rows, {String? startRowId}) {
    if (rows.isEmpty) return;
    var index = 0;
    if (startRowId != null) {
      final i = rows.indexWhere((r) => r.id == startRowId);
      if (i >= 0) index = i;
    }
    showDisplayPreviewDialog(context, rows: rows, startIndex: index);
  }

  Widget _queueList({
    required AppState state,
    required AppController notifier,
    required double listWidth,
    required bool splitDetail,
  }) {
    if (state.rows.isEmpty) {
      return UploadEmptyState(
        busy: state.busy,
        onAddPhotos: _pickPhotos,
        onAddFolder: notifier.addFolder,
      );
    }

    final common = (
      rows: state.rows,
      selectedId: state.selectedRowId,
      selectedIds: state.selectedRowIds,
      onSelect: notifier.selectRow,
      onToggleSelect: notifier.toggleRowSelected,
      onRemove: notifier.removeRow,
    );

    if (state.queueViewMode == QueueViewMode.compact) {
      return PhotoCompactList(
        rows: common.rows,
        selectedId: common.selectedId,
        selectedIds: common.selectedIds,
        expandedId: _expandedCompactRowId,
        onSelect: common.onSelect,
        onToggleSelect: common.onToggleSelect,
        onExpand: (id) => setState(() => _expandedCompactRowId = id),
        onRemove: common.onRemove,
        onChanged: (row) => notifier.updateRow(row.id, (_) => row),
      );
    }

    if (splitDetail) {
      return PhotoMasterList(
        rows: common.rows,
        selectedId: common.selectedId,
        selectedIds: common.selectedIds,
        onSelect: common.onSelect,
        onToggleSelect: common.onToggleSelect,
        onRemove: common.onRemove,
      );
    }

    return PhotoAccordionList(
      rows: common.rows,
      selectedId: common.selectedId,
      selectedIds: common.selectedIds,
      registries: state.registries,
      knownTags: state.knownTags,
      onSelect: common.onSelect,
      onToggleSelect: common.onToggleSelect,
      onRemove: common.onRemove,
      onChanged: (row) => notifier.updateRow(row.id, (_) => row),
      onCreateRegistry: (kind) => _openRegistryDialog(
        RegistryModalRequest(kind: kind, rowId: state.selectedRow?.id),
      ),
    );
  }

  Widget _detailPane(AppState state, AppController notifier) {
    if (state.selectedRow == null) return _emptyDetail(context);
    return PhotoDetailPane(
      row: state.selectedRow!,
      registries: state.registries,
      knownTags: state.knownTags,
      onChanged: (updated) => notifier.updateRow(updated.id, (_) => updated),
      onCreateRegistry: (kind) => _openRegistryDialog(
        RegistryModalRequest(kind: kind, rowId: state.selectedRow!.id),
      ),
    );
  }

  Widget _buildUploadColumn({
    required AppState state,
    required AppController notifier,
    required bool useMasterDetail,
    required bool isSplitView,
    required double listWidth,
  }) {
    return Column(
      children: [
        if (state.pendingUpdate != null)
          MaterialBanner(
            content: Text(state.pendingUpdate!.bannerMessage),
            leading: const Icon(Icons.system_update_alt),
            actions: [
              if (Platform.isAndroid)
                FilledButton(
                  onPressed: state.busy ? null : notifier.installAppUpdate,
                  child: const Text('Install update'),
                ),
              TextButton(onPressed: notifier.dismissUpdateNotice, child: const Text('Later')),
            ],
          ),
        if (_showUploadHint && state.rows.isEmpty)
          OnboardingHintCard(
            title: 'Upload queue',
            body:
                'Your photo list and commit note autosave on this device until you publish or discard the draft.',
            storageKey: 'onboarding_upload_dismissed',
            onDismissed: () => setState(() => _showUploadHint = false),
          ),
        QueueToolbar(
          rowCount: state.rows.length,
          selectedCount: state.selectedRowIds.length,
          viewMode: state.queueViewMode,
          disabled: state.busy,
          onViewModeChanged: notifier.setQueueViewMode,
          onOpenDisplayPreview: () => _openDisplayPreview(
            state.rows,
            startRowId: state.selectedRowId,
          ),
          onSelectAll: notifier.selectAllRows,
          onClearSelection: notifier.clearRowSelection,
        ),
        BatchEditBar(
          rowCount: state.rows.length,
          selectedCount: state.selectedRowIds.length,
          registries: state.registries,
          knownTags: state.knownTags,
          disabled: state.busy,
          onApply: notifier.applyBatchEdit,
          onCopyFromFirst: notifier.copyFromFirst,
          onSelectAll: notifier.selectAllRows,
          onClearSelection: notifier.clearRowSelection,
        ),
        BulkTitleBar(
          rowCount: state.rows.length,
          selectedCount: state.selectedRowIds.length,
          disabled: state.busy,
          onApply: notifier.applyBulkTitle,
          onSortByCaptureDate: notifier.sortRowsByCaptureDate,
        ),
        Expanded(
          child: useMasterDetail
              ? Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    SizedBox(
                      width: listWidth,
                      child: _queueList(
                        state: state,
                        notifier: notifier,
                        listWidth: listWidth,
                        splitDetail: true,
                      ),
                    ),
                    const VerticalDivider(width: 1),
                    Expanded(child: _detailPane(state, notifier)),
                  ],
                )
              : state.selectedRow != null &&
                      !isSplitView &&
                      state.queueViewMode != QueueViewMode.accordion
                  ? PhotoDetailPane(
                      row: state.selectedRow!,
                      registries: state.registries,
                      knownTags: state.knownTags,
                      onChanged: (updated) => notifier.updateRow(updated.id, (_) => updated),
                      onBack: () => notifier.selectRow(null),
                      onCreateRegistry: (kind) => _openRegistryDialog(
                        RegistryModalRequest(kind: kind, rowId: state.selectedRow!.id),
                      ),
                    )
                  : _queueList(
                      state: state,
                      notifier: notifier,
                      listWidth: listWidth,
                      splitDetail: false,
                    ),
        ),
      ],
    );
  }

  Future<void> _openRegistryDialog(RegistryModalRequest request) async {
    final notifier = ref.read(appControllerProvider.notifier);
    final state = ref.read(appControllerProvider);
    RegistryCollection? collection;
    RegistryEquipment? equipment;
    if (request.editSlug != null) {
      if (request.kind == RegistryKind.collection) {
        collection = notifier.registryCollectionForEdit(request.editSlug!);
      } else {
        equipment = notifier.registryEquipmentForEdit(request.kind, request.editSlug!);
      }
    }
    if (!mounted) return;
    await showDialog<bool>(
      context: context,
      builder: (context) => RegistryCreateDialog(
        request: request,
        registries: state.registries,
        coverCandidates: notifier.coverCandidates(),
        initialCollection: collection,
        initialEquipment: equipment,
        onSave: notifier.saveRegistry,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(appControllerProvider);
    final notifier = ref.read(appControllerProvider.notifier);
    final width = MediaQuery.sizeOf(context).width;
    final isWideTablet = width >= 840;
    final isSplitView = width >= 600;
    final listWidth = isWideTablet ? 360.0 : (isSplitView ? 280.0 : width);
    final useMasterDetail = isSplitView && state.queueViewMode != QueueViewMode.accordion;

    if (_section == HomeSection.upload) {
      _uploadTabMounted = true;
    }

    final uploadColumn = _buildUploadColumn(
      state: state,
      notifier: notifier,
      useMasterDetail: useMasterDetail,
      isSplitView: isSplitView,
      listWidth: listWidth,
    );

    final content = Stack(
      fit: StackFit.expand,
      children: [
        if (_uploadTabMounted)
          Offstage(
            offstage: _section != HomeSection.upload,
            child: uploadColumn,
          ),
        if (_section == HomeSection.defaults)
          SessionDefaultsCard(
            defaults: state.sessionDefaults,
            registries: state.registries,
            knownTags: state.knownTags,
            onChanged: notifier.updateSessionDefaults,
          ),
        if (_section == HomeSection.registries)
          RegistryListsPanel(
            registries: state.registries,
            onNew: (kind) => _openRegistryDialog(RegistryModalRequest(kind: kind)),
            onEdit: (kind, slug) =>
                _openRegistryDialog(RegistryModalRequest(kind: kind, editSlug: slug)),
          ),
        if (_section == HomeSection.site)
          SiteConfigPanel(
            draft: state.siteConfigDraft,
            busy: state.busy,
            onChanged: notifier.updateSiteConfigDraft,
            onSave: notifier.saveSiteConfig,
            onReload: notifier.reloadSiteConfig,
          ),
        if (_section == HomeSection.publish)
          PublishPanel(
            commitMessage: state.commitMessage,
            publishMode: state.publishMode,
            rowCount: state.rows.length,
            busy: state.busy,
            canCancel: state.operationCancelable,
            onCommitMessageChanged: notifier.setCommitMessage,
            onPublishModeChanged: notifier.setPublishMode,
            onPublish: notifier.uploadAndPublish,
            onSync: notifier.syncGallery,
            onCancel: notifier.cancelOperation,
          ),
      ],
    );

    final main = Scaffold(
      appBar: AppBar(
        title: const Text('Galleree Upload'),
        actions: [
          if (_section == HomeSection.upload) ...[
            PopupMenuButton<String>(
              enabled: !state.busy,
              onSelected: (value) async {
                switch (value) {
                  case 'folder':
                    await notifier.addFolder();
                  case 'discard':
                    await _discardDraft();
                }
              },
              itemBuilder: (context) => const [
                PopupMenuItem(value: 'folder', child: Text('Add folder…')),
                PopupMenuItem(value: 'discard', child: Text('Discard draft…')),
              ],
              icon: const Icon(Icons.more_vert),
            ),
            FilledButton.tonalIcon(
              onPressed: state.busy ? null : _pickPhotos,
              icon: const Icon(Icons.add_photo_alternate_outlined),
              label: const Text('Add photos'),
            ),
          ],
          const SizedBox(width: 8),
          IconButton(
            tooltip: 'Sync gallery',
            onPressed: state.busy ? null : notifier.syncGallery,
            icon: const Icon(Icons.cloud_download_outlined),
          ),
          IconButton(
            tooltip: 'About',
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute<void>(builder: (_) => const AboutScreen()),
            ),
            icon: const Icon(Icons.info_outline),
          ),
          IconButton(
            tooltip: 'Git settings',
            onPressed: state.busy
                ? null
                : () => Navigator.of(context).push(
                      MaterialPageRoute<void>(builder: (_) => const SettingsScreen()),
                    ),
            icon: const Icon(Icons.settings_outlined),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          OperationProgressBar(
            progress: state.progress,
            canCancel: state.operationCancelable,
            onCancel: notifier.cancelOperation,
          ),
          if (state.status != null && _showStatus)
            MaterialBanner(
              content: Text(state.status!),
              actions: [
                TextButton(
                  onPressed: () => setState(() => _showStatus = false),
                  child: const Text('Dismiss'),
                ),
              ],
            ),
          Expanded(child: content),
        ],
      ),
      bottomNavigationBar: isWideTablet
          ? null
          : NavigationBar(
              selectedIndex: _section.index,
              onDestinationSelected: (i) => setState(() => _section = HomeSection.values[i]),
              destinations: const [
                NavigationDestination(icon: Icon(Icons.photo_library_outlined), label: 'Upload'),
                NavigationDestination(icon: Icon(Icons.tune), label: 'Defaults'),
                NavigationDestination(icon: Icon(Icons.collections_bookmark_outlined), label: 'Registries'),
                NavigationDestination(icon: Icon(Icons.language_outlined), label: 'Site'),
                NavigationDestination(icon: Icon(Icons.cloud_upload_outlined), label: 'Publish'),
              ],
            ),
    );

    if (!isWideTablet) return main;

    return Row(
      children: [
        NavigationRail(
          selectedIndex: _section.index,
          onDestinationSelected: (i) => setState(() => _section = HomeSection.values[i]),
          labelType: NavigationRailLabelType.all,
          destinations: const [
            NavigationRailDestination(
              icon: Icon(Icons.photo_library_outlined),
              label: Text('Upload'),
            ),
            NavigationRailDestination(
              icon: Icon(Icons.tune),
              label: Text('Defaults'),
            ),
            NavigationRailDestination(
              icon: Icon(Icons.collections_bookmark_outlined),
              label: Text('Registries'),
            ),
            NavigationRailDestination(
              icon: Icon(Icons.language_outlined),
              label: Text('Site'),
            ),
            NavigationRailDestination(
              icon: Icon(Icons.cloud_upload_outlined),
              label: Text('Publish'),
            ),
          ],
        ),
        const VerticalDivider(width: 1),
        Expanded(child: main),
      ],
    );
  }

  Widget _emptyDetail(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.touch_app_outlined, size: 48, color: Theme.of(context).colorScheme.outline),
          const SizedBox(height: 12),
          Text('Select a photo to edit metadata', style: Theme.of(context).textTheme.titleMedium),
        ],
      ),
    );
  }
}
