import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';

import 'app_api.dart';
import 'notification_service.dart';

const _brand = Color(0xFF16834A);
const _ink = Color(0xFF17231C);
const _muted = Color(0xFF718078);

String _dateString([DateTime? value]) =>
    DateFormat('yyyy-MM-dd').format(value ?? DateTime.now());

String _dateLabel(Object? value) {
  if (value == null || value.toString().isEmpty) return '-';
  final date = DateTime.tryParse(value.toString());
  return date == null
      ? value.toString()
      : DateFormat('dd MMM yyyy', 'id_ID').format(date.toLocal());
}

String _money(Object? value) {
  final amount = value is num
      ? value.toDouble()
      : double.tryParse('$value') ?? 0;
  return NumberFormat.currency(
    locale: 'id_ID',
    symbol: 'Rp ',
    decimalDigits: 0,
  ).format(amount);
}

double _number(TextEditingController controller) =>
    double.tryParse(controller.text.replaceAll(RegExp(r'[^0-9]'), '')) ?? 0;

String _errorText(Object error) =>
    error.toString().replaceFirst('Exception: ', '');

Map<String, dynamic> _map(Object? value) =>
    Map<String, dynamic>.from(value as Map);

class ErrorBanner extends StatelessWidget {
  final String message;
  const ErrorBanner({super.key, required this.message});

  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: const Color(0xFFFFF0EE),
      border: Border.all(color: const Color(0xFFF4C6BF)),
      borderRadius: BorderRadius.circular(12),
    ),
    child: Text(message, style: const TextStyle(color: Color(0xFFB42318))),
  );
}

class _PagePadding extends StatelessWidget {
  final Widget child;
  const _PagePadding({required this.child});

  @override
  Widget build(BuildContext context) => SingleChildScrollView(
    padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
    child: child,
  );
}

class _SectionCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  const _SectionCard({
    required this.child,
    this.padding = const EdgeInsets.all(16),
  });

  @override
  Widget build(BuildContext context) => Card(
    margin: EdgeInsets.zero,
    child: Padding(padding: padding, child: child),
  );
}

class _PageHeading extends StatelessWidget {
  final String title;
  final String subtitle;
  const _PageHeading(this.title, this.subtitle);

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 16),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: Theme.of(context).textTheme.titleLarge
              ?.copyWith(fontWeight: FontWeight.bold, color: _ink),
        ),
        const SizedBox(height: 5),
        Text(subtitle, style: const TextStyle(color: _muted, height: 1.4)),
      ],
    ),
  );
}

class _BusyButton extends StatelessWidget {
  final String label;
  final bool busy;
  final VoidCallback? onPressed;
  final IconData? icon;
  const _BusyButton({
    required this.label,
    required this.busy,
    required this.onPressed,
    this.icon,
  });

  @override
  Widget build(BuildContext context) => SizedBox(
    width: double.infinity,
    child: FilledButton.icon(
      onPressed: busy ? null : onPressed,
      icon: busy
          ? const SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: Colors.white,
              ),
            )
          : Icon(icon ?? Icons.check_rounded),
      label: Text(busy ? 'Memproses...' : label),
      style: FilledButton.styleFrom(
        backgroundColor: _brand,
        padding: const EdgeInsets.symmetric(vertical: 14),
      ),
    ),
  );
}

class DashboardPage extends StatefulWidget {
  final AuthSession session;
  final ValueChanged<String> onOpen;
  const DashboardPage({super.key, required this.session, required this.onOpen});

  @override
  State<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends State<DashboardPage> {
  Map<String, dynamic>? _summary;
  Map<String, dynamic>? _bills;
  List<dynamic> _dates = [];
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final today = _dateString();
      final values = await Future.wait([
        if (widget.session.user.role == 'ADMIN')
          ApiClient.get(
            '/reports/summary',
            query: {'from': today, 'to': today},
          ),
        if (widget.session.user.role == 'ADMIN')
          ApiClient.get('/reports/tagihan'),
        ApiClient.list('/closings/dates', query: {'days': '7'}),
      ]);
      var index = 0;
      if (widget.session.user.role == 'ADMIN') {
        _summary = values[index++] as Map<String, dynamic>;
        _bills = values[index++] as Map<String, dynamic>;
      }
      _dates = values[index] as List<dynamic>;
    } catch (e) {
      _error = _errorText(e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isAdmin = widget.session.user.role == 'ADMIN';
    final modules = <_ModuleCardData>[
      _ModuleCardData(
        'Harian',
        'Omset & pengeluaran',
        Icons.calendar_month_rounded,
        const Color(0xFF16834A),
        'daily',
      ),
      _ModuleCardData(
        'Bon / Nota',
        'Foto dan konfirmasi bon',
        Icons.add_a_photo_rounded,
        const Color(0xFF3973C6),
        'bon',
      ),
      _ModuleCardData(
        'Tagihan',
        'Tagihan supplier',
        Icons.receipt_long_rounded,
        const Color(0xFFCE7B20),
        'bills',
      ),
      if (isAdmin)
        _ModuleCardData(
          'Laporan',
          'Neraca dan ringkasan',
          Icons.query_stats_rounded,
          const Color(0xFF8158C6),
          'report',
        ),
      if (isAdmin)
        _ModuleCardData(
          'Pengguna',
          'Kelola akun aplikasi',
          Icons.people_alt_rounded,
          const Color(0xFFCE5164),
          'users',
        ),
      _ModuleCardData(
        'Notifikasi',
        'Pesan dan pengumuman',
        Icons.notifications_active_rounded,
        const Color(0xFF2788A2),
        'notifications',
      ),
      _ModuleCardData(
        isAdmin ? 'Daftar barang kosong' : 'Laporkan barang kosong',
        'Pantau kebutuhan stok',
        Icons.inventory_2_rounded,
        const Color(0xFF6673B8),
        isAdmin ? 'stockAdmin' : 'stock',
      ),
    ];
    final width = MediaQuery.sizeOf(context).width;
    final crossCount = width >= 850
        ? 3
        : width >= 540
        ? 2
        : 2;

    return RefreshIndicator(
      onRefresh: _load,
      child: _PagePadding(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(22),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(22),
                gradient: const LinearGradient(
                  colors: [_brand, Color(0xFF105E38)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                boxShadow: [
                  BoxShadow(
                    color: _brand.withValues(alpha: .18),
                    blurRadius: 20,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Row(
                children: [
                  const CircleAvatar(
                    radius: 27,
                    backgroundColor: Color(0x33FFFFFF),
                    child: Icon(
                      Icons.storefront,
                      color: Colors.white,
                      size: 29,
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Toko Amelia Jaya',
                          style: TextStyle(color: Colors.white70, fontSize: 13),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          'Halo, ${widget.session.user.name}',
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            fontSize: 21,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          isAdmin ? 'Administrator' : 'Kasir',
                          style: const TextStyle(color: Colors.white70),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    onPressed: _load,
                    color: Colors.white,
                    icon: const Icon(Icons.refresh_rounded),
                    tooltip: 'Muat ulang',
                  ),
                ],
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 14),
              ErrorBanner(message: _error!),
            ],
            if (isAdmin) ...[
              const SizedBox(height: 20),
              Text(
                'Ringkasan hari ini',
                style: Theme.of(context).textTheme.titleMedium
                    ?.copyWith(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 10),
              if (_loading)
                const Center(
                  child: Padding(
                    padding: EdgeInsets.all(18),
                    child: CircularProgressIndicator(),
                  ),
                )
              else
                LayoutBuilder(
                  builder: (context, constraints) {
                    final cardWidth = constraints.maxWidth >= 620
                        ? (constraints.maxWidth - 20) / 3
                        : (constraints.maxWidth - 10) / 2;
                    return Wrap(
                      spacing: 10,
                      runSpacing: 10,
                      children: [
                        _MetricCard(
                          label: 'Omset',
                          value: _money(_summary?['totalOmset']),
                          icon: Icons.trending_up,
                          color: _brand,
                          width: cardWidth,
                        ),
                        _MetricCard(
                          label: 'Pengeluaran',
                          value: _money(_summary?['totalPengeluaran']),
                          icon: Icons.payments_outlined,
                          color: const Color(0xFFD34C4C),
                          width: cardWidth,
                        ),
                        _MetricCard(
                          label: 'Belum lunas',
                          value: _money(_bills?['totalTagihan']),
                          icon: Icons.receipt_long,
                          color: const Color(0xFFCE7B20),
                          width: cardWidth,
                        ),
                      ],
                    );
                  },
                ),
            ] else ...[
              const SizedBox(height: 20),
              _SectionCard(
                child: Row(
                  children: [
                    const Icon(Icons.calendar_today_rounded, color: _brand),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'Tanggal transaksi dicatat berdasarkan hari kejadian. Data dapat dilengkapi untuk tanggal sebelumnya.',
                        style: TextStyle(
                          color: Colors.grey.shade700,
                          height: 1.4,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 22),
            Text(
              'Menu utama',
              style: Theme.of(context).textTheme.titleMedium
                  ?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 10),
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: modules.length,
              gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: crossCount,
                crossAxisSpacing: 10,
                mainAxisSpacing: 10,
                childAspectRatio: width < 380 ? 1.08 : 1.28,
              ),
              itemBuilder: (context, index) => _ModuleCard(
                data: modules[index],
                onTap: () => widget.onOpen(modules[index].route),
              ),
            ),
            if (!isAdmin && _dates.isNotEmpty) ...[
              const SizedBox(height: 20),
              const _SectionCard(
                child: Row(
                  children: [
                    Icon(Icons.info_outline, color: _brand),
                    SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'Gunakan menu Harian untuk mencatat omzet kasir, QRIS, dan pengeluaran toko.',
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _MetricCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;
  final double width;
  const _MetricCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
    required this.width,
  });

  @override
  Widget build(BuildContext context) => SizedBox(
    width: width,
    child: _SectionCard(
      padding: const EdgeInsets.all(13),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color),
          const SizedBox(height: 10),
          Text(label, style: const TextStyle(fontSize: 12, color: _muted)),
          const SizedBox(height: 4),
          FittedBox(
            alignment: Alignment.centerLeft,
            fit: BoxFit.scaleDown,
            child: Text(
              value,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: color,
              ),
            ),
          ),
        ],
      ),
    ),
  );
}

class _ModuleCardData {
  final String title;
  final String subtitle;
  final IconData icon;
  final Color color;
  final String route;
  const _ModuleCardData(
    this.title,
    this.subtitle,
    this.icon,
    this.color,
    this.route,
  );
}

class _ModuleCard extends StatelessWidget {
  final _ModuleCardData data;
  final VoidCallback onTap;
  const _ModuleCard({required this.data, required this.onTap});

  @override
  Widget build(BuildContext context) => Card(
    margin: EdgeInsets.zero,
    clipBehavior: Clip.antiAlias,
    child: InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: data.color.withValues(alpha: .1),
                borderRadius: BorderRadius.circular(13),
              ),
              child: Icon(data.icon, color: data.color),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  data.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    color: _ink,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  data.subtitle,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 11, color: _muted),
                ),
              ],
            ),
          ],
        ),
      ),
    ),
  );
}

class MorePage extends StatelessWidget {
  final AuthSession session;
  final ValueChanged<String> onOpen;
  const MorePage({super.key, required this.session, required this.onOpen});

  @override
  Widget build(BuildContext context) {
    final admin = session.user.role == 'ADMIN';
    final modules = <_ModuleCardData>[
      _ModuleCardData(
        'Tagihan',
        'Lihat dan bayar supplier',
        Icons.receipt_long_rounded,
        const Color(0xFFCE7B20),
        'bills',
      ),
      if (admin)
        _ModuleCardData(
          'Laporan',
          'Neraca dan omset',
          Icons.query_stats_rounded,
          const Color(0xFF8158C6),
          'report',
        ),
      if (admin)
        _ModuleCardData(
          'Pengguna',
          'Tambah dan kelola akun',
          Icons.people_alt_rounded,
          const Color(0xFFCE5164),
          'users',
        ),
      _ModuleCardData(
        'Notifikasi',
        'Pengumuman toko',
        Icons.notifications_active_rounded,
        const Color(0xFF2788A2),
        'notifications',
      ),
      _ModuleCardData(
        admin ? 'Barang kosong' : 'Laporkan barang kosong',
        'Pantau stok',
        Icons.inventory_2_rounded,
        const Color(0xFF6673B8),
        admin ? 'stockAdmin' : 'stock',
      ),
    ];
    return _PagePadding(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _PageHeading(
            'Menu lainnya',
            'Akses modul pembukuan dan pengelolaan toko.',
          ),
          ...modules.map(
            (item) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _SectionCard(
                padding: EdgeInsets.zero,
                child: ListTile(
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 5,
                  ),
                  leading: CircleAvatar(
                    backgroundColor: item.color.withValues(alpha: .1),
                    child: Icon(item.icon, color: item.color),
                  ),
                  title: Text(
                    item.title,
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                  subtitle: Text(item.subtitle),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => onOpen(item.route),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class DailyPage extends StatefulWidget {
  const DailyPage({super.key});

  @override
  State<DailyPage> createState() => _DailyPageState();
}

class _DailyPageState extends State<DailyPage> {
  List<dynamic> _dates = [];
  List<dynamic> _closings = [];
  List<dynamic> _expenses = [];
  List<String> _categories = [];
  DateTime _selectedDate = DateTime.now();
  String _source = 'KASIR';
  String _expenseSource = 'LACI';
  final _sales = TextEditingController();
  final _note = TextEditingController();
  final _category = TextEditingController();
  final _expenseAmount = TextEditingController();
  final _expenseNote = TextEditingController();
  String? _error;
  String? _success;
  bool _loading = true;

  String get _date => _dateString(_selectedDate);

  @override
  void initState() {
    super.initState();
    _loadDates();
    _loadCategories();
  }

  @override
  void dispose() {
    _sales.dispose();
    _note.dispose();
    _category.dispose();
    _expenseAmount.dispose();
    _expenseNote.dispose();
    super.dispose();
  }

  Future<void> _loadDates() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      _dates = await ApiClient.list('/closings/dates');
      await _loadForDate();
    } catch (e) {
      _error = _errorText(e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadCategories() async {
    try {
      final values = await ApiClient.list('/expenses/categories');
      if (mounted) {
        setState(() => _categories = values.map((e) => '$e').toList());
      }
    } catch (e) {
      if (mounted) setState(() => _error = _errorText(e));
    }
  }

  Future<void> _loadForDate() async {
    final query = {'from': _date, 'to': _date};
    final results = await Future.wait([
      ApiClient.list('/closings', query: query),
      ApiClient.list('/expenses', query: query),
    ]);
    if (!mounted) return;
    setState(() {
      _closings = results[0];
      _expenses = results[1];
      final matching = _closings.cast<Map>().where(
        (entry) => entry['sumber'] == _source,
      );
      _sales.text = matching.isEmpty ? '' : '${matching.first['omset'] ?? ''}';
      _note.text = matching.isEmpty ? '' : '${matching.first['catatan'] ?? ''}';
    });
  }

  Future<void> _run(Future<void> Function() action) async {
    setState(() {
      _loading = true;
      _error = null;
      _success = null;
    });
    try {
      await action();
    } catch (e) {
      if (mounted) setState(() => _error = _errorText(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _chooseDate() async {
    final chosen = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime.now().subtract(const Duration(days: 60)),
      lastDate: DateTime.now(),
      locale: const Locale('id'),
    );
    if (chosen == null) return;
    setState(() => _selectedDate = chosen);
    await _run(_loadForDate);
  }

  Future<void> _saveSales() async {
    if (_number(_sales) <= 0) {
      setState(() => _error = 'Jumlah omset harus lebih dari 0.');
      return;
    }
    await _run(() async {
      await ApiClient.post(
        '/closings',
        body: {
          'tanggal': _date,
          'omset': _number(_sales),
          'sumber': _source,
          'catatan': _note.text.trim(),
        },
      );
      await _loadForDate();
      setState(() => _success = 'Omset berhasil disimpan.');
    });
  }

  Future<void> _addExpense() async {
    if (_category.text.trim().isEmpty || _number(_expenseAmount) <= 0) {
      setState(
        () => _error = 'Isi kategori dan jumlah pengeluaran yang valid.',
      );
      return;
    }
    await _run(() async {
      await ApiClient.post(
        '/expenses',
        body: {
          'tanggal': _date,
          'kategori': _category.text.trim(),
          'jumlah': _number(_expenseAmount),
          'keterangan': _expenseNote.text.trim(),
          'sumberDana': _expenseSource,
        },
      );
      _category.clear();
      _expenseAmount.clear();
      _expenseNote.clear();
      await _loadForDate();
      setState(() => _success = 'Pengeluaran berhasil ditambahkan.');
    });
  }

  Future<void> _deleteExpense(String id) async {
    final confirmed = await _confirm(context, 'Hapus pengeluaran ini?');
    if (confirmed != true) return;
    await _run(() async {
      await ApiClient.delete('/expenses/$id');
      await _loadForDate();
    });
  }

  @override
  Widget build(BuildContext context) {
    final expensesTotal = _expenses.fold<double>(
      0,
      (sum, item) => sum + ((item as Map)['jumlah'] as num? ?? 0).toDouble(),
    );
    final salesTotal = _closings.fold<double>(
      0,
      (sum, item) => sum + ((item as Map)['omset'] as num? ?? 0).toDouble(),
    );
    return RefreshIndicator(
      onRefresh: _loadDates,
      child: _PagePadding(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const _PageHeading(
              'Tutup buku harian',
              'Catat omset kasir/QRIS dan pengeluaran sesuai tanggal transaksi.',
            ),
            if (_error != null) ...[
              ErrorBanner(message: _error!),
              const SizedBox(height: 10),
            ],
            if (_success != null) ...[
              _SuccessBanner(message: _success!),
              const SizedBox(height: 10),
            ],
            _SectionCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const _SectionTitle(
                    'Omset harian',
                    icon: Icons.trending_up_rounded,
                  ),
                  const SizedBox(height: 14),
                  OutlinedButton.icon(
                    onPressed: _chooseDate,
                    icon: const Icon(Icons.calendar_month_rounded),
                    label: Text(_dateLabel(_date)),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    (_dates
                                .cast<Map>()
                                .where((entry) => entry['tanggal'] == _date)
                                .isNotEmpty &&
                            _dates.cast<Map>().firstWhere(
                                  (entry) => entry['tanggal'] == _date,
                                )['sudahDiinput'] ==
                                true)
                        ? 'Tanggal ini sudah memiliki catatan transaksi.'
                        : 'Anda dapat memilih tanggal hingga 60 hari sebelumnya.',
                    style: const TextStyle(color: _muted, fontSize: 12),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: _source,
                    decoration: const InputDecoration(
                      labelText: 'Sumber pemasukan',
                    ),
                    items: const [
                      DropdownMenuItem(
                        value: 'KASIR',
                        child: Text('Kasir / Tunai'),
                      ),
                      DropdownMenuItem(value: 'QRIS', child: Text('QRIS')),
                    ],
                    onChanged: (value) {
                      if (value == null) return;
                      setState(() => _source = value);
                      _loadForDate().catchError(
                        (Object e) => setState(() => _error = _errorText(e)),
                      );
                    },
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _sales,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: 'Omset (Rp)',
                      prefixText: 'Rp ',
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _note,
                    decoration: const InputDecoration(
                      labelText: 'Catatan (opsional)',
                    ),
                  ),
                  if (_closings.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    _InfoPanel(
                      title: 'Total omset tanggal ini: ${_money(salesTotal)}',
                      lines: _closings
                          .map(
                            (entry) =>
                                '${entry['sumber'] == 'QRIS' ? 'QRIS' : 'Kasir/Tunai'} · ${_money(entry['omset'])}',
                          )
                          .toList(),
                    ),
                  ],
                  const SizedBox(height: 14),
                  _BusyButton(
                    label: 'Simpan Omset',
                    busy: _loading,
                    onPressed: _saveSales,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            _SectionCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _SectionTitle(
                    'Pengeluaran · ${_dateLabel(_date)}',
                    icon: Icons.payments_outlined,
                    trailing: _money(expensesTotal),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: _category,
                    decoration: InputDecoration(
                      labelText: 'Kategori pengeluaran',
                      hintText: _categories.isEmpty
                          ? 'Contoh: Belanja barang'
                          : 'Ketik nama kategori',
                    ),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _expenseAmount,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: 'Jumlah (Rp)',
                      prefixText: 'Rp ',
                    ),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _expenseNote,
                    decoration: const InputDecoration(
                      labelText: 'Keterangan (opsional)',
                    ),
                  ),
                  const SizedBox(height: 10),
                  DropdownButtonFormField<String>(
                    initialValue: _expenseSource,
                    decoration: const InputDecoration(labelText: 'Sumber dana'),
                    items: const [
                      DropdownMenuItem(
                        value: 'LACI',
                        child: Text('Laci kasir'),
                      ),
                      DropdownMenuItem(
                        value: 'CASHFLOW',
                        child: Text('Cashflow'),
                      ),
                      DropdownMenuItem(
                        value: 'BANK',
                        child: Text('Bank / transfer'),
                      ),
                    ],
                    onChanged: (value) =>
                        setState(() => _expenseSource = value ?? 'LACI'),
                  ),
                  const SizedBox(height: 12),
                  _BusyButton(
                    label: 'Tambah Pengeluaran',
                    busy: _loading,
                    onPressed: _addExpense,
                    icon: Icons.add,
                  ),
                  const Divider(height: 26),
                  if (_loading)
                    const Center(child: CircularProgressIndicator())
                  else if (_expenses.isEmpty)
                    const _EmptyState(
                      'Belum ada pengeluaran pada tanggal ini.',
                      icon: Icons.receipt_long_outlined,
                    )
                  else
                    ..._expenses.map((entry) {
                      final e = _map(entry);
                      return _DataTile(
                        icon: Icons.payments_outlined,
                        title: '${e['kategori'] ?? 'Pengeluaran'}',
                        subtitle:
                            '${e['sumberDana'] ?? 'LACI'}${(e['keterangan'] ?? '').toString().isNotEmpty ? ' · ${e['keterangan']}' : ''}',
                        value: _money(e['jumlah']),
                        trailing: IconButton(
                          tooltip: 'Hapus pengeluaran',
                          onPressed: () => _deleteExpense('${e['id']}'),
                          icon: const Icon(
                            Icons.delete_outline,
                            color: Color(0xFFC43838),
                          ),
                        ),
                      );
                    }),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class BonPage extends StatefulWidget {
  const BonPage({super.key});
  @override
  State<BonPage> createState() => _BonPageState();
}

class _BonPageState extends State<BonPage> {
  final ImagePicker _picker = ImagePicker();
  final _date = TextEditingController();
  final _amount = TextEditingController();
  final _supplier = TextEditingController();
  final _category = TextEditingController();
  final _dueDate = TextEditingController();
  List<String> _categories = [];
  File? _image;
  Map<String, dynamic>? _bon;
  String _type = 'CASH';
  String _source = 'LACI';
  bool _uploading = false;
  bool _saving = false;
  String? _error;
  String? _message;

  @override
  void initState() {
    super.initState();
    ApiClient.list('/expenses/categories')
        .then((items) {
          if (mounted) {
            setState(() => _categories = items.map((item) => '$item').toList());
          }
        })
        .catchError((Object e) {
          if (mounted) setState(() => _error = _errorText(e));
        });
  }

  @override
  void dispose() {
    _date.dispose();
    _amount.dispose();
    _supplier.dispose();
    _category.dispose();
    _dueDate.dispose();
    super.dispose();
  }

  Future<void> _pickImage(ImageSource source) async {
    try {
      final picked = await _picker.pickImage(
        source: source,
        imageQuality: 85,
        maxWidth: 2000,
      );
      if (picked == null) return;
      setState(() {
        _image = File(picked.path);
        _bon = null;
        _error = null;
        _message = null;
      });
      await _upload();
    } catch (e) {
      setState(() => _error = 'Tidak dapat membuka foto: ${_errorText(e)}');
    }
  }

  Future<void> _upload() async {
    if (_image == null) return;
    setState(() {
      _uploading = true;
      _error = null;
    });
    try {
      final result = await ApiClient.uploadImage(
        '/bon/upload',
        _image!,
        type: _type,
      );
      setState(() {
        _bon = result;
        _date.text = _inputDate(result['tanggal']) ?? _dateString();
        _amount.text = result['jumlah'] == null ? '' : '${result['jumlah']}';
        _supplier.text = '${result['supplier'] ?? ''}';
        _dueDate.text = _inputDate(result['jatuhTempo']) ?? '';
      });
    } catch (e) {
      setState(() => _error = _errorText(e));
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  String? _inputDate(Object? value) {
    final date = DateTime.tryParse('$value');
    return date == null ? null : _dateString(date.toLocal());
  }

  Future<void> _save() async {
    if (_bon == null) return;
    final amount = _number(_amount);
    if (amount <= 0) {
      setState(
        () => _error = 'Nominal hasil OCR harus diisi dan lebih dari 0.',
      );
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ApiClient.patch(
        '/bon/${_bon!['id']}/confirm',
        body: {
          'tanggal': _date.text.trim(),
          'jumlah': amount,
          'supplier': _supplier.text.trim(),
          if (_type != 'TITIP')
            'kategori': _category.text.trim().isEmpty
                ? 'Belanja/Bon Tunai'
                : _category.text.trim(),
          if (_type == 'CREDIT' && _dueDate.text.isNotEmpty)
            'jatuhTempo': _dueDate.text,
          if (_type == 'CASH') 'sumberDana': _source,
        },
      );
      setState(() {
        _bon = null;
        _image = null;
        _message = 'Bon berhasil dikonfirmasi dan disimpan.';
        _amount.clear();
        _supplier.clear();
        _category.clear();
      });
    } catch (e) {
      setState(() => _error = _errorText(e));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) => _PagePadding(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _PageHeading(
          'Upload bon / nota',
          'Foto nota dibaca dengan OCR. Periksa tanggal dan nominal sebelum menyimpan.',
        ),
        if (_error != null) ...[
          ErrorBanner(message: _error!),
          const SizedBox(height: 10),
        ],
        if (_message != null) ...[
          _SuccessBanner(message: _message!),
          const SizedBox(height: 10),
        ],
        _SectionCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const _SectionTitle(
                'Jenis nota',
                icon: Icons.receipt_long_rounded,
              ),
              const SizedBox(height: 12),
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(
                    value: 'CASH',
                    label: Text('Tunai'),
                    icon: Icon(Icons.payments_outlined),
                  ),
                  ButtonSegment(
                    value: 'CREDIT',
                    label: Text('Kredit'),
                    icon: Icon(Icons.account_balance_wallet_outlined),
                  ),
                  ButtonSegment(
                    value: 'TITIP',
                    label: Text('Titip'),
                    icon: Icon(Icons.inventory_2_outlined),
                  ),
                ],
                selected: {_type},
                onSelectionChanged: (value) =>
                    setState(() => _type = value.first),
              ),
              const SizedBox(height: 14),
              if (_image != null)
                ClipRRect(
                  borderRadius: BorderRadius.circular(14),
                  child: Image.file(
                    _image!,
                    height: 220,
                    width: double.infinity,
                    fit: BoxFit.cover,
                  ),
                ),
              if (_uploading) const LinearProgressIndicator(),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _uploading
                          ? null
                          : () => _pickImage(ImageSource.camera),
                      icon: const Icon(Icons.camera_alt_outlined),
                      label: const Text('Kamera'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _uploading
                          ? null
                          : () => _pickImage(ImageSource.gallery),
                      icon: const Icon(Icons.photo_library_outlined),
                      label: const Text('Galeri'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        if (_bon != null) ...[
          const SizedBox(height: 14),
          _SectionCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const _SectionTitle(
                  'Konfirmasi hasil baca',
                  icon: Icons.fact_check_outlined,
                ),
                const SizedBox(height: 6),
                const Text(
                  'Koreksi bila hasil OCR kurang tepat.',
                  style: TextStyle(color: _muted),
                ),
                const SizedBox(height: 14),
                TextField(
                  controller: _date,
                  readOnly: true,
                  decoration: InputDecoration(
                    labelText: 'Tanggal',
                    suffixIcon: IconButton(
                      onPressed: () => _pickDate(_date),
                      icon: const Icon(Icons.calendar_month),
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _amount,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: 'Jumlah (Rp)',
                    prefixText: 'Rp ',
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _supplier,
                  decoration: const InputDecoration(
                    labelText: 'Nama supplier/toko',
                  ),
                ),
                if (_type != 'TITIP') ...[
                  const SizedBox(height: 10),
                  TextField(
                    controller: _category,
                    decoration: const InputDecoration(
                      labelText: 'Kategori pengeluaran',
                    ),
                  ),
                  if (_categories.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 6,
                      runSpacing: 4,
                      children: _categories
                          .take(5)
                          .map(
                            (category) => ActionChip(
                              label: Text(category),
                              onPressed: () =>
                                  setState(() => _category.text = category),
                            ),
                          )
                          .toList(),
                    ),
                  ],
                ],
                if (_type == 'CREDIT') ...[
                  const SizedBox(height: 10),
                  TextField(
                    controller: _dueDate,
                    readOnly: true,
                    decoration: InputDecoration(
                      labelText: 'Jatuh tempo (opsional)',
                      suffixIcon: IconButton(
                        onPressed: () => _pickDate(_dueDate),
                        icon: const Icon(Icons.calendar_month),
                      ),
                    ),
                  ),
                ],
                if (_type == 'CASH') ...[
                  const SizedBox(height: 10),
                  DropdownButtonFormField<String>(
                    initialValue: _source,
                    decoration: const InputDecoration(labelText: 'Sumber dana'),
                    items: const [
                      DropdownMenuItem(
                        value: 'LACI',
                        child: Text('Laci kasir'),
                      ),
                      DropdownMenuItem(
                        value: 'CASHFLOW',
                        child: Text('Cashflow'),
                      ),
                      DropdownMenuItem(
                        value: 'BANK',
                        child: Text('Bank / transfer'),
                      ),
                    ],
                    onChanged: (value) =>
                        setState(() => _source = value ?? 'LACI'),
                  ),
                ],
                const SizedBox(height: 14),
                _BusyButton(
                  label: 'Konfirmasi & Simpan',
                  busy: _saving,
                  onPressed: _save,
                ),
              ],
            ),
          ),
        ],
      ],
    ),
  );

  Future<void> _pickDate(TextEditingController target) async {
    final selected = DateTime.tryParse(target.text) ?? DateTime.now();
    final value = await showDatePicker(
      context: context,
      initialDate: selected,
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
    );
    if (value != null) target.text = _dateString(value);
  }
}

class BillsPage extends StatefulWidget {
  final bool isAdmin;
  const BillsPage({super.key, required this.isAdmin});
  @override
  State<BillsPage> createState() => _BillsPageState();
}

class _BillsPageState extends State<BillsPage> {
  String _filter = 'BELUM_LUNAS';
  String _search = '';
  List<dynamic> _items = [];
  List<dynamic> _unpaidItems = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final query = switch (_filter) {
        'CASH' => {'tipe': 'CASH'},
        'LUNAS' => {'tipe': 'CREDIT', 'status': 'LUNAS'},
        _ => {'status': 'BELUM_LUNAS'},
      };
      final results = await Future.wait([
        ApiClient.list('/bon', query: query),
        ApiClient.list('/bon', query: {'status': 'BELUM_LUNAS'}),
      ]);
      _items = results[0];
      _unpaidItems = results[1];
    } catch (e) {
      _error = _errorText(e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _pay(Map<String, dynamic> bon) async {
    final amountController = TextEditingController();
    var method = 'LACI';
    final remaining =
        ((bon['jumlah'] as num? ?? 0) - (bon['paidAmount'] as num? ?? 0))
            .toDouble();
    final suggestedAmount = bon['tipe'] == 'TITIP'
        ? (bon['jumlah'] as num? ?? 0).toDouble()
        : remaining;
    final result = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text(
            bon['tipe'] == 'TITIP'
                ? 'Selesaikan barang titip'
                : 'Bayar tagihan',
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('Sisa tagihan: ${_money(remaining)}'),
              const SizedBox(height: 12),
              TextField(
                controller: amountController,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  labelText: bon['tipe'] == 'TITIP'
                      ? 'Jumlah akhir terjual'
                      : 'Jumlah pembayaran',
                  prefixText: 'Rp ',
                  hintText: suggestedAmount.toStringAsFixed(0),
                ),
              ),
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(
                initialValue: method,
                decoration: const InputDecoration(labelText: 'Sumber dana'),
                items: const [
                  DropdownMenuItem(value: 'LACI', child: Text('Laci kasir')),
                  DropdownMenuItem(value: 'CASHFLOW', child: Text('Cashflow')),
                  DropdownMenuItem(
                    value: 'BANK',
                    child: Text('Bank / transfer'),
                  ),
                ],
                onChanged: (value) =>
                    setDialogState(() => method = value ?? 'LACI'),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Batal'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Simpan'),
            ),
          ],
        ),
      ),
    );
    if (result != true) {
      amountController.dispose();
      return;
    }
    final enteredAmount =
        double.tryParse(
          amountController.text.replaceAll(RegExp(r'[^0-9]'), ''),
        ) ??
        suggestedAmount;
    amountController.dispose();
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      if (bon['tipe'] == 'TITIP') {
        await ApiClient.post(
          '/bon/${bon['id']}/selesaikan-titip',
          body: {'jumlahAkhir': enteredAmount, 'metode': method},
        );
      } else {
        await ApiClient.post(
          '/bon/${bon['id']}/pay',
          body: {'jumlah': enteredAmount, 'metode': method},
        );
      }
      await _load();
    } catch (e) {
      setState(() {
        _error = _errorText(e);
        _loading = false;
      });
    }
  }

  Future<void> _delete(Map<String, dynamic> bon) async {
    if (await _confirm(
          context,
          'Hapus bon ${bon['supplier'] ?? 'ini'}? Pengeluaran terkait juga akan dihapus.',
        ) !=
        true) {
      return;
    }
    try {
      await ApiClient.delete('/bon/${bon['id']}');
      await _load();
    } catch (e) {
      setState(() => _error = _errorText(e));
    }
  }

  Future<void> _edit(Map<String, dynamic> bon) async {
    final date = TextEditingController(text: _inputDate(bon['tanggal']) ?? '');
    final amount = TextEditingController(text: '${bon['jumlah'] ?? ''}');
    final supplier = TextEditingController(text: '${bon['supplier'] ?? ''}');
    final dueDate = TextEditingController(
      text: _inputDate(bon['jatuhTempo']) ?? '',
    );
    final result = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Edit bon / tagihan'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: date,
                readOnly: true,
                decoration: const InputDecoration(
                  labelText: 'Tanggal (YYYY-MM-DD)',
                ),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: amount,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Jumlah (Rp)'),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: supplier,
                decoration: const InputDecoration(labelText: 'Supplier'),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: dueDate,
                decoration: const InputDecoration(
                  labelText: 'Jatuh tempo (opsional)',
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Batal'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Simpan'),
          ),
        ],
      ),
    );
    if (result == true) {
      try {
        await ApiClient.patch(
          '/bon/${bon['id']}',
          body: {
            'tanggal': date.text.trim(),
            'jumlah': double.tryParse(
              amount.text.replaceAll(RegExp(r'[^0-9]'), ''),
            ),
            'supplier': supplier.text.trim(),
            'jatuhTempo': dueDate.text.trim().isEmpty
                ? null
                : dueDate.text.trim(),
          },
        );
        await _load();
      } catch (e) {
        setState(() => _error = _errorText(e));
      }
    }
    date.dispose();
    amount.dispose();
    supplier.dispose();
    dueDate.dispose();
  }

  String? _inputDate(Object? value) {
    final parsed = DateTime.tryParse('$value');
    return parsed == null ? null : _dateString(parsed.toLocal());
  }

  Future<void> _reopen(Map<String, dynamic> bon) async {
    if (await _confirm(
          context,
          'Kembalikan tagihan ini ke status belum dibayar?',
        ) !=
        true) {
      return;
    }
    try {
      await ApiClient.post('/bon/${bon['id']}/batal-lunas');
      setState(() => _filter = 'BELUM_LUNAS');
      await _load();
    } catch (e) {
      setState(() => _error = _errorText(e));
    }
  }

  Future<void> _changePaymentSource(Map<String, dynamic> bon) async {
    var method = <String>{'LACI', 'CASHFLOW', 'BANK'}.contains(bon['caraBayar'])
        ? bon['caraBayar'] as String
        : 'LACI';
    final selected = await showDialog<String>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Ubah sumber dana pembayaran'),
          content: DropdownButtonFormField<String>(
            initialValue: method,
            decoration: const InputDecoration(labelText: 'Sumber dana'),
            items: const [
              DropdownMenuItem(value: 'LACI', child: Text('Laci kasir')),
              DropdownMenuItem(value: 'CASHFLOW', child: Text('Cashflow')),
              DropdownMenuItem(value: 'BANK', child: Text('Bank / transfer')),
            ],
            onChanged: (value) =>
                setDialogState(() => method = value ?? 'LACI'),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Batal'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, method),
              child: const Text('Simpan'),
            ),
          ],
        ),
      ),
    );
    if (selected == null) return;
    try {
      await ApiClient.post(
        '/bon/${bon['id']}/ubah-sumber-bayar',
        body: {'metode': selected},
      );
      await _load();
    } catch (e) {
      setState(() => _error = _errorText(e));
    }
  }

  Future<void> _preview(Map<String, dynamic> bon) async {
    await showDialog<void>(
      context: context,
      builder: (context) => Dialog(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      '${bon['supplier'] ?? 'Foto faktur'}',
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close),
                  ),
                ],
              ),
              SizedBox(
                height: MediaQuery.sizeOf(context).height * .65,
                child: Image.network(
                  '$apiBaseUrl/bon/${bon['id']}/image',
                  fit: BoxFit.contain,
                  errorBuilder: (context, error, stackTrace) =>
                      const _EmptyState(
                        'Foto bon tidak dapat dimuat.',
                        icon: Icons.broken_image_outlined,
                      ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final shown = _items.where((value) {
      final item = _map(value);
      final q = _search.toLowerCase();
      return '${item['supplier'] ?? ''} ${item['tanggal'] ?? ''} ${item['jumlah'] ?? ''} ${item['tipe'] ?? ''}'
          .toLowerCase()
          .contains(q);
    }).toList();
    final amountTotal = shown.fold<double>(0, (total, value) {
      final item = _map(value);
      final gross = (item['jumlah'] as num? ?? 0).toDouble();
      final paid = (item['paidAmount'] as num? ?? 0).toDouble();
      return total +
          (_filter == 'BELUM_LUNAS'
              ? (gross - paid).clamp(0, double.infinity)
              : gross);
    });
    return RefreshIndicator(
      onRefresh: _load,
      child: _PagePadding(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _PageHeading(
              _filter == 'BELUM_LUNAS'
                  ? 'Tagihan belum lunas'
                  : _filter == 'LUNAS'
                  ? 'Tagihan sudah dibayar'
                  : 'Bon tunai',
              'Pantau tagihan, sisa pembayaran, dan jatuh tempo supplier.',
            ),
            if (_error != null) ...[
              ErrorBanner(message: _error!),
              const SizedBox(height: 10),
            ],
            _SectionCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _money(amountTotal),
                    style: TextStyle(
                      fontSize: 25,
                      fontWeight: FontWeight.bold,
                      color: _filter == 'BELUM_LUNAS'
                          ? const Color(0xFFC33E3E)
                          : _brand,
                    ),
                  ),
                  if (_filter == 'BELUM_LUNAS') ...[
                    const SizedBox(height: 10),
                    _SectionCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const _SectionTitle(
                            'Jatuh tempo terdekat',
                            icon: Icons.event_note_outlined,
                          ),
                          const SizedBox(height: 12),
                          Row(
                            children: List.generate(3, (offset) {
                              final dueDate = DateTime.now().add(
                                Duration(days: offset),
                              );
                              final dueKey = _dateString(dueDate);
                              final dueItems = _unpaidItems.map(_map).where((
                                item,
                              ) {
                                final date = DateTime.tryParse(
                                  '${item['jatuhTempo'] ?? ''}',
                                );
                                return date != null &&
                                    _dateString(date.toLocal()) == dueKey;
                              }).toList();
                              final dueAmount = dueItems.fold<double>(0, (
                                sum,
                                item,
                              ) {
                                final amount = (item['jumlah'] as num? ?? 0)
                                    .toDouble();
                                final paid = (item['paidAmount'] as num? ?? 0)
                                    .toDouble();
                                return sum +
                                    (amount - paid).clamp(0, double.infinity);
                              });
                              return Expanded(
                                child: Padding(
                                  padding: EdgeInsets.only(
                                    right: offset == 2 ? 0 : 7,
                                  ),
                                  child: Container(
                                    padding: const EdgeInsets.all(9),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFF8FAF8),
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          offset == 0
                                              ? 'Hari ini'
                                              : offset == 1
                                              ? 'Besok'
                                              : 'Lusa',
                                          style: const TextStyle(
                                            fontWeight: FontWeight.w600,
                                            fontSize: 12,
                                          ),
                                        ),
                                        Text(
                                          _dateLabel(dueKey),
                                          style: const TextStyle(
                                            color: _muted,
                                            fontSize: 10,
                                          ),
                                        ),
                                        const SizedBox(height: 5),
                                        FittedBox(
                                          child: Text(
                                            _money(dueAmount),
                                            style: const TextStyle(
                                              color: Color(0xFFC43838),
                                              fontWeight: FontWeight.bold,
                                            ),
                                          ),
                                        ),
                                        Text(
                                          '${dueItems.length} tagihan',
                                          style: const TextStyle(
                                            color: _muted,
                                            fontSize: 10,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              );
                            }),
                          ),
                        ],
                      ),
                    ),
                  ],
                  const SizedBox(height: 12),
                  SegmentedButton<String>(
                    segments: const [
                      ButtonSegment(
                        value: 'BELUM_LUNAS',
                        label: Text('Belum lunas'),
                      ),
                      ButtonSegment(value: 'LUNAS', label: Text('Lunas')),
                      ButtonSegment(value: 'CASH', label: Text('Tunai')),
                    ],
                    selected: {_filter},
                    onSelectionChanged: (value) {
                      setState(() => _filter = value.first);
                      _load();
                    },
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    onChanged: (value) => setState(() => _search = value),
                    decoration: const InputDecoration(
                      prefixIcon: Icon(Icons.search),
                      hintText: 'Cari supplier atau tanggal',
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            if (_loading)
              const Center(
                child: Padding(
                  padding: EdgeInsets.all(25),
                  child: CircularProgressIndicator(),
                ),
              )
            else if (shown.isEmpty)
              const _EmptyState(
                'Tidak ada bon atau tagihan pada filter ini.',
                icon: Icons.receipt_long_outlined,
              )
            else
              ...shown.map((value) {
                final item = _map(value);
                final amount = (item['jumlah'] as num? ?? 0).toDouble();
                final paid = (item['paidAmount'] as num? ?? 0).toDouble();
                final remaining = (amount - paid).clamp(0, double.infinity);
                final isUnpaid = item['status'] == 'BELUM_LUNAS';
                return Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _SectionCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            CircleAvatar(
                              backgroundColor: isUnpaid
                                  ? const Color(0xFFFFF0E0)
                                  : const Color(0xFFE8F5EC),
                              child: Icon(
                                item['tipe'] == 'TITIP'
                                    ? Icons.inventory_2_outlined
                                    : Icons.receipt_long_outlined,
                                color: isUnpaid
                                    ? const Color(0xFFCE7B20)
                                    : _brand,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    '${item['supplier'] ?? 'Tanpa nama supplier'}',
                                    style: const TextStyle(
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                  Text(
                                    '${item['tipe']} · ${_dateLabel(item['tanggal'])}',
                                    style: const TextStyle(
                                      fontSize: 12,
                                      color: _muted,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            IconButton(
                              tooltip: 'Lihat foto faktur',
                              onPressed: () => _preview(item),
                              icon: const Icon(
                                Icons.image_outlined,
                                color: _brand,
                              ),
                            ),
                            if (widget.isAdmin) ...[
                              IconButton(
                                tooltip: 'Edit bon',
                                onPressed: () => _edit(item),
                                icon: const Icon(Icons.edit_outlined),
                              ),
                              IconButton(
                                onPressed: () => _delete(item),
                                icon: const Icon(
                                  Icons.delete_outline,
                                  color: Color(0xFFC43838),
                                ),
                              ),
                            ],
                          ],
                        ),
                        const Divider(height: 22),
                        Wrap(
                          alignment: WrapAlignment.spaceBetween,
                          runSpacing: 8,
                          children: [
                            _LabelValue('Nilai bon', _money(amount)),
                            if (_filter == 'BELUM_LUNAS')
                              _LabelValue(
                                'Sisa',
                                _money(remaining),
                                color: const Color(0xFFC43838),
                              ),
                            if (item['jatuhTempo'] != null)
                              _LabelValue(
                                'Jatuh tempo',
                                _dateLabel(item['jatuhTempo']),
                              ),
                            if (paid > 0) _LabelValue('Terbayar', _money(paid)),
                          ],
                        ),
                        if (isUnpaid && item['tipe'] != 'CASH') ...[
                          const SizedBox(height: 12),
                          _BusyButton(
                            label: item['tipe'] == 'TITIP'
                                ? 'Selesaikan / Bayar'
                                : 'Bayar tagihan',
                            busy: false,
                            onPressed: () => _pay(item),
                            icon: Icons.payments_outlined,
                          ),
                        ],
                        if (_filter == 'LUNAS' && item['tipe'] != 'CASH') ...[
                          const SizedBox(height: 10),
                          OutlinedButton.icon(
                            onPressed: () => _changePaymentSource(item),
                            icon: const Icon(Icons.swap_horiz_rounded),
                            label: const Text('Ubah sumber dana'),
                          ),
                          if (widget.isAdmin)
                            TextButton.icon(
                              onPressed: () => _reopen(item),
                              icon: const Icon(Icons.undo_rounded),
                              label: const Text('Kembalikan ke belum dibayar'),
                            ),
                        ],
                      ],
                    ),
                  ),
                );
              }),
          ],
        ),
      ),
    );
  }
}

class ReportPage extends StatefulWidget {
  const ReportPage({super.key});
  @override
  State<ReportPage> createState() => _ReportPageState();
}

class _ReportPageState extends State<ReportPage> {
  DateTime _from = DateTime(DateTime.now().year, DateTime.now().month, 1);
  DateTime _to = DateTime.now();
  Map<String, dynamic>? _summary;
  double _unpaid = 0;
  List<dynamic> _chartData = [];
  List<dynamic> _expenses = [];
  String _period = 'harian';
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final results = await Future.wait([
        ApiClient.get(
          '/reports/summary',
          query: {'from': _dateString(_from), 'to': _dateString(_to)},
        ),
        ApiClient.get('/reports/tagihan'),
        ApiClient.get(
          '/reports/chart',
          query: {
            'from': _dateString(_from),
            'to': _dateString(_to),
            'periode': _period,
          },
        ),
        ApiClient.list(
          '/expenses',
          query: {'from': _dateString(_from), 'to': _dateString(_to)},
        ),
      ]);
      _summary = results[0] as Map<String, dynamic>;
      _unpaid =
          ((results[1] as Map<String, dynamic>)['totalTagihan'] as num? ?? 0)
              .toDouble();
      _chartData =
          (results[2] as Map<String, dynamic>)['data'] as List<dynamic>? ?? [];
      _expenses = results[3] as List<dynamic>;
    } catch (e) {
      _error = _errorText(e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _pick(bool from) async {
    final date = from ? _from : _to;
    final result = await showDatePicker(
      context: context,
      initialDate: date,
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
    );
    if (result == null) return;
    setState(() {
      if (from) {
        _from = result;
      } else {
        _to = result;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final rows = (_summary?['rows'] as List<dynamic>? ?? []);
    final categories = (_summary?['categoryTotals'] as List<dynamic>? ?? []);
    return RefreshIndicator(
      onRefresh: _load,
      child: _PagePadding(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const _PageHeading(
              'Laporan / neraca',
              'Rekap omset, pengeluaran, laba/rugi dan tagihan belum lunas.',
            ),
            if (_error != null) ...[
              ErrorBanner(message: _error!),
              const SizedBox(height: 10),
            ],
            _SectionCard(
              child: Column(
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () => _pick(true),
                          icon: const Icon(Icons.calendar_month),
                          label: Text(_dateLabel(_dateString(_from))),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () => _pick(false),
                          icon: const Icon(Icons.calendar_month),
                          label: Text(_dateLabel(_dateString(_to))),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  _BusyButton(
                    label: 'Tampilkan laporan',
                    busy: _loading,
                    onPressed: _load,
                    icon: Icons.query_stats,
                  ),
                ],
              ),
            ),
            if (_loading && _summary == null)
              const Center(
                child: Padding(
                  padding: EdgeInsets.all(28),
                  child: CircularProgressIndicator(),
                ),
              )
            else if (_summary != null) ...[
              const SizedBox(height: 12),
              LayoutBuilder(
                builder: (context, constraints) {
                  final width = (constraints.maxWidth - 10) / 2;
                  return Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: [
                      _MetricCard(
                        label: 'Total omset',
                        value: _money(_summary!['totalOmset']),
                        icon: Icons.trending_up,
                        color: _brand,
                        width: width,
                      ),
                      _MetricCard(
                        label: 'Pengeluaran',
                        value: _money(_summary!['totalPengeluaran']),
                        icon: Icons.payments_outlined,
                        color: const Color(0xFFD34C4C),
                        width: width,
                      ),
                      _MetricCard(
                        label: 'Laba / rugi',
                        value: _money(_summary!['labaRugi']),
                        icon: Icons.account_balance_wallet_outlined,
                        color: const Color(0xFF3973C6),
                        width: width,
                      ),
                      _MetricCard(
                        label: 'Tagihan belum lunas',
                        value: _money(_unpaid),
                        icon: Icons.receipt_long,
                        color: const Color(0xFFCE7B20),
                        width: width,
                      ),
                    ],
                  );
                },
              ),
              const SizedBox(height: 12),
              _SectionCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Expanded(
                          child: _SectionTitle(
                            'Tren omset & pengeluaran',
                            icon: Icons.bar_chart_rounded,
                          ),
                        ),
                        DropdownButton<String>(
                          value: _period,
                          underline: const SizedBox.shrink(),
                          items: const [
                            DropdownMenuItem(
                              value: 'harian',
                              child: Text('Harian'),
                            ),
                            DropdownMenuItem(
                              value: 'mingguan',
                              child: Text('Mingguan'),
                            ),
                            DropdownMenuItem(
                              value: 'bulanan',
                              child: Text('Bulanan'),
                            ),
                          ],
                          onChanged: (value) {
                            if (value == null) return;
                            setState(() => _period = value);
                            _load();
                          },
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    if (_chartData.isEmpty)
                      const Text(
                        'Tidak ada data grafik untuk periode ini.',
                        style: TextStyle(color: _muted),
                      )
                    else
                      ..._chartData.map((value) {
                        final item = _map(value);
                        final sales = (item['omset'] as num? ?? 0).toDouble();
                        final expenses = (item['pengeluaran'] as num? ?? 0)
                            .toDouble();
                        final maxValue = _chartData.fold<double>(1, (
                          max,
                          chartItem,
                        ) {
                          final data = _map(chartItem);
                          final candidate = [
                            (data['omset'] as num? ?? 0).toDouble(),
                            (data['pengeluaran'] as num? ?? 0).toDouble(),
                          ].reduce((a, b) => a > b ? a : b);
                          return candidate > max ? candidate : max;
                        });
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      '${item['label']}',
                                      style: const TextStyle(
                                        fontSize: 12,
                                        color: _muted,
                                      ),
                                    ),
                                  ),
                                  Text(
                                    _money(sales),
                                    style: const TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w600,
                                      color: _brand,
                                    ),
                                  ),
                                  const SizedBox(width: 10),
                                  Text(
                                    _money(expenses),
                                    style: const TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w600,
                                      color: Color(0xFFD34C4C),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 4),
                              ClipRRect(
                                borderRadius: BorderRadius.circular(6),
                                child: Column(
                                  children: [
                                    LinearProgressIndicator(
                                      value: (sales / maxValue).clamp(0, 1),
                                      minHeight: 6,
                                      color: _brand,
                                      backgroundColor: const Color(0xFFEAF0EA),
                                    ),
                                    const SizedBox(height: 3),
                                    LinearProgressIndicator(
                                      value: (expenses / maxValue).clamp(0, 1),
                                      minHeight: 4,
                                      color: const Color(0xFFD34C4C),
                                      backgroundColor: const Color(0xFFF7E9E8),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        );
                      }),
                    const SizedBox(height: 2),
                    const Row(
                      children: [
                        _LegendDot(color: _brand, label: 'Omset'),
                        SizedBox(width: 14),
                        _LegendDot(
                          color: Color(0xFFD34C4C),
                          label: 'Pengeluaran',
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              _SectionCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const _SectionTitle(
                      'Rincian harian',
                      icon: Icons.view_day_outlined,
                    ),
                    const SizedBox(height: 8),
                    if (rows.isEmpty)
                      const _EmptyState(
                        'Tidak ada transaksi untuk periode ini.',
                        icon: Icons.insert_chart_outlined,
                      )
                    else
                      ...rows.map((rowValue) {
                        final row = _map(rowValue);
                        return _DataTile(
                          icon: Icons.calendar_today_outlined,
                          title: _dateLabel(row['tanggal']),
                          subtitle: 'Pengeluaran ${_money(row['pengeluaran'])}',
                          value: _money(row['omset']),
                          trailing: Text(
                            _money(row['labaRugi']),
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              color: (row['labaRugi'] as num? ?? 0) >= 0
                                  ? _brand
                                  : Colors.red,
                            ),
                          ),
                        );
                      }),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              _SectionCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _SectionTitle(
                      'Rincian pengeluaran',
                      icon: Icons.receipt_long_outlined,
                      trailing: '${_expenses.length} transaksi',
                    ),
                    const SizedBox(height: 6),
                    if (_expenses.isEmpty)
                      const Text(
                        'Belum ada pengeluaran di periode ini.',
                        style: TextStyle(color: _muted),
                      )
                    else
                      ..._expenses.map((value) {
                        final item = _map(value);
                        return _DataTile(
                          icon: Icons.payments_outlined,
                          title: '${item['kategori'] ?? 'Pengeluaran'}',
                          subtitle:
                              '${_dateLabel(item['tanggal'])} · ${item['sumberDana'] ?? ''}${(item['keterangan'] ?? '').toString().isEmpty ? '' : ' · ${item['keterangan']}'}',
                          value: _money(item['jumlah']),
                        );
                      }),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              _SectionCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const _SectionTitle(
                      'Pengeluaran per kategori',
                      icon: Icons.pie_chart_outline,
                    ),
                    const SizedBox(height: 8),
                    if (categories.isEmpty)
                      const Text(
                        'Belum ada pengeluaran.',
                        style: TextStyle(color: _muted),
                      )
                    else
                      ...categories.map((value) {
                        final item = _map(value);
                        return _DataTile(
                          icon: Icons.label_outline,
                          title: '${item['name']}',
                          value: _money(item['jumlah']),
                        );
                      }),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class UsersPage extends StatefulWidget {
  const UsersPage({super.key});
  @override
  State<UsersPage> createState() => _UsersPageState();
}

class _UsersPageState extends State<UsersPage> {
  List<dynamic> _users = [];
  bool _loading = true;
  String? _error;
  final _name = TextEditingController();
  final _username = TextEditingController();
  final _password = TextEditingController();
  String _role = 'CASHIER';

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _name.dispose();
    _username.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      _users = await ApiClient.list('/users');
    } catch (e) {
      _error = _errorText(e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _create() async {
    if (_name.text.trim().isEmpty ||
        _username.text.trim().length < 3 ||
        _password.text.length < 6) {
      setState(
        () => _error = 'Isi nama, username minimal 3 karakter, dan password minimal 6 karakter.',
      );
      return;
    }
    try {
      await ApiClient.post(
        '/users',
        body: {
          'name': _name.text.trim(),
          'username': _username.text.trim(),
          'password': _password.text,
          'role': _role,
        },
      );
      _name.clear();
      _username.clear();
      _password.clear();
      setState(() => _role = 'CASHIER');
      await _load();
    } catch (e) {
      setState(() => _error = _errorText(e));
    }
  }

  Future<void> _toggle(Map<String, dynamic> user) async {
    try {
      await ApiClient.patch(
        '/users/${user['id']}/active',
        body: {'active': !(user['active'] as bool? ?? false)},
      );
      await _load();
    } catch (e) {
      setState(() => _error = _errorText(e));
    }
  }

  @override
  Widget build(BuildContext context) => RefreshIndicator(
    onRefresh: _load,
    child: _PagePadding(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _PageHeading(
            'Kelola pengguna',
            'Buat akun kasir/admin dan aktifkan atau nonaktifkan akses.',
          ),
          if (_error != null) ...[
            ErrorBanner(message: _error!),
            const SizedBox(height: 10),
          ],
          _SectionCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const _SectionTitle(
                  'Tambah pengguna',
                  icon: Icons.person_add_alt_1,
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _name,
                  decoration: const InputDecoration(labelText: 'Nama lengkap'),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _username,
                  autocorrect: false,
                  decoration: const InputDecoration(labelText: 'Username'),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _password,
                  obscureText: true,
                  decoration: const InputDecoration(
                    labelText: 'Password (minimal 6 karakter)',
                  ),
                ),
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  initialValue: _role,
                  decoration: const InputDecoration(labelText: 'Role'),
                  items: const [
                    DropdownMenuItem(value: 'CASHIER', child: Text('Kasir')),
                    DropdownMenuItem(
                      value: 'ADMIN',
                      child: Text('Administrator'),
                    ),
                  ],
                  onChanged: (value) =>
                      setState(() => _role = value ?? 'CASHIER'),
                ),
                const SizedBox(height: 12),
                _BusyButton(
                  label: 'Tambah user',
                  busy: _loading,
                  onPressed: _create,
                  icon: Icons.person_add_alt_1,
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          _SectionCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _SectionTitle(
                  'Daftar pengguna',
                  icon: Icons.groups_2_outlined,
                  trailing: '${_users.length} akun',
                ),
                if (_loading)
                  const Center(
                    child: Padding(
                      padding: EdgeInsets.all(18),
                      child: CircularProgressIndicator(),
                    ),
                  )
                else if (_users.isEmpty)
                  const _EmptyState(
                    'Belum ada pengguna.',
                    icon: Icons.people_outline,
                  )
                else
                  ..._users.map((value) {
                    final user = _map(value);
                    final active = user['active'] as bool? ?? false;
                    return _DataTile(
                      icon: user['role'] == 'ADMIN'
                          ? Icons.admin_panel_settings_outlined
                          : Icons.person_outline,
                      title: '${user['name']}',
                      subtitle:
                          '@${user['username']} · ${user['role'] == 'ADMIN' ? 'Administrator' : 'Kasir'} · ${active ? 'Aktif' : 'Nonaktif'}',
                      trailing: Switch(
                        value: active,
                        activeThumbColor: _brand,
                        onChanged: (_) => _toggle(user),
                      ),
                    );
                  }),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}

class NotificationsPage extends StatefulWidget {
  final bool isAdmin;
  final ValueChanged<String> onOpenRoute;
  final String? serviceError;
  const NotificationsPage({
    super.key,
    required this.isAdmin,
    required this.onOpenRoute,
    required this.serviceError,
  });
  @override
  State<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends State<NotificationsPage> {
  List<dynamic> _items = [];
  bool _loading = true;
  String? _error;
  final _title = TextEditingController();
  final _message = TextEditingController();
  String _recipient = 'SEMUA';
  String? _recipientUserId;
  String _destination = '/laporan';
  List<Map<String, dynamic>> _users = [];
  bool _permissionGranted = false;
  bool _permissionLoading = true;

  @override
  void initState() {
    super.initState();
    _load();
    if (widget.isAdmin) _loadUsers();
    _checkNotificationPermission();
  }

  Future<void> _loadUsers() async {
    try {
      _users = (await ApiClient.list('/users'))
          .map((value) => Map<String, dynamic>.from(value as Map))
          .where((user) => user['active'] == true)
          .toList();
      if (mounted) setState(() {});
    } catch (e) {
      if (mounted) setState(() => _error = _errorText(e));
    }
  }

  Future<void> _checkNotificationPermission() async {
    try {
      final granted = await NotificationService.notificationsEnabled;
      if (mounted) {
        setState(() {
          _permissionGranted = granted;
          _permissionLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = _errorText(e);
          _permissionLoading = false;
        });
      }
    }
  }

  Future<void> _enableDeviceNotifications() async {
    setState(() {
      _permissionLoading = true;
      _error = null;
    });
    try {
      final granted = await NotificationService.requestPermission();
      if (!mounted) return;
      setState(() {
        _permissionGranted = granted;
        _permissionLoading = false;
        if (!granted) {
          _error = 'Izin notifikasi belum diberikan. Aktifkan melalui Pengaturan Android.';
        }
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          _permissionLoading = false;
          _error = _errorText(e);
        });
      }
    }
  }

  @override
  void dispose() {
    _title.dispose();
    _message.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      _items = await ApiClient.list('/notifications');
    } catch (e) {
      _error = _errorText(e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _send() async {
    if (_title.text.trim().isEmpty || _message.text.trim().isEmpty) {
      setState(() => _error = 'Judul dan isi notifikasi wajib diisi.');
      return;
    }
    if (_recipient == 'USER' && _recipientUserId == null) {
      setState(() => _error = 'Pilih pengguna penerima notifikasi.');
      return;
    }
    try {
      await ApiClient.post(
        '/notifications',
        body: {
          'judul': _title.text.trim(),
          'pesan': _message.text.trim(),
          'tujuan': _destination,
          'penerima': _recipient,
          if (_recipient == 'USER') 'userId': _recipientUserId,
        },
      );
      _title.clear();
      _message.clear();
      await _load();
    } catch (e) {
      setState(() => _error = _errorText(e));
    }
  }

  Future<void> _markRead(Map<String, dynamic> item) async {
    if (item['dibacaAt'] == null) {
      try {
        await ApiClient.patch('/notifications/${item['id']}/read');
        await _load();
      } catch (e) {
        setState(() => _error = _errorText(e));
      }
    }
    widget.onOpenRoute('${item['tujuan'] ?? '/notifikasi'}');
  }

  Future<void> _delete(Map<String, dynamic> item) async {
    if (!widget.isAdmin ||
        await _confirm(context, 'Hapus notifikasi ini?') != true) {
      return;
    }
    try {
      await ApiClient.delete('/notifications/${item['id']}');
      await _load();
    } catch (e) {
      setState(() => _error = _errorText(e));
    }
  }

  @override
  Widget build(BuildContext context) => RefreshIndicator(
    onRefresh: _load,
    child: _PagePadding(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _PageHeading(
            'Notifikasi',
            'Pengumuman dan aktivitas terbaru untuk akun Anda.',
          ),
          if (_error != null) ...[
            ErrorBanner(message: _error!),
            const SizedBox(height: 10),
          ],
          if (widget.serviceError != null) ...[
            ErrorBanner(message: 'Layanan notifikasi: ${widget.serviceError}'),
            const SizedBox(height: 10),
          ],
          _SectionCard(
            child: Row(
              children: [
                Icon(
                  _permissionGranted
                      ? Icons.notifications_active_rounded
                      : Icons.notifications_off_outlined,
                  color: _permissionGranted ? _brand : const Color(0xFFCE7B20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    _permissionGranted
                        ? 'Notifikasi FCM aktif di perangkat ini, termasuk saat aplikasi di latar belakang.'
                        : 'Aktifkan notifikasi agar perangkat menerima pemberitahuan FCM, termasuk saat aplikasi ditutup.',
                    style: const TextStyle(fontSize: 13, height: 1.4),
                  ),
                ),
                if (!_permissionGranted)
                  TextButton(
                    onPressed: _permissionLoading
                        ? null
                        : _enableDeviceNotifications,
                    child: _permissionLoading
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Aktifkan'),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          if (widget.isAdmin)
            _SectionCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const _SectionTitle(
                    'Kirim pengumuman',
                    icon: Icons.campaign_outlined,
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _title,
                    maxLength: 120,
                    decoration: const InputDecoration(labelText: 'Judul'),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _message,
                    maxLines: 3,
                    maxLength: 2000,
                    decoration: const InputDecoration(labelText: 'Isi pesan'),
                  ),
                  const SizedBox(height: 8),
                  DropdownButtonFormField<String>(
                    initialValue: _recipient,
                    decoration: const InputDecoration(labelText: 'Penerima'),
                    items: const [
                      DropdownMenuItem(
                        value: 'SEMUA',
                        child: Text('Semua pengguna'),
                      ),
                      DropdownMenuItem(
                        value: 'ADMIN',
                        child: Text('Administrator'),
                      ),
                      DropdownMenuItem(value: 'CASHIER', child: Text('Kasir')),
                      DropdownMenuItem(
                        value: 'USER',
                        child: Text('Pengguna tertentu'),
                      ),
                    ],
                    onChanged: (value) => setState(() {
                      _recipient = value ?? 'SEMUA';
                      _recipientUserId = null;
                    }),
                  ),
                  if (_recipient == 'USER') ...[
                    const SizedBox(height: 8),
                    DropdownButtonFormField<String>(
                      initialValue: _recipientUserId,
                      decoration: const InputDecoration(
                        labelText: 'Pilih pengguna',
                      ),
                      items: _users
                          .map(
                            (user) => DropdownMenuItem(
                              value: '${user['id']}',
                              child: Text(
                                '${user['name']} (${user['role'] == 'ADMIN' ? 'Admin' : 'Kasir'})',
                              ),
                            ),
                          )
                          .toList(),
                      onChanged: (value) =>
                          setState(() => _recipientUserId = value),
                    ),
                  ],
                  const SizedBox(height: 8),
                  DropdownButtonFormField<String>(
                    initialValue: _destination,
                    decoration: const InputDecoration(
                      labelText: 'Halaman saat notifikasi diketuk',
                    ),
                    items: const [
                      DropdownMenuItem(
                        value: '/laporan',
                        child: Text('Laporan'),
                      ),
                      DropdownMenuItem(
                        value: '/input-harian',
                        child: Text('Harian'),
                      ),
                      DropdownMenuItem(
                        value: '/upload-bon',
                        child: Text('Upload bon'),
                      ),
                      DropdownMenuItem(
                        value: '/tagihan',
                        child: Text('Tagihan'),
                      ),
                      DropdownMenuItem(
                        value: '/notifikasi',
                        child: Text('Notifikasi'),
                      ),
                      DropdownMenuItem(
                        value: '/barang-kosong-admin',
                        child: Text('Barang kosong'),
                      ),
                    ],
                    onChanged: (value) =>
                        setState(() => _destination = value ?? '/laporan'),
                  ),
                  const SizedBox(height: 12),
                  _BusyButton(
                    label: 'Kirim notifikasi',
                    busy: _loading,
                    onPressed: _send,
                    icon: Icons.send_rounded,
                  ),
                ],
              ),
            ),
          if (widget.isAdmin) const SizedBox(height: 14),
          _SectionCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _SectionTitle(
                  'Pesan masuk',
                  icon: Icons.notifications_none_rounded,
                  trailing: '${_items.length}',
                ),
                if (_loading)
                  const Center(
                    child: Padding(
                      padding: EdgeInsets.all(18),
                      child: CircularProgressIndicator(),
                    ),
                  )
                else if (_items.isEmpty)
                  const _EmptyState(
                    'Belum ada notifikasi.',
                    icon: Icons.notifications_off_outlined,
                  )
                else
                  ..._items.map((value) {
                    final item = _map(value);
                    final read = item['dibacaAt'] != null;
                    return _DataTile(
                      icon: read
                          ? Icons.notifications_none_rounded
                          : Icons.notifications_active_rounded,
                      title: '${item['judul'] ?? 'Notifikasi'}',
                      subtitle:
                          '${item['pesan'] ?? ''}\n${_dateLabel(item['createdAt'])}',
                      value: read ? '' : 'Baru',
                      trailing: widget.isAdmin
                          ? IconButton(
                              onPressed: () => _delete(item),
                              icon: const Icon(Icons.delete_outline),
                            )
                          : null,
                      onTap: () => _markRead(item),
                    );
                  }),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}

class StockPage extends StatefulWidget {
  final bool isAdmin;
  const StockPage({super.key, required this.isAdmin});
  @override
  State<StockPage> createState() => _StockPageState();
}

class _StockPageState extends State<StockPage> {
  List<dynamic> _items = [];
  bool _loading = true;
  String? _error;
  final _itemsText = TextEditingController();
  final _note = TextEditingController();

  List<Map<String, dynamic>> get _pendingItems =>
      _items.map(_map).where((item) => item['dibeliAt'] == null).toList();

  List<Map<String, dynamic>> get _purchasedItems {
    final items = _items
        .map(_map)
        .where((item) => item['dibeliAt'] != null)
        .toList();
    items.sort((a, b) {
      final aDate = DateTime.tryParse('${a['dibeliAt']}') ?? DateTime(1970);
      final bDate = DateTime.tryParse('${b['dibeliAt']}') ?? DateTime(1970);
      return bDate.compareTo(aDate);
    });
    return items;
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _itemsText.dispose();
    _note.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      _items = await ApiClient.list('/barang-kosong');
    } catch (e) {
      _error = _errorText(e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _submit() async {
    if (_itemsText.text.trim().isEmpty) {
      setState(() => _error = 'Tulis minimal satu nama barang.');
      return;
    }
    try {
      await ApiClient.post(
        '/barang-kosong',
        body: {
          'namaBarang': _itemsText.text.trim(),
          'catatan': _note.text.trim(),
        },
      );
      _itemsText.clear();
      _note.clear();
      await _load();
    } catch (e) {
      setState(() => _error = _errorText(e));
    }
  }

  Future<void> _toggle(Map<String, dynamic> item) async {
    try {
      await ApiClient.patch('/barang-kosong/${item['id']}/purchased');
      await _load();
    } catch (e) {
      setState(() => _error = _errorText(e));
    }
  }

  Widget _reportList({
    required String title,
    required List<Map<String, dynamic>> items,
    required bool purchased,
  }) {
    return _SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SectionTitle(
            title,
            icon: purchased
                ? Icons.check_circle_outline_rounded
                : Icons.inventory_2_outlined,
            trailing: '${items.length}',
          ),
          const SizedBox(height: 8),
          if (_loading)
            const Padding(
              padding: EdgeInsets.all(18),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (items.isEmpty)
            _EmptyState(
              purchased
                  ? 'Belum ada barang yang dibelanjakan.'
                  : 'Tidak ada barang yang menunggu dibelanjakan.',
              icon: purchased
                  ? Icons.task_alt_rounded
                  : Icons.inventory_outlined,
            )
          else
            ...items.map((item) {
              final createdBy = (item['createdBy'] as Map?)?['name'] ?? 'Kasir';
              final checkedBy =
                  (item['dibeliOleh'] as Map?)?['name'] ?? 'Admin';
              final createdAt = item['createdAt'];
              final purchasedAt = item['dibeliAt'];
              final note = (item['catatan'] ?? '').toString().trim();

              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 7),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Material(
                      color: purchased ? _brand : Colors.white,
                      borderRadius: BorderRadius.circular(6),
                      child: InkWell(
                        onTap: () => _toggle(item),
                        borderRadius: BorderRadius.circular(6),
                        child: Container(
                          width: 26,
                          height: 26,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(
                              color: purchased
                                  ? _brand
                                  : const Color(0xFFBCC8BE),
                            ),
                          ),
                          child: purchased
                              ? const Icon(
                                  Icons.check_rounded,
                                  color: Colors.white,
                                  size: 19,
                                )
                              : null,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '${item['namaBarang'] ?? 'Barang'}',
                            style: TextStyle(
                              fontWeight: FontWeight.w600,
                              color: purchased ? _muted : _ink,
                            ),
                          ),
                          if (note.isNotEmpty) ...[
                            const SizedBox(height: 3),
                            Text(
                              note,
                              style: const TextStyle(
                                color: _muted,
                                fontSize: 12,
                              ),
                            ),
                          ],
                          const SizedBox(height: 4),
                          Text(
                            purchased
                                ? 'Dicentang ${_dateLabel(purchasedAt)} oleh $checkedBy'
                                : 'Dicatat ${_dateLabel(createdAt)} oleh $createdBy',
                            style: TextStyle(
                              color: purchased ? _brand : _muted,
                              fontSize: 11,
                            ),
                          ),
                          if (purchased) ...[
                            const SizedBox(height: 2),
                            Text(
                              'Diinput ${_dateLabel(createdAt)} oleh $createdBy',
                              style: const TextStyle(
                                color: _muted,
                                fontSize: 11,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) => RefreshIndicator(
    onRefresh: _load,
    child: _PagePadding(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _PageHeading(
            widget.isAdmin ? 'Daftar barang kosong' : 'Laporan barang kosong',
            widget.isAdmin ? 'Tandai barang yang sudah dibeli toko.' : 'Laporkan barang yang habis agar admin dapat menindaklanjuti.',
          ),
          if (_error != null) ...[
            ErrorBanner(message: _error!),
            const SizedBox(height: 10),
          ],
          if (!widget.isAdmin) ...[
            _SectionCard(
              child: Column(
                children: [
                  TextField(
                    controller: _itemsText,
                    maxLines: 4,
                    decoration: const InputDecoration(
                      labelText: 'Nama barang (satu barang per baris)',
                      alignLabelWithHint: true,
                    ),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _note,
                    decoration: const InputDecoration(
                      labelText: 'Catatan (opsional)',
                    ),
                  ),
                  const SizedBox(height: 12),
                  _BusyButton(
                    label: 'Kirim laporan',
                    busy: _loading,
                    onPressed: _submit,
                    icon: Icons.send_rounded,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
          ],
          if (widget.isAdmin) ...[
            _reportList(
              title: 'Belum Dibelanjakan',
              items: _pendingItems,
              purchased: false,
            ),
            const SizedBox(height: 14),
            _reportList(
              title: 'Sudah Dibelanjakan',
              items: _purchasedItems,
              purchased: true,
            ),
          ] else
            _reportList(
              title: 'Daftar kebutuhan',
              items: _pendingItems,
              purchased: false,
            ),
        ],
      ),
    ),
  );
}

class _SuccessBanner extends StatelessWidget {
  final String message;
  const _SuccessBanner({required this.message});

  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: const Color(0xFFEAF6EE),
      borderRadius: BorderRadius.circular(12),
    ),
    child: Text(message, style: const TextStyle(color: _brand)),
  );
}

class _SectionTitle extends StatelessWidget {
  final String title;
  final IconData icon;
  final String? trailing;
  const _SectionTitle(this.title, {required this.icon, this.trailing});

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Icon(icon, size: 20, color: _brand),
      const SizedBox(width: 8),
      Expanded(
        child: Text(
          title,
          style: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.bold,
            color: _ink,
          ),
        ),
      ),
      if (trailing != null)
        Text(
          trailing!,
          style: const TextStyle(fontWeight: FontWeight.bold, color: _muted),
        ),
    ],
  );
}

class _LegendDot extends StatelessWidget {
  final Color color;
  final String label;
  const _LegendDot({required this.color, required this.label});

  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Container(
        width: 8,
        height: 8,
        decoration: BoxDecoration(color: color, shape: BoxShape.circle),
      ),
      const SizedBox(width: 5),
      Text(label, style: const TextStyle(fontSize: 11, color: _muted)),
    ],
  );
}

class _InfoPanel extends StatelessWidget {
  final String title;
  final List<String> lines;
  const _InfoPanel({required this.title, required this.lines});

  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: const Color(0xFFF4F7F4),
      borderRadius: BorderRadius.circular(12),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
        ...lines.map(
          (line) => Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(
              line,
              style: const TextStyle(fontSize: 12, color: _muted),
            ),
          ),
        ),
      ],
    ),
  );
}

class _DataTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final String? value;
  final Widget? trailing;
  final VoidCallback? onTap;
  const _DataTile({
    required this.icon,
    required this.title,
    this.subtitle,
    this.value,
    this.trailing,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) => ListTile(
    contentPadding: const EdgeInsets.symmetric(horizontal: 2, vertical: 2),
    leading: Icon(icon, color: _brand),
    title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
    subtitle: subtitle == null
        ? null
        : Text(subtitle!, style: const TextStyle(fontSize: 12, height: 1.35)),
    trailing:
        trailing ??
        (value == null
            ? null
            : Text(
                value!,
                style: const TextStyle(fontWeight: FontWeight.bold),
              )),
    onTap: onTap,
  );
}

class _LabelValue extends StatelessWidget {
  final String label;
  final String value;
  final Color? color;
  const _LabelValue(this.label, this.value, {this.color});

  @override
  Widget build(BuildContext context) => SizedBox(
    width: MediaQuery.sizeOf(context).width > 700 ? 180 : 145,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(color: _muted, fontSize: 11)),
        const SizedBox(height: 3),
        Text(
          value,
          style: TextStyle(fontWeight: FontWeight.bold, color: color ?? _ink),
        ),
      ],
    ),
  );
}

class _EmptyState extends StatelessWidget {
  final String message;
  final IconData icon;
  const _EmptyState(this.message, {required this.icon});

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 20),
    child: Center(
      child: Column(
        children: [
          Icon(icon, size: 32, color: Colors.grey.shade400),
          const SizedBox(height: 8),
          Text(
            message,
            textAlign: TextAlign.center,
            style: const TextStyle(color: _muted),
          ),
        ],
      ),
    ),
  );
}

Future<bool?> _confirm(BuildContext context, String message) =>
    showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Konfirmasi'),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Batal'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Lanjutkan'),
          ),
        ],
      ),
    );
