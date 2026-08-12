# ☁️ Panduan Deployment Cloud VEKTRA (Vercel + Render)

Dokumen ini berisi panduan langkah-demi-langkah untuk men-deploy aplikasi VEKTRA ke **Vercel** (Frontend) dan **Render** (Backend FastAPI).

---

## 🛠️ Persiapan Awal

Pastikan repository proyek sudah dipush ke **GitHub**.

---

## 1️⃣ Deploy Backend (FastAPI) ke Render.com

1. Buka [Render.com](https://render.com/) dan buat akun (atau login dengan GitHub).
2. Klik **New +** -> **Web Service**.
3. Hubungkan ke repository GitHub proyek **VEKTRA**.
4. Isi konfigurasi sebagai berikut:
   - **Name**: `vektra-backend`
   - **Root Directory**: `backend`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Pada bagian **Environment Variables**, tambahkan:
   - `LLM_BASE_URL`: Base URL API LLM Anda (contoh: `https://openrouter.ai/api/v1` atau server 9Router Anda)
   - `LLM_API_KEY`: API Key LLM Anda
   - `ALLOWED_ORIGINS`: `*` (atau masukan domain Vercel Anda nanti)
6. Klik **Create Web Service**.
7. Setelah selesai, salin URL publik backend Anda (contoh: `https://vektra-backend.onrender.com`).

---

## 2️⃣ Deploy Frontend (Next.js) ke Vercel

1. Buka [Vercel.com](https://vercel.com/) dan login dengan akun GitHub Anda.
2. Klik **Add New...** -> **Project**.
3. Pilih repository **VEKTRA** dari daftar GitHub Anda.
4. Konfigurasi Deployment:
   - **Framework Preset**: Next.js
   - **Root Directory**: Klik `Edit` dan pilih folder `frontend`.
5. Buka bagian **Environment Variables** dan tambahkan:
   - **Key**: `NEXT_PUBLIC_API_URL`
   - **Value**: URL backend Render Anda dari Langkah 1 (contoh: `https://vektra-backend.onrender.com`)
6. Klik **Deploy**.

Vercel akan secara otomatis mem-build aplikasi dan memberikan Anda link publik (contoh: `https://vektra-ai.vercel.app`).

---

## 🔒 Catatan Keamanan & Troubleshooting

- **CORS Error**: Jika frontend mengalami CORS error saat fetch ke backend, pastikan `ALLOWED_ORIGINS` di backend mencakup domain Vercel Anda atau di-set ke `*`.
- **Render Free Tier**: Layanan gratis Render akan *sleep* jika tidak ada trafik selama 15 menit. Request pertama setelah *sleep* membutuhkan waktu ~30-50 detik untuk *cold start*.
