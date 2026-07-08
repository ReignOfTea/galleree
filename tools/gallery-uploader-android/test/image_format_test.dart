import 'package:flutter_test/flutter_test.dart';
import 'package:gallery_uploader_android/services/gallery_services.dart';

void main() {
  test('imageExtensionFromBytes detects JPEG', () {
    const jpegHeader = [0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10];
    expect(imageExtensionFromBytes(jpegHeader), '.jpg');
    expect(
      extensionFromPathAndBytes(r'C:\photos\wrong-name.png', jpegHeader),
      '.jpg',
    );
  });
}
