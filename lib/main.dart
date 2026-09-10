import 'dart:async';

import 'package:flutter/material.dart';
import 'package:audio_service/audio_service.dart';

import 'player/player_controller.dart';
import 'playback/music_audio_handler.dart';
import 'playback/audio_playback_service.dart';
import 'storage/queue_store.dart';
import 'frontend/frontend_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const MusicoApp());
  unawaited(_initializeAudioService());
}

Future<void> _initializeAudioService() async {
  try {
    await AudioService.init(
      builder: MusicAudioHandler.new,
      config: AudioServiceConfig(
        androidNotificationChannelId: 'com.example.musicplaya.playback',
        androidNotificationChannelName: 'Music playback',
        androidNotificationOngoing: true,
        androidStopForegroundOnPause: false,
      ),
    ).timeout(const Duration(seconds: 5));
  } on Object catch (_) {
    // The UI remains usable when a platform media service is unavailable.
  }
}

class MusicoApp extends StatefulWidget {
  const MusicoApp({this.audioHandler, super.key});

  final AudioHandler? audioHandler;

  @override
  State<MusicoApp> createState() => _MusicoAppState();
}

class _MusicoAppState extends State<MusicoApp> {
  late final PlayerController controller;

  @override
  void initState() {
    super.initState();
    controller = PlayerController(
      store: const QueueStore(),
      playback: AudioPlaybackService(),
    );
    controller.restore();
  }

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Musico',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF101212),
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFFE5B96B),
          brightness: Brightness.dark,
        ),
        useMaterial3: true,
      ),
      home: FrontendScreen(player: controller),
    );
  }
}
