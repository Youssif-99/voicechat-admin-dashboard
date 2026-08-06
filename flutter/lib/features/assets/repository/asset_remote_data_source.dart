import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import '../core/asset_constants.dart';
import '../data/models/asset_model.dart';

// ── Result types (sealed) ─────────────────────────────────────────────────

sealed class CatalogFetchResult { const CatalogFetchResult(); }

final class CatalogFetched extends CatalogFetchResult {
  final AssetCatalog catalog;
  final String etag;
  const CatalogFetched({required this.catalog, required this.etag});
}

final class CatalogNotModified extends CatalogFetchResult {
  const CatalogNotModified();
}

final class CatalogFetchError extends CatalogFetchResult {
  final String message;
  final bool isNetworkError;
  const CatalogFetchError({required this.message, this.isNetworkError = false});
}

/// Low-level HTTP client for the AppAsset catalog API.
/// Handles ETag conditional requests, retries with back-off, and timeouts.
class AssetRemoteDataSource {
  AssetRemoteDataSource({http.Client? client})
      : _client = client ?? http.Client();

  final http.Client _client;

  Future<CatalogFetchResult> fetchCatalog({String? cachedEtag}) async {
    for (int attempt = 1; attempt <= AssetConstants.maxRetries; attempt++) {
      try {
        final headers = <String, String>{
          'Accept': 'application/json',
          if (cachedEtag != null) 'If-None-Match': '"$cachedEtag"',
        };

        final response = await _client
            .get(Uri.parse(AssetConstants.assetsEndpoint), headers: headers)
            .timeout(AssetConstants.fetchTimeout);

        if (response.statusCode == HttpStatus.notModified) {
          return const CatalogNotModified();
        }

        if (response.statusCode == HttpStatus.ok) {
          final json    = jsonDecode(response.body) as Map<String, dynamic>;
          final catalog = AssetCatalog.fromJson(json);
          final etag    = _stripQuotes(
            response.headers['etag'] ?? catalog.etag,
          );
          return CatalogFetched(catalog: catalog, etag: etag);
        }

        // 4xx — non-retryable
        if (response.statusCode >= 400 && response.statusCode < 500) {
          return CatalogFetchError(
            message: 'HTTP ${response.statusCode}: ${response.body}',
          );
        }

        // 5xx — retryable
        if (attempt < AssetConstants.maxRetries) {
          await _backoff(attempt);
          continue;
        }
        return CatalogFetchError(
          message: 'Server error HTTP ${response.statusCode} after $attempt attempts',
        );
      } on SocketException catch (e) {
        if (attempt < AssetConstants.maxRetries) { await _backoff(attempt); continue; }
        return CatalogFetchError(message: e.message, isNetworkError: true);
      } on HttpException catch (e) {
        if (attempt < AssetConstants.maxRetries) { await _backoff(attempt); continue; }
        return CatalogFetchError(message: e.message, isNetworkError: true);
      } on Exception catch (e) {
        if (attempt < AssetConstants.maxRetries) { await _backoff(attempt); continue; }
        return CatalogFetchError(message: e.toString());
      }
    }
    return const CatalogFetchError(message: 'Exhausted retries');
  }

  Future<List<int>?> downloadFile(String url) async {
    try {
      final response = await _client
          .get(Uri.parse(url))
          .timeout(const Duration(seconds: 30));
      if (response.statusCode == HttpStatus.ok) return response.bodyBytes;
      return null;
    } catch (_) {
      return null;
    }
  }

  Future<void> _backoff(int attempt) =>
      Future.delayed(AssetConstants.retryBaseDelay * attempt);

  String _stripQuotes(String etag) => etag.replaceAll('"', '');

  void dispose() => _client.close();
}
