import 'dart:io';

import 'package:audio_metadata_reader/audio_metadata_reader.dart';
import 'package:flutter/foundation.dart';

import '../player/track.dart';
import 'metadata_normalizer.dart';

class ScanResult {
  const ScanResult({required this.tracks, required this.skippedFiles});

  final List<Track> tracks;
  final List<String> skippedFiles;
}

class AudioFileScanner {
  const AudioFileScanner();

  Future<ScanResult> scan(String rootPath) async {
    final roots = <Directory>[];

    // Android: scan internal + any external storages
    final primaryDir = Directory(rootPath);
    if (await primaryDir.exists()) roots.add(primaryDir);

    // Also try /storage/emulated/0 sub-paths likely to have music
    if (rootPath == '/storage/emulated/0') {
      final storageBase = Directory('/storage');
      if (await storageBase.exists()) {
        await for (final entity in storageBase.list()) {
          if (entity is Directory) {
            final name = entity.path.split('/').last;
            // Skip emulated (already covered) and self
            if (name != 'emulated' && name != 'self') {
              if (await entity.exists()) roots.add(entity);
            }
          }
        }
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