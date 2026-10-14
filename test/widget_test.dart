import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:amelia_jaya_mobile/main.dart';

void main() {
  testWidgets('Login screen shows Amelia Jaya branding', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(MaterialApp(home: LoginPage(onLogin: (_) {})));

    expect(find.text('Toko Amelia Jaya'), findsOneWidget);
  });
}
