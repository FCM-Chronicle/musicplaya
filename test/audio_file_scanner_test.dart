import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

import 'package:musicplaya/library/audio_file_scanner.dart';

void main() {
  test('scans supported audio files recursively and skips other files', () async {
    final root = await Directory.systemTemp.createTemp('musicplaya_scan_');
    addTearDown(() => root.delete(recursive: true));
    final nested = Directory('${root.path}${Platform.pathSeparator}nested');
    await nested.create();
    await File('${root.path}${Platform.pathSeparator}B - Second.opus').writeAsString('');
    await File('${nested.path}${Platform.pathSeparator}A - First.m4a').writeAsString('');
    final ignored = '${nested.path}${Platform.pathSeparator}cover.jpg';
    await File(ignored).writeAsString('');

    final result = await const AudioFileScanner().scan(root.path);

    expect(result.tracks.map((track) => track.title), ['First', 'Second']);
    expect(result.tracks.first.artist, 'A');
    expect(result.tracks.first.filePath, contains('A - First.m4a'));
    expect(result.skippedFiles, contains(ignored));
  });

  test('returns an empty result for a missing folder', () async {
    final result = await const AudioFileScanner().scan('${Directory.systemTemp.path}/missing_musicplaya_folder');

    expect(result.tracks, isEmpty);
    expect(result.skippedFiles, isEmpty);
  });
}