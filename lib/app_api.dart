import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

const String apiBaseUrl = 'https://amelia-jaya.shop/api';

class ApiException implements Exception {
  final String message;
  const ApiException(this.message);

  @override
  String toString() => message;
}

class AuthSession {
  final String token;
  final AuthUser user;

  const AuthSession({required this.token, required this.user});
}

class AuthUser {
  final String id;
  final String name;
  final String username;
  final String role;

  const AuthUser({
    required this.id,
    required this.name,
    required this.username,
    required this.role,
  });

  factory AuthUser.fromJson(Map<String, dynamic> json) => AuthUser(
    id: json['id'] as String? ?? '',
    name: json['name'] as String? ?? '',
    username: json['username'] as String? ?? '',
    role: json['role'] as String? ?? 'CASHIER',
  );
}

class ApiClient {
  static String? _token;
  static final http.Client _client = http.Client();

  static Map<String, String> get authHeaders => {
    if (_token != null) 'Authorization': 'Bearer $_token',
  };

  static Future<AuthSession> login(String username, String password) async {
    final data = await _request(
      'POST',
      '/auth/login',
      body: {'username': username, 'password': password},
      authenticated: false,
    );
    final session = AuthSession(
      token: data['token'] as String,
      user: AuthUser.fromJson(Map<String, dynamic>.from(data['user'] as Map)),
    );
    _token = session.token;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('token', session.token);
    await prefs.setString(
      'user',
      jsonEncode({
        'id': session.user.id,
        'name': session.user.name,
        'username': session.user.username,
        'role': session.user.role,
      }),
    );
    return session;
  }

  static Future<AuthSession?> restoreSession() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('token');
    final userJson = prefs.getString('user');
    if (token == null || userJson == null) return null;
    try {
      final user = AuthUser.fromJson(
        Map<String, dynamic>.from(jsonDecode(userJson) as Map),
      );
      _token = token;
      return AuthSession(token: token, user: user);
    } on FormatException {
      await logout();
      return null;
    }
  }

  static Future<void> logout() async {
    _token = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('token');
    await prefs.remove('user');
  }

  static Future<Map<String, dynamic>> get(
    String path, {
    Map<String, String>? query,
  }) async => _request('GET', path, query: query);

  static Future<List<dynamic>> list(
    String path, {
    Map<String, String>? query,
  }) async {
    final result = await _request('GET', path, query: query);
    final value = result['_list'];
    if (value is List<dynamic>) return value;
    throw const ApiException('Respons daftar dari server tidak sesuai format.');
  }

  static Future<Map<String, dynamic>> post(
    String path, {
    Map<String, dynamic>? body,
  }) async => _request('POST', path, body: body);

  static Future<Map<String, dynamic>> patch(
    String path, {
    Map<String, dynamic>? body,
  }) async => _request('PATCH', path, body: body);

  static Future<void> delete(String path, {Map<String, dynamic>? body}) async {
    await _request('DELETE', path, body: body);
  }

  static Future<Map<String, dynamic>> uploadImage(
    String path,
    File file, {
    required String type,
  }) async {
    final request = http.MultipartRequest('POST', Uri.parse('$apiBaseUrl$path'))
      ..headers.addAll(authHeaders)
      ..fields['tipe'] = type
      ..files.add(await http.MultipartFile.fromPath('file', file.path));
    final streamed = await _client
        .send(request)
        .timeout(const Duration(seconds: 60));
    final response = await http.Response.fromStream(streamed);
    return _decodeResponse(response);
  }

  static Future<Map<String, dynamic>> _request(
    String method,
    String path, {
    Map<String, String>? query,
    Map<String, dynamic>? body,
    bool authenticated = true,
  }) async {
    final uri = Uri.parse('$apiBaseUrl$path').replace(queryParameters: query);
    final headers = <String, String>{
      'Content-Type': 'application/json',
      if (authenticated) ...authHeaders,
    };
    final request = http.Request(method, uri)..headers.addAll(headers);
    if (body != null) request.body = jsonEncode(body);
    try {
      final streamed = await _client
          .send(request)
          .timeout(const Duration(seconds: 30));
      final response = await http.Response.fromStream(streamed);
      return _decodeResponse(response);
    } on SocketException {
      throw const ApiException(
        'Tidak dapat terhubung ke server. Periksa koneksi internet.',
      );
    } on HttpException {
      throw const ApiException('Koneksi ke server gagal. Coba lagi.');
    }
  }

  static Map<String, dynamic> _decodeResponse(http.Response response) {
    if (response.statusCode == 204 || response.body.isEmpty) {
      if (response.statusCode >= 200 && response.statusCode < 300) return {};
    }
    dynamic decoded;
    try {
      decoded = jsonDecode(response.body);
    } on FormatException {
      decoded = null;
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final message = decoded is Map && decoded['message'] is String
          ? decoded['message'] as String
          : 'Permintaan gagal (HTTP ${response.statusCode}).';
      if (response.statusCode == 401) {
        logout();
      }
      throw ApiException(message);
    }
    if (decoded is Map<String, dynamic>) return decoded;
    if (decoded is List) return {'_list': decoded};
    throw const ApiException('Respons server tidak valid.');
  }
}
