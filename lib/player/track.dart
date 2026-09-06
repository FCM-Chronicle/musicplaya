import 'dart:typed_data';

class Track {
  const Track({
    required this.id,
    required this.title,
    required this.artist,
    required this.album,
    required this.duration,
    this.genre,
    this.coverColor = 0xFF243447,
    this.filePath,
    this.artworkBytes,
    this.embeddedLyrics,
  });

  final String id;
  final String title;
  final String artist;
  final String album;
  final Duration duration;
  final String? genre;
  final int coverColor;
  final String? filePath;
  final Uint8List? artworkBytes;
  final String? embeddedLyrics;

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'artist': artist,
        'album': album,
        'durationMs': duration.inMilliseconds,
        'genre': genre,
        'coverColor': coverColor,
        'filePath': filePath,
      };

  factory Track.fromJson(Map<String, dynamic> json) {
    return Track(
      id: json['id'] as String,
      title: json['title'] as String,
      artist: json['artist'] as String,
      album: json['album'] as String,
      duration: Duration(milliseconds: json['durationMs'] as int? ?? 0),
      genre: json['genre'] as String?,
      coverColor: json['coverColor'] as int? ?? 0xFF243447,
      filePath: json['filePath'] as String?,
    );
  }
}