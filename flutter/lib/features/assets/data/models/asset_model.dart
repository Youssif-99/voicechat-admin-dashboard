/// Strongly-typed representation of a single remote AppAsset.
/// Matches the JSON shape returned by GET /api/assets.
class AssetModel {
  final String  id;
  final String  key;
  final String  name;
  final String  category;
  final String? imageUrl;
  final String? thumbnailUrl;
  final String? mimeType;
  final String? hash;
  final int?    width;
  final int?    height;
  final int     version;
  final DateTime updatedAt;

  const AssetModel({
    required this.id,
    required this.key,
    required this.name,
    required this.category,
    this.imageUrl,
    this.thumbnailUrl,
    this.mimeType,
    this.hash,
    this.width,
    this.height,
    required this.version,
    required this.updatedAt,
  });

  factory AssetModel.fromJson(Map<String, dynamic> json) => AssetModel(
        id:          json['id']          as String,
        key:         json['key']         as String,
        name:        json['name']        as String,
        category:    json['category']    as String,
        imageUrl:    json['imageUrl']    as String?,
        thumbnailUrl:json['thumbnailUrl'] as String?,
        mimeType:    json['mimeType']    as String?,
        hash:        json['hash']        as String?,
        width:       (json['width']  as num?)?.toInt(),
        height:      (json['height'] as num?)?.toInt(),
        version:     (json['version']    as num).toInt(),
        updatedAt:   DateTime.parse(json['updatedAt'] as String),
      );

  Map<String, dynamic> toJson() => {
        'id':          id,
        'key':         key,
        'name':        name,
        'category':    category,
        'imageUrl':    imageUrl,
        'thumbnailUrl':thumbnailUrl,
        'mimeType':    mimeType,
        'hash':        hash,
        'width':       width,
        'height':      height,
        'version':     version,
        'updatedAt':   updatedAt.toIso8601String(),
      };

  /// Whether this asset has a file to display.
  bool get hasFile => imageUrl != null;

  /// Returns true if the asset is an SVG.
  bool get isSvg => mimeType == 'image/svg+xml' ||
      (imageUrl?.contains('.svg') ?? false);

  AssetModel copyWith({
    String? imageUrl,
    String? thumbnailUrl,
    String? mimeType,
    String? hash,
    int?    version,
    DateTime? updatedAt,
  }) =>
      AssetModel(
        id:          id,
        key:         key,
        name:        name,
        category:    category,
        imageUrl:    imageUrl     ?? this.imageUrl,
        thumbnailUrl:thumbnailUrl ?? this.thumbnailUrl,
        mimeType:    mimeType     ?? this.mimeType,
        hash:        hash         ?? this.hash,
        width:       width,
        height:      height,
        version:     version      ?? this.version,
        updatedAt:   updatedAt    ?? this.updatedAt,
      );

  @override
  bool operator ==(Object other) =>
      other is AssetModel && other.key == key && other.version == version;

  @override
  int get hashCode => Object.hash(key, version);
}

/// Full catalog response from GET /api/assets.
class AssetCatalog {
  final String          etag;
  final int             version;
  final String          updatedAt;
  final List<AssetModel> assets;

  const AssetCatalog({
    required this.etag,
    required this.version,
    required this.updatedAt,
    required this.assets,
  });

  factory AssetCatalog.fromJson(Map<String, dynamic> json) => AssetCatalog(
        etag:      json['etag']      as String,
        version:   (json['version']  as num).toInt(),
        updatedAt: json['updatedAt'] as String,
        assets:    (json['assets'] as List)
            .map((e) => AssetModel.fromJson(e as Map<String, dynamic>))
            .toList(),
      );

  Map<String, dynamic> toJson() => {
        'etag':      etag,
        'version':   version,
        'updatedAt': updatedAt,
        'assets':    assets.map((e) => e.toJson()).toList(),
      };

  bool get isEmpty => assets.isEmpty;

  AssetModel? findByKey(String key) {
    try {
      return assets.firstWhere((a) => a.key == key);
    } catch (_) {
      return null;
    }
  }

  Map<String, AssetModel> toKeyMap() =>
      {for (final a in assets) a.key: a};
}
