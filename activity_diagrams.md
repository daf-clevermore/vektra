# Activity Diagrams Sistem VEKTRA

Dokumen ini memuat **Activity Diagrams** (Diagram Aktivitas) yang menggambarkan alur kerja (*workflow*) utama pada aplikasi **VEKTRA**.

---

## 1. Activity Diagram: `alurGenerasiDesainVector` (AI Generation & Refinement)

Diagram ini menggambarkan alur kerja pembuatan dan penyempurnaan desain vektor secara otomatis melalui integrasi AI LLM dan *Autonomous Hybrid Rendering*.

```mermaid
flowchart TD
    subgraph lanePengguna ["penggunaDesainer"]
        mulaiGen([Mulai])
        inputPrompt["Memasukkan Prompt Teks & Memilih Preset Canvas"]
        lihatHasil["Melihat Hasil Desain di Fabric.js Canvas"]
        evaluasiDesain{"Desain Sesuai Ekspektasi?"}
        selesaiGen([Selesai])
        inputRefinemen["Memasukkan Instruksi Revisi / Refinement"]
    end

    subgraph laneFrontend ["frontendApp"]
        kirimPayload["Kirim Payload ChatRequest (Messages + Canvas Width/Height)"]
        renderCanvas["Muat SVG ke Fabric.js Canvas Editor"]
    end

    subgraph laneBackend ["backendFastApi"]
        susunPrompt["Rakit System Prompt + Canvas Constraints + Layout Blueprint"]
        panggilLlm["Kirim Request ke 9Router LLM API"]
        bersihSvg["Eksekusi Fungsi clean_svg"]
        validasiSvg{"Sintaks SVG Valid?"}
        returnError["Kembalikan HTTP Error 500"]
    end

    subgraph laneAi ["sistemAiLLM"]
        analisisPrompt["Analisis Kebutuhan Desain"]
        cekHybrid{"Membutuhkan Elemen Fotorealistis?"}
        injeksiRaster["Auto-Injeksi Tag <image> (Pollinations AI)"]
        renderPureVector["Render Pure SVG Primitives & Paths"]
        hasilkanRawSvg["Hasikan Raw String SVG"]
    end

    mulaiGen --> inputPrompt
    inputPrompt --> kirimPayload
    kirimPayload --> susunPrompt
    susunPrompt --> panggilLlm
    panggilLlm --> analisisPrompt
    analisisPrompt --> cekHybrid
    cekHybrid -- Ya --> injeksiRaster
    cekHybrid -- Tidak --> renderPureVector
    injeksiRaster --> hasilkanRawSvg
    renderPureVector --> hasilkanRawSvg
    hasilkanRawSvg --> bersihSvg
    bersihSvg --> validasiSvg
    validasiSvg -- Tidak --> returnError
    validasiSvg -- Ya --> renderCanvas
    renderCanvas --> lihatHasil
    lihatHasil --> evaluasiDesain
    evaluasiDesain -- Ya --> selesaiGen
    evaluasiDesain -- Tidak --> inputRefinemen
    inputRefinemen --> kirimPayload
```

---

## 2. Activity Diagram: `alurEditingManualCanvas` (Canvas Manipulation & Property Editing)

Diagram ini menggambarkan alur kerja penyuntingan interaktif pada canvas oleh desainer, termasuk manipulasi objek, penyesuaian properti visual, dan penguraian riwayat aksi (*Undo/Redo*).

```mermaid
flowchart TD
    subgraph lanePenggunaEdit ["penggunaDesainer"]
        mulaiEdit([Mulai Editing])
        pilihObjek["Pilih Objek pada Canvas atau LeftSidebar Layers"]
        pilihAksi{"Pilih Jenis Aksi Edit"}
        
        transformObjek["Lakukan Transformasi (Move / Scale / Rotate)"]
        ubahProperti["Ubah Properti Visual (Fill / Stroke / Font / Opacity)"]
        kelolaLayer["Ubah Hirarki Layer (Bring Forward / Send Backward / Lock)"]
        tambahPrimitif["Tambah Shape Primitif (Rect / Circle / Text)"]
        pemicuUndoRedo["Tekan Tombol Undo / Redo"]
    end

    subgraph laneCanvasEngine ["frontendApp (Fabric.js Engine)"]
        updateState["Perbarui Koordinat & Transformasi Objek"]
        applyProperti["Terapkan Gaya Visual ke Objek Selected"]
        reorderZIndex["Perbarui Urutan Penumpukan Z-Index Layer"]
        tambahKeCanvas["Render Objek Baru ke Canvas Grid"]
        pulihkanStateHistory["Pulihkan Snapshot Canvas dari History Stack"]
        catatHistoryStack["Simpan State Snapshot ke History Stack"]
        renderCanvasUlang["Render Ulang Tampilan Canvas Editor"]
    end

    mulaiEdit --> pilihObjek
    pilihObjek --> pilihAksi
    
    pilihAksi -- Transformasi --> transformObjek
    pilihAksi -- Properti Visual --> ubahProperti
    pilihAksi -- Manajemen Layer --> kelolaLayer
    pilihAksi -- Objek Baru --> tambahPrimitif
    pilihAksi -- Undo / Redo --> pemicuUndoRedo

    transformObjek --> updateState
    ubahProperti --> applyProperti
    kelolaLayer --> reorderZIndex
    tambahPrimitif --> tambahKeCanvas
    pemicuUndoRedo --> pulihkanStateHistory

    updateState --> catatHistoryStack
    applyProperti --> catatHistoryStack
    reorderZIndex --> catatHistoryStack
    tambahKeCanvas --> catatHistoryStack
    pulihkanStateHistory --> renderCanvasUlang

    catatHistoryStack --> renderCanvasUlang
```

---

## 3. Activity Diagram: `alurEksporHasilDesain` (Export & Download Workflow)

Diagram ini menggambarkan alur kerja ekspor file dari editor canvas ke format file lokal pengguna (`SVG`, `PNG`, atau `JSON`).

```mermaid
flowchart TD
    subgraph lanePenggunaEkspor ["penggunaDesainer"]
        mulaiEkspor([Mulai Ekspor])
        klikTombolEkspor["Klik Tombol Export pada Topbar Engine"]
        pilihFormat{"Pilih Format Output"}
        terimaFileDownload([Terima & Simpan File Hasil Ekspor])
    end

    subgraph laneFrontendEkspor ["frontendApp"]
        bacaCanvasObject["Serialisasi Seluruh Objek Canvas Aktif"]
        konversiSvg["Generasi File String Kode SVG Clean"]
        konversiPng["Render Raster PNG via HTML5 Canvas DataURL"]
        konversiJson["Ekstrak Konfigurasi Struktur Objek JSON"]
        pemicuDownload["Trigger Browser File Download Prompt"]
    end

    mulaiEkspor --> klikTombolEkspor
    klikTombolEkspor --> pilihFormat
    pilihFormat -- Format SVG --> konversiSvg
    pilihFormat -- Format PNG --> konversiPng
    pilihFormat -- Format JSON --> konversiJson

    konversiSvg --> bacaCanvasObject
    konversiPng --> bacaCanvasObject
    konversiJson --> bacaCanvasObject

    bacaCanvasObject --> pemicuDownload
    pemicuDownload --> terimaFileDownload
```
