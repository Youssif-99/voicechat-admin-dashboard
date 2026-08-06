import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import '../core/icon_constants.dart';
import '../data/models/icon_catalog.dart';

/// Result of a conditional GET /api/icons request.
sealed class CatalogFetchResult {
  const CatalogFetchResult();
}

/// Server returned new data (HTTP 200).
final class CatalogFetched extends CatalogFetchResult {
  final IconCatalog catalog;
  final String etag;
  const CatalogFetched({required this.catalog, required this.etag});
}

/// Server confirmed nothing changed (HTTP 304 Not Modified).
final class CatalogNotModified extends CatalogFetchResult {
  const CatalogNotModified();
}

/// Network or server error — caller should use cached data.
final class CatalogFetchError extends CatalogFetchResult {
  final String message;
  final bool isNetworkError;
  const CatalogFetchError({required this.message, this.isNetworkError = false});
}

/// Low-level HTTP client for the icon catalog API.
///
/// Handles:
///  - Conditional requests with If-None-Match (ETag)
///  - Retry with exponential back-off on transient errors
///  - Timeout enforcement
///  - Individual icon file downloads
class IconRemoteDataSource {
  IconRemoteDataSource({http.Client? client})
      : _client = client ?? http.Client();

  final http.Client _client;

  // ── Catalog fetch ─────────────────────────────────────────────────────────

  /// Fetches the icon catalog from the API.
  /// Pass [cachedEtag] to enable 304 short-circuit.
  Future<CatalogFetchResult> fetchCatalog({String? cachedEtag}) async {
    for (int attempt = 1; attempt <= IconConstants.maxRetries; attempt++) {
      try {
        final headers = <String, String>{
          'Accept': 'application/json',
          if (cachedEtag != null) 'If-None-Match': '"$cachedEtag"',
        };

        final response = await _client
            .get(Uri.parse(IconConstants.iconsEndpoint), headers: headers)
            .timeout(IconConstants.fetchTimeout);

        if (response.statusCode == HttpStatus.notModified) {
          return const CatalogNotModified();
        }

        if (response.statusCode == HttpStatus.ok) {
          final json    = jsonDecode(response.body) as Map<String, dynamic>;
          final catalog = IconCatalog.fromJson(json);
          final etag    = _stripQuotes(
            response.headers['etag'] ?? catalog.etag,
          );
          return CatalogFetched(catalog: catalog, etag: etag);
        }

        // Non-retryable server error
        if (response.statusCode >= 400 && response.statusCode < 500) {
          return CatalogFetchError(
            message: 'HTTP ${response.statusCode}: ${response.body}',
          );
        }

        // 5xx — retryable
        if (attempt < IconConstants.maxRetries) {
          await _backoff(attempt);
          continue;
        }
        return CatalogFetchError(
          message: 'Server error HTTP ${response.statusCode} after $attempt attempts',
        );
      } on SocketException catch (e) {
        if (attempt < IconConstants.maxRetries) {
          await _backoff(attempt);
          continue;
        }
        return CatalogFetchError(message: e.message, isNetworkError: true);
      } on HttpException catch (e) {
        if (attempt < IconConstants.maxRetries) {
          await _backoff(attempt);
          continue;
        }
        return CatalogFetchError(message: e.message, isNetworkError: true);
      } on Exception catch (e) {
        if (attempt < IconConstants.maxRetries) {
          await _backoff(attempt);
          continue;
        }
        return CatalogFetchError(message: e.toString());
      }
    }
    return const CatalogFetchError(message: 'Exhausted retries');
  }

  // ── Icon file download ────────────────────────────────────────────────────

  /// Downloads the bytes at [url]. Returns null on any error.
  Future<List<int>?> downloadIconFile(String url) async {
    try {
      final response = await _client
          .get(Uri.parse(url))
          .timeout(const Duration(seconds: 20));
      if (response.statusCode == HttpStatus.ok) return response.bodyBytes;
      return null;
    } catch (_) {
      return null;
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  Future<void> _backoff(int attempt) =>
      Future.delayed(IconConstants.retryBaseDelay * attempt);

  String _stripQuotes(String etag) =>
      etag.replaceAll('"', '');

  void dispose() => _client.close();
}
