import 'package:flutter_test/flutter_test.dart';

import 'package:musicplaya/library/metadata_normalizer.dart';

void main() {
  test('removes common video suffix noise', () {
    expect(
      MetadataNormalizer.clean('IU - Love wins all [Official Audio] (Live)'),
      'IU - Love wins all',
    );
  });

  test('splits artist and title from a downloaded filename', () {
    final result = MetadataNormalizer.fromFilename('아이유 - Love wins all [MV].opus');

    expect(result.artist, '아이유');
    expect(result.title, 'Love wins all');
  });

  test('preserves metadata artist when a filename has no split', () {
    final result = MetadataNormalizer.fromFilename('Track 01 (Official Music Video).m4a', metadataArtist: 'Channel Name');

    expect(result.artist, 'Channel Name');
    expect(result.title, 'Track 01');
  });

  test('recognizes requested audio formats only', () {
    expect(MetadataNormalizer.supportsExtension('/music/song.OPUS'), isTrue);
    expect(MetadataNormalizer.supportsExtension('/music/song.m4a'), isTrue);
    expect(MetadataNormalizer.supportsExtension('/music/cover.jpg'), isFalse);
  });
}