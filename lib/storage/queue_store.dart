import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../player/player_controller.dart';
import '../player/track.dart';

class QueueSnapshot {
  const QueueSnapshot({required this.queues, required this.selectedQueueIndex});

  final List<PlaybackQueue> queues;
  final int selectedQueueIndex;
}

class QueueStore {
  const QueueStore({this.key = 'musicplaya.queue_snapshot'});

  final String key;

  Future<void> save({required List<PlaybackQueue> queues, required int selectedQueueIndex}) async {
    final preferences = await SharedPreferences.getInstance();
    final payload = {
      'selectedQueueIndex': selectedQueueIndex,
      'queues': queues
          .map(
            (queue) => {
              'id': queue.id,
              'name': queue.name,
              'currentIndex': queue.currentIndex,
              'positionMs': queue.position.inMilliseconds,
              'tracks': queue.tracks.map((track) => track.toJson()).toList(),
            },
          )
          .toList(),
    };
    await preferences.setString(key, jsonEncode(payload));
  }

  Future<QueueSnapshot?> restore() async {
    final preferences = await SharedPreferences.getInstance();
    final encoded = preferences.getString(key);
    if (encoded == null) {
      return null;
    }
    final payload = jsonDecode(encoded) as Map<String, dynamic>;
    final rawQueues = payload['queues'] as List<dynamic>? ?? [];
    final queues = rawQueues.map((rawQueue) {
      final json = rawQueue as Map<String, dynamic>;
      final tracks = (json['tracks'] as List<dynamic>? ?? [])
          .map((track) => Track.fromJson(track as Map<String, dynamic>))
          .toList();
      final queue = PlaybackQueue(
        id: json['id'] as String,
        name: json['name'] as String,
        tracks: tracks,
      );
      if (tracks.isNotEmpty) {
        queue.currentIndex = (json['currentIndex'] as int? ?? 0).clamp(0, tracks.length - 1);
      }
      queue.position = Duration(milliseconds: json['positionMs'] as int? ?? 0);
      return queue;
    }).toList();
    if (queues.isEmpty) {
      return null;
    }
    final index = (payload['selectedQueueIndex'] as int? ?? 0).clamp(0, queues.length - 1);
    return QueueSnapshot(queues: queues, selectedQueueIndex: index);
  }
}