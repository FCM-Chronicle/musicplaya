import 'dart:async';
import 'dart:io';

import 'package:flutter/services.dart';

class LocalAssetServer {
  HttpServer? _server;

  Future<Uri> start() async {
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    _server = server;
    unawaited(_serve(server));
    return Uri.parse('http://${server.address.address}:${server.port}/index.html');
  }

  Future<void> _serve(HttpServer server) async {
    await for (final request in server) {
      final requestedPath = request.uri.path == '/' ? 'index.html' : request.uri.path.substring(1);
      if (requestedPath.contains('..') || requestedPath.contains('\\')) {
        request.response
          ..statusCode = HttpStatus.forbidden
          ..close();
        continue;
      }

      final assetPath = 'assets/web/$requestedPath';
      try {
        final data = await rootBundle.load(assetPath);
        request.response
          ..statusCode = HttpStatus.ok
          ..headers.contentType = _contentType(requestedPath)
          ..add(data.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes));
      } on Object {
        request.response.statusCode = HttpStatus.notFound;
      } finally {
        await request.response.close();
      }
    }
  }

  Future<void> stop() async {
    await _server?.close(force: true);
    _server = null;
  }

  ContentType _contentType(String path) {
    if (path.endsWith('.html')) return ContentType.html;
    if (path.endsWith('.js')) return ContentType('text', 'javascript', charset: 'utf-8');
    if (path.endsWith('.css')) return ContentType('text', 'css', charset: 'utf-8');
    if (path.endsWith('.json')) return ContentType.json;
    if (path.endsWith('.svg')) return ContentType('image', 'svg+xml');
    if (path.endsWith('.png')) return ContentType('image', 'png');
    if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return ContentType('image', 'jpeg');
    return ContentType.binary;
  }
}