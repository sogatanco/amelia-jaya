import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:amelia_jaya_mobile/main.dart';

void main() {
  testWidgets('Login screen shows Amelia Jaya branding', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(MaterialApp(home: LoginPage(onLogin: (_) {})));

    expect(find.text('Toko Amelia Jaya'), findsOneWidget);
  });

  testWidgets('Indonesian date picker opens with app localizations', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        locale: const Locale('id'),
        supportedLocales: const [Locale('id'), Locale('en', 'US')],
        localizationsDelegates: const [
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        home: Builder(
          builder: (context) => Scaffold(
            body: TextButton(
              onPressed: () => showDatePicker(
                context: context,
                initialDate: DateTime(2026, 10, 15),
                firstDate: DateTime(2020),
                lastDate: DateTime(2030),
                locale: const Locale('id'),
              ),
              child: const Text('Pilih tanggal'),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Pilih tanggal'));
    await tester.pumpAndSettle();

    expect(find.byType(DatePickerDialog), findsOneWidget);
  });
}
