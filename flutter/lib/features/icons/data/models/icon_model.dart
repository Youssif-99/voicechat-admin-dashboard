// ignore_for_file: non_constant_identifier_names

/// Strongly-typed representation of a single remote icon.
/// Matches the JSON shape returned by GET /api/icons.
class IconModel {
  final String id;
  final String key;
  final String displayName;
  final String category;

  /// "svg" | "png" | "both"
  final String type;

  final String? svgUrl;
  final String? pngUrl;
  final String? svgHash;
  final String? pngHash;
  final int version;
  final DateTime updatedAt;

  const IconModel({
    required this.id,
    required this.key,
    required this.displayName,
    required this.category,
    required this.type,
    this.svgUrl,
    this.pngUrl,
    this.svgHash,
    this.pngHash,
    required this.version,
    required this.updatedAt,
  });

  factory IconModel.fromJson(Map<String, dynamic> json) => IconModel(
        id:          json['id']          as String,
        key:         json['key']         as String,
        displayName: json['displayName'] as String,
        category:    json['category']    as String,
        type:        json['type']        as String,
        svgUrl:      json['svgUrl']      as String?,
        pngUrl:      json['pngUrl']      as String?,
        svgHash:     json['svgHash']     as String?,
        pngHash:     json['pngHash']     as String?,
        version:     (json['version']    as num).toInt(),
        updatedAt:   DateTime.parse(json['updatedAt'] as String),
      );

  Map<String, dynamic> toJson() => {
        'id':          id,
        'key':         key,
        'displayName': displayName,
        'category':    category,
        'type':        type,
        'svgUrl':      svgUrl,
        'pngUrl':      pngUrl,
        'svgHash':     svgHash,
        'pngHash':     pngHash,
        'version':     version,
        'updatedAt':   updatedAt.toIso8601String(),
      };

  IconModel copyWith({
    String? svgUrl,
    String? pngUrl,
    String? svgHash,
    String? pngHash,
    int? version,
    DateTime? updatedAt,
  }) =>
      IconModel(
        id:          id,
        key:         key,
        displayName: displayName,
        category:    category,
        type:        type,
        svgUrl:      svgUrl      ?? this.svgUrl,
        pngUrl:      pngUrl      ?? this.pngUrl,
        svgHash:     svgHash     ?? this.svgHash,
        pngHash:     pngHash     ?? this.pngHash,
        version:     version     ?? this.version,
        updatedAt:   updatedAt   ?? this.updatedAt,
      );

  @override
  bool operator ==(Object other) =>
      other is IconModel && other.key == key && other.version == version;

  @override
  int get hashCode => Object.hash(key, version);
}

/// Full catalog response from GET /api/icons
class IconCatalog {
  final String etag;
  final int version;
  final String updatedAt;
  final List<IconModel> icons;

  const IconCatalog({
    required this.etag,
    required this.version,
    required this.updatedAt,
    required this.icons,
  });

  factory IconCatalog.fromJson(Map<String, dynamic> json) => IconCatalog(
        etag:      json['etag']      as String,
        version:   (json['version']  as num).toInt(),
        updatedAt: json['updatedAt'] as String,
        icons:     (json['icons'] as List)
            .map((e) => IconModel.fromJson(e as Map<String, dynamic>))
            .toList(),
      );

  Map<String, dynamic> toJson() => {
        'etag':      etag,
        'version':   version,
        'updatedAt': updatedAt,
        'icons':     icons.map((e) => e.toJson()).toList(),
      };
}
