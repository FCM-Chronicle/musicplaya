import 'dart:async';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:path_provider/path_provider.dart';
import 'package:just_audio/just_audio.dart';

import '../library/audio_file_scanner.dart';
import '../playback/audio_playback_service.dart';
import '../storage/queue_store.dart';
import 'track.dart';

enum RepeatState { none, all, one }

class PlaybackQueue {
  PlaybackQueue({required this.id, required this.name, required List<Track> tracks})
      : tracks = List<Track>.of(tracks);

  final String id;
  final String name;
  final List<Track> tracks;
  int currentIndex = 0;
  Duration position = Duration.zero;

  Track get currentTrack => tracks[currentIndex];
}

class PlayerController extends ChangeNotifier {
  PlayerController({List<PlaybackQueue>? queues, this.store, this.playback})
      : queues = queues ?? [] {
    final audioPlayback = playback;
    if (audioPlayback != null) {
      _positionSubscription = audioPlayback.positionStream.listen((position) {
        if (this.queues.isNotEmpty) {
          currentQueue.position = position;
        }
        notifyListeners();
      });
      _stateSubscription = audioPlayback.stateStream.listen((state) {
        if (isPlaying != state.playing) {
          isPlaying = state.playing;
          notifyListeners();
        }
        if (state.processingState == ProcessingState.completed) {
          _handleTrackCompleted();
        }
      });
    }
  }

  final List<PlaybackQueue> queues;
  final QueueStore? store;
  final AudioPlaybackService? playback;
  final AudioFileScanner _scanner = const AudioFileScanner();
  StreamSubscription<Duration>? _positionSubscription;
  StreamSubscription<dynamic>? _stateSubscription;
  int selectedQueueIndex = 0;
  String? _loadedTrackId;
  bool isPlaying = false;
  
  bool isShuffle = false;
  RepeatState repeatState = RepeatState.none;
  bool isKaraokeOn = false;
  int pitchShift = 0;
  final Random _random = Random();

  PlaybackQueue get currentQueue => queues.isNotEmpty
      ? queues[selectedQueueIndex.clamp(0, queues.length - 1)]
      : PlaybackQueue(id: 'empty', name: '빈 대기열', tracks: [_emptyTrack]);
  Track get currentTrack => currentQueue.currentTrack;

  static final Track _emptyTrack = const Track(
    id: 'empty',
    title: '재생할 곡 없음',
    artist: '라이브러리를 스캔하세요',
    album: '',
    duration: Duration.zero,
  );

  Future<void> restore() async {
    final snapshot = await store?.restore();
    if (snapshot == null || snapshot.queues.isEmpty) {
      return;
    }
    queues
      ..clear()
      ..addAll(snapshot.queues);
    selectedQueueIndex = snapshot.selectedQueueIndex;
    notifyListeners();
  }

  void _changed() {
    notifyListeners();
    unawaited(store?.save(queues: queues, selectedQueueIndex: selectedQueueIndex));
  }

  Future<void> scanEntireDevice() async {
    bool hasPermission = false;

    if (defaultTargetPlatform == TargetPlatform.android) {
      // Android 13+ → READ_MEDIA_AUDIO
      // Android 12 이하 → READ_EXTERNAL_STORAGE
      final audioStatus = await Permission.audio.request();
      if (audioStatus.isGranted) {
        hasPermission = true;
      } else {
        // Android 12 이하 fallback
        final storageStatus = await Permission.storage.request();
        hasPermission = storageStatus.isGranted;
      }
    } else {
      hasPermission = await Permission.storage.request().isGranted;
    }

    if (!hasPermission) {
      debugPrint('[Scanner] Permission denied — cannot scan');
      return;
    }

    String path;
    if (defaultTargetPlatform == TargetPlatform.android) {
      path = '/storage/emulated/0';
    } else {
      path = (await getApplicationDocumentsDirectory()).path;
    }

    debugPrint('[Scanner] Scanning: $path');
    final result = await _scanner.scan(path);
    debugPrint('[Scanner] Found ${result.tracks.length} tracks, skipped ${result.skippedFiles.length}');

    if (result.tracks.isEmpty) return;

    // 스캔 성공 시 데모/더미 큐 모두 제거하고 실제 라이브러리로 교체
    final libraryQueue = PlaybackQueue(
      id: 'local-library',
      name: '내 기기 음악',
      tracks: result.tracks,
    );
    queues
      ..removeWhere((q) => q.id == 'local-library' || q.id == 'late-night' || q.id == 'focus' || q.id == 'context')
      ..insert(0, libraryQueue);
    selectedQueueIndex = 0;
    _changed();
  }

  void selectQueue(int index) {
    if (index < 0 || index >= queues.length || index == selectedQueueIndex) return;
    selectedQueueIndex = index;
    isPlaying = false;
    _changed();
  }

  void selectTrack(int index) {
    if (index < 0 || index >= currentQueue.tracks.length) return;
    currentQueue.currentIndex = index;
    currentQueue.position = Duration.zero;
    isPlaying = true;
    _changed();
    unawaited(_loadAndPlayCurrent());
  }

  void togglePlay() {
    if (queues.isEmpty || currentQueue.tracks.isEmpty) return;
    isPlaying = !isPlaying;
    _changed();
    if (isPlaying) {
      // If the same track is already loaded, just resume; otherwise load fresh
      if (_loadedTrackId == currentTrack.id) {
        unawaited(playback?.play());
      } else {
        unawaited(_loadAndPlayCurrent());
      }
    } else {
      unawaited(playback?.pause());
    }
  }

  /// 컨텍스트(앨범/아티스트/장르)에서 곡을 선택했을 때 해당 그룹을 임시 대기열로 세팅
  void setContextQueue({required List<Track> tracks, required int startIndex}) {
    final queue = PlaybackQueue(id: 'context', name: 'Context Queue', tracks: tracks);
    queue.currentIndex = startIndex.clamp(0, tracks.length - 1);
    // 기존 context 큐는 교체, 아니면 맨 앞에 삽입
    final existing = queues.indexWhere((q) => q.id == 'context');
    if (existing >= 0) {
      queues[existing] = queue;
      selectedQueueIndex = existing;
    } else {
      queues.insert(0, queue);
      selectedQueueIndex = 0;
    }
    isPlaying = true;
    _changed();
    unawaited(_loadAndPlayCurrent());
  }
  
  void toggleShuffle() {
    isShuffle = !isShuffle;
    _changed();
  }
  
  void toggleRepeat() {
    switch (repeatState) {
      case RepeatState.none:
        repeatState = RepeatState.all;
        break;
      case RepeatState.all:
        repeatState = RepeatState.one;
        break;
      case RepeatState.one:
        repeatState = RepeatState.none;
        break;
    }
    _changed();
  }

  Future<void> seek(Duration position) async {
    currentQueue.position = position;
    _changed();
    if (playback != null) {
      await playback!.seek(position);
    }
  }

  void next() {
    if (currentQueue.tracks.isEmpty) return;
    
    if (isShuffle) {
      currentQueue.currentIndex = _random.nextInt(currentQueue.tracks.length);
    } else {
      final nextIndex = currentQueue.currentIndex + 1;
      currentQueue.currentIndex = nextIndex < currentQueue.tracks.length ? nextIndex : 0;
    }
    
    currentQueue.position = Duration.zero;
    isPlaying = true;
    _changed();
    unawaited(_loadAndPlayCurrent());
  }

  void previous() {
    if (currentQueue.tracks.isEmpty) return;
    
    if (isShuffle) {
      currentQueue.currentIndex = _random.nextInt(currentQueue.tracks.length);
    } else {
      final previousIndex = currentQueue.currentIndex - 1;
      currentQueue.currentIndex = previousIndex < 0
          ? currentQueue.tracks.length - 1
          : previousIndex;
    }
    
    currentQueue.position = Duration.zero;
    isPlaying = true;
    _changed();
    unawaited(_loadAndPlayCurrent());
  }
  
  void _handleTrackCompleted() {
    if (currentQueue.tracks.isEmpty) return;
    
    if (repeatState == RepeatState.one) {
      currentQueue.position = Duration.zero;
      unawaited(_loadAndPlayCurrent());
      return;
    }
    
    if (isShuffle) {
      currentQueue.currentIndex = _random.nextInt(currentQueue.tracks.length);
    } else {
      final nextIndex = currentQueue.currentIndex + 1;
      if (nextIndex >= currentQueue.tracks.length) {
        if (repeatState == RepeatState.all) {
          currentQueue.currentIndex = 0;
        } else {
          // Reached end of queue without repeat all
          isPlaying = false;
          currentQueue.position = Duration.zero;
          _changed();
          return;
        }
      } else {
        currentQueue.currentIndex = nextIndex;
      }
    }
    
    currentQueue.position = Duration.zero;
    isPlaying = true;
    _changed();
    unawaited(_loadAndPlayCurrent());
  }

  void reorderCurrentTrack(int oldIndex, int newIndex) {
    final tracks = currentQueue.tracks;
    if (oldIndex < 0 || oldIndex >= tracks.length) return;
    if (newIndex > oldIndex) newIndex -= 1;
    final track = tracks.removeAt(oldIndex);
    tracks.insert(newIndex.clamp(0, tracks.length), track);
    if (currentQueue.currentIndex == oldIndex) {
      currentQueue.currentIndex = newIndex;
    }
    _changed();
  }

  Future<void> _loadAndPlayCurrent() async {
    final audioPlayback = playback;
    final path = currentTrack.filePath;
    if (audioPlayback == null || path == null || path.isEmpty) return;
    await audioPlayback.load(currentTrack);
    unawaited(audioPlayback.setPitch(pitchShift));
    _loadedTrackId = currentTrack.id;
    final savedPosition = currentQueue.position;
    if (savedPosition > Duration.zero) {
      await audioPlayback.seek(savedPosition);
    }
    if (isPlaying) {
      await audioPlayback.play();
    }
  }

  void setKaraokeMode(bool enabled) {
    if (isKaraokeOn == enabled) return;
    isKaraokeOn = enabled;
    _changed();
  }

  void setPitch(int semitones) {
    if (pitchShift == semitones) return;
    pitchShift = semitones.clamp(-6, 6);
    _changed();
    unawaited(playback?.setPitch(pitchShift));
  }

  void createPlaylist(String name) {
    final id = 'playlist_${DateTime.now().millisecondsSinceEpoch}';
    final playlistQueue = PlaybackQueue(id: id, name: name, tracks: []);
    queues.add(playlistQueue);
    _changed();
  }

  void addTrackToPlaylist(String playlistId, Track track) {
    final queueIndex = queues.indexWhere((q) => q.id == playlistId);
    if (queueIndex != -1) {
      queues[queueIndex].tracks.add(track);
      _changed();
    }
  }

  @override
  void dispose() {
    unawaited(_positionSubscription?.cancel());
    unawaited(_stateSubscription?.cancel());
    unawaited(playback?.dispose());
    super.dispose();
  }
}


