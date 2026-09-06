class NormalizedTitle {
  const NormalizedTitle({required this.title, this.artist});

  final String title;
  final String? artist;
}

class MetadataNormalizer {
  static const supportedExtensions = {
    'mp3',
    'flac',
    'm4a',
    'aac',
    'ogg',
    'opus',
    'wav',
    'wma',
    'alac',
    'ape',
    'dsf',
  };

  static NormalizedTitle fromFilename(String filename, {String? metadataArtist}) {
    final withoutExtension = filename.replaceFirst(RegExp(r'\.[^.]+$'), '');
    final parts = withoutExtension.split(RegExp(r'\s+-\s+'));
    if (parts.length > 1) {
      final candidateArtist = clean(parts.first);
      final candidateTitle = clean(parts.sublist(1).join(' - '));
      if (candidateArtist.isNotEmpty && candidateTitle.isNotEmpty) {
        return NormalizedTitle(artist: candidateArtist, title: candidateTitle);
      }
    }
    return NormalizedTitle(
      artist: metadataArtist == null ? null : clean(metadataArtist),
      title: clean(withoutExtension),
    );
  }

  static String clean(String value) {
    var result = value;
    final noise = RegExp(
      r'\s*(?:\[[^\]]*(?:mv|official\s+audio|official\s+video|music\s+video|lyrics?)[^\]]*\]|\([^)]*(?:official\s+music\s+video|live|lyrics?)[^)]*\))\s*',
      caseSensitive: false,
    );
    result = result.replaceAll(noise, ' ');
    result = result.replaceAll(RegExp(r'\s{2,}'), ' ');
    return result.trim().replaceFirst(RegExp(r'[-|]+\s*$'), '').trim();
  }

  static bool supportsExtension(String path) {
    final match = RegExp(r'\.([^.\\/]+)$').firstMatch(path.toLowerCase());
    return match != null && supportedExtensions.contains(match.group(1));
  }
}