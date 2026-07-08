import 'package:flutter/material.dart';

import 'pat_scope_info.dart';

class GitConnectionForm extends StatefulWidget {
  const GitConnectionForm({
    super.key,
    required this.repoController,
    required this.branchController,
    required this.patController,
    this.patOptional = false,
  });

  final TextEditingController repoController;
  final TextEditingController branchController;
  final TextEditingController patController;
  final bool patOptional;

  @override
  State<GitConnectionForm> createState() => _GitConnectionFormState();
}

class _GitConnectionFormState extends State<GitConnectionForm> {
  bool _obscurePat = true;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          controller: widget.repoController,
          decoration: const InputDecoration(
            labelText: 'GitHub repository URL',
            hintText: 'https://github.com/you/galaree',
          ),
          keyboardType: TextInputType.url,
          textInputAction: TextInputAction.next,
          autofillHints: const [AutofillHints.url],
        ),
        const SizedBox(height: 12),
        TextField(
          controller: widget.branchController,
          decoration: const InputDecoration(labelText: 'Branch'),
          textInputAction: TextInputAction.next,
        ),
        const SizedBox(height: 12),
        TextField(
          controller: widget.patController,
          decoration: InputDecoration(
            labelText: 'GitHub personal access token',
            helperText: widget.patOptional
                ? 'Leave blank to keep the current token.'
                : 'Stored in the device secure vault (not plain app storage).',
            suffixIcon: IconButton(
              icon: Icon(_obscurePat ? Icons.visibility : Icons.visibility_off),
              onPressed: () => setState(() => _obscurePat = !_obscurePat),
            ),
          ),
          obscureText: _obscurePat,
          textInputAction: TextInputAction.done,
          autofillHints: const [AutofillHints.password],
        ),
        const SizedBox(height: 12),
        const PatScopeInfo(),
      ],
    );
  }
}
