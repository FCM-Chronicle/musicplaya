import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../player/player_controller.dart';
import '../player/track.dart';
import 'local_asset_server.dart';

class FrontendScreen extends StatefulWidget {
  const FrontendScreen({required this.player, super.key});

  final PlayerController player;

  @override
  State<FrontendScreen> createState() => _FrontendScreenState();
}

class _FrontendScreenState extends State<FrontendScreen> {
  late final WebViewController controller;
  final LocalAssetServer assetServer = LocalAssetServer();
  String? loadError;
  bool loading = true;

  @override
  void initState() {
    super.initState();
    controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0xFF101212))
      ..setOnConsoleMessage((message) {
        if (!mounted) return;
        debugPrint('JS: ${message.message}');
      })
      ..addJavaScriptChannel('musicplaya', onMessageReceived: _handleMessage)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageFinished: (_) {
            if (mounted) setState(() => loading = false);
            _syncState();
          },
          onWebResourceError: (error) {
            if (!mounted || error.isForMainFrame == false) return;
            setState(() {
              loading = false;
              loadError = '${error.errorCode}: ${error.description}';
            });
          },
        ),
      );
    widget.player.addListener(_syncState);
    _loadFrontendFromServer();
  }

  Future<void> _loadFrontendFromServer() async {
    try {
      final uri = await assetServer.start();
      await controller.loadRequest(uri);
    } on Object catch (error) {
      if (!mounted) return;
      setState(() {
        loading = false;
        loadError = 'Frontend asset load failed: $error';
      });
    }
  }

  @override
  void dispose() {
    widget.player.removeListener(_syncState);
    assetServer.stop();
    super.dispose();
  }

  void _handleMessage(JavaScriptMessage message) {
    final payload = jsonDecode(message.message) as Map<String, dynamic>;
    switch (payload['action']) {
      case 'play':
        if (!widget.player.isPlaying) widget.player.togglePlay();
      case 'pause':
        if (widget.player.isPlaying) widget.player.togglePlay();
      case 'next':
        widget.player.next();
      case 'previous':
        widget.player.previous();
      case 'selectTrack':
        widget.player.selectTrack(payload['index'] as int? ?? 0);
      case 'selectQueue':
        widget.player.selectQueue(payload['index'] as int? ?? 0);
      case 'scanEntireDevice':
        widget.player.scanEntireDevice();
      case 'pickFolder':
        widget.player.pickFolder();
      case 'seek':
        final pos = payload['position'] as num?;
        if (pos != null) widget.player.seek(Duration(seconds: pos.toInt()));
      case 'shuffle':
        widget.player.toggleShuffle();
      case 'repeat':
        widget.player.toggleRepeat();
      case 'setContextQueue':
        final rawTracks = payload['tracks'] as List<dynamic>?;
        final startIndex = payload['startIndex'] as int? ?? 0;
        if (rawTracks != null && rawTracks.isNotEmpty) {
          final tracks = rawTracks.map((t) {
            final map = t as Map<String, dynamic>;
            return Track(
              id: (map['filePath'] as String?) ?? (map['title'] as String? ?? 'unknown'),
              title: map['title'] as String? ?? 'Unknown',
              artist: map['artist'] as String? ?? 'Unknown',
              album: map['album'] as String? ?? 'Unknown',
              duration: Duration(seconds: (map['duration'] as num?)?.toInt() ?? 0),
              genre: map['genre'] as String?,
              filePath: map['filePath'] as String?,
            );
          }).toList();
          widget.player.setContextQueue(tracks: tracks, startIndex: startIndex);
        }
      case 'createPlaylist':
        final name = payload['name'] as String?;
        if (name != null && name.isNotEmpty) {
          widget.player.createPlaylist(name);
        }
      case 'addTrackToPlaylist':
        final playlistId = payload['playlistId'] as String?;
        final trackMap = payload['track'] as Map<String, dynamic>?;
        if (playlistId != null && trackMap != null) {
          final track = Track(
            id: (trackMap['filePath'] as String?) ?? (trackMap['title'] as String? ?? 'unknown'),
            title: trackMap['title'] as String? ?? 'Unknown',
            artist: trackMap['artist'] as String? ?? 'Unknown',
            album: trackMap['album'] as String? ?? 'Unknown',
            duration: Duration(seconds: (trackMap['duration'] as num?)?.toInt() ?? 0),
            genre: trackMap['genre'] as String?,
            filePath: trackMap['filePath'] as String?,
          );
          widget.player.addTrackToPlaylist(playlistId, track);
        }
      case 'setPitch':
        final semitones = payload['semitones'] as num?;
        if (semitones != null) {
          widget.player.setPitch(semitones.toInt());
        }
      case 'setKaraokeMode':
        final enabled = payload['enabled'] as bool?;
        if (enabled != null) {
          widget.player.setKaraokeMode(enabled);
        }
    }
  }

  Future<void> _syncState() async {
    if (!mounted) return;
    final queue = widget.player.currentQueue;
    final state = jsonEncode({
      'playing': widget.player.isPlaying,
      'queueIndex': widget.player.selectedQueueIndex,
      'isShuffle': widget.player.isShuffle,
      'repeatState': widget.player.repeatState.name,
      'isKaraokeOn': widget.player.isKaraokeOn,
      'pitchShift': widget.player.pitchShift,
      'queue': {
        'name': queue.name,
        'tracks': queue.tracks
            .map((track) {
              final artBytes = track.artworkBytes;
              final artB64 = artBytes != null ? 'data:image/jpeg;base64,${base64Encode(artBytes)}' : null;
              // Derive two tint colors from the integer coverColor
              final c = track.coverColor;
              final r = (c >> 16 & 0xFF).toRadixString(16).padLeft(2, '0');
              final g = (c >> 8 & 0xFF).toRadixString(16).padLeft(2, '0');
              final b = (c & 0xFF).toRadixString(16).padLeft(2, '0');
              return {
                'title': track.title,
                'artist': track.artist,
                'album': track.album,
                'genre': track.genre,
                'duration': track.duration.inSeconds,
                'filePath': track.filePath,
                'artworkB64': artB64,
                'c1': '#$r$g$b',
                'c2': '#$b$g$r',
              };
            })
            .toList(),
      },
      'currentIndex': queue.currentIndex,
      'position': queue.position.inSeconds,
      'playlists': widget.player.queues
          .where((q) => q.id.startsWith('playlist_'))
          .map((q) => {
                'id': q.id,
                'name': q.name,
                'tracks': q.tracks.map((track) {
                  final c = track.coverColor;
                  final r = (c >> 16 & 0xFF).toRadixString(16).padLeft(2, '0');
                  final g = (c >> 8 & 0xFF).toRadixString(16).padLeft(2, '0');
                  final b = (c & 0xFF).toRadixString(16).padLeft(2, '0');
                  return {
                    'title': track.title,
                    'artist': track.artist,
                    'album': track.album,
                    'genre': track.genre,
                    'duration': track.duration.inSeconds,
                    'filePath': track.filePath,
                    'c1': '#$r$g$b',
                    'c2': '#$b$g$r',
                  };
                }).toList(),
              })
          .toList(),
    });
    await controller.runJavaScript('''
      if (typeof window.__musicplayaApplyState === 'function') {
        window.__musicplayaApplyState($state);
      } else {
        window.__musicplayaPendingState = $state;
      }
    ''');
  }

  @override
  Widget build(BuildContext context) {
    if (loadError != null) {
      return ColoredBox(
        color: const Color(0xFF101212),
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text('Frontend load failed\n$loadError', textAlign: TextAlign.center),
          ),
        ),
      );
    }
    return Stack(
      children: [
        WebViewWidget(controller: controller),
        if (loading)
          const ColoredBox(
            color: Color(0xFF101212),
            child: Center(child: CircularProgressIndicator()),
          ),
      ],
    );
  }
}
