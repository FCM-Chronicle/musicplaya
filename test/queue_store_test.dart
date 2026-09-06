import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:musicplaya/player/player_controller.dart';
import 'package:musicplaya/player/track.dart';
import 'package:musicplaya/storage/queue_store.dart';

void main() {
  test('round trips queues, positions, and selected queue', () async {
    SharedPreferences.setMockInitialValues({});
    final queues = [
      PlaybackQueue(id: 'q1', name: 'Queue 1', tracks: [
        const Track(id: '1', title: 'Song 1', artist: 'A', album: 'B', duration: Duration(seconds: 1)),
        const Track(id: '2', title: 'Song 2', artist: 'A', album: 'B', duration: Duration(seconds: 1)),
        const Track(id: '3', title: 'Slow Burn', artist: 'A', album: 'B', duration: Duration(seconds: 1)),
      ]),
      PlaybackQueue(id: 'q2', name: 'Queue 2', tracks: [
        const Track(id: '4', title: 'North Star', artist: 'A', album: 'B', duration: Duration(seconds: 1)),
      ]),
    ];
    queues[0].currentIndex = 2;
    queues[0].position = const Duration(seconds: 41);
    const store = QueueStore();

    await store.save(queues: queues, selectedQueueIndex: 1);
    final restored = await store.restore();

    expect(restored, isNotNull);
    expect(restored!.selectedQueueIndex, 1);
    expect(restored.queues[0].currentTrack.title, 'Slow Burn');
    expect(restored.queues[0].position, const Duration(seconds: 41));
    expect(restored.queues[1].tracks.last.title, 'North Star');
  });

  test('returns null when no saved snapshot exists', () async {
    SharedPreferences.setMockInitialValues({});

    expect(await const QueueStore().restore(), isNull);
  });
}