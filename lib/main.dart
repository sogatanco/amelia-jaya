import 'dart:async';
import 'dart:convert';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'app_api.dart';
import 'app_pages.dart';
import 'firebase_options.dart';
import 'notification_service.dart';

const _brand = Color(0xFF16834A);
const _ink = Color(0xFF17231C);
const _canvas = Color(0xFFF4F7F4);

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  if (!kIsWeb &&
      (defaultTargetPlatform == TargetPlatform.android ||
          defaultTargetPlatform == TargetPlatform.iOS)) {
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
  }
  await initializeDateFormatting('id_ID');
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.landscapeLeft,
    DeviceOrientation.landscapeRight,
  ]);
  runApp(const AmeliaJayaApp());
}

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
}

class AmeliaJayaApp extends StatefulWidget {
  const AmeliaJayaApp({super.key});

  @override
  State<AmeliaJayaApp> createState() => _AmeliaJayaAppState();
}

class _AmeliaJayaAppState extends State<AmeliaJayaApp>
    {
  AuthSession? _session;
  bool _checkingSession = true;
  final _messengerKey = GlobalKey<ScaffoldMessengerState>();
  final _homeKey = GlobalKey<_NativeHomeState>();
  String? _pendingDestination;
  String? _notificationError;

  @override
  void initState() {
    super.initState();
    ApiClient.restoreSession().then((session) async {
      if (!mounted) return;
      setState(() {
        _session = session;
        _checkingSession = false;
      });
      if (session != null) await _startNotifications(session);
    });
  }

  @override
  void dispose() {
    unawaited(NotificationService.stop());
    super.dispose();
  }

  Future<void> _startNotifications(AuthSession session) async {
    try {
      await NotificationService.initialize(onSelect: _onNotificationSelected);
      NotificationService.onError = (error) {
        if (mounted) setState(() => _notificationError = error.toString());
      };
      await NotificationService.start(session.user.id);
      final launchPayload = await NotificationService.launchPayload;
      if (launchPayload != null) {
        await _onNotificationSelected(launchPayload);
      }
    } catch (error) {
      if (mounted) setState(() => _notificationError = error.toString());
    }
  }

  void _onLogin(AuthSession session) {
    setState(() {
      _session = session;
      _notificationError = null;
    });
    unawaited(_startNotifications(session));
  }

  Future<void> _onLogout() async {
    String? logoutWarning;
    try {
      await NotificationService.unregisterDevice();
    } catch (error) {
      logoutWarning = error.toString();
    }
    await NotificationService.stop();
    await ApiClient.logout();
    if (mounted) {
      setState(() {
        _session = null;
        _notificationError = null;
      });
      if (logoutWarning != null) {
        _messengerKey.currentState?.showSnackBar(
          SnackBar(
            content: Text(
              'Sesi keluar, tetapi token FCM gagal dihapus dari server: $logoutWarning',
            ),
          ),
        );
      }
    }
  }

  Future<void> _onNotificationSelected(String payload) async {
    String? destination;
    String? notificationId;
    try {
      final data = jsonDecode(payload);
      if (data is Map) {
        destination = data['tujuan'] as String?;
        notificationId = data['id'] as String?;
      } else {
        destination = payload;
      }
    } on FormatException {
      destination = payload;
    }

    if (notificationId != null) {
      try {
        await ApiClient.patch('/notifications/$notificationId/read');
      } catch (error) {
        if (mounted) setState(() => _notificationError = error.toString());
      }
    }

    if (_session == null) {
      _pendingDestination = destination;
      return;
    }
    _openNotificationDestination(destination ?? '/notifikasi');
  }

  void _openNotificationDestination(String destination) {
    final isAdmin = _session?.user.role == 'ADMIN';
    final route = switch (destination) {
      '/input-harian' || '/harian' => 'daily',
      '/upload-bon' => 'bon',
      '/tagihan' => 'bills',
      '/laporan' => isAdmin ? 'report' : 'notifications',
      '/users' || '/pengaturan' => isAdmin ? 'users' : 'notifications',
      '/notifikasi' => 'notifications',
      '/barang-kosong' => 'stock',
      '/barang-kosong-admin' => isAdmin ? 'stockAdmin' : 'notifications',
      _ => 'notifications',
    };
    final home = _homeKey.currentState;
    if (home != null) {
      home.openPage(route);
      _pendingDestination = null;
    } else {
      _pendingDestination = destination;
    }
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      scaffoldMessengerKey: _messengerKey,
      title: 'Amelia Jaya',
      debugShowCheckedModeBanner: false,
      locale: const Locale('id'),
      supportedLocales: const [Locale('id'), Locale('en', 'US')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(seedColor: _brand),
        scaffoldBackgroundColor: _canvas,
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.white,
          foregroundColor: _ink,
          elevation: 0,
          centerTitle: false,
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: const Color(0xFFF8FAF8),
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 14,
            vertical: 13,
          ),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(13),
            borderSide: const BorderSide(color: Color(0xFFE1E9E2)),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(13),
            borderSide: const BorderSide(color: Color(0xFFE1E9E2)),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(13),
            borderSide: const BorderSide(color: _brand, width: 1.5),
          ),
        ),
        cardTheme: CardThemeData(
          color: Colors.white,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(18),
            side: const BorderSide(color: Color(0xFFEAF0EA)),
          ),
        ),
      ),
      home: _checkingSession
          ? const _SplashScreen()
          : _session == null
          ? LoginPage(onLogin: _onLogin)
          : NativeHome(
              key: _homeKey,
              session: _session!,
              onLogout: _onLogout,
              notificationError: _notificationError,
              onOpenRoute: _openNotificationDestination,
              initialDestination: _pendingDestination,
            ),
    );
  }
}

class _SplashScreen extends StatelessWidget {
  const _SplashScreen();

  @override
  Widget build(BuildContext context) =>
      const Scaffold(body: Center(child: CircularProgressIndicator()));
}

class LoginPage extends StatefulWidget {
  final ValueChanged<AuthSession> onLogin;
  const LoginPage({super.key, required this.onLogin});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _formKey = GlobalKey<FormState>();
  final _username = TextEditingController();
  final _password = TextEditingController();
  bool _loading = false;
  bool _obscurePassword = true;
  String? _error;

  @override
  void dispose() {
    _username.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      widget.onLogin(
        await ApiClient.login(_username.text.trim(), _password.text),
      );
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final wide = MediaQuery.sizeOf(context).width > 700;
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(22),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 960),
              child: Card(
                clipBehavior: Clip.antiAlias,
                child: IntrinsicHeight(
                  child: Row(
                    children: [
                      if (wide)
                        Expanded(
                          child: Container(
                            padding: const EdgeInsets.all(42),
                            decoration: const BoxDecoration(
                              gradient: LinearGradient(
                                colors: [_brand, Color(0xFF105E38)],
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                              ),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Image.asset(
                                  'assets/branding/amelia-jaya-logo.png',
                                  width: 88,
                                  height: 88,
                                ),
                                SizedBox(height: 26),
                                Text(
                                  'Pembukuan toko, lebih mudah.',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 30,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                SizedBox(height: 12),
                                Text(
                                  'Kelola omset, pengeluaran, bon, dan tagihan Amelia Jaya dalam satu aplikasi.',
                                  style: TextStyle(
                                    color: Colors.white70,
                                    height: 1.5,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      Expanded(
                        child: Padding(
                          padding: EdgeInsets.all(wide ? 42 : 26),
                          child: Form(
                            key: _formKey,
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                if (!wide) ...[
                                  ClipRRect(
                                    borderRadius: BorderRadius.circular(18),
                                    child: Image.asset(
                                      'assets/branding/amelia-jaya-logo.png',
                                      width: 62,
                                      height: 62,
                                    ),
                                  ),
                                  const SizedBox(height: 18),
                                ],
                                Text(
                                  'Toko Amelia Jaya',
                                  style: Theme.of(context)
                                      .textTheme
                                      .headlineSmall
                                      ?.copyWith(
                                        color: _ink,
                                        fontWeight: FontWeight.bold,
                                      ),
                                ),
                                const SizedBox(height: 5),
                                Text(
                                  'Masuk ke aplikasi pembukuan',
                                  style: TextStyle(color: Colors.grey.shade600),
                                ),
                                const SizedBox(height: 26),
                                TextFormField(
                                  controller: _username,
                                  textInputAction: TextInputAction.next,
                                  autocorrect: false,
                                  decoration: const InputDecoration(
                                    labelText: 'Username',
                                    prefixIcon: Icon(Icons.person_outline),
                                  ),
                                  validator: (value) =>
                                      value == null || value.trim().isEmpty
                                      ? 'Username wajib diisi'
                                      : null,
                                ),
                                const SizedBox(height: 14),
                                TextFormField(
                                  controller: _password,
                                  obscureText: _obscurePassword,
                                  onFieldSubmitted: (_) => _login(),
                                  decoration: InputDecoration(
                                    labelText: 'Password',
                                    prefixIcon: const Icon(Icons.lock_outline),
                                    suffixIcon: IconButton(
                                      onPressed: () => setState(
                                        () => _obscurePassword =
                                            !_obscurePassword,
                                      ),
                                      icon: Icon(
                                        _obscurePassword
                                            ? Icons.visibility_outlined
                                            : Icons.visibility_off_outlined,
                                      ),
                                    ),
                                  ),
                                  validator: (value) =>
                                      value == null || value.isEmpty
                                      ? 'Password wajib diisi'
                                      : null,
                                ),
                                if (_error != null) ...[
                                  const SizedBox(height: 14),
                                  ErrorBanner(message: _error!),
                                ],
                                const SizedBox(height: 20),
                                FilledButton(
                                  onPressed: _loading ? null : _login,
                                  style: FilledButton.styleFrom(
                                    padding: const EdgeInsets.symmetric(
                                      vertical: 15,
                                    ),
                                    backgroundColor: _brand,
                                  ),
                                  child: _loading
                                      ? const SizedBox(
                                          width: 20,
                                          height: 20,
                                          child: CircularProgressIndicator(
                                            strokeWidth: 2,
                                            color: Colors.white,
                                          ),
                                        )
                                      : const Text(
                                          'Masuk',
                                          style: TextStyle(
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class NativeHome extends StatefulWidget {
  final AuthSession session;
  final Future<void> Function() onLogout;
  final String? notificationError;
  final ValueChanged<String> onOpenRoute;
  final String? initialDestination;
  const NativeHome({
    super.key,
    required this.session,
    required this.onLogout,
    required this.notificationError,
    required this.onOpenRoute,
    required this.initialDestination,
  });

  @override
  State<NativeHome> createState() => _NativeHomeState();
}

class _NativeHomeState extends State<NativeHome> {
  String _page = 'home';

  @override
  void initState() {
    super.initState();
    _applyInitialDestination();
  }

  @override
  void didUpdateWidget(covariant NativeHome oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.initialDestination != widget.initialDestination) {
      _applyInitialDestination();
    }
  }

  void _applyInitialDestination() {
    final destination = widget.initialDestination;
    if (destination == null) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) widget.onOpenRoute(destination);
    });
  }

  void openPage(String page) {
    if (mounted) setState(() => _page = page);
  }

  String get _title => switch (_page) {
    'daily' => 'Harian',
    'bon' => 'Upload Bon',
    'bills' => 'Tagihan',
    'report' => 'Laporan',
    'users' => 'Pengguna',
    'notifications' => 'Notifikasi',
    'stock' => 'Barang Kosong',
    'stockAdmin' => 'Barang Kosong',
    _ => 'Dashboard',
  };

  void _open(String page) => setState(() => _page = page);

  Widget _pageWidget() => switch (_page) {
    'daily' => DailyPage(),
    'bon' => BonPage(),
    'bills' => BillsPage(isAdmin: widget.session.user.role == 'ADMIN'),
    'report' => ReportPage(),
    'users' => UsersPage(),
    'notifications' => NotificationsPage(
      isAdmin: widget.session.user.role == 'ADMIN',
      onOpenRoute: widget.onOpenRoute,
      serviceError: widget.notificationError,
    ),
    'stock' => StockPage(isAdmin: false),
    'stockAdmin' => StockPage(isAdmin: true),
    'more' => MorePage(session: widget.session, onOpen: _open),
    _ => DashboardPage(session: widget.session, onOpen: _open),
  };

  int get _selectedNavigation => switch (_page) {
    'daily' => 1,
    'bon' => 2,
    'more' ||
    'bills' ||
    'report' ||
    'users' ||
    'notifications' ||
    'stock' ||
    'stockAdmin' => 3,
    _ => 0,
  };

  @override
  Widget build(BuildContext context) {
    final wide = MediaQuery.sizeOf(context).width >= 760;
    final destinations = const [
      NavigationDestination(
        icon: Icon(Icons.home_outlined),
        selectedIcon: Icon(Icons.home_rounded),
        label: 'Beranda',
      ),
      NavigationDestination(
        icon: Icon(Icons.calendar_month_outlined),
        selectedIcon: Icon(Icons.calendar_month),
        label: 'Harian',
      ),
      NavigationDestination(
        icon: Icon(Icons.receipt_long_outlined),
        selectedIcon: Icon(Icons.receipt_long),
        label: 'Bon',
      ),
      NavigationDestination(
        icon: Icon(Icons.grid_view_rounded),
        label: 'Lainnya',
      ),
    ];
    return Scaffold(
      appBar: AppBar(
        title: Text(
          _title,
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: IconButton.filledTonal(
              tooltip: 'Keluar',
              onPressed: widget.onLogout,
              icon: const Icon(Icons.logout_rounded),
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: Row(
          children: [
            if (wide)
              NavigationRail(
                selectedIndex: _selectedNavigation,
                onDestinationSelected: (index) =>
                    _open(['home', 'daily', 'bon', 'more'][index]),
                labelType: NavigationRailLabelType.all,
                destinations: const [
                  NavigationRailDestination(
                    icon: Icon(Icons.home_outlined),
                    selectedIcon: Icon(Icons.home_rounded),
                    label: Text('Beranda'),
                  ),
                  NavigationRailDestination(
                    icon: Icon(Icons.calendar_month_outlined),
                    selectedIcon: Icon(Icons.calendar_month),
                    label: Text('Harian'),
                  ),
                  NavigationRailDestination(
                    icon: Icon(Icons.receipt_long_outlined),
                    selectedIcon: Icon(Icons.receipt_long),
                    label: Text('Bon'),
                  ),
                  NavigationRailDestination(
                    icon: Icon(Icons.grid_view_rounded),
                    label: Text('Lainnya'),
                  ),
                ],
              ),
            Expanded(
              child: Align(
                alignment: Alignment.topCenter,
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 1050),
                  child: _pageWidget(),
                ),
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: wide
          ? null
          : NavigationBar(
              selectedIndex: _selectedNavigation,
              onDestinationSelected: (index) =>
                  _open(['home', 'daily', 'bon', 'more'][index]),
              destinations: destinations,
            ),
    );
  }
}
