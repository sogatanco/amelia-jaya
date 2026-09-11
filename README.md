# Pembukuan Toko Kelontong Amelia Jaya

Aplikasi web (bisa dipakai sebagai aplikasi PWA di iPhone & Android) untuk
pembukuan omset harian, pengeluaran, dan tagihan Toko Kelontong Amelia Jaya.

## Fitur

- **Login 2 role**: Administrator (pemilik) dan Kasir/Karyawan.
  - Administrator: bisa input, plus akses semua laporan & neraca, kelola user.
  - Kasir: hanya bisa input omset harian, pengeluaran, dan upload bon.
- **Input omset harian fleksibel**: form memakai *list tanggal* (60 hari
  terakhir) sehingga laporan yang telat diinput (mis. omset kemarin baru
  sempat diinput hari ini/lusa) tetap bisa dicatat untuk tanggal yang benar.
- **Input pengeluaran harian** per tanggal (tanpa input stok barang).
- **Upload foto bon/nota** — dibaca otomatis pakai OCR (Tesseract) sehingga
  nominal & tanggal tidak perlu diketik manual (tetap bisa dikoreksi sebelum
  disimpan). Nota **tunai** otomatis masuk ke pengeluaran harian, nota
  **kredit** otomatis masuk ke daftar **Tagihan** (utang ke supplier).
- **Laporan / Neraca** (khusus admin): rekap omset vs pengeluaran per hari,
  total laba/rugi, dan total tagihan belum lunas dalam rentang tanggal.
- **PWA**: bisa di-"Add to Home Screen" di iPhone (Safari) maupun Android
  (Chrome), tampil seperti aplikasi native tanpa perlu App Store/Play Store.

## Struktur Proyek

```
toko-amelia-jaya/
├── server/   # REST API - Node.js + Express + TypeScript + Prisma
└── client/   # Frontend PWA - React + Vite + TypeScript + Tailwind
```

## Teknologi & Alasan Pemilihan

| Bagian    | Pilihan                          | Alasan |
|-----------|-----------------------------------|--------|
| Bahasa    | TypeScript (Node.js + React)     | Cepat dikembangkan, satu bahasa untuk FE & BE, banyak hosting mendukung |
| Database  | MySQL via Prisma ORM             | Sudah dikonfigurasi untuk MySQL (lokal & remote); tinggal set DATABASE_URL di .env |
| OCR       | Tesseract.js (open-source)       | Gratis, jalan di server sendiri, tidak butuh API berbayar |
| Auth      | JWT + bcrypt                     | Stateless, mudah di-deploy di hosting mana pun |
| PWA       | vite-plugin-pwa                  | Installable di iOS/Android langsung dari browser |

## Menjalankan di Lokal

### 1. Backend

```powershell
cd server
copy .env.example .env
npm install
npx prisma migrate dev --name init   # buat database + seed akun admin
npm run dev                           # jalan di http://localhost:4000
```

Akun admin default setelah seed: **username `admin`, password `amelia123`**
— segera ganti setelah login pertama (buat user baru lalu nonaktifkan/ubah
password akun ini, atau ubah langsung lewat Prisma Studio `npx prisma studio`).

### 2. Frontend

```powershell
cd client
npm install
npm run dev    # jalan di http://localhost:5173, proxy ke API port 4000
```

Buka `http://localhost:5173` di browser. Untuk uji tampilan mobile, buka lewat
IP komputer di HP yang satu WiFi (mis. `http://192.168.1.x:5173`).

## Install sebagai Aplikasi di HP

- **Android (Chrome)**: buka situsnya → menu titik tiga → "Add to Home screen" / "Install app".
- **iPhone (Safari)**: buka situsnya → tombol Share → "Add to Home Screen".

Setelah itu ikon aplikasi muncul di layar utama dan terbuka full-screen
seperti aplikasi native.

## Install di Hosting / Shared Hosting

Berikut panduan paling realistis untuk deployment di shared hosting yang mendukung Node.js (contoh: cPanel/Node.js App, Plesk, atau hosting dengan runtime Node.js). Jika hosting Anda hanya menyediakan PHP/HTML statis tanpa runtime Node.js, maka solusi yang paling aman adalah:

- pakai VPS/Cloud VPS, atau
- pisahkan backend ke hosting Node.js dan frontend ke hosting statis.

### Persyaratan hosting

- Node.js versi 18+ atau yang direkomendasikan oleh hosting
- npm / package manager tersedia
- database MySQL atau PostgreSQL (lebih aman untuk production)
- akses SSH atau panel Node.js App / terminal dari hosting
- folder upload file harus bersifat writable

> Catatan penting: app ini memakai `sqlite` default untuk development. Untuk shared hosting production, sebaiknya ganti ke `mysql` atau `postgresql` agar lebih stabil dan tidak kehilangan data saat restart server.

### 1. Persiapkan database production

Provider di `server/prisma/schema.prisma` sudah diatur ke **MySQL**. Anda hanya perlu menyiapkan database MySQL (lokal atau remote) dan mengatur connection string.

Proyek ini sudah menyertakan template siap pakai di [server/.env.production](server/.env.production) yang menunjuk ke MySQL remote. Salin isinya ke `.env` di server, lalu ganti `GANTI_PASSWORD` dengan password database Anda:

```env
DATABASE_URL="mysql://u398446913_amel:PASSWORD_ANDA@153.92.15.27:3306/u398446913_amel"
```

Untuk MySQL lain, format umumnya:

```env
DATABASE_URL="mysql://USER:PASSWORD@HOST:3306/NAMA_DATABASE"
```

> Catatan: pastikan user database Anda punya akses remote dari IP server aplikasi (banyak hosting membatasi host yang boleh connect).

### 2. Siapkan file environment backend

Di folder `server`, buat file `.env`. Untuk MySQL remote yang sudah disiapkan, salin dari [server/.env.production](server/.env.production) lalu ganti password dan domain:

```env
DATABASE_URL="mysql://u398446913_amel:PASSWORD_ANDA@153.92.15.27:3306/u398446913_amel"
JWT_SECRET="buat-string-random-yang-panjang-dan-aman"
CORS_ORIGIN="https://domain-anda.com"
UPLOAD_DIR="uploads"
PORT=4000
```

Jika frontend dan API berada di domain yang sama, gunakan:

```env
CORS_ORIGIN="https://domain-anda.com"
```

Jika frontend di subdomain lain, misalnya `https://app.domain-anda.com`, maka set `CORS_ORIGIN` ke URL frontend tersebut.

### 3. Install & build backend di server

Jalankan di local komputer atau via terminal hosting:

```bash
cd server
npm install
npx prisma generate
npx prisma migrate deploy
npm run build
```

Setelah build, hasilnya akan ada di folder:

```bash
server/dist
```

Untuk menjalankan backend di hosting, gunakan perintah:

```bash
cd server
node dist/index.js
```

Jika hosting Anda menyediakan fitur Node.js App / App Manager, gunakan `server/dist/index.js` atau `npm run start` sebagai startup command.

### 4. Build frontend untuk hosting statis

Jalankan di folder client:

```bash
cd client
npm install
npm run build
```

Hasil build ada di folder:

```bash
client/dist
```

Upload semua isi folder `client/dist` ke root domain website Anda, misalnya:

- `public_html/` (untuk domain utama)
- atau folder website statis di hosting

### 5. Struktur deployment yang disarankan

Untuk shared hosting, pola paling umum adalah:

- Frontend: `https://domain-anda.com`
- Backend API: `https://api.domain-anda.com`

Jika frontend dan API dipisah, sesuaikan `CORS_ORIGIN` dan `api` base URL.

Karena frontend saat ini memakai base URL default `'/api'`, cara paling mudah adalah:

- frontend dan backend di domain yang sama, atau
- backend di subdomain yang sama dan proxy ke `/api` di server web hosting

Jika hosting Anda tidak mendukung proxy atau reverse proxy, lebih aman gunakan:

- domain utama untuk frontend statis
- subdomain `api.domain-anda.com` untuk backend Node.js

Lalu ubah client jika perlu menjadi:

```ts
export const api = axios.create({ baseURL: 'https://api.domain-anda.com/api' });
```

### 6. Menjalankan server di shared hosting

Beberapa shared hosting menyediakan fitur terminal/Node.js App, biasanya ada opsi seperti:

- startup command: `npm start`
- atau command manual: `node dist/index.js`
- atau `npx prisma migrate deploy && node dist/index.js`

Gunakan perintah berikut di panel hosting jika tersedia:

```bash
cd /path/to/project/server
npm install
npx prisma generate
npx prisma migrate deploy
node dist/index.js
```

### 7. Pastikan folder upload tetap bisa ditulis

Folder upload nota disimpan di `uploads` dan harus writable. Pastikan permission folder aman dan persistent:

```bash
chmod -R 755 uploads
```

Jika hosting Anda tidak memelihara file lokal terus-menerus, sebaiknya pindahkan upload file ke object storage seperti S3/Cloud Storage.

### 8. Akun default setelah install

Setelah migrasi database berjalan, akun admin default dari seed adalah:

- username: `admin`
- password: `amelia123`

Segera ganti password setelah login pertama.

### 9. Checklist sebelum go live

- [ ] `JWT_SECRET` sudah diganti dengan string acak
- [ ] `CORS_ORIGIN` sesuai domain produksi
- [ ] database production sudah dibuat dan terhubung
- [ ] `npx prisma migrate deploy` berhasil dijalankan
- [ ] build frontend berhasil dan file statis sudah diupload
- [ ] upload folder writable
- [ ] password admin default sudah diganti

## Deploy ke VPS lewat GitHub

Alur: **push kode ke GitHub → clone/pull di VPS → build & jalankan dengan PM2 + Nginx**.
Cara ini cocok untuk VPS (Ubuntu/Debian) dan memudahkan update berikutnya — cukup `git pull` di VPS.

### Alur Singkat: Database Remote Sudah Siap

Gunakan alur ini jika database production sudah dibuat di hosting/database
remote dan Anda ingin mengirim project melalui GitHub.

#### 1. Push project dari komputer lokal ke GitHub

Pastikan file sensitif tidak ikut di-upload. Buat atau cek `.gitignore` di root:

```gitignore
node_modules/
dist/
.env
.env.production
server/uploads/
server/google-vision-service-account.json
```

Lalu dari folder project:

```bash
git init
git add .
git commit -m "Initial deploy"
git branch -M main
git remote add origin https://github.com/USERNAME/toko-amelia-jaya.git
git push -u origin main
```

Jika repository sudah pernah dibuat, cukup:

```bash
git add .
git commit -m "Update aplikasi"
git push
```

#### 2. Clone project di VPS

```bash
ssh user@IP_VPS
sudo mkdir -p /var/www
sudo chown -R $USER:$USER /var/www
cd /var/www
git clone https://github.com/USERNAME/toko-amelia-jaya.git
cd toko-amelia-jaya
```

Untuk repository private, gunakan SSH key GitHub atau token melalui metode
yang aman. Jangan menaruh password database di URL GitHub.

#### 3. Buat `.env` backend dengan database remote

```bash
cd /var/www/toko-amelia-jaya/server
nano .env
```

Isi menggunakan kredensial database remote Anda:

```env
PORT=4000
DATABASE_URL="mysql://USER:PASSWORD@HOST:3306/NAMA_DATABASE"
JWT_SECRET="string-acak-panjang-dan-aman"
JWT_EXPIRES_IN="7d"
CORS_ORIGIN="https://domain-anda.com"
UPLOAD_DIR="uploads"
OCR_PROVIDER="tesseract"
```

Jika memakai Google Vision, upload file service account secara manual ke folder
`server/` dan tambahkan:

```env
GOOGLE_APPLICATION_CREDENTIALS="./google-vision-service-account.json"
OCR_PROVIDER="google"
```

#### 4. Install backend dan jalankan migration

```bash
cd /var/www/toko-amelia-jaya/server
npm install
npx prisma generate
npx prisma migrate deploy
npx prisma db seed
npm run build
mkdir -p uploads
chmod 755 uploads
```

`npx prisma migrate deploy` akan membuat atau memperbarui tabel pada database
remote sesuai migration project. Jalankan `npx prisma db seed` hanya jika akun
admin default belum ada.

#### 5. Jalankan backend dengan PM2

```bash
cd /var/www/toko-amelia-jaya/server
pm2 start dist/index.js --name amelia-api
pm2 save
pm2 startup
```

Ikuti perintah `sudo ...` yang ditampilkan oleh `pm2 startup`, lalu cek:

```bash
pm2 status
pm2 logs amelia-api
curl http://127.0.0.1:4000/api/health
```

#### 6. Build frontend

```bash
cd /var/www/toko-amelia-jaya/client
npm install
npm run build
```

Hasil frontend berada di `client/dist`. Karena client memakai `baseURL: '/api'`,
frontend dan backend dapat memakai satu domain melalui Nginx.

#### 7. Pasang Nginx dan domain

Gunakan konfigurasi Nginx pada bagian [F. Setup Nginx](#f-setup-nginx-satu-domain-untuk-frontend--api),
lalu arahkan DNS Cloudflare ke IP VPS:

| Type | Name | Content |
|------|------|---------|
| A | `@` | IP VPS |
| A | `www` | IP VPS |

Aktifkan proxy Cloudflare, pasang SSL **Full (strict)**, lalu ubah:

```env
CORS_ORIGIN="https://domain-anda.com"
```

Restart backend setelah mengubah `.env`:

```bash
pm2 restart amelia-api --update-env
```

#### 8. Update aplikasi berikutnya

Setiap ada perubahan kode:

```bash
cd /var/www/toko-amelia-jaya
git pull

cd server
npm install
npx prisma generate
npx prisma migrate deploy
npm run build
pm2 restart amelia-api --update-env

cd ../client
npm install
npm run build
```

Jangan menghapus `server/uploads` karena foto bon disimpan di folder tersebut.

### A. Push project ke GitHub (di komputer lokal)

1. Buat repository baru di GitHub (misalnya `toko-amelia-jaya`). Bisa private.

2. Pastikan file sensitif **tidak ikut ter-push**. Buat/cek file `.gitignore` di root proyek:

```gitignore
node_modules/
dist/
.env
.env.production
server/uploads/
*.db
server/google-vision-service-account.json
```

> **Penting**: `.env` berisi password database & JWT secret — jangan pernah di-push ke GitHub.
> File `clouflare-*.json` (service account Google) juga jangan di-push.

3. Inisialisasi git, commit, dan push:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/USERNAME/toko-amelia-jaya.git
git push -u origin main
```

### B. Siapkan VPS (sekali saja)

SSH ke VPS Anda, lalu install kebutuhan dasar:

```bash
# Update sistem
sudo apt update && sudo apt upgrade -y

# Node.js 20 LTS (via NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PM2 (process manager agar server jalan terus & auto-restart)
sudo npm install -g pm2

# Nginx (reverse proxy + serve frontend)
sudo apt install -y nginx

# Git
sudo apt install -y git
```

### C. Clone project di VPS

```bash
cd /var/www          # atau folder pilihan Anda
sudo git clone https://github.com/USERNAME/toko-amelia-jaya.git
sudo chown -R $USER:$USER toko-amelia-jaya
cd toko-amelia-jaya
```

> Jika repo **private**, buat Personal Access Token di GitHub (Settings → Developer settings → Tokens)
> lalu clone dengan: `git clone https://TOKEN@github.com/USERNAME/toko-amelia-jaya.git`
> atau lebih aman: setup SSH key di VPS dan tambahkan ke GitHub (Settings → SSH keys).

### D. Setup backend di VPS

```bash
cd /var/www/toko-amelia-jaya/server
npm install
```

Buat file `.env` (file ini tidak ada di GitHub, harus dibuat manual di server):

```bash
nano .env
```

Isi dengan konfigurasi production (contoh untuk MySQL remote yang sudah disiapkan):

```env
PORT=4000
DATABASE_URL="mysql://u398446913_amel:PASSWORD_ANDA@153.92.15.27:3306/u398446913_amel"
JWT_SECRET="string-random-panjang-yang-aman"
JWT_EXPIRES_IN="7d"
CORS_ORIGIN="https://domain-anda.com"
UPLOAD_DIR="uploads"
GOOGLE_APPLICATION_CREDENTIALS="./google-vision-service-account.json"
OCR_PROVIDER="google"
```

Lalu siapkan database & build:

```bash
npx prisma generate
npx prisma migrate deploy
npx prisma db seed        # membuat akun admin default (jika database masih kosong)
npm run build             # hasil ke server/dist
mkdir -p uploads
```

Jika memakai Google Vision OCR, upload juga file service account JSON ke folder `server/`
(misalnya via `scp` dari komputer lokal):

```bash
scp clouflare-497104-bb0a61fd74c3.json user@IP_VPS:/var/www/toko-amelia-jaya/server/google-vision-service-account.json
```

Jalankan backend dengan PM2:

```bash
pm2 start dist/index.js --name amelia-api
pm2 save
pm2 startup               # ikuti perintah yang muncul agar PM2 jalan otomatis saat reboot
```

Cek status: `pm2 status` dan `pm2 logs amelia-api`.

### E. Setup frontend di VPS

```bash
cd /var/www/toko-amelia-jaya/client
npm install
npm run build             # hasil ke client/dist
```

### F. Setup Nginx (satu domain untuk frontend + API)

Buat konfigurasi situs:

```bash
sudo nano /etc/nginx/sites-available/amelia
```

Isi (ganti `domain-anda.com`):

```nginx
server {
    listen 80;
    server_name domain-anda.com;

    # Frontend statis (hasil build Vite)
    root /var/www/toko-amelia-jaya/client/dist;
    index index.html;

    # API diteruskan ke backend Node.js di port 4000
    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 10m;   # untuk upload foto nota
    }

    # Folder uploads (foto nota)
    location /uploads/ {
        proxy_pass http://127.0.0.1:4000;
    }

    # SPA fallback: semua path lain ke index.html
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Aktifkan dan reload:

```bash
sudo ln -s /etc/nginx/sites-available/amelia /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Karena frontend dan API berada di **domain yang sama**, konfigurasi client tidak perlu diubah
(base URL tetap `/api`, Nginx yang meneruskan ke backend).

### G. Pasang HTTPS (gratis, Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d domain-anda.com
```

Certbot otomatis mengubah konfigurasi Nginx ke HTTPS dan memasang auto-renewal.
Setelah HTTPS aktif, ubah `CORS_ORIGIN` di `server/.env` ke `https://domain-anda.com`
lalu restart backend: `pm2 restart amelia-api`.

### H. Update aplikasi berikutnya (setelah ada perubahan kode)

Di komputer lokal: `git push` seperti biasa. Lalu di VPS:

```bash
cd /var/www/toko-amelia-jaya
git pull

# Backend
cd server
npm install               # jika ada dependensi baru
npx prisma migrate deploy # jika ada migrasi database baru
npm run build
pm2 restart amelia-api

# Frontend
cd ../client
npm install               # jika ada dependensi baru
npm run build
```

### I. Troubleshooting umum di VPS

| Masalah | Cara cek |
|---------|----------|
| API tidak merespons | `pm2 logs amelia-api` |
| 502 Bad Gateway dari Nginx | pastikan `pm2 status` menunjukkan `amelia-api` online, dan port 4000 listen (`ss -tlnp \| grep 4000`) |
| Upload gagal / foto besar | pastikan `client_max_body_size` di Nginx ≥ 10m |
| Database tidak connect | cek DATABASE_URL di `server/.env`, dan pastikan IP VPS diizinkan di panel Remote MySQL hosting |
| Foto nota hilang setelah redeploy | folder `server/uploads` jangan dihapus; folder ini tidak ikut di git sehingga aman saat `git pull` |

## Tutorial Upload ke VPS dan Setting Domain Cloudflare

Panduan ini memakai satu domain untuk frontend dan backend:

- Frontend: `https://domain-anda.com`
- API: `https://domain-anda.com/api`
- DNS dan proxy HTTPS: Cloudflare
- Reverse proxy: Nginx
- Backend process manager: PM2

### 1. Siapkan VPS

SSH ke VPS dari PowerShell atau terminal:

```bash
ssh root@IP_VPS
```

Install kebutuhan dasar di Ubuntu/Debian:

```bash
apt update && apt upgrade -y
apt install -y nginx git curl
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install -g pm2
```

Disarankan menjalankan aplikasi dengan user biasa:

```bash
adduser amelia
usermod -aG sudo amelia
su - amelia
```

### 2. Upload project ke VPS

#### Opsi A: Clone dari GitHub

Di komputer lokal, push project ke GitHub. Pastikan file sensitif tidak ikut
ter-upload:

```gitignore
node_modules/
dist/
.env
.env.production
server/uploads/
server/google-vision-service-account.json
```

Di VPS:

```bash
sudo mkdir -p /var/www
sudo chown -R $USER:$USER /var/www
cd /var/www
git clone https://github.com/USERNAME/toko-amelia-jaya.git
cd toko-amelia-jaya
```

Untuk repository private, gunakan SSH key GitHub. Hindari menaruh Personal
Access Token langsung di URL clone.

#### Opsi B: Upload dari Windows dengan SCP

Jalankan dari PowerShell komputer lokal:

```powershell
scp -r .\server user@IP_VPS:/var/www/toko-amelia-jaya/
scp -r .\client user@IP_VPS:/var/www/toko-amelia-jaya/
```

Untuk update berkala, GitHub lebih praktis karena berikutnya cukup `git pull`.

### 3. Siapkan environment backend

```bash
cd /var/www/toko-amelia-jaya/server
cp .env.example .env
nano .env
```

Isi contoh untuk frontend dan backend pada satu domain:

```env
PORT=4000
DATABASE_URL="mysql://USER:PASSWORD@HOST:3306/NAMA_DATABASE"
JWT_SECRET="string-acak-panjang-minimal-32-karakter"
JWT_EXPIRES_IN="7d"
CORS_ORIGIN="https://domain-anda.com"
UPLOAD_DIR="uploads"
OCR_PROVIDER="tesseract"
```

Jangan commit `.env` atau file service account Google Vision ke GitHub.

### 4. Install, migration, dan build

```bash
cd /var/www/toko-amelia-jaya/server
npm install
npx prisma generate
npx prisma migrate deploy
npx prisma db seed
npm run build
mkdir -p uploads
chmod 755 uploads
```

Uji backend:

```bash
PORT=4000 node dist/index.js
```

Dari terminal lain di VPS:

```bash
curl http://127.0.0.1:4000/api/health
```

Hasil yang benar adalah `{"ok":true}`. Hentikan proses uji dengan `Ctrl+C`.

### 5. Build frontend

```bash
cd /var/www/toko-amelia-jaya/client
npm install
npm run build
```

Frontend memakai `baseURL: '/api'`, sehingga tidak perlu mengubah kode client
ketika frontend dan backend memakai domain yang sama. Hasil build berada di
`/var/www/toko-amelia-jaya/client/dist`.

### 6. Jalankan backend dengan PM2

```bash
cd /var/www/toko-amelia-jaya/server
pm2 start dist/index.js --name amelia-api
pm2 save
pm2 startup
```

Jalankan perintah `sudo ...` yang ditampilkan oleh `pm2 startup`, kemudian cek:

```bash
pm2 status
pm2 logs amelia-api
curl http://127.0.0.1:4000/api/health
```

### 7. Atur DNS Cloudflare

1. Login ke Cloudflare dan pilih domain.
2. Buka **DNS → Records**.
3. Tambahkan record berikut:

| Type | Name | Content | Proxy status |
|------|------|---------|--------------|
| A | `@` | IP VPS | Proxied/orange cloud |
| A | `www` | IP VPS | Proxied/orange cloud |

Untuk konfigurasi satu domain, tidak perlu membuat record `api`, karena API
diakses melalui path `/api`. Jangan membuka port `4000` ke internet; Nginx akan
mengakses backend melalui `127.0.0.1`.

### 8. Konfigurasi Nginx

```bash
sudo nano /etc/nginx/sites-available/amelia
```

Isi berikut dan ganti `domain-anda.com`:

```nginx
server {
  listen 80;
  server_name domain-anda.com www.domain-anda.com;

  root /var/www/toko-amelia-jaya/client/dist;
  index index.html;

  location /api/ {
    proxy_pass http://127.0.0.1:4000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 10m;
  }

  location /uploads/ {
    proxy_pass http://127.0.0.1:4000;
  }

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

Aktifkan dan tes konfigurasi:

```bash
sudo ln -s /etc/nginx/sites-available/amelia /etc/nginx/sites-enabled/amelia
sudo nginx -t
sudo systemctl reload nginx
```

Jika memakai UFW:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

### 9. Aktifkan HTTPS Cloudflare

Di Cloudflare buka **SSL/TLS → Overview**, lalu pilih **Full (strict)**.

Untuk mode ini, buat **Origin Certificate** di **SSL/TLS → Origin Server →
Create Certificate**. Simpan certificate dan private key di VPS:

```bash
sudo mkdir -p /etc/ssl/amelia
sudo nano /etc/ssl/amelia/origin.crt
sudo nano /etc/ssl/amelia/origin.key
sudo chmod 600 /etc/ssl/amelia/origin.key
```

Setelah certificate tersedia, ganti isi file konfigurasi Nginx dengan
konfigurasi lengkap berikut. Jangan mempertahankan blok HTTP awal, supaya tidak
ada dua konfigurasi yang memakai `listen 80` untuk domain yang sama:

```nginx
server {
  listen 443 ssl http2;
  server_name domain-anda.com www.domain-anda.com;

  ssl_certificate /etc/ssl/amelia/origin.crt;
  ssl_certificate_key /etc/ssl/amelia/origin.key;
  root /var/www/toko-amelia-jaya/client/dist;
  index index.html;

  location /api/ {
    proxy_pass http://127.0.0.1:4000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
    client_max_body_size 10m;
  }

  location /uploads/ {
    proxy_pass http://127.0.0.1:4000;
  }

  location / {
    try_files $uri $uri/ /index.html;
  }
}

server {
  listen 80;
  server_name domain-anda.com www.domain-anda.com;
  return 301 https://$host$request_uri;
}
```

Tes dan reload:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Aktifkan **Always Use HTTPS** di **SSL/TLS → Edge Certificates**. Pastikan
environment backend memakai:

```env
CORS_ORIGIN="https://domain-anda.com"
```

Lalu restart:

```bash
pm2 restart amelia-api --update-env
```

### 10. Cek dan install aplikasi

Buka alamat berikut:

```text
https://domain-anda.com
https://domain-anda.com/api/health
```

Login dan segera ganti password admin default. Untuk install sebagai aplikasi:

- Android Chrome: menu → **Install app** atau **Add to Home screen**.
- iPhone Safari: Share → **Add to Home Screen**.

Jika ikon lama masih muncul, hapus PWA lama lalu install ulang atau bersihkan
cache browser. Ikon aplikasi berada di `client/public/icons/`.

### 11. Update aplikasi berikutnya

```bash
cd /var/www/toko-amelia-jaya
git pull

cd server
npm install
npx prisma generate
npx prisma migrate deploy
npm run build
pm2 restart amelia-api --update-env

cd ../client
npm install
npm run build
```

Jangan menghapus folder `server/uploads`, karena foto bon tersimpan di sana dan
folder tersebut tidak diikuti Git.

## Catatan Keamanan

- Ganti `JWT_SECRET` dan password admin default sebelum go-live.
- Endpoint laporan (`/api/reports/*`) dan kelola user (`/api/users/*`) dibatasi
  khusus role `ADMIN` di backend (bukan cuma disembunyikan di UI).
- Upload bon dibatasi tipe file gambar & ukuran maksimal 8MB.
