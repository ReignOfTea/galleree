import 'dart:io' show Platform;

import 'package:dynamic_color/dynamic_color.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'screens/root_screen.dart';
import 'theme/app_theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ProviderScope(child: GallereeUploadApp()));
}

class GallereeUploadApp extends StatelessWidget {
  const GallereeUploadApp({super.key});

  @override
  Widget build(BuildContext context) {
    // dynamic_color polls the OS accent on Windows and can flood the runner.
    if (Platform.isWindows) {
      return MaterialApp(
        title: 'Galleree Upload',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.theme(AppTheme.fallbackLight, Brightness.light),
        darkTheme: AppTheme.theme(AppTheme.fallbackDark, Brightness.dark),
        themeMode: ThemeMode.dark,
        home: const RootScreen(),
      );
    }

    return DynamicColorBuilder(
      builder: (lightDynamic, darkDynamic) {
        final lightScheme = lightDynamic ?? AppTheme.fallbackLight;
        final darkScheme = darkDynamic ?? AppTheme.fallbackDark;
        return MaterialApp(
          title: 'Galleree Upload',
          debugShowCheckedModeBanner: false,
          theme: AppTheme.theme(lightScheme, Brightness.light),
          darkTheme: AppTheme.theme(darkScheme, Brightness.dark),
          themeMode: ThemeMode.system,
          home: const RootScreen(),
        );
      },
    );
  }
}