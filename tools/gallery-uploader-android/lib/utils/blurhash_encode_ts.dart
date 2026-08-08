import 'dart:math' as math;
import 'dart:typed_data';

/// BlurHash encoder matching the site's TypeScript / npm `blurhash` package (Wolt).
/// Prefer this over blurhash_dart, which uses a different encoder.
String encodeBlurHashTs(
  Uint8List pixels,
  int width,
  int height, {
  int componentX = 4,
  int componentY = 4,
}) {
  if (componentX < 1 || componentX > 9 || componentY < 1 || componentY > 9) {
    throw ArgumentError('BlurHash must have between 1 and 9 components');
  }
  if (width * height * 4 != pixels.length) {
    throw ArgumentError('Width and height must match the pixels array');
  }

  final factors = <List<double>>[];
  for (var y = 0; y < componentY; y++) {
    for (var x = 0; x < componentX; x++) {
      final normalisation = x == 0 && y == 0 ? 1.0 : 2.0;
      factors.add(
        _multiplyBasisFunction(
          pixels,
          width,
          height,
          (i, j) =>
              normalisation *
              math.cos(math.pi * x * i / width) *
              math.cos(math.pi * y * j / height),
        ),
      );
    }
  }

  final dc = factors.first;
  final ac = factors.sublist(1);

  var hash = '';
  final sizeFlag = componentX - 1 + (componentY - 1) * 9;
  hash += _encode83(sizeFlag, 1);

  late final double maximumValue;
  if (ac.isNotEmpty) {
    var actualMaximumValue = 0.0;
    for (final val in ac) {
      actualMaximumValue = math.max(actualMaximumValue, math.max(val[0], math.max(val[1], val[2])));
    }
    final quantisedMaximumValue = math.max(
      0,
      math.min(82, (actualMaximumValue * 166 - 0.5).floor()),
    );
    maximumValue = (quantisedMaximumValue + 1) / 166;
    hash += _encode83(quantisedMaximumValue, 1);
  } else {
    maximumValue = 1;
    hash += _encode83(0, 1);
  }

  hash += _encode83(_encodeDc(dc), 4);

  for (final factor in ac) {
    hash += _encode83(_encodeAc(factor, maximumValue), 2);
  }

  return hash;
}

List<double> _multiplyBasisFunction(
  Uint8List pixels,
  int width,
  int height,
  double Function(int i, int j) basisFunction,
) {
  var r = 0.0;
  var g = 0.0;
  var b = 0.0;
  const bytesPerPixel = 4;
  final bytesPerRow = width * bytesPerPixel;

  for (var x = 0; x < width; x++) {
    final bytesPerPixelX = bytesPerPixel * x;
    for (var y = 0; y < height; y++) {
      final basePixelIndex = bytesPerPixelX + y * bytesPerRow;
      final basis = basisFunction(x, y);
      r += basis * _sRgbToLinear(pixels[basePixelIndex]);
      g += basis * _sRgbToLinear(pixels[basePixelIndex + 1]);
      b += basis * _sRgbToLinear(pixels[basePixelIndex + 2]);
    }
  }

  final scale = 1 / (width * height);
  return [r * scale, g * scale, b * scale];
}

int _encodeDc(List<double> value) {
  final roundedR = _linearToSRgb(value[0]);
  final roundedG = _linearToSRgb(value[1]);
  final roundedB = _linearToSRgb(value[2]);
  return (roundedR << 16) + (roundedG << 8) + roundedB;
}

int _encodeAc(List<double> value, double maximumValue) {
  final quantR = math.max(
    0,
    math.min(18, (_signPow(value[0] / maximumValue, 0.5) * 9 + 9.5).floor()),
  );
  final quantG = math.max(
    0,
    math.min(18, (_signPow(value[1] / maximumValue, 0.5) * 9 + 9.5).floor()),
  );
  final quantB = math.max(
    0,
    math.min(18, (_signPow(value[2] / maximumValue, 0.5) * 9 + 9.5).floor()),
  );
  return quantR * 19 * 19 + quantG * 19 + quantB;
}

double _sRgbToLinear(num value) {
  final v = value / 255;
  if (v <= 0.04045) return v / 12.92;
  return math.pow((v + 0.055) / 1.055, 2.4).toDouble();
}

int _linearToSRgb(double value) {
  final v = value.clamp(0.0, 1.0);
  if (v <= 0.0031308) return (v * 12.92 * 255 + 0.5).truncate();
  return ((1.055 * math.pow(v, 1 / 2.4) - 0.055) * 255 + 0.5).truncate();
}

double _signPow(double val, double exp) =>
    val < 0 ? -math.pow(-val, exp).toDouble() : math.pow(val, exp).toDouble();

const _digitCharacters = [
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
  'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
  '#', r'$', '%', '*', '+', ',', '-', '.', ':', ';', '=', '?', '@',
  '[', ']', '^', '_', '{', '|', '}', '~',
];

String _encode83(int n, int length) {
  final buffer = StringBuffer();
  for (var i = 1; i <= length; i++) {
    final digit = (n ~/ math.pow(83, length - i)) % 83;
    buffer.write(_digitCharacters[digit]);
  }
  return buffer.toString();
}
