import 'dart:async';

import 'package:flutter/material.dart';
import 'package:audio_service/audio_service.dart';

import 'player/player_controller.dart';
import 'player/track.dart';
import 'playback/music_audio_handler.dart';
import 'playback/audio_playback_service.dart';
import 'storage/queue_store.dart';
import 'lyrics/lyrics_view.dart';
import 'frontend/frontend_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const MusicoApp());
  unawaited(_initializeAudioService());
}

Future<void> _initializeAudioService() async {
  try {
    await AudioService.init(
      builder: MusicAudioHandler.new,
      config: AudioServiceConfig(
        androidNotificationChannelId: 'com.example.musicplaya.playback',
        androidNotificationChannelName: 'Music playback',
        androidNotificationOngoing: true,
        androidStopForegroundOnPause: false,
      ),
    ).timeout(const Duration(seconds: 5));
  } on Object catch (_) {
    // The UI remains usable when a platform media service is unavailable.
  }
}

class MusicoApp extends StatefulWidget {
  const MusicoApp({this.audioHandler, this.useFrontend = false, super.key});

  final AudioHandler? audioHandler;
  final bool useFrontend;

  @override
  State<MusicoApp> createState() => _MusicoAppState();
}

class _MusicoAppState extends State<MusicoApp> {
  late final PlayerController controller;

  @override
  void initState() {
    super.initState();
    controller = PlayerController(
      store: const QueueStore(),
      playback: AudioPlaybackService(),
    );
    controller.restore();
  }

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Musico',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF101212),
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFFE5B96B),
          brightness: Brightness.dark,
        ),
        useMaterial3: true,
      ),
      home: widget.useFrontend ? FrontendScreen(player: controller) : PlayerHome(controller: controller),
    );
  }
}

class PlayerHome extends StatefulWidget {
  const PlayerHome({required this.controller, super.key});

  final PlayerController controller;

  @override
  State<PlayerHome> createState() => _PlayerHomeState();
}

class _PlayerHomeState extends State<PlayerHome> {
  int selectedTab = 0;

  PlayerController get player => widget.controller;

  @override
  void initState() {
    super.initState();
    player.addListener(_refresh);
  }

  @override
  void dispose() {
    player.removeListener(_refresh);
    super.dispose();
  }

  void _refresh() => setState(() {});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            const _TopBar(),
            Expanded(child: _buildContent()),
            _NowPlayingBar(player: player),
            _NavigationBar(
              selectedIndex: selectedTab,
              onSelected: (index) => setState(() => selectedTab = index),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildContent() {
    switch (selectedTab) {
      case 1:
        return _QueueView(player: player);
      case 2:
        return _LibraryView(player: player);
      default:
        return _HomeView(player: player);
    }
  }
}

class _TopBar extends StatelessWidget {
  const _TopBar();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(22, 18, 14, 10),
      child: Row(
        children: [
          const Text(
            'MUSICO',
            style: TextStyle(
              color: Color(0xFFE5B96B),
              fontSize: 19,
              fontWeight: FontWeight.w800,
              letterSpacing: 3,
            ),
          ),
          const Spacer(),
          IconButton(
            onPressed: () {},
            tooltip: 'Search library',
            icon: const Icon(Icons.search_rounded),
          ),
          IconButton(
            onPressed: () {},
            tooltip: 'Settings',
            icon: const Icon(Icons.tune_rounded),
          ),
        ],
      ),
    );
  }
}

class _HomeView extends StatelessWidget {
  const _HomeView({required this.player});

  final PlayerController player;

  @override
  Widget build(BuildContext context) {
    final track = player.currentTrack;
    return ListView(
      padding: const EdgeInsets.fromLTRB(22, 16, 22, 26),
      children: [
        Text('Good evening', style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w700)),
        const SizedBox(height: 6),
        Text('Your music, without the noise.', style: TextStyle(color: Colors.white.withValues(alpha: 0.55))),
        const SizedBox(height: 26),
        _HeroTrack(track: track, playing: player.isPlaying),
        const SizedBox(height: 30),
        Row(
          children: [
            Text(
              'QUEUES',
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.5),
                fontSize: 12,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.7,
              ),
            ),
            const Spacer(),
            Text('${player.queues.length} active', style: TextStyle(color: Colors.white.withValues(alpha: 0.45))),
          ],
        ),
        const SizedBox(height: 12),
        ...player.queues.asMap().entries.map(
          (entry) => _QueueTile(
            queue: entry.value,
            selected: entry.key == player.selectedQueueIndex,
            onTap: () => player.selectQueue(entry.key),
          ),
        ),
      ],
    );
  }
}

class _HeroTrack extends StatelessWidget {
  const _HeroTrack({required this.track, required this.playing});

  final Track track;
  final bool playing;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(color: Color(track.coverColor), borderRadius: BorderRadius.circular(8)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.graphic_eq_rounded, color: Colors.white70),
              const SizedBox(width: 8),
              Text(
                playing ? 'NOW PLAYING' : 'READY TO PLAY',
                style: const TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 1.3),
              ),
            ],
          ),
          const SizedBox(height: 76),
          Text(track.title, style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w800)),
          const SizedBox(height: 4),
          Text(track.artist, style: const TextStyle(color: Colors.white70)),
        ],
      ),
    );
  }
}

class _QueueTile extends StatelessWidget {
  const _QueueTile({required this.queue, required this.selected, required this.onTap});

  final PlaybackQueue queue;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 2),
      onTap: onTap,
      leading: Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(color: Color(queue.tracks.first.coverColor), borderRadius: BorderRadius.circular(5)),
        child: Icon(selected ? Icons.graphic_eq_rounded : Icons.queue_music_rounded, color: Colors.white70),
      ),
      title: Text(queue.name, style: const TextStyle(fontWeight: FontWeight.w700)),
      subtitle: Text('${queue.tracks.length} tracks'),
      trailing: selected ? const Icon(Icons.check_circle_rounded, color: Color(0xFFE5B96B)) : const Icon(Icons.chevron_right_rounded),
    );
  }
}

class _QueueView extends StatelessWidget {
  const _QueueView({required this.player});

  final PlayerController player;

  @override
  Widget build(BuildContext context) {
    final queue = player.currentQueue;
    return ReorderableListView.builder(
      padding: const EdgeInsets.fromLTRB(22, 16, 22, 22),
      itemCount: queue.tracks.length,
      onReorderItem: player.reorderCurrentTrack,
      itemBuilder: (context, index) {
        final track = queue.tracks[index];
        return ListTile(
          key: ValueKey(track.id),
          contentPadding: EdgeInsets.zero,
          onTap: () => player.selectTrack(index),
          leading: _Artwork(track: track, size: 48),
          title: Text(track.title),
          subtitle: Text(track.artist),
          trailing: index == queue.currentIndex ? const Icon(Icons.equalizer_rounded, color: Color(0xFFE5B96B)) : Text(_formatDuration(track.duration)),
        );
      },
    );
  }
}

class _LibraryView extends StatefulWidget {
  const _LibraryView({required this.player});
  final PlayerController player;
  @override
  State<_LibraryView> createState() => _LibraryViewState();
}

class _LibraryViewState extends State<_LibraryView> {
  @override
  Widget build(BuildContext context) {
    final localQueue = widget.player.queues.where((q) => q.id == 'local-library').firstOrNull;
    
    if (localQueue == null || localQueue.tracks.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(30),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.library_music_outlined, size: 52, color: Color(0xFFE5B96B)),
              const SizedBox(height: 18),
              Text('Your library starts here', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 8),
              Text('Folder scanning will connect your local music to this library.', textAlign: TextAlign.center, style: TextStyle(color: Colors.white.withValues(alpha: 0.55))),
              const SizedBox(height: 22),
              FilledButton.icon(
                onPressed: widget.player.scanEntireDevice,
                icon: const Icon(Icons.manage_search_rounded),
                label: const Text('Scan Entire Device'),
              ),
            ],
          ),
        ),
      );
    }

    final tracks = localQueue.tracks;
    
    // Grouping
    final artists = <String, int>{};
    final albums = <String, int>{};
    final genres = <String, int>{};
    
    for (final t in tracks) {
      artists[t.artist] = (artists[t.artist] ?? 0) + 1;
      albums[t.album] = (albums[t.album] ?? 0) + 1;
      final genre = t.genre ?? 'Unknown Genre';
      genres[genre] = (genres[genre] ?? 0) + 1;
    }

    final artistList = artists.entries.toList()..sort((a, b) => a.key.compareTo(b.key));
    final albumList = albums.entries.toList()..sort((a, b) => a.key.compareTo(b.key));
    final genreList = genres.entries.toList()..sort((a, b) => a.key.compareTo(b.key));

    return DefaultTabController(
      length: 4,
      child: Column(
        children: [
          const TabBar(
            indicatorColor: Color(0xFFE5B96B),
            labelColor: Color(0xFFE5B96B),
            unselectedLabelColor: Colors.white54,
            isScrollable: true,
            tabAlignment: TabAlignment.start,
            tabs: [
              Tab(text: 'Tracks'),
              Tab(text: 'Artists'),
              Tab(text: 'Albums'),
              Tab(text: 'Genres'),
            ],
          ),
          Expanded(
            child: TabBarView(
              children: [
                ListView.builder(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  itemCount: tracks.length,
                  itemBuilder: (context, i) => ListTile(
                    leading: _Artwork(track: tracks[i], size: 44),
                    title: Text(tracks[i].title, maxLines: 1),
                    subtitle: Text(tracks[i].artist, maxLines: 1),
                    onTap: () {
                      widget.player.selectQueue(widget.player.queues.indexOf(localQueue));
                      widget.player.selectTrack(i);
                    },
                  ),
                ),
                ListView.builder(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  itemCount: artistList.length,
                  itemBuilder: (context, i) => ListTile(
                    leading: const CircleAvatar(backgroundColor: Color(0xFF1E2323), child: Icon(Icons.person_rounded, color: Colors.white54)),
                    title: Text(artistList[i].key),
                    subtitle: Text('${artistList[i].value} tracks'),
                  ),
                ),
                ListView.builder(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  itemCount: albumList.length,
                  itemBuilder: (context, i) => ListTile(
                    leading: Container(width: 44, height: 44, decoration: BoxDecoration(color: const Color(0xFF1E2323), borderRadius: BorderRadius.circular(4)), child: const Icon(Icons.album_rounded, color: Colors.white54)),
                    title: Text(albumList[i].key),
                    subtitle: Text('${albumList[i].value} tracks'),
                  ),
                ),
                ListView.builder(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  itemCount: genreList.length,
                  itemBuilder: (context, i) => ListTile(
                    leading: Container(width: 44, height: 44, decoration: BoxDecoration(color: const Color(0xFF1E2323), borderRadius: BorderRadius.circular(4)), child: const Icon(Icons.style_rounded, color: Colors.white54)),
                    title: Text(genreList[i].key),
                    subtitle: Text('${genreList[i].value} tracks'),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
class _NowPlayingBar extends StatelessWidget {
  const _NowPlayingBar({required this.player});

  final PlayerController player;

  @override
  Widget build(BuildContext context) {
    final track = player.currentTrack;
    return Container(
      padding: const EdgeInsets.fromLTRB(18, 10, 18, 10),
      decoration: BoxDecoration(color: const Color(0xFF1A1E1E), border: Border(top: BorderSide(color: Colors.white.withValues(alpha: 0.08)))),
      child: Row(
        children: [
          _Artwork(track: track, size: 48),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(track.title, maxLines: 1, overflow: TextOverflow.ellipsis),
                Text(track.artist, style: TextStyle(color: Colors.white.withValues(alpha: 0.55), fontSize: 12)),
              ],
            ),
          ),
          IconButton(onPressed: player.previous, tooltip: 'Previous track', icon: const Icon(Icons.skip_previous_rounded)),
          IconButton(
            onPressed: () => showModalBottomSheet<void>(
              context: context,
              isScrollControlled: true,
              backgroundColor: const Color(0xFF171B1B),
              builder: (_) => SizedBox(height: MediaQuery.sizeOf(context).height * 0.82, child: LyricsPanel(track: track)),
            ),
            tooltip: 'Lyrics',
            icon: const Icon(Icons.lyrics_outlined),
          ),
          IconButton(
            onPressed: player.togglePlay,
            tooltip: player.isPlaying ? 'Pause' : 'Play',
            icon: Icon(player.isPlaying ? Icons.pause_circle_filled_rounded : Icons.play_circle_fill_rounded),
            iconSize: 36,
          ),
          IconButton(onPressed: player.next, tooltip: 'Next track', icon: const Icon(Icons.skip_next_rounded)),
        ],
      ),
    );
  }
}

class _Artwork extends StatelessWidget {
  const _Artwork({required this.track, required this.size});

  final Track track;
  final double size;

  @override
  Widget build(BuildContext context) {
    final artwork = track.artworkBytes;
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(color: Color(track.coverColor), borderRadius: BorderRadius.circular(5)),
      clipBehavior: Clip.antiAlias,
      child: artwork == null
          ? const Icon(Icons.music_note_rounded, color: Colors.white54)
          : Image.memory(artwork, fit: BoxFit.cover, errorBuilder: (_, _, _) => const Icon(Icons.music_note_rounded, color: Colors.white54)),
    );
  }
}

class _NavigationBar extends StatelessWidget {
  const _NavigationBar({required this.selectedIndex, required this.onSelected});

  final int selectedIndex;
  final ValueChanged<int> onSelected;

  @override
  Widget build(BuildContext context) {
    return NavigationBar(
      selectedIndex: selectedIndex,
      onDestinationSelected: onSelected,
      backgroundColor: const Color(0xFF151818),
      destinations: const [
        NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'Home'),
        NavigationDestination(icon: Icon(Icons.queue_music_outlined), selectedIcon: Icon(Icons.queue_music), label: 'Queue'),
        NavigationDestination(icon: Icon(Icons.library_music_outlined), selectedIcon: Icon(Icons.library_music), label: 'Library'),
      ],
    );
  }
}

String _formatDuration(Duration duration) {
  final minutes = duration.inMinutes;
  final seconds = duration.inSeconds.remainder(60).toString().padLeft(2, '0');
  return '$minutes:$seconds';
}



