import 'dart:convert';

import 'package:http/http.dart' as http;

class LyricLine {
  const LyricLine({required this.timestamp, required this.text});

  final Duration timestamp;
  final String text;
}

class LyricCandidate {
  const LyricCandidate({
    required this.id,
    required this.trackName,
    required this.artistName,
    required this.duration,
    this.syncedLyrics,
    this.plainLyrics,
  });

  factory LyricCandidate.fromJson(Map<String, dynamic> json) {
    return LyricCandidate(
      id: json['id'] as int? ?? 0,
      trackName: json['trackName'] as String? ?? '',
      artistName: json['artistName'] as String? ?? '',
      duration: Duration(seconds: (json['duration'] as num?)?.round() ?? 0),
      syncedLyrics: json['syncedLyrics'] as String?,
      plainLyrics: json['plainLyrics'] as String?,
    );
  }

  final int id;
  final String trackName;
  final String artistName;
  final Duration duration;
  final String? syncedLyrics;
  final String? plainLyrics;

  bool get hasSyncedLyrics => syncedLyrics?.trim().isNotEmpty ?? false;
  bool get hasKoreanText => RegExp(r'[가-힣]').hasMatch(syncedLyrics ?? plainLyrics ?? '');
}

class LrclibService {
  LrclibService({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  Future<List<LyricCandidate>> search({
    required String title,
    required String artist,
    Duration? duration,
  }) async {
    final uri = Uri.https('lrclib.net', '/api/search', {
      'track_name': title,
      'artist_name': artist,
      if (duration != null) 'duration': '${duration.inSeconds}',
    });
    final response = await _client.get(uri).timeout(const Duration(seconds: 8));
    if (response.statusCode != 200) {
      throw Exception('LRCLIB request failed with ${response.statusCode}');
    }
    final decoded = jsonDecode(response.body) as List<dynamic>;
    return decoded
        .whereType<Map<String, dynamic>>()
        .map(LyricCandidate.fromJson)
        .toList();
  }

  void dispose() => _client.close();

  static List<LyricCandidate> rank(List<LyricCandidate> candidates, {Duration? targetDuration}) {
    final ranked = List<LyricCandidate>.of(candidates);
    ranked.sort((left, right) {
      final syncedCompare = right.hasSyncedLyrics ? 1 : 0;
      final leftSyncedCompare = left.hasSyncedLyrics ? 1 : 0;
      if (syncedCompare != leftSyncedCompare) {
        return syncedCompare.compareTo(leftSyncedCompare);
      }
      if (left.hasKoreanText != right.hasKoreanText) {
        return left.hasKoreanText ? -1 : 1;
      }
      if (targetDuration != null) {
        final leftError = (left.duration - targetDuration).abs();
        final rightError = (right.duration - targetDuration).abs();
        return leftError.compareTo(rightError);
      }
      return 0;
    });
    return ranked;
  }

  static List<LyricLine> parseSyncedLyrics(String lyrics) {
    final lines = <LyricLine>[];
    final pattern = RegExp(r'^\[(\d+):(\d{2})(?:\.(\d{1,3}))?\]\s?(.*)$');
    for (final rawLine in lyrics.split('\n')) {
      final match = pattern.firstMatch(rawLine.trim());
      if (match == null) {
        continue;
      }
      final fraction = match.group(3)?.padRight(3, '0') ?? '000';
      lines.add(
        LyricLine(
          timestamp: Duration(
            minutes: int.parse(match.group(1)!),
            seconds: int.parse(match.group(2)!),
            milliseconds: int.parse(fraction),
          ),
          text: match.group(4) ?? '',
        ),
      );
    }
    lines.sort((left, right) => left.timestamp.compareTo(right.timestamp));
    return lines;
  }
}