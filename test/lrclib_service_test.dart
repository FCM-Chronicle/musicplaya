import 'package:flutter_test/flutter_test.dart';

import 'package:musicplaya/lyrics/lrclib_service.dart';

void main() {
  test('ranks synced Korean lyrics before unsynced alternatives', () {
    final ranked = LrclibService.rank([
      const LyricCandidate(
        id: 1,
        trackName: 'Song',
        artistName: 'Artist',
        duration: Duration(seconds: 180),
        plainLyrics: 'romanized lyrics',
      ),
      const LyricCandidate(
        id: 2,
        trackName: 'Song',
        artistName: 'Artist',
        duration: Duration(seconds: 190),
        syncedLyrics: '[00:01.00] 사랑해',
      ),
    ], targetDuration: const Duration(seconds: 180));

    expect(ranked.first.id, 2);
  });

  test('uses duration error after lyric quality signals', () {
    final ranked = LrclibService.rank([
      const LyricCandidate(
        id: 1,
        trackName: 'Song',
        artistName: 'Artist',
        duration: Duration(seconds: 200),
        syncedLyrics: '[00:01.00] one',
      ),
      const LyricCandidate(
        id: 2,
        trackName: 'Song',
        artistName: 'Artist',
        duration: Duration(seconds: 181),
        syncedLyrics: '[00:01.00] two',
      ),
    ], targetDuration: const Duration(seconds: 180));

    expect(ranked.first.id, 2);
  });

  test('parses and sorts timestamped lyric lines', () {
    final lines = LrclibService.parseSyncedLyrics('[00:02.50] later\n[00:01.5] first');

    expect(lines.first.text, 'first');
    expect(lines.first.timestamp, const Duration(seconds: 1, milliseconds: 500));
    expect(lines.last.timestamp, const Duration(seconds: 2, milliseconds: 500));
  });
}