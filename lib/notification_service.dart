import 'dart:async';
import 'dart:convert';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import 'app_api.dart';

class NotificationService {
  NotificationService._();

  static final FlutterLocalNotificationsPlugin _plugin =
      FlutterLocalNotificationsPlugin();
  static final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  static Future<void> Function(String payload)? _onSelect;
  static StreamSubscription<RemoteMessage>? _foregroundSubscription;
  static StreamSubscription<RemoteMessage>? _openedSubscription;
  static StreamSubscription<String>? _tokenSubscription;
  static String? _userId;
  static bool _initialized = false;
  static void Function(Object error)? onError;

  static Future<void> initialize({
    required Future<void> Function(String payload) onSelect,
  }) async {
    _onSelect = onSelect;
    if (_initialized) return;

    await _plugin.initialize(
      settings: const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
      ),
      onDidReceiveNotificationResponse: (response) {
        final payload = response.payload;
        if (payload != null && payload.isNotEmpty) _dispatch(payload);
      },
    );
    await _plugin
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >()
        ?.createNotificationChannel(
          const AndroidNotificationChannel(
            'amelia_jaya_updates',
            'Notifikasi Amelia Jaya',
            description: 'Pemberitahuan aktivitas pembukuan toko',
            importance: Importance.high,
          ),
        );

    _foregroundSubscription = FirebaseMessaging.onMessage.listen(
      _showForegroundNotification,
      onError: (Object error) => onError?.call(error),
    );
    _openedSubscription = FirebaseMessaging.onMessageOpenedApp.listen(
      _handleFirebaseTap,
      onError: (Object error) => onError?.call(error),
    );
    _tokenSubscription = _messaging.onTokenRefresh.listen((token) {
      final userId = _userId;
      if (userId != null) {
        unawaited(
          _registerToken(userId, token).catchError((Object error) {
            onError?.call(error);
          }),
        );
      }
    }, onError: (Object error) => onError?.call(error));
    _initialized = true;
  }

  static Future<String?> get launchPayload async {
    final localDetails = await _plugin.getNotificationAppLaunchDetails();
    if (localDetails?.didNotificationLaunchApp == true) {
      final payload = localDetails?.notificationResponse?.payload;
      if (payload != null && payload.isNotEmpty) return payload;
    }

    final message = await _messaging.getInitialMessage();
    if (message == null || message.data.isEmpty) return null;
    return jsonEncode(message.data);
  }

  static Future<bool> get notificationsEnabled async {
    final settings = await _messaging.getNotificationSettings();
    return _isAuthorized(settings.authorizationStatus);
  }

  static Future<bool> requestPermission() async {
    final settings = await _messaging.requestPermission();
    final granted = _isAuthorized(settings.authorizationStatus);
    final userId = _userId;
    if (granted && userId != null) {
      final token = await _messaging.getToken();
      if (token != null) await _registerToken(userId, token);
    }
    return granted;
  }

  static Future<Map<String, dynamic>> getDeliveryStatus() async {
    final token = await _messaging.getToken();
    final userId = _userId;
    if (token != null && userId != null) {
      await _registerToken(userId, token);
    }
    return ApiClient.post(
      '/notifications/fcm-status',
      body: {if (token != null) 'token': token},
    );
  }

  static Future<void> start(String userId) async {
    if (!_initialized || _userId == userId) return;
    _userId = userId;
    final settings = await _messaging.getNotificationSettings();
    if (!_isAuthorized(settings.authorizationStatus)) return;
    final token = await _messaging.getToken();
    if (token != null) await _registerToken(userId, token);
  }

  static Future<void> unregisterDevice() async {
    final userId = _userId;
    if (userId == null) return;
    try {
      final token = await _messaging.getToken();
      if (token != null) {
        await ApiClient.delete(
          '/notifications/fcm-token',
          body: {'token': token},
        );
      }
    } catch (_) {
      try {
        await _messaging.deleteToken();
      } catch (cleanupError) {
        onError?.call(cleanupError);
      }
      rethrow;
    } finally {
      _userId = null;
    }
  }

  static Future<void> stop() async {
    _userId = null;
    await _foregroundSubscription?.cancel();
    await _openedSubscription?.cancel();
    await _tokenSubscription?.cancel();
    _foregroundSubscription = null;
    _openedSubscription = null;
    _tokenSubscription = null;
    _initialized = false;
  }

  static bool _isAuthorized(AuthorizationStatus status) =>
      status == AuthorizationStatus.authorized ||
      status == AuthorizationStatus.provisional;

  static Future<void> _registerToken(String userId, String token) async {
    if (_userId != userId) return;
    await ApiClient.post('/notifications/fcm-token', body: {'token': token});
  }

  static void _showForegroundNotification(RemoteMessage message) {
    final title =
        message.notification?.title ?? message.data['title'] as String?;
    final body = message.notification?.body ?? message.data['body'] as String?;
    if (title == null || title.isEmpty) return;

    unawaited(
      _plugin.show(
        id: DateTime.now().microsecondsSinceEpoch & 0x7fffffff,
        title: title,
        body: body ?? '',
        notificationDetails: const NotificationDetails(
          android: AndroidNotificationDetails(
            'amelia_jaya_updates',
            'Notifikasi Amelia Jaya',
            channelDescription: 'Pemberitahuan aktivitas pembukuan toko',
            importance: Importance.high,
            priority: Priority.high,
            icon: '@mipmap/ic_launcher',
          ),
        ),
        payload: jsonEncode({
          ...message.data,
          'tujuan': message.data['tujuan'] ?? '/notifikasi',
        }),
      ),
    );
  }

  static void _handleFirebaseTap(RemoteMessage message) {
    if (message.data.isNotEmpty) _dispatch(jsonEncode(message.data));
  }

  static void _dispatch(String payload) {
    final onSelect = _onSelect;
    if (onSelect != null) unawaited(onSelect(payload));
  }
}
