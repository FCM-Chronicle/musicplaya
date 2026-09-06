import 'package:audio_service/audio_service.dart';
import 'package:just_audio/just_audio.dart';

class MusicAudioHandler extends BaseAudioHandler with QueueHandler, SeekHandler {
  MusicAudioHandler() {
    _player.playbackEventStream.map(_transformEvent).pipe(playbackState);
    _player.currentIndexStream.listen((index) {
      if (index != null && index < queue.value.length) {
        mediaItem.add(queue.value[index]);
      }
    });
  }

  final AudioPlayer _player = AudioPlayer();

  @override
  Future<void> play() => _player.play();

  @override
  Future<void> pause() => _player.pause();

  @override
  Future<void> stop() async {
    await _player.stop();
    await super.stop();
  }

  @override
  Future<void> seek(Duration position) => _player.seek(position);

  @override
  Future<void> skipToNext() => _player.seekToNext();

  @override
  Future<void> skipToPrevious() => _player.seekToPrevious();

  Future<void> loadQueue(List<MediaItem> items, {int initialIndex = 0}) async {
    final sources = items.map((item) => AudioSource.uri(Uri.file(item.id))).toList();
    queue.add(items);
    await _player.setAudioSources(sources, initialIndex: initialIndex);
    if (items.isNotEmpty) {
      mediaItem.add(items[initialIndex]);
    }
  }

  @override
  Future<void> onTaskRemoved() async {
    await stop();
  }

  PlaybackState _transformEvent(PlaybackEvent event) {
    return PlaybackState(
      controls: [
        MediaControl.skipToPrevious,
        if (_player.playing) MediaControl.pause else MediaControl.play,
        MediaControl.skipToNext,
        MediaControl.stop,
      ],
      systemActions: const {MediaAction.seek},
      androidCompactActionIndices: const [0, 1, 2],
      processingState: const {
        ProcessingState.idle: AudioProcessingState.idle,
        ProcessingState.loading: AudioProcessingState.loading,
        ProcessingState.buffering: AudioProcessingState.buffering,
        ProcessingState.ready: AudioProcessingState.ready,
        ProcessingState.completed: AudioProcessingState.completed,
      }[_player.processingState]!,
      playing: _player.playing,
      updatePosition: event.updatePosition,
      bufferedPosition: event.bufferedPosition,
      speed: _player.speed,
      queueIndex: event.currentIndex,
    );
  }
}