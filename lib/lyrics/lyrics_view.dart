import 'dart:io';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:audio_metadata_reader/audio_metadata_reader.dart';

import '../player/track.dart';
import 'lrclib_service.dart';

class LyricsPanel extends StatefulWidget {
  const LyricsPanel({required this.track, super.key});

  final Track track;

  @override
  State<LyricsPanel> createState() => _LyricsPanelState();
}

class _LyricsPanelState extends State<LyricsPanel> {
  late final LrclibService service;
  late Future<List<LyricCandidate>> searchFuture;
  double offsetSeconds = 0;
  LyricCandidate? selected;
  List<LyricCandidate> candidates = const [];

  @override
  void initState() {
    super.initState();
    service = LrclibService();
    searchFuture = _search();
  }

  Future<List<LyricCandidate>> _search() async {
    final localCandidates = <LyricCandidate>[];
    final path = widget.track.filePath;
    
    // 1. Check local .lrc file next to the audio file
    if (path != null) {
      final lrcPath = path.replaceAll(RegExp(r'\.[^.]+$'), '.lrc');
      final lrcFile = File(lrcPath);
      if (lrcFile.existsSync()) {
        localCandidates.add(LyricCandidate(
          id: -1,
          trackName: '${widget.track.title} (Local File)',
          artistName: widget.track.artist,
          duration: widget.track.duration,
          syncedLyrics: lrcFile.readAsStringSync(),
        ));
      }
    }

    // 2. Check embedded lyrics
    String? embedded = widget.track.embeddedLyrics;
    if (embedded == null && path != null) {
      try {
        final metadata = await Future.microtask(() => readMetadata(File(path), getImage: false));
        embedded = metadata.lyrics;
      } catch (_) {}
    }

    if (embedded != null && embedded.trim().isNotEmpty) {
      localCandidates.add(LyricCandidate(
        id: -2,
        trackName: '${widget.track.title} (Embedded)',
        artistName: widget.track.artist,
        duration: widget.track.duration,
        syncedLyrics: embedded.contains('[00:') ? embedded : null,
        plainLyrics: embedded,
      ));
    }

    // 3. Check App Cache
    File? cacheFile;
    if (path != null) {
      try {
        final docsDir = await getApplicationDocumentsDirectory();
        final cacheDir = Directory('${docsDir.path}/lyrics_cache');
        if (!cacheDir.existsSync()) {
          cacheDir.createSync(recursive: true);
        }
        final safeName = base64UrlEncode(utf8.encode(path));
        cacheFile = File('${cacheDir.path}/$safeName.json');
        if (cacheFile.existsSync()) {
          final cachedData = jsonDecode(cacheFile.readAsStringSync()) as Map<String, dynamic>;
          localCandidates.add(LyricCandidate.fromJson(cachedData));
        }
      } catch (_) {}
    }

    if (localCandidates.isNotEmpty) {
      if (mounted) {
        setState(() {
          candidates = localCandidates;
          selected = localCandidates.first;
        });
      }
      return localCandidates;
    }

    // 4. Fetch from LRCLIB
    final results = await service.search(
      title: widget.track.title,
      artist: widget.track.artist,
      duration: widget.track.duration == Duration.zero ? null : widget.track.duration,
    );
    final ranked = LrclibService.rank(
      results,
      targetDuration: widget.track.duration == Duration.zero ? null : widget.track.duration,
    );
    
    if (mounted) {
      setState(() {
        candidates = ranked;
        selected = ranked.isEmpty ? null : ranked.first;
      });
    }

    // Save highest ranked to cache
    if (ranked.isNotEmpty && cacheFile != null) {
      try {
        cacheFile.writeAsStringSync(jsonEncode({
          'id': ranked.first.id,
          'trackName': ranked.first.trackName,
          'artistName': ranked.first.artistName,
          'duration': ranked.first.duration.inSeconds,
          'syncedLyrics': ranked.first.syncedLyrics,
          'plainLyrics': ranked.first.plainLyrics,
        }));
      } catch (_) {}
    }

    return ranked;
  }

  @override
  void dispose() {
    service.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(22, 14, 22, 22),
        child: FutureBuilder<List<LyricCandidate>>(
          future: searchFuture,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snapshot.hasError) {
              return _Message(
                icon: Icons.cloud_off_rounded,
                text: 'Lyrics could not be loaded.',
                action: TextButton(onPressed: () => setState(() => searchFuture = _search()), child: const Text('Retry')),
              );
            }
            if (selected == null) {
              return const _Message(icon: Icons.lyrics_outlined, text: 'No lyrics found for this track.');
            }
            return _LyricsContent(
              track: widget.track,
              candidate: selected!,
              alternatives: candidates,
              offsetSeconds: offsetSeconds,
              onOffsetChanged: (value) => setState(() => offsetSeconds = value),
              onSelectAlternative: _selectAlternative,
            );
          },
        ),
      ),
    );
  }

  Future<void> _selectAlternative() async {
    final choice = await showModalBottomSheet<LyricCandidate>(
      context: context,
      showDragHandle: true,
      builder: (context) => ListView(
        shrinkWrap: true,
        children: [
          const ListTile(title: Text('Choose lyrics'), subtitle: Text('Synced and Korean results are ranked first.')),
          ...candidates.map(
            (candidate) => ListTile(
              leading: Icon(candidate.hasSyncedLyrics ? Icons.sync_rounded : Icons.notes_rounded),
              title: Text(candidate.trackName),
              subtitle: Text('${candidate.artistName}  •  ${candidate.duration.inSeconds}s'),
              trailing: candidate.id == selected?.id ? const Icon(Icons.check_rounded) : null,
              onTap: () => Navigator.pop(context, candidate),
            ),
          ),
        ],
      ),
    );
    if (choice != null && mounted) {
      setState(() => selected = choice);
      
      // Save choice to cache
      final path = widget.track.filePath;
      if (path != null) {
        try {
          final docsDir = await getApplicationDocumentsDirectory();
          final cacheDir = Directory('${docsDir.path}/lyrics_cache');
          if (!cacheDir.existsSync()) {
            cacheDir.createSync(recursive: true);
          }
          final safeName = base64UrlEncode(utf8.encode(path));
          final cacheFile = File('${cacheDir.path}/$safeName.json');
          cacheFile.writeAsStringSync(jsonEncode({
            'id': choice.id,
            'trackName': choice.trackName,
            'artistName': choice.artistName,
            'duration': choice.duration.inSeconds,
            'syncedLyrics': choice.syncedLyrics,
            'plainLyrics': choice.plainLyrics,
          }));
        } catch (_) {}
      }
    }
  }
}

class _LyricsContent extends StatelessWidget {
  const _LyricsContent({
    required this.track,
    required this.candidate,
    required this.alternatives,
    required this.offsetSeconds,
    required this.onOffsetChanged,
    required this.onSelectAlternative,
  });

  final Track track;
  final LyricCandidate candidate;
  final List<LyricCandidate> alternatives;
  final double offsetSeconds;
  final ValueChanged<double> onOffsetChanged;
  final VoidCallback onSelectAlternative;

  @override
  Widget build(BuildContext context) {
    final synced = candidate.syncedLyrics;
    final lines = synced == null || synced.trim().isEmpty
        ? (candidate.plainLyrics ?? '').split('\n').map((text) => LyricLine(timestamp: Duration.zero, text: text)).toList()
        : LrclibService.parseSyncedLyrics(synced);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Icon(Icons.lyrics_rounded, color: Color(0xFFE5B96B)),
            const SizedBox(width: 10),
            Expanded(child: Text('${track.title} lyrics', style: Theme.of(context).textTheme.titleLarge)),
            if (alternatives.length > 1)
              IconButton(onPressed: onSelectAlternative, tooltip: 'Choose another lyrics result', icon: const Icon(Icons.swap_vert_rounded)),
          ],
        ),
        Text(candidate.hasSyncedLyrics ? 'Synced lyrics' : 'Plain lyrics', style: TextStyle(color: Colors.white.withValues(alpha: 0.5))),
        if (candidate.hasSyncedLyrics) ...[
          const SizedBox(height: 12),
          Row(
            children: [
              const Text('Sync offset'),
              Expanded(
                child: Slider(
                  value: offsetSeconds,
                  min: -5,
                  max: 5,
                  divisions: 20,
                  label: '${offsetSeconds.toStringAsFixed(1)}s',
                  onChanged: onOffsetChanged,
                ),
              ),
              SizedBox(width: 44, child: Text('${offsetSeconds >= 0 ? '+' : ''}${offsetSeconds.toStringAsFixed(1)}s')),
            ],
          ),
        ],
        const Divider(height: 24),
        Expanded(
          child: ListView.separated(
            itemCount: lines.length,
            separatorBuilder: (_, _) => const SizedBox(height: 14),
            itemBuilder: (context, index) => Text(
              lines[index].text.isEmpty ? ' ' : lines[index].text,
              style: TextStyle(fontSize: 20, height: 1.25, color: index == 0 ? Colors.white : Colors.white.withValues(alpha: 0.72)),
            ),
          ),
        ),
      ],
    );
  }
}

class _Message extends StatelessWidget {
  const _Message({required this.icon, required this.text, this.action});

  final IconData icon;
  final String text;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 42, color: const Color(0xFFE5B96B)),
          const SizedBox(height: 12),
          Text(text, textAlign: TextAlign.center),
          ?action,
        ],
      ),
    );
  }
}