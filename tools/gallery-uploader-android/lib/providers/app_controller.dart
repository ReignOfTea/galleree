import 'dart:async';
import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path/path.dart' as p;
import 'package:uuid/uuid.dart';

import '../models/gallery_meta.dart';
import '../models/models.dart';
import '../utils/batch_edit.dart' as batch;
import '../utils/bulk_title.dart';
import '../utils/registry_slug.dart';
import '../utils/tag_suggest.dart';
import '../utils/upload_row_meta.dart';
import '../services/app_storage.dart';
import '../services/display_preview_service.dart';
import '../services/draft_session_service.dart';
import '../services/gallery_services.dart';
import '../services/generate_assets_service.dart';
import '../services/github_gallery_service.dart';
import '../services/operation_cancel.dart';
import '../services/site_config_service.dart';
import '../services/uploader_update_service.dart';
import '../widgets/registry_create_dialog.dart';

final appStorageProvider = Provider<AppStorage>((ref) => AppStorage());
final githubServiceProvider = Provider<GitHubGalleryService>((ref) => GitHubGalleryService());
final registryServiceProvider = Provider<GalleryRegistryService>((ref) => GalleryRegistryService());
final stageServiceProvider = Provider<GalleryStageService>((ref) => GalleryStageService());
final exifServiceProvider = Provider<ExifService>((ref) => ExifService());
final generateAssetsServiceProvider =
    Provider<GenerateAssetsService>((ref) => GenerateAssetsService());
final draftSessionServiceProvider = Provider<DraftSessionService>((ref) => DraftSessionService());
final siteConfigServiceProvider = Provider<SiteConfigService>((ref) => SiteConfigService());
final displayPreviewServiceProvider = Provider<DisplayPreviewService>((ref) => DisplayPreviewService());
final uploaderUpdateServiceProvider = Provider<UploaderUpdateService>((ref) => UploaderUpdateService());

class AppState {
  AppState({
    this.config,
    this.hasPat = false,
    GalleryRegistries? registries,
    this.rows = const [],
    this.selectedRowId,
    this.selectedRowIds = const {},
    SessionDefaults? sessionDefaults,
    this.commitMessage = '',
    this.publishMode = PublishMode.standard,
    this.busy = false,
    this.status,
    this.progress,
    this.galleryTags = const [],
    this.galleryContentHashIndex = const {},
    SiteConfigDraft? siteConfigDraft,
    this.extraStagedPaths = const {},
    this.queueViewMode = QueueViewMode.compact,
    this.pendingUpdate,
    this.operationCancelable = false,
  })  : registries = registries ??
            GalleryRegistries(collections: [], cameras: [], lenses: []),
        sessionDefaults = sessionDefaults ?? SessionDefaults(),
        siteConfigDraft = siteConfigDraft ?? const SiteConfigDraft();

  final AppConfig? config;
  final bool hasPat;
  final GalleryRegistries registries;
  final List<UploadRow> rows;
  final String? selectedRowId;
  final Set<String> selectedRowIds;
  final SessionDefaults sessionDefaults;
  final String commitMessage;
  final PublishMode publishMode;
  final bool busy;
  final String? status;
  final String? progress;
  final List<String> galleryTags;
  final Map<String, GalleryContentHashHit> galleryContentHashIndex;
  final SiteConfigDraft siteConfigDraft;
  final Set<String> extraStagedPaths;
  final QueueViewMode queueViewMode;
  final UpdateCheckResult? pendingUpdate;
  final bool operationCancelable;

  AppState copyWith({
    AppConfig? config,
    bool? hasPat,
    GalleryRegistries? registries,
    List<UploadRow>? rows,
    String? selectedRowId,
    bool clearSelection = false,
    Set<String>? selectedRowIds,
    SessionDefaults? sessionDefaults,
    String? commitMessage,
    PublishMode? publishMode,
    bool? busy,
    String? status,
    String? progress,
    List<String>? galleryTags,
    Map<String, GalleryContentHashHit>? galleryContentHashIndex,
    SiteConfigDraft? siteConfigDraft,
    Set<String>? extraStagedPaths,
    QueueViewMode? queueViewMode,
    UpdateCheckResult? pendingUpdate,
    bool clearPendingUpdate = false,
    bool? operationCancelable,
    bool clearStatus = false,
    bool clearProgress = false,
  }) {
    return AppState(
      config: config ?? this.config,
      hasPat: hasPat ?? this.hasPat,
      registries: registries ?? this.registries,
      rows: rows ?? this.rows,
      selectedRowId: clearSelection ? null : (selectedRowId ?? this.selectedRowId),
      selectedRowIds: selectedRowIds ?? this.selectedRowIds,
      sessionDefaults: sessionDefaults ?? this.sessionDefaults,
      commitMessage: commitMessage ?? this.commitMessage,
      publishMode: publishMode ?? this.publishMode,
      busy: busy ?? this.busy,
      status: clearStatus ? null : (status ?? this.status),
      progress: clearProgress ? null : (progress ?? this.progress),
      galleryTags: galleryTags ?? this.galleryTags,
      galleryContentHashIndex: galleryContentHashIndex ?? this.galleryContentHashIndex,
      siteConfigDraft: siteConfigDraft ?? this.siteConfigDraft,
      extraStagedPaths: extraStagedPaths ?? this.extraStagedPaths,
      queueViewMode: queueViewMode ?? this.queueViewMode,
      pendingUpdate: clearPendingUpdate ? null : (pendingUpdate ?? this.pendingUpdate),
      operationCancelable: operationCancelable ?? this.operationCancelable,
    );
  }

  bool get isConfigured => config != null && hasPat;

  List<String> get knownTags {
    final merged = <String>[...galleryTags];
    for (final row in rows) {
      merged.addAll(parseTagsInput(row.tags));
    }
    merged.addAll(parseTagsInput(sessionDefaults.tags));
    return normalizeKnownTags(merged);
  }

  UploadRow? get selectedRow {
    if (selectedRowId == null) return null;
    for (final row in rows) {
      if (row.id == selectedRowId) return row;
    }
    return null;
  }
}

class AppController extends StateNotifier<AppState> {
  AppController(this._ref) : super(AppState()) {
    _bootstrap();
  }

  final Ref _ref;
  Future<void>? _refreshInFlight;
  Timer? _draftTimer;
  OperationCancelToken? _cancelToken;

  AppStorage get _storage => _ref.read(appStorageProvider);
  GitHubGalleryService get _github => _ref.read(githubServiceProvider);
  GalleryRegistryService get _registry => _ref.read(registryServiceProvider);
  GalleryStageService get _stage => _ref.read(stageServiceProvider);
  ExifService get _exif => _ref.read(exifServiceProvider);
  GenerateAssetsService get _generateAssets => _ref.read(generateAssetsServiceProvider);
  DraftSessionService get _drafts => _ref.read(draftSessionServiceProvider);
  SiteConfigService get _siteConfig => _ref.read(siteConfigServiceProvider);
  UploaderUpdateService get _updates => _ref.read(uploaderUpdateServiceProvider);

  Future<void> _bootstrap() async {
    final config = await _storage.loadConfig();
    final pat = await _storage.readPat();
    final defaults = await _storage.loadSessionDefaults();
    final commitMessage = await _storage.loadCommitMessage();
    final queueViewMode = await _storage.loadQueueViewMode();
    state = state.copyWith(
      config: config,
      hasPat: pat != null && pat.isNotEmpty,
      sessionDefaults: defaults,
      commitMessage: commitMessage,
      queueViewMode: queueViewMode,
    );
    if (config != null && pat != null && pat.isNotEmpty) {
      SchedulerBinding.instance.scheduleFrameCallback((_) {
        unawaited(_warmGalleryOnLaunch(config: config));
      });
    }
  }

  void _scheduleDraftSave() {
    _draftTimer?.cancel();
    _draftTimer = Timer(const Duration(milliseconds: 500), () {
      unawaited(_persistDraft());
    });
  }

  Future<void> _persistDraft() async {
    final config = state.config;
    if (config == null || state.rows.isEmpty) return;
    await _drafts.save(_drafts.buildSession(
      repoUrl: config.repoUrl,
      branch: config.branch,
      rows: state.rows,
      commitMessage: state.commitMessage,
      selectedRowIds: state.selectedRowIds,
      sessionDefaults: state.sessionDefaults,
    ));
  }

  Future<void> _tryRestoreDraft(AppConfig config) async {
    if (state.rows.isNotEmpty) return;
    final restored = await _drafts.loadForConfig(
      repoUrl: config.repoUrl,
      branch: config.branch,
    );
    if (restored == null || restored.rows.isEmpty) return;

    var msg = 'Restored ${restored.rows.length} photo(s) from your last session.';
    if (restored.skippedPaths.isNotEmpty) {
      msg += ' ${restored.skippedPaths.length} missing file(s) were skipped.';
    }

    state = state.copyWith(
      rows: restored.rows,
      selectedRowId: restored.rows.first.id,
      selectedRowIds: restored.selectedRowIds,
      commitMessage: restored.commitMessage.isEmpty ? state.commitMessage : restored.commitMessage,
      sessionDefaults: restored.sessionDefaults ?? state.sessionDefaults,
      status: msg,
    );
  }

  void _loadSiteConfigDraft(AppConfig config) {
    final draft = _siteConfig.loadDraft(GalleryPaths(config.workdir));
    state = state.copyWith(siteConfigDraft: draft);
  }

  void addExtraStagedPaths(Iterable<String> paths) {
    state = state.copyWith(
      extraStagedPaths: {...state.extraStagedPaths, ...paths},
    );
  }

  void _setProgress(String? message, {void Function(String message)? onProgress}) {
    if (message != null) onProgress?.call(message);
    if (message == state.progress) return;
    state = state.copyWith(progress: message);
  }

  void _clearProgress() {
    if (state.progress == null) return;
    state = state.copyWith(clearProgress: true);
  }

  Future<void> _warmGalleryOnLaunch({required AppConfig config}) async {
    await Future<void>.delayed(const Duration(milliseconds: 16));

    final paths = GalleryPaths(config.workdir);
    _loadSiteConfigDraft(config);

    if (!Directory(paths.metaDir).existsSync()) {
      state = state.copyWith(
        status: 'Gallery metadata not on this device yet. Tap the cloud icon to sync from GitHub.',
      );
      return;
    }

    try {
      final registries = loadGalleryRegistriesSync(config.workdir);
      final galleryTags = loadGalleryTagsSync(paths);
      final hashIndex = loadGalleryContentHashIndexSync(paths);
      state = state.copyWith(
        registries: registries,
        galleryTags: galleryTags,
        galleryContentHashIndex: hashIndex,
      );
      await _tryRestoreDraft(config);
      unawaited(_checkForUpdate(config));
    } catch (e) {
      state = state.copyWith(status: '$e');
    }
  }

  Future<bool> saveSetup({
    required String repoUrl,
    required String branch,
    required String pat,
    bool keepExistingPat = false,
  }) async {
    final previous = state.config;
    state = state.copyWith(busy: true, status: 'Saving setup…', progress: 'Saving…');
    _setProgress('Saving…');
    try {
      final trimmedPat = pat.trim();
      final existingPat = await _storage.readPat();
      final effectivePat = trimmedPat.isNotEmpty
          ? trimmedPat
          : (keepExistingPat ? existingPat : null);
      if (effectivePat == null || effectivePat.isEmpty) {
        _clearProgress();
        state = state.copyWith(
          busy: false,
          clearProgress: true,
          status: 'Personal access token is required.',
        );
        return false;
      }

      if (trimmedPat.isNotEmpty) {
        await _storage.writePat(trimmedPat);
      }
      final config = await _storage.saveConfig(repoUrl: repoUrl, branch: branch);
      final sameRemote = previous != null &&
          previous.repoUrl.trim().toLowerCase() == config.repoUrl.trim().toLowerCase() &&
          previous.branch == config.branch;

      state = state.copyWith(config: config, hasPat: true);

      if (sameRemote) {
        _loadSiteConfigDraft(config);
        _clearProgress();
        state = state.copyWith(
          busy: false,
          clearProgress: true,
          status: 'Settings saved.',
        );
        unawaited(_checkForUpdate(config));
        return true;
      }

      await _refreshGallery(
        pat: effectivePat,
        config: config,
        onProgress: (message) => _setProgress(message),
      );
      _clearProgress();
      state = state.copyWith(busy: false, clearProgress: true, status: 'Gallery project ready.');
      unawaited(_checkForUpdate(config));
      return true;
    } catch (e) {
      _clearProgress();
      state = state.copyWith(busy: false, clearProgress: true, status: '$e');
      return false;
    }
  }

  Future<void> _refreshGallery({
    required String pat,
    required AppConfig config,
    void Function(String message)? onProgress,
    OperationCancelToken? cancel,
  }) async {
    if (_refreshInFlight != null) {
      await _refreshInFlight;
      return;
    }

    _refreshInFlight = _refreshGalleryImpl(
      pat: pat,
      config: config,
      onProgress: onProgress,
      cancel: cancel,
    );
    try {
      await _refreshInFlight;
    } finally {
      _refreshInFlight = null;
    }
  }

  Future<void> _refreshGalleryImpl({
    required String pat,
    required AppConfig config,
    void Function(String message)? onProgress,
    OperationCancelToken? cancel,
  }) async {
    cancel?.throwIfCanceled();
    _setProgress('Preparing gallery…', onProgress: onProgress);
    await _github.ensureRepoReady(
      pat: pat,
      config: config,
      onProgress: (message) => _setProgress(message, onProgress: onProgress),
      cancel: cancel,
    );
    cancel?.throwIfCanceled();
    final paths = GalleryPaths(config.workdir);
    _setProgress('Loading registries…', onProgress: onProgress);
    final registries = loadGalleryRegistriesSync(config.workdir);
    final galleryTags = loadGalleryTagsSync(paths);
    final hashIndex = loadGalleryContentHashIndexSync(paths);
    state = state.copyWith(
      registries: registries,
      galleryTags: galleryTags,
      galleryContentHashIndex: hashIndex,
    );
    _loadSiteConfigDraft(config);
  }

  Future<void> syncGallery() async {
    final config = state.config;
    final pat = await _storage.readPat();
    if (config == null || pat == null) return;
    _beginCancelableOperation('Syncing…');
    try {
      await _github.syncLatest(
        pat: pat,
        config: config,
        onProgress: (m) => _setProgress(m),
        cancel: _cancelToken,
      );
      _cancelToken?.throwIfCanceled();
      await _refreshGallery(pat: pat, config: config, cancel: _cancelToken);
      _endCancelableOperation(status: 'Gallery synced from GitHub.');
    } on OperationCanceledException {
      _endCancelableOperation(status: 'Sync canceled.');
    } catch (e) {
      _endCancelableOperation(status: '$e');
    }
  }

  void _beginCancelableOperation(String progress) {
    _cancelToken = OperationCancelToken();
    state = state.copyWith(busy: true, progress: progress, operationCancelable: true);
    _setProgress(progress);
  }

  void _endCancelableOperation({String? status}) {
    _cancelToken = null;
    _clearProgress();
    state = state.copyWith(
      busy: false,
      operationCancelable: false,
      clearProgress: true,
      status: status,
    );
  }

  void cancelOperation() => _cancelToken?.cancel();

  Future<void> _checkForUpdate(AppConfig config) async {
    try {
      final result = await _updates.check(config);
      if (result == null) return;
      state = state.copyWith(pendingUpdate: result);
    } catch (_) {
      /* offline or non-GitHub repo */
    }
  }

  void dismissUpdateNotice() => state = state.copyWith(clearPendingUpdate: true);

  Future<void> installAppUpdate() async {
    final update = state.pendingUpdate;
    final config = state.config;
    if (update == null || config == null) return;

    _beginCancelableOperation('Preparing update…');
    try {
      await _updates.downloadAndInstall(
        repoUrl: config.repoUrl,
        update: update,
        onProgress: _setProgress,
      );
      _endCancelableOperation(
        status: 'Follow the system prompt to install v${update.latestVersion}.',
      );
    } on OperationCanceledException {
      _endCancelableOperation(status: 'Update canceled.');
    } catch (e) {
      _endCancelableOperation(status: '$e');
    }
  }

  void setQueueViewMode(QueueViewMode mode) {
    state = state.copyWith(queueViewMode: mode);
    _storage.saveQueueViewMode(mode);
    _scheduleDraftSave();
  }

  Future<void> addPhotos(List<String> paths) async {
    if (paths.isEmpty) return;
    final config = state.config;
    if (config == null) return;

    final defaults = state.sessionDefaults;
    final newRows = <UploadRow>[];
    final batchHashes = <String>{};
    var skippedDuplicates = 0;

    try {
      for (final path in paths) {
        final file = File(path);
        if (!file.existsSync()) continue;

        final bytes = await file.readAsBytes();
        final digest = sha256HexBytes(bytes);
        if (state.galleryContentHashIndex.containsKey(digest) ||
            batchHashes.contains(digest) ||
            state.rows.any((r) => r.contentHash == digest)) {
          skippedDuplicates++;
          continue;
        }
        batchHashes.add(digest);

        final hints = await _exif.readHints(path);
        final ext = extensionFromPathAndBytes(path, bytes);
        final destFilename = randomGalleryFilename(ext);
        final destId = destFilename.split('.').first;

        var camera = defaults.cameraSelect;
        var lens = defaults.lensSelect;
        final matchedCamera = matchEquipmentSlug(hints.make, hints.model, state.registries.cameras);
        if (matchedCamera != null) camera = matchedCamera;
        final matchedLens = matchEquipmentSlug(hints.lensModel, null, state.registries.lenses);
        if (matchedLens != null) lens = matchedLens;

        var captureDate = defaults.captureDate;
        var captureIso = '';
        if (hints.captureDateTime != null) {
          captureIso = hints.captureDateTime!.toUtc().toIso8601String();
          captureDate = captureDateToCapturedOn(hints.captureDateTime) ?? captureDate;
        }

        newRows.add(UploadRow(
          id: const Uuid().v4(),
          sourcePath: path,
          title: titleFromFilename(path),
          description: hints.description ?? '',
          tags: defaults.tags,
          location: defaults.location,
          captureDate: captureDate,
          captureDateTimeIso: captureIso,
          collectionSelect: defaults.collectionSelect,
          cameraSelect: camera,
          lensSelect: lens,
          hidden: defaults.hidden,
          copyright: defaults.copyright,
          extension: ext,
          destFilename: destFilename,
          destId: destId,
          destExists: destExistsForId(GalleryPaths(config.workdir), destFilename),
          contentHash: digest,
        ));
      }
    } catch (e) {
      state = state.copyWith(status: 'Could not read selected photos: $e');
      return;
    }

    if (newRows.isEmpty) {
      state = state.copyWith(
        status: skippedDuplicates > 0
            ? 'No new photos added (duplicates skipped).'
            : 'No new photos added.',
      );
      return;
    }

    final rows = [...state.rows, ...newRows];
    var status = 'Added ${newRows.length} photo${newRows.length == 1 ? '' : 's'}.';
    if (skippedDuplicates > 0) {
      status += ' Skipped $skippedDuplicates duplicate${skippedDuplicates == 1 ? '' : 's'}.';
    }
    state = state.copyWith(
      rows: rows,
      selectedRowId: newRows.first.id,
      status: status,
    );
    _scheduleDraftSave();
  }

  Future<void> addFolder() async {
    final dir = await FilePicker.platform.getDirectoryPath();
    if (dir == null) return;
    final paths = <String>[];
    await for (final entity in Directory(dir).list(recursive: true, followLinks: false)) {
      if (entity is! File) continue;
      final ext = p.extension(entity.path).toLowerCase();
      if ({'.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif'}.contains(ext)) {
        paths.add(entity.path);
      }
    }
    await addPhotos(paths);
  }

  void toggleRowSelected(String id) {
    final next = Set<String>.from(state.selectedRowIds);
    if (next.contains(id)) {
      next.remove(id);
    } else {
      next.add(id);
    }
    state = state.copyWith(selectedRowIds: next);
    _scheduleDraftSave();
  }

  void selectAllRows() {
    state = state.copyWith(
      selectedRowIds: state.rows.map((r) => r.id).toSet(),
    );
    _scheduleDraftSave();
  }

  void clearRowSelection() {
    state = state.copyWith(selectedRowIds: {});
    _scheduleDraftSave();
  }

  void setRows(List<UploadRow> rows) {
    state = state.copyWith(rows: rows);
    _scheduleDraftSave();
  }

  void applyBatchEdit(batch.BatchEditPatch patch) {
    final scope = state.selectedRowIds.isEmpty ? null : state.selectedRowIds;
    setRows(batch.applyBatchEdit(state.rows, scope, patch));
    state = state.copyWith(
      status: scope == null
          ? 'Batch edits applied to all ${state.rows.length} photos.'
          : 'Batch edits applied to ${scope.length} selected photo(s).',
    );
  }

  void copyFromFirst(List<batch.CopyFromFirstField> fields) {
    if (state.selectedRowIds.isEmpty) return;
    setRows(batch.copyMetadataFromFirst(state.rows, state.selectedRowIds, fields));
    state = state.copyWith(status: 'Copied metadata from first selected photo.');
  }

  void applyBulkTitle(BulkTitleOptions options) {
    final scope = state.selectedRowIds.isEmpty ? null : state.selectedRowIds;
    setRows(applyBulkTitlesToRows(state.rows, scope, options));
    state = state.copyWith(status: 'Bulk title update applied.');
  }

  void sortRowsByCaptureDate() {
    setRows(batch.sortRowsByCaptureDate(state.rows));
    state = state.copyWith(status: 'Queue sorted by capture date (oldest first).');
  }

  Future<void> discardDraft() async {
    await _drafts.clear();
    await _storage.saveCommitMessage('');
    state = state.copyWith(
      rows: [],
      selectedRowIds: {},
      commitMessage: '',
      clearSelection: true,
      status: 'Autosaved draft discarded.',
    );
  }

  void updateSiteConfigDraft(SiteConfigDraft draft) {
    state = state.copyWith(siteConfigDraft: draft);
  }

  void reloadSiteConfig() {
    final config = state.config;
    if (config == null) return;
    _loadSiteConfigDraft(config);
    state = state.copyWith(status: 'Reloaded site.json from local copy.');
  }

  Future<void> saveSiteConfig() async {
    final config = state.config;
    if (config == null) return;
    final paths = GalleryPaths(config.workdir);
    final rel = _siteConfig.saveDraft(paths, state.siteConfigDraft);
    addExtraStagedPaths([rel]);
    state = state.copyWith(
      status: 'Saved site.json locally. Include on next publish.',
    );
  }

  List<({String id, String label})> coverCandidates() {
    final fromQueue = state.rows
        .where((r) => r.title.trim().isNotEmpty)
        .map((r) => (id: r.destId, label: r.title.trim()));
    final config = state.config;
    if (config == null) return fromQueue.toList();
    final fromGallery =
        loadGalleryPhotoTitlesSync(GalleryPaths(config.workdir)).map((p) => (id: p.id, label: p.title));
    return [...fromQueue, ...fromGallery];
  }

  Future<void> saveRegistry(RegistrySaveInput input) async {
    final config = state.config;
    if (config == null) return;
    final paths = GalleryPaths(config.workdir);
    final staged = <String>[];
    final slug = _registrySlug(input);
    if (slug == null) {
      throw StateError('Enter a title or name that produces a valid slug.');
    }

    switch (input.kind) {
      case RegistryKind.collection:
        staged.add(_registry.saveCollection(
          paths: paths,
          editSlug: input.editSlug,
          title: input.titleOrName,
          description: input.description,
          coverImageId: input.coverImageId,
        ));
      case RegistryKind.camera:
        staged.addAll(_registry.saveCamera(
          paths: paths,
          editSlug: input.editSlug,
          name: input.titleOrName,
          make: input.make,
          model: input.model,
          description: input.description,
          lensSlug: input.lensSlug,
          imagePath: input.imagePath,
        ));
      case RegistryKind.lens:
        staged.addAll(_registry.saveLens(
          paths: paths,
          editSlug: input.editSlug,
          name: input.titleOrName,
          make: input.make,
          model: input.model,
          description: input.description,
          imagePath: input.imagePath,
        ));
    }

    addExtraStagedPaths(staged);
    final registries = loadGalleryRegistriesSync(config.workdir);
    state = state.copyWith(registries: registries, status: 'Registry saved locally.');
    if (input.rowId != null) {
      handleRegistryCreated(input.kind, slug, rowId: input.rowId);
    }
  }

  String? _registrySlug(RegistrySaveInput input) {
    final edit = input.editSlug?.trim().toLowerCase();
    if (edit != null && edit.isNotEmpty) return edit;
    return switch (input.kind) {
      RegistryKind.collection => collectionSlugFromTitle(input.titleOrName.trim()),
      RegistryKind.camera || RegistryKind.lens => equipmentSlugFromLabel(input.titleOrName.trim()),
    };
  }

  RegistryCollection? registryCollectionForEdit(String slug) {
    final config = state.config;
    if (config == null) return null;
    return _registry.loadCollection(GalleryPaths(config.workdir), slug);
  }

  RegistryEquipment? registryEquipmentForEdit(RegistryKind kind, String slug) {
    final config = state.config;
    if (config == null) return null;
    final paths = GalleryPaths(config.workdir);
    return kind == RegistryKind.camera
        ? _registry.loadEquipment(paths, paths.camerasDir, slug)
        : _registry.loadEquipment(paths, paths.lensesDir, slug);
  }

  void handleRegistryCreated(RegistryKind kind, String slug, {String? rowId}) {
    if (rowId != null) {
      updateRow(rowId, (row) {
        return switch (kind) {
          RegistryKind.collection => row.copyWith(collectionSelect: slug),
          RegistryKind.camera => row.copyWith(cameraSelect: slug, cameraCustom: ''),
          RegistryKind.lens => row.copyWith(lensSelect: slug, lensCustom: ''),
        };
      });
    }
  }

  void selectRow(String? id) => state = state.copyWith(selectedRowId: id);

  void updateRow(String id, UploadRow Function(UploadRow) transform) {
    state = state.copyWith(
      rows: state.rows.map((r) => r.id == id ? transform(r) : r).toList(),
    );
    _scheduleDraftSave();
  }

  void removeRow(String id) {
    final rows = state.rows.where((r) => r.id != id).toList();
    final nextSelected = Set<String>.from(state.selectedRowIds)..remove(id);
    state = state.copyWith(
      rows: rows,
      clearSelection: state.selectedRowId == id,
      selectedRowId: rows.isEmpty ? null : rows.first.id,
      selectedRowIds: nextSelected,
    );
    _scheduleDraftSave();
  }

  void updateSessionDefaults(SessionDefaults defaults) {
    state = state.copyWith(sessionDefaults: defaults);
    _storage.saveSessionDefaults(defaults);
    _scheduleDraftSave();
  }

  void setCommitMessage(String message) {
    state = state.copyWith(commitMessage: message);
    _storage.saveCommitMessage(message);
    _scheduleDraftSave();
  }

  void setPublishMode(PublishMode mode) => state = state.copyWith(publishMode: mode);

  void setStatus(String message) => state = state.copyWith(status: message);

  Future<void> uploadAndPublish() async {
    final config = state.config;
    final pat = await _storage.readPat();
    if (config == null || pat == null) return;
    if (state.rows.isEmpty) {
      state = state.copyWith(status: 'Add photos before publishing.');
      return;
    }
    for (final row in state.rows) {
      final error = validateUploadRowForPublish(row);
      if (error != null) {
        state = state.copyWith(status: error);
        selectRow(row.id);
        return;
      }
    }

    state = state.copyWith(busy: true, progress: 'Staging photos…', operationCancelable: true);
    _setProgress('Staging photos…');
    _cancelToken = OperationCancelToken();
    try {
      final paths = GalleryPaths(config.workdir);
      final stagedRepoPaths = <String>{...state.extraStagedPaths};
      for (var i = 0; i < state.rows.length; i++) {
        _cancelToken?.throwIfCanceled();
        final row = state.rows[i];
        _setProgress('Staging ${i + 1} of ${state.rows.length}…');
        await _stage.stageRow(paths: paths, row: row, registries: state.registries);
        stagedRepoPaths.add('public/gallery/${row.destFilename}');
        stagedRepoPaths.add('public/gallery/meta/${row.destId}.json');
        if (row.collectionSetCover && row.collectionSelect.isNotEmpty) {
          _registry.setCollectionCover(paths, row.collectionSelect, row.destId);
          stagedRepoPaths.add('public/gallery/meta/collections/${row.collectionSelect}.json');
        }
      }

      final generateResult = await _generateAssets.runIfAvailable(
        config.workdir,
        onProgress: _setProgress,
      );

      _cancelToken?.throwIfCanceled();
      await _github.publish(
        pat: pat,
        config: config,
        message: state.commitMessage,
        mode: state.publishMode,
        stagedRepoPaths: stagedRepoPaths.toList(),
        onProgress: (m) => _setProgress(m),
        cancel: _cancelToken,
      );

      _cancelToken?.throwIfCanceled();
      await _refreshGallery(pat: pat, config: config, cancel: _cancelToken);
      await _drafts.clear();
      _cancelToken = null;
      _clearProgress();
      final status = generateResult.ran
          ? 'Published to GitHub.'
          : 'Published to GitHub. npm generate-assets was not run (Node.js or gallery package.json missing in the workdir). '
              'blurHash and exifDisplay were written in-app when possible; site CI normalizes them before deploy.';
      state = state.copyWith(
        rows: [],
        selectedRowIds: {},
        extraStagedPaths: {},
        clearSelection: true,
        busy: false,
        operationCancelable: false,
        clearProgress: true,
        status: status,
      );
    } on OperationCanceledException {
      _cancelToken = null;
      _clearProgress();
      state = state.copyWith(
        busy: false,
        operationCancelable: false,
        clearProgress: true,
        status: 'Publish canceled.',
      );
    } catch (e) {
      _cancelToken = null;
      _clearProgress();
      state = state.copyWith(
        busy: false,
        operationCancelable: false,
        clearProgress: true,
        status: '$e',
      );
    }
  }
}

final appControllerProvider = StateNotifierProvider<AppController, AppState>(
  (ref) => AppController(ref),
);
