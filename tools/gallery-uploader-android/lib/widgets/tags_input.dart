import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../utils/tag_suggest.dart';

class TagsInput extends StatefulWidget {
  const TagsInput({
    super.key,
    required this.value,
    required this.onChanged,
    required this.knownTags,
    this.label,
    this.required = false,
  });

  final String value;
  final ValueChanged<String> onChanged;
  final List<String> knownTags;
  final String? label;
  final bool required;

  @override
  State<TagsInput> createState() => _TagsInputState();
}

class _TagsInputState extends State<TagsInput> {
  late final TextEditingController _controller;
  late final FocusNode _focusNode;
  final _fieldKey = GlobalKey();
  int _caret = 0;
  int _activeIndex = 0;
  bool _open = false;
  OverlayEntry? _overlayEntry;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.value);
    _caret = widget.value.length;
    _focusNode = FocusNode();
    _focusNode.addListener(_handleFocusChange);
    _controller.addListener(_syncCaret);
  }

  @override
  void didUpdateWidget(covariant TagsInput oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.value != _controller.text && widget.value != oldWidget.value) {
      _controller.text = widget.value;
      _caret = _controller.selection.baseOffset.clamp(0, widget.value.length);
    }
    if (widget.knownTags != oldWidget.knownTags) {
      _scheduleOverlayUpdate();
    }
  }

  @override
  void dispose() {
    _removeOverlay();
    _focusNode.removeListener(_handleFocusChange);
    _controller.removeListener(_syncCaret);
    _focusNode.dispose();
    _controller.dispose();
    super.dispose();
  }

  void _handleFocusChange() {
    if (_focusNode.hasFocus) {
      _open = true;
      _scheduleOverlayUpdate();
    } else {
      Future<void>.delayed(const Duration(milliseconds: 120), () {
        if (!_focusNode.hasFocus && mounted) {
          _open = false;
          _removeOverlay();
        }
      });
    }
  }

  void _syncCaret() {
    _caret = _controller.selection.baseOffset.clamp(0, _controller.text.length);
    widget.onChanged(_controller.text);
    _activeIndex = 0;
    if (_open) _scheduleOverlayUpdate();
  }

  List<String> get _suggestions =>
      filterTagSuggestions(widget.knownTags, _controller.text, _caret);

  void _scheduleOverlayUpdate() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (!_open || !_focusNode.hasFocus || _suggestions.isEmpty) {
        _removeOverlay();
        return;
      }
      _showOverlay();
    });
  }

  void _showOverlay() {
    _removeOverlay();
    final box = _fieldKey.currentContext?.findRenderObject() as RenderBox?;
    if (box == null || !box.hasSize) return;

    final overlay = Overlay.of(context);
    final fieldOffset = box.localToGlobal(Offset.zero, ancestor: overlay.context.findRenderObject());
    final suggestions = _suggestions;

    _overlayEntry = OverlayEntry(
      builder: (context) => Positioned(
        left: fieldOffset.dx,
        top: fieldOffset.dy + box.size.height + 4,
        width: box.size.width,
        child: Material(
          elevation: 4,
          borderRadius: BorderRadius.circular(8),
          color: Theme.of(context).colorScheme.surfaceContainerHigh,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxHeight: 220),
            child: ListView.builder(
              padding: EdgeInsets.zero,
              shrinkWrap: true,
              itemCount: suggestions.length,
              itemBuilder: (context, index) {
                final tag = suggestions[index];
                final selected = index == _activeIndex;
                return ListTile(
                  dense: true,
                  selected: selected,
                  title: _highlightMatch(tag),
                  onTap: () => _pick(tag),
                );
              },
            ),
          ),
        ),
      ),
    );
    overlay.insert(_overlayEntry!);
  }

  void _removeOverlay() {
    _overlayEntry?.remove();
    _overlayEntry = null;
  }

  Widget _highlightMatch(String tag) {
    final fragment = tagFragmentAt(_controller.text, _caret).fragment.trim();
    if (fragment.isEmpty) return Text(tag);
    final lower = tag.toLowerCase();
    final frag = fragment.toLowerCase();
    if (!lower.startsWith(frag)) return Text(tag);
    return Text.rich(
      TextSpan(
        children: [
          TextSpan(
            text: tag.substring(0, fragment.length),
            style: const TextStyle(fontWeight: FontWeight.w600),
          ),
          TextSpan(text: tag.substring(fragment.length)),
        ],
      ),
    );
  }

  void _pick(String tag) {
    final next = applySuggestedTag(_controller.text, _caret, tag);
    _controller.value = TextEditingValue(
      text: next.value,
      selection: TextSelection.collapsed(offset: next.caret),
    );
    _caret = next.caret;
    widget.onChanged(next.value);
    _open = true;
    _focusNode.requestFocus();
    _scheduleOverlayUpdate();
  }

  KeyEventResult _handleKey(FocusNode node, KeyEvent event) {
    if (!_open || _suggestions.isEmpty || event is! KeyDownEvent) {
      return KeyEventResult.ignored;
    }
    if (event.logicalKey == LogicalKeyboardKey.arrowDown) {
      setState(() => _activeIndex = (_activeIndex + 1) % _suggestions.length);
      _scheduleOverlayUpdate();
      return KeyEventResult.handled;
    }
    if (event.logicalKey == LogicalKeyboardKey.arrowUp) {
      setState(() => _activeIndex = (_activeIndex - 1 + _suggestions.length) % _suggestions.length);
      _scheduleOverlayUpdate();
      return KeyEventResult.handled;
    }
    if (event.logicalKey == LogicalKeyboardKey.enter ||
        event.logicalKey == LogicalKeyboardKey.tab) {
      _pick(_suggestions[_activeIndex]);
      return KeyEventResult.handled;
    }
    if (event.logicalKey == LogicalKeyboardKey.escape) {
      _open = false;
      _removeOverlay();
      return KeyEventResult.handled;
    }
    return KeyEventResult.ignored;
  }

  @override
  Widget build(BuildContext context) {
    final label = widget.label;
    return Focus(
      onKeyEvent: _handleKey,
      child: TextField(
        key: _fieldKey,
        controller: _controller,
        focusNode: _focusNode,
        decoration: InputDecoration(
          labelText: label == null
              ? null
              : widget.required
                  ? '$label *'
                  : label,
          hintText: 'Comma-separated',
        ),
        onTap: () {
          _open = true;
          _syncCaret();
          _scheduleOverlayUpdate();
        },
      ),
    );
  }
}
