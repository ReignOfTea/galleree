import 'package:flutter/material.dart';

class AppTheme {
  static ColorScheme get fallbackLight => ColorScheme.fromSeed(
        seedColor: const Color(0xFF6B4F3A),
        brightness: Brightness.light,
      );

  static ColorScheme get fallbackDark => ColorScheme.fromSeed(
        seedColor: const Color(0xFFD4A574),
        brightness: Brightness.dark,
      );

  static ThemeData theme(ColorScheme scheme, Brightness brightness) {
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      brightness: brightness,
      visualDensity: VisualDensity.standard,
      inputDecorationTheme: InputDecorationTheme(
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
        filled: true,
        fillColor: scheme.surfaceContainerHighest.withValues(alpha: 0.35),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        color: scheme.surfaceContainerLow,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      ),
      navigationRailTheme: NavigationRailThemeData(
        backgroundColor: scheme.surfaceContainerLow,
        indicatorColor: scheme.secondaryContainer,
        selectedIconTheme: IconThemeData(color: scheme.onSecondaryContainer),
        selectedLabelTextStyle: TextStyle(color: scheme.onSecondaryContainer),
      ),
    );
  }
}
