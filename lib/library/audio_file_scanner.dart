import 'dart:io';

import 'package:audio_metadata_reader/audio_metadata_reader.dart';
import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';

import '../player/track.dart';
import 'metadata_normalizer.dart';

class ScanResult {
  const ScanResult({required this.tracks, required this.skippedFiles});

  final List<Track> tracks;
  final List<String> skippedFiles;
}

class AudioFileScanner {
  const AudioFileScanner();

  Future<ScanResult> scan(String rootPath, {List<String> additionalRoots = const []}) async {
    final roots = <Directory>[];

    final primaryDir = Directory(rootPath);
    if (await primaryDir.exists()) roots.add(primaryDir);

    for (final addPath in additionalRoots) {
      final d = Directory(addPath);
      if (await d.exists() && !roots.any((r) => r.path == d.path)) {
        roots.add(d);
      }
    }

    // Android: scan internal + any external storages (SD card)
    if (rootPath == '/storage/emulated/0' || defaultTargetPlatform == TargetPlatform.android) {
      // 1. Scan /storage directory for SD cards like /storage/XXXX-XXXX
      final storageBase = Directory('/storage');
      try {
        if (await storageBase.exists()) {
          await for (final entity in storageBase.list()) {
            if (entity is Directory) {
              final name = entity.path.split('/').last;
              // Skip emulated (already covered) and self
              if (name != 'emulated' && name != 'self' && !name.startsWith('.')) {
                if (await entity.exists() && !roots.any((r) => r.path == entity.path)) {
                  roots.add(entity);
                }
              }
            }
          }
        }
      } catch (e) {
        debugPrint('[Scanner] /storage listing note: $e');
      }

      // 2. Discover physical SD card roots via getExternalStorageDirectories()
      try {
        final externalDirs = await getExternalStorageDirectories();
        if (externalDirs != null) {
          for (final dir in externalDirs) {
            final match = RegExp(r'^(/storage/[^/]+)').firstMatch(dir.path);
            if (match != null) {
              final sdRoot = Directory(match.group(1)!);
              final name = sdRoot.path.split('/').last;
              if (name != 'emulated' && name != 'self' && !roots.any((r) => r.path == sdRoot.path)) {
                if (await sdRoot.exists()) {
                  roots.add(sdRoot);
                }
              }
            }
          }
        }
      } catch (e) {
        debugPrint('[Scanner] getExternalStorageDirectories note: $e');
      }

      // 3. Fallback check for common legacy mount points
      for (final mnt in ['/mnt/media_rw', '/mnt/sdcard', '/storage/sdcard0', '/storage/sdcard1']) {
        try {
          final d = Directory(mnt);
          if (await d.exists() && !roots.any((r) => r.path == d.path)) {
            roots.add(d);
          }
        } catch (_) {}
      }
    }

    final tracks = <Track>[];
    final skippedFiles = <String>[];
    final seen = <String>{};

    for (final root in roots) {
      final stream = root.list(recursive: true, followLinks: false).handleError((dynamic _) {});
      await for (final entity in stream) {
        if (entity is! File) continue;
        if (seen.contains(entity.path)) continue;
        if (!MetadataNormalizer.supportsExtension(entity.path)) {
          skippedFiles.add(entity.path);
          continue;
        }
        seen.add(entity.path);

        final filename = entity.uri.pathSegments.last;
        final metadata = MetadataNormalizer.fromFilename(filename);
        AudioMetadata? audioMetadata;
        try {
          audioMetadata = readMetadata(entity, getImage: true);
        } on Object catch (e) {
          debugPrint('[Scanner] metadata read failed for ${entity.path}: $e');
        }

        final title = _firstValue(audioMetadata?.title, metadata.title);
        final artist = _firstValue(audioMetadata?.artist, metadata.artist, 'Unknown Artist');
        final album = _firstValue(audioMetadata?.album, 'Unknown Album');

        String? genre;
        if (audioMetadata != null && audioMetadata.genres.isNotEmpty) {
          genre = audioMetadata.genres.join(', ');
        }

        tracks.add(
          Track(
            id: entity.path,
            title: title,
            artist: artist,
            album: album,
            duration: audioMetadata?.duration ?? Duration.zero,
            genre: genre,
            filePath: entity.path,
            artworkBytes: audioMetadata?.pictures.isEmpty ?? true ? null : audioMetadata!.pictures.first.bytes,
            embeddedLyrics: audioMetadata?.lyrics,
          ),
        );
      }
    }

    tracks.sort((a, b) => a.title.toLowerCase().compareTo(b.title.toLowerCase()));
    return ScanResult(tracks: tracks, skippedFiles: skippedFiles);
  }

  static String _firstValue(String? primary, [String? fallback, String? lastFallback]) {
    for (final value in [primary, fallback, lastFallback]) {
      if (value != null && value.trim().isNotEmpty) {
        return value.trim();
      }
    }
    return 'Unknown';
  }
}