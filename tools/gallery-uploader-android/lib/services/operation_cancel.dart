class OperationCanceledException implements Exception {
  const OperationCanceledException();

  @override
  String toString() => 'Operation canceled.';
}

class OperationCancelToken {
  bool _canceled = false;

  bool get isCanceled => _canceled;

  void cancel() => _canceled = true;

  void throwIfCanceled() {
    if (_canceled) throw const OperationCanceledException();
  }
}
