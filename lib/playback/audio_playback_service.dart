import 'dart:math' as math;

import 'package:just_audio/just_audio.dart';

import '../player/track.dart';

class AudioPlaybackService {
  AudioPlaybackService({AudioPlayer? player}) : _player = player ?? AudioPlayer();

  final AudioPlayer _player;

  Stream<Duration> get positionStream => _player.positionStream;
  Stream<Duration?> get durationStream => _player.durationStream;
  Stream<PlayerState> get stateStream => _player.playerStateStream;
  Duration get position => _player.position;
  Duration? get duration => _player.duration;
  bool get isPlaying => _player.playing;

  Future<void> load(Track track) async {
    final filePath = track.filePath;
    if (filePath == null || filePath.isEmpty) {
      throw ArgumentError('Track has no local file path: ${track.id}');
    }
    await _player.setAudioSource(AudioSource.file(filePath));
  }

  Future<void> play() => _player.play();

  Future<void> pause() => _player.pause();

  Future<void> seek(Duration position) => _player.seek(position);

  Future<void> setSpeed(double speed) => _player.setSpeed(speed);

  Future<void> setPitch(int semitones) {
    final pitch = math.pow(2.0, semitones / 12.0).toDouble();
    return _player.setPitch(pitch);
  }

  Future<void> setVolume(double volume) => _player.setVolume(volume.clamp(0, 1));

  Future<void> stop() => _player.stop();

  Future<void> dispose() => _player.dispose();
}