/* ════ CONFIG ════ */
const API_URL = "https://script.google.com/macros/s/AKfycbynS1NxEP-Xwr71LvTVgZTuIH6Z_msLuFDE96ik6XIBDLW6z6QY7iEkzA3DOMcFIsZ_/exec";
let DATA = null;

/* ════ CACHE & TOKEN SYSTEM ════ */
const TOKEN_KEY = 'ict_portal_token';
const CACHE_KEY = 'ict_portal_cache';

// Fungsi mengecek sesi saat web dibuka
function initApp() {
  const savedToken = localStorage.getItem(TOKEN_KEY);
  const cachedDataStr = localStorage.getItem(CACHE_KEY);

  if (savedToken && cachedDataStr) {
    try {
      // 1. Tampilkan UI secara instan (0 detik loading) menggunakan Cache
      const cachedData = JSON.parse(cachedDataStr);
      DATA = cachedData;
      
      document.getElementById('search-screen').classList.add('hidden');
      const ps = document.getElementById('profile-screen');
      ps.classList.add('is-visible');
      if (window.innerWidth < 768) ps.style.display = 'block';
      else ps.style.display = '';

      loadProfile(cachedData);

      // 2. Lakukan sinkronisasi ke server menggunakan TOKEN
      refreshDataInBackground(savedToken);
    } catch (e) {
      doLogout();
    }
  }
}

// Fungsi memanggil API di latar belakang
async function refreshDataInBackground(token) {
  try {
    // Memanggil API dengan Parameter Token (bukan Kode Siswa)
    const json = await fetchJSONP(`${API_URL}?token=${token}`, 'cb_bg_' + Date.now());
    
    if (json.success) {
      DATA = json;
      localStorage.setItem(CACHE_KEY, JSON.stringify(json));
      loadProfile(json); // Render ulang tanpa mengganggu layar
    } else if (json.expired) {
      // Jika token sudah expired (lewat 6 jam), paksa logout
      alert("Sesi Anda telah berakhir. Silakan masukkan kode siswa kembali.");
      doLogout();
    }
  } catch (e) {
    console.log("Koneksi gagal. Aplikasi berjalan sepenuhnya dari cache lokal.");
  }
}

/* ════ JSONP ════ */
function fetchJSONP(url, cbName) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => { cleanup(); reject(new Error('timeout')); }, 15000);
    function cleanup() {
      delete window[cbName];
      const el = document.getElementById('jsonp-' + cbName);
      if (el) el.remove();
      clearTimeout(t);
    }
    window[cbName] = d => { cleanup(); resolve(d); };
    const s = document.createElement('script');
    s.id = 'jsonp-' + cbName;
    s.src = url + '&callback=' + cbName;
    s.onerror = () => { cleanup(); reject(new Error('load error')); };
    document.head.appendChild(s);
  });
}

/* ════ LOGIN / LOGOUT ════ */
async function doSearch() {
  const kode = document.getElementById('code-input').value.trim().toUpperCase();
  if (!kode) return;
  const btn = document.getElementById('search-btn');
  btn.disabled = true; btn.textContent = 'Mengambil data...';
  document.getElementById('search-error').classList.add('hidden');
  
  try {
    // Eksekusi Login dengan Kode Siswa
    const json = await fetchJSONP(`${API_URL}?kode=${kode}`, 'cb_' + Date.now());
    
    if (!json.success) { 
      document.getElementById('search-error').classList.remove('hidden'); 
      return; 
    }
    
    // Simpan TOKEN dari server dan simpan Cache JSON
    localStorage.setItem(TOKEN_KEY, json.token);
    localStorage.setItem(CACHE_KEY, JSON.stringify(json));

    DATA = json;
    loadProfile(json);
    document.getElementById('search-screen').classList.add('hidden');
    const ps = document.getElementById('profile-screen');
    ps.classList.add('is-visible');
    if (window.innerWidth < 768) ps.style.display = 'block';
    else ps.style.display = '';
  } catch (e) {
    alert('Gagal terhubung. Periksa koneksi internet lalu coba lagi.');
  } finally {
    btn.disabled = false; btn.textContent = 'Lihat Perkembangan Anak';
  }
}

function doLogout() {
  // Hapus token dan cache dari browser
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(CACHE_KEY);

  const ps = document.getElementById('profile-screen');
  ps.classList.remove('is-visible');
  ps.style.display = '';
  document.getElementById('search-screen').classList.remove('hidden');
  document.getElementById('code-input').value = '';
  DATA = null;
  switchPage('beranda');
}

/* ════ HELPERS ════ */
function ns(raw = '') {
  const v = (raw || '').toLowerCase().trim();
  if (v.includes('selesai')) return 'selesai';
  if (v.includes('proses') || v.includes('dikerjakan')) return 'proses';
  return 'belum';
}
function fmtShort(v) {
  if (!v) return '–';
  const d = new Date(v);
  if (isNaN(d)) return String(v);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}
function ytEmbed(raw = '') {
  if (!raw) return '';
  const m = raw.match(/(?:youtu\.be\/|v=|embed\/)([A-Za-z0-9_-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : '';
}

/* Helper: set text to multiple elements by id */
function setAll(pairs) {
  pairs.forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  });
}
function styleAll(pairs) {
  pairs.forEach(([id, prop, val]) => {
    const el = document.getElementById(id);
    if (el) el.style[prop] = val;
  });
}

/* ════ LOAD PROFILE ════ */
function loadProfile(json) {
  const s = json.siswa || {};

  // Sidebar (desktop) & mobile topbar share the same data
  setAll([
    ['sb-nama',   s.nama  || '–'],
    ['sb-kelas',  s.kelas || '–'],
    ['sb-kode',   s.kode  || '–'],
    ['mob-nama',  s.nama  || '–'],
    ['mob-kelas', s.kelas || '–'],
    ['mob-kode',  s.kode  || '–'],
  ]);

  const progres = json.progres || [];
  const sel = progres.filter(x => ns(x.status) === 'selesai').length;
  const pro = progres.filter(x => ns(x.status) === 'proses').length;
  const bel = progres.filter(x => ns(x.status) === 'belum').length;
  const tot = progres.length || 1;
  const pct = Math.round(sel / tot * 100);

  setAll([
    ['sb-pct', pct + '%'], ['mob-pct', pct + '%'],
    ['sb-sel', sel], ['sb-pro', pro], ['sb-bel', bel],
    ['mob-sel', sel], ['mob-pro', pro], ['mob-bel', bel],
  ]);
  styleAll([
    ['sb-fill',  'width', pct + '%'],
    ['mob-fill', 'width', pct + '%'],
  ]);

  // Notification dots
  if (bel > 0) {
    ['snd-tugas', 'mnd-tugas'].forEach(id => document.getElementById(id).classList.remove('hidden'));
  }
  const mbel = (json.tugasMingguan || []).filter(x => ns(x.status) !== 'selesai').length;
  if (mbel > 0) {
    ['snd-minggu', 'mnd-minggu'].forEach(id => document.getElementById(id).classList.remove('hidden'));
  }

  renderBeranda(json);
  renderTugas(json);
  renderMingguan(json.tugasMingguan || []);
  renderKarya(json.karya || []);
  renderSKL(json.skl || []);
  renderJadwal(json.jadwal || [], s.kelas);
}

/* ════ BERANDA ════ */
function renderBeranda(json) {
  const progres = json.progres || [];
  const tugas   = json.tugasMingguan || [];
  const skl     = json.skl || [];

  // Pending tugas
  const pending = progres.filter(x => ns(x.status) !== 'selesai');
  const pEl = document.getElementById('b-pending-list');
  if (!pending.length) {
    pEl.innerHTML = `<div style="padding:16px;text-align:center;color:#16a34a;font-size:12px;font-weight:700;">🎉 Semua materi sudah selesai!</div>`;
  } else {
    pEl.innerHTML = '';
    pending.slice(0, 5).forEach(m => {
      const n = ns(m.status);
      const el = document.createElement('div');
      el.className = 'pending-item';
      el.innerHTML = `
        <div class="pending-dot ${n === 'proses' ? 'dot-amber' : 'dot-red'}"></div>
        <div style="flex:1;min-width:0;">
          <div class="pending-name text-truncate">${m.nama_materi || m.id_materi || '–'}</div>
          ${m.deadline ? `<div class="pending-sub">Deadline: ${fmtShort(m.deadline)}</div>` : ''}
        </div>
        <span class="pending-status" style="color:${n === 'proses' ? '#d97706' : '#dc2626'}">${n === 'proses' ? 'Proses' : 'Belum'}</span>`;
      el.onclick = () => openMateriModal(m);
      pEl.appendChild(el);
    });
  }

  // Weekly pending
  const wp = tugas.filter(x => ns(x.status) !== 'selesai');
  const wEl = document.getElementById('b-weekly-list');
  if (!wp.length) {
    wEl.innerHTML = `<div style="padding:16px;text-align:center;color:#16a34a;font-size:12px;font-weight:700;">🎉 Semua tugas mingguan selesai!</div>`;
  } else {
    wEl.innerHTML = '';
    wp.slice(0, 4).forEach(tg => {
      const n = ns(tg.status);
      const judul = tg.judul_tugas || tg.judul || tg.nama_tugas || '–';
      const el = document.createElement('div');
      el.className = 'pending-item';
      el.innerHTML = `
        <div class="pending-dot ${n === 'proses' ? 'dot-amber' : 'dot-red'}"></div>
        <div style="flex:1;min-width:0;">
          <div class="pending-name text-truncate">${judul}</div>
          ${tg.minggu ? `<div class="pending-sub">${tg.minggu}</div>` : ''}
        </div>
        <span class="pending-status" style="color:${n === 'proses' ? '#d97706' : '#dc2626'}">${n === 'proses' ? 'Proses' : 'Belum'}</span>`;
      el.onclick = () => openWeeklyModal(tg);
      wEl.appendChild(el);
    });
  }

  // Notes
  const notes = progres.filter(x => x.catatan_guru && x.catatan_guru.trim());
  const nCard = document.getElementById('b-notes-card');
  const nList = document.getElementById('b-notes-list');
  if (notes.length) {
    nCard.classList.remove('hidden');
    nList.innerHTML = '';
    notes.slice(0, 3).forEach(m => {
      nList.innerHTML += `<div style="padding:10px 14px;border-bottom:1px solid #f5f5f5;">
        <div style="font-size:11px;font-weight:700;color:#1e40af;margin-bottom:3px;">${m.nama_materi || m.id_materi}</div>
        <div style="font-size:12px;color:#374151;line-height:1.5;">${m.catatan_guru}</div>
      </div>`;
    });
  }

  // SKL mini
  const sklEl = document.getElementById('b-skl-mini');
  sklEl.innerHTML = '';
  if (!skl.length) {
    sklEl.innerHTML = '<div style="font-size:12px;color:#9ca3af;padding:6px 4px;">Belum ada data SKL.</div>';
  } else {
    skl.slice(0, 3).forEach(item => {
      const isTer = (item.status || '').toLowerCase().includes('terpenuhi');
      const isCuk = (item.status || '').toLowerCase().includes('cukup');
      const color = isTer ? '#16a34a' : isCuk ? '#d97706' : '#dc2626';
      const dot   = isTer ? '#22c55e' : isCuk ? '#f59e0b' : '#ef4444';
      sklEl.innerHTML += `<div style="display:flex;align-items:center;gap:8px;padding:6px 4px;">
        <div style="width:8px;height:8px;border-radius:50%;background:${dot};flex-shrink:0;"></div>
        <span style="font-size:12px;font-weight:600;color:#111827;flex:1;">${item.mata_kompetensi || '–'}</span>
        <span style="font-size:11px;font-weight:700;color:${color};">${item.status || 'Belum'}</span>
      </div>`;
    });
  }
}

function renderTugas(json) {
  const bab    = json.bab    || [];
  const materi = json.materi || [];
  const progres= json.progres|| [];
  const grid   = document.getElementById('bab-grid');
  grid.innerHTML = '';

  if (!bab.length) return; // Fallback jika bab kosong

  bab.forEach(b => {
    // CEK STATUS AKSES BAB
    const statusBab = (b.status_akses || b.status || '').toLowerCase().trim();
    if (statusBab === 'hidden') return; // Lewati, jangan dirender sama sekali
    const isBabLocked = statusBab === 'tidak aktif';

    // Filter materi: Hanya hitung materi yang tidak "hidden"
    let mats = materi.filter(m => m.id_bab === b.id_bab);
    mats = mats.filter(m => (m.status_akses || m.status || '').toLowerCase().trim() !== 'hidden');

    const sel  = mats.filter(m => {
      const p = progres.find(px => px.id_materi === m.id_materi);
      return p && ns(p.status) === 'selesai';
    }).length;
    const pct = mats.length ? Math.round(sel / mats.length * 100) : 0;
    const thumb = b.thumbnail || null; 
    
    // Perhatikan tambahan isBabLocked dikirim sebagai parameter
    grid.appendChild(makeBabCard(b.judul_bab || b.id_bab, thumb, sel, mats.length, pct, isBabLocked, () => {
      const combined = mats.map(m => {
        const p = progres.find(px => px.id_materi === m.id_materi) || {};
        // Simpan status_akses ke variabel baru agar tidak ditimpa status progres
        return { ...m, ...p, nama_materi: m.nama_materi || m.id_materi, status_akses_master: m.status_akses || '' };
      });
      showMateriList(b.judul_bab || b.id_bab, combined);
    }));
  });
}

// Tambahkan parameter isLocked
function makeBabCard(title, thumbnail, sel, tot, pct, isLocked, onClick) {
  const card = document.createElement('div');
  card.className = `bab-card ${isLocked ? 'locked-card' : ''}`;
  card.style.position = 'relative';
  
  const thumbContent = thumbnail 
    ? `<img src="${thumbnail}" alt="${title}" class="bab-thumb-img">`
    : `<svg width="36" height="36" viewBox="0 0 48 48" fill="none"><path d="M8 10C8 8.34 9.34 7 11 7H25L38 18V40C38 41.66 36.66 43 35 43H11C9.34 43 8 41.66 8 40V10Z" fill="#dbeafe" stroke="#1040a0" stroke-width="1.5"/><path d="M25 7L38 18H27C25.9 18 25 17.1 25 16V7Z" fill="#1040a0" opacity="0.3"/><line x1="15" y1="25" x2="31" y2="25" stroke="#1040a0" stroke-width="1.8" stroke-linecap="round"/><line x1="15" y1="30" x2="28" y2="30" stroke="#1040a0" stroke-width="1.8" stroke-linecap="round"/></svg>`;

  // Ikon gembok jika status tidak aktif
  const lockBadge = isLocked ? `
    <div class="locked-badge">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      Terkunci
    </div>` : '';

  card.innerHTML = `
    ${lockBadge}
    <div class="bab-thumb">${thumbContent}</div>
    <div class="bab-body">
      <div class="bab-title">${title}</div>
      <div style="font-size:10px;color:#9ca3af;margin-bottom:5px;">${sel}/${tot} materi diselesaikan</div>
      <div class="prog-track"><div class="prog-fill" style="width:${pct}%"></div></div>
      <div class="prog-pct">${pct}%</div>
    </div>`;
    
  card.onclick = () => {
    if (isLocked) {
      alert('Materi ini belum dimulai. Guru akan mengaktifkannya sesuai jadwal pelajaran anak Anda.');
    } else {
      onClick();
    }
  };
  return card;
}

function showMateriList(title, items) {
  document.getElementById('view-bab-page').classList.add('hidden');
  document.getElementById('view-materi-page').classList.remove('hidden');
  document.getElementById('materi-bab-title').textContent = title;
  const list = document.getElementById('materi-list');
  list.innerHTML = '';
  
  items.forEach(m => {
    // CEK STATUS AKSES MATERI
    const statusAkses = (m.status_akses_master || '').toLowerCase().trim();
    if (statusAkses === 'hidden') return; // Jangan tampilkan di list
    const isLocked = statusAkses === 'tidak aktif';

    const n   = ns(m.status || '');
    const cls = isLocked ? 'mi-belum' : (n === 'selesai' ? 'mi-selesai' : n === 'proses' ? 'mi-proses' : 'mi-belum');
    const ic  = isLocked ? '#9ca3af' : (n === 'selesai' ? '#22c55e' : n === 'proses' ? '#f59e0b' : '#d1d5db');
    const ip  = n === 'selesai'
      ? '<path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round"/>'
      : n === 'proses'
      ? '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'
      : '<circle cx="12" cy="12" r="10"/>';
      
    const el = document.createElement('div');
    // Tambahkan class locked-card jika isLocked true
    el.className = `materi-item ${cls} ${isLocked ? 'locked-card' : ''}`;
    
    // Ikon gembok kecil di kanan
    const lockIconHtml = isLocked ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" style="margin-left:auto; flex-shrink:0;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>` : '';

    el.innerHTML = `
      <div class="mi-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${ic}" stroke-width="2.2">${isLocked ? '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>' : ip}</svg>
      </div>
      <div style="flex:1;min-width:0;display:flex;align-items:center;">
        <div style="flex:1;">
          <div class="mi-name" style="${isLocked ? 'color:#6b7280;' : ''}">
            ${m.nama_materi || m.id_materi || '–'}
            ${m.nilai ? `<span style="display:inline-block; margin-left:6px; padding:2px 6px; background:#dcfce7; color:#15803d; border-radius:6px; font-size:10px; border:1px solid #bbf7d0;">Nilai: ${m.nilai}</span>` : ''}
          </div>
          <div class="mi-status" style="color:${isLocked ? '#6b7280' : (n==='selesai'?'#16a34a':n==='proses'?'#d97706':'#9ca3af')};">
            ${isLocked ? '🔒 Terkunci' : (n==='selesai'?'✅ Selesai':n==='proses'?'⏳ Dalam Proses':'⏸ Belum Mulai')}
          </div>
          ${m.deadline ? `<div class="mi-date">Deadline: ${fmtShort(m.deadline)}</div>` : ''}
        </div>
        ${lockIconHtml}
      </div>`;
      
    el.onclick = () => {
      if (isLocked) {
        alert('Detail materi belum tersedia karena jadwal pembelajarannya belum dimulai.');
      } else {
        openMateriModal(m);
      }
    };
    list.appendChild(el);
  });
}

function backToBab() {
  document.getElementById('view-materi-page').classList.add('hidden');
  document.getElementById('view-bab-page').classList.remove('hidden');
}

/* ════ MINGGUAN ════ */
function renderMingguan(list) {
  const sel  = list.filter(x => ns(x.status) === 'selesai');
  const bel  = list.filter(x => ns(x.status) !== 'selesai');
  const poin = sel.reduce((s, x) => s + (parseFloat(x.poin) || 0), 0);

  document.getElementById('minggu-stats').innerHTML = `
    <div class="ms-card ms-purple"><div class="ms-num">${poin} pts</div><div class="ms-lbl">Total Poin</div></div>
    <div class="ms-card ms-green"><div class="ms-num">${sel.length}</div><div class="ms-lbl">Selesai</div></div>
    <div class="ms-card ms-amber"><div class="ms-num">${bel.length}</div><div class="ms-lbl">Tersisa</div></div>`;

  const sorted = [...bel, ...sel];
  const tbody  = document.getElementById('minggu-tbody');
  tbody.innerHTML = '';
  if (!sorted.length) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:20px;color:#9ca3af;font-size:12px;">Belum ada tugas mingguan.</td></tr>';
    return;
  }
  sorted.forEach(tg => {
    const n     = ns(tg.status);
    const judul = tg.judul_tugas || tg.judul || tg.nama_tugas || '–';
    const tr    = document.createElement('tr');
    tr.className = `minggu-row ${n==='belum'?'belum-row':n==='proses'?'proses-row':''}`;
    tr.innerHTML = `
      <td style="max-width:140px;">${judul}</td>
      <td style="color:#9ca3af;font-size:11px;">${tg.minggu || '–'}</td>
      <td><span class="badge ${n==='selesai'?'badge-s':n==='proses'?'badge-p':'badge-b'}">${n==='selesai'?'Selesai':n==='proses'?'Proses':'Belum'}</span></td>`;
    tr.onclick = () => openWeeklyModal(tg);
    tbody.appendChild(tr);
  });
}

/* ════ KARYA ════ */
function renderKarya(karya) {
  const ind = karya.filter(x => x.jenis?.toLowerCase().includes('individu')).length;
  const kel = karya.filter(x => x.jenis?.toLowerCase().includes('kelompok')).length;
  document.getElementById('karya-stats').innerHTML = `
    <div class="ks-card" style="background:#fdf2f8;"><div style="font-size:20px;font-weight:700;color:#db2777;">${karya.length}</div><div style="font-size:10px;font-weight:600;color:#db2777;margin-top:2px;">Total Karya</div></div>
    <div class="ks-card" style="background:#eff6ff;"><div style="font-size:20px;font-weight:700;color:#2563eb;">${ind}</div><div style="font-size:10px;font-weight:600;color:#2563eb;margin-top:2px;">Individu</div></div>
    <div class="ks-card" style="background:#f0fdf4;"><div style="font-size:20px;font-weight:700;color:#16a34a;">${kel}</div><div style="font-size:10px;font-weight:600;color:#16a34a;margin-top:2px;">Kelompok</div></div>`;

  const grid = document.getElementById('karya-grid');
  grid.innerHTML = '';
  if (!karya.length) {
    grid.innerHTML = '<div style="grid-column:span 2;text-align:center;padding:20px;color:#9ca3af;font-size:12px;">Belum ada karya.</div>';
    return;
  }
  karya.forEach(k => {
    const isKel = k.jenis?.toLowerCase().includes('kelompok');
    const el    = document.createElement('div');
    el.className = 'karya-card';
    el.innerHTML = `
      ${k.gambar
        ? `<img class="karya-img" src="${k.gambar}" alt="${k.judul || ''}">`
        : `<div class="karya-nopic"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#c4b5fd" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>`}
      <div class="karya-body">
        <span style="font-size:10px;font-weight:700;padding:2px 6px;border-radius:99px;${isKel?'background:#dcfce7;color:#15803d;':'background:#dbeafe;color:#1e40af;'}">${isKel ? 'Kelompok' : 'Individu'}</span>
        <div class="karya-title" style="margin-top:5px;">${k.judul || '–'}</div>
        ${k.tanggal ? `<div style="font-size:10px;color:#9ca3af;">${fmtShort(k.tanggal)}</div>` : ''}
      </div>`;
    el.onclick = () => openKaryaModal(k);
    grid.appendChild(el);
  });
}

/* ════ SKL ════ */
function renderSKL(skl) {
  const list = document.getElementById('skl-list');
  list.innerHTML = '';
  if (!skl.length) {
    list.innerHTML = '<div style="text-align:center;padding:20px;color:#9ca3af;font-size:12px;">Belum ada data SKL.</div>';
    return;
  }
  skl.forEach(item => {
    const isTer = (item.status || '').toLowerCase().includes('terpenuhi');
    const isCuk = (item.status || '').toLowerCase().includes('cukup');
    const cardCls  = isTer ? 'skl-t' : isCuk ? 'skl-c' : 'skl-b';
    const badgeCls = isTer ? 'skl-bt' : isCuk ? 'skl-bc' : 'skl-bb';
    const noteCls  = isTer ? 'skl-ct' : isCuk ? 'skl-cc' : 'skl-cb';
    const ic       = isTer ? '#22c55e' : isCuk ? '#f59e0b' : '#ef4444';

    const subs = item.sub_materi || [];
    let subHtml = '';
    if (subs.length) {
      const subItems = subs.map(sub => {
        const subOk  = ['dikuasai','selesai','terpenuhi'].some(w => (sub.status||'').toLowerCase().includes(w));
        const subMid = ['proses','cukup'].some(w => (sub.status||'').toLowerCase().includes(w));
        const subDot   = subOk ? '#22c55e' : subMid ? '#f59e0b' : '#ef4444';
        const subColor = subOk ? '#15803d' : subMid ? '#b45309' : '#b91c1c';
        return `<div class="skl-sub-item">
          <div class="skl-sub-dot" style="background:${subDot};"></div>
          <span class="skl-sub-name">${sub.nama_sub_materi || '–'}</span>
          <span class="skl-sub-status" style="color:${subColor};">${sub.status || '–'}</span>
        </div>${sub.catatan ? `<div class="skl-sub-catatan">${sub.catatan}</div>` : ''}`;
      }).join('');
      subHtml = `<div class="skl-sub-divider"></div><div class="skl-sub-title">Sub Kompetensi</div><div class="skl-sub-list">${subItems}</div>`;
    }

    const el = document.createElement('div');
    el.className = `skl-card ${cardCls}`;
    el.innerHTML = `
      <div style="display:flex;align-items:flex-start;gap:10px;">
        <div style="width:36px;height:36px;border-radius:10px;background:white;flex-shrink:0;display:flex;align-items:center;justify-content:center;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${ic}" stroke-width="2.2">
            <circle cx="12" cy="12" r="10"/>
            ${isTer ? '<path d="M8 12l3 3 5-5"/>' : `<path d="M12 8v4"/><circle cx="12" cy="16" r="1" fill="${ic}"/>`}
          </svg>
        </div>
        <div style="flex:1;min-width:0;">
          <div class="skl-name">${item.mata_kompetensi || '–'}</div>
          ${item.deskripsi ? `<div class="skl-desc">${item.deskripsi}</div>` : ''}
          <span class="skl-badge ${badgeCls}">${isTer ? '🏅' : isCuk ? '🏅' : '⏸'} ${item.status || 'Belum'}</span>
        </div>
      </div>
      ${item.catatan_guru ? `<div class="skl-catatan ${noteCls}" style="margin-top:10px;"><strong>Catatan:</strong> ${item.catatan_guru}</div>` : ''}
      ${subHtml}`;
    list.appendChild(el);
  });
}

/* ════ MODAL: MATERI ════ */
function openMateriModal(m) {
  document.getElementById('mm-title').textContent = m.nama_materi || m.id_materi || 'Detail';

  const vu = ytEmbed(m.video || '');
  if (vu) {
    document.getElementById('mm-video-wrap').classList.add('hidden');
    document.getElementById('mm-video-frame').classList.remove('hidden');
    document.getElementById('mm-iframe').src = vu;
  } else {
    document.getElementById('mm-video-wrap').classList.remove('hidden');
    document.getElementById('mm-video-frame').classList.add('hidden');
    document.getElementById('mm-iframe').src = '';
  }

  const sb = document.getElementById('mm-status-block');
  const n  = ns(m.status || '');
  if (m.status) {
    sb.classList.remove('hidden');
    const map = {
      selesai: ['#f0fdf4','#22c55e','#15803d','✅ Selesai'],
      proses:  ['#fffbeb','#f59e0b','#92400e','⏳ Dalam Proses'],
      belum:   ['#fff5f5','#ef4444','#991b1b','⏸ Belum Mulai'],
    };
    const [bg, bc, tc, lbl] = map[n];
    sb.style.cssText = `background:${bg};border:1.5px solid ${bc};border-radius:12px;padding:10px 14px;margin-bottom:12px;display:flex;align-items:center;gap:10px;`;
    sb.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${bc}" stroke-width="2.2">
      <circle cx="12" cy="12" r="10"/>
      ${n==='selesai'?'<path d="M8 12l3 3 5-5"/>':n==='proses'?'<polyline points="12 6 12 12 16 14"/>':`<path d="M12 8v4"/><circle cx="12" cy="16" r="1" fill="${bc}"/>`}
    </svg><span style="font-size:13px;font-weight:700;color:${tc};">${lbl}</span>`;
  } else {
    sb.classList.add('hidden');
  }

  document.getElementById('mm-desc').textContent = m.deskripsi || `Materi: ${m.nama_materi || m.id_materi}`;

  const given = m.tanggal_mulai || m.tanggal_diberi;
  const dEl   = document.getElementById('mm-dates');
  if (given || m.deadline) {
    dEl.classList.remove('hidden');
    document.getElementById('mm-given').textContent = fmtShort(given);
    document.getElementById('mm-due').textContent   = fmtShort(m.deadline);
  } else dEl.classList.add('hidden');

  const pEl = document.getElementById('mm-poin-block');
  // Menampilkan Nilai jika ada
  const nEl_nilai = document.getElementById('mm-nilai-block');
  if (nEl_nilai) {
    if (m.nilai && m.nilai.toString().trim() !== '') {
      nEl_nilai.classList.remove('hidden');
      document.getElementById('mm-nilai').textContent = m.nilai;
    } else {
      nEl_nilai.classList.add('hidden');
    }
  }

  if (m._isPoin && m.poin !== undefined && m.poin !== '') {
    pEl.classList.remove('hidden');
    document.getElementById('mm-poin').textContent = m.poin + ' pts';
  } else pEl.classList.add('hidden');

  const nEl = document.getElementById('mm-note');
  if (m.catatan_guru && m.catatan_guru.trim()) {
    nEl.classList.remove('hidden');
    document.getElementById('mm-note-text').textContent = m.catatan_guru;
  } else nEl.classList.add('hidden');

  const fEl = document.getElementById('mm-file');
  const fu  = m.file || m.link_file || m.link_tugas;
  if (fu) {
    fEl.classList.remove('hidden');
    document.getElementById('mm-file-link').href = fu;
  } else fEl.classList.add('hidden');

  document.getElementById('modal-materi').classList.remove('hidden');
}

function openWeeklyModal(tg) {
  const judul = tg.judul_tugas || tg.judul || tg.nama_tugas || '–';
  openMateriModal({
    nama_materi:  judul,
    status:       tg.status,
    deskripsi:    tg.deskripsi || `Kategori: ${tg.kategori || '–'} · ${tg.minggu || ''}`,
    catatan_guru: tg.catatan_guru || null,
    tanggal_mulai:tg.tanggal_diberi || null,
    deadline:     tg.deadline || null,
    video:        tg.video || null,
    link_tugas:   tg.link_tugas || null,
    poin:         tg.poin,
    _isPoin:      true,
  });
}

/* ════ MODAL: KARYA ════ */
function openKaryaModal(k) {
  document.getElementById('km-title').textContent = k.judul || '–';
  const img = document.getElementById('km-img');
  if (k.gambar) { img.src = k.gambar; img.classList.remove('hidden'); }
  else img.classList.add('hidden');

  const isKel = k.jenis?.toLowerCase().includes('kelompok');
  document.getElementById('km-tags').innerHTML = `
    <span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:99px;${isKel?'background:#dcfce7;color:#15803d;':'background:#dbeafe;color:#1e40af;'}">${isKel?'👥 Kelompok':'👤 Individu'}</span>
    ${k.kategori ? `<span style="font-size:11px;padding:3px 10px;border-radius:99px;background:#f3f4f6;color:#6b7280;font-weight:600;">${k.kategori}</span>` : ''}
    ${k.tanggal  ? `<span style="font-size:11px;color:#9ca3af;">📅 ${fmtShort(k.tanggal)}</span>` : ''}`;

  const db = document.getElementById('km-desc-block');
  if (k.deskripsi) { db.classList.remove('hidden'); document.getElementById('km-desc').textContent = k.deskripsi; }
  else db.classList.add('hidden');

  const lb    = document.getElementById('km-links');
  const links = k.links || [];
  if (k.link_karya && !links.length) links.push({ label: 'Lihat Karya', url: k.link_karya });
  if (links.length) {
    lb.innerHTML = `<div style="font-size:11px;font-weight:700;color:#9ca3af;margin-bottom:6px;">LINK KARYA</div>` +
      links.map(l => `<a href="${l.url}" target="_blank" class="karya-link-item">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        <span class="karya-link-text">${l.label || 'Lihat'}</span>
      </a>`).join('');
  } else lb.innerHTML = '';

  document.getElementById('modal-karya').classList.remove('hidden');
}

/* ════ MODAL CLOSE ════ */
function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
  if (id === 'modal-materi') document.getElementById('mm-iframe').src = '';
}
document.getElementById('modal-materi').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal('modal-materi'); });
document.getElementById('modal-karya').addEventListener('click',  e => { if (e.target === e.currentTarget) closeModal('modal-karya'); });

/* ════ PAGE SWITCH ════ */
function switchPage(name) {
  // Pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');

  // Bottom nav (mobile)
  document.querySelectorAll('.bn-btn').forEach(b => {
    const active = b.dataset.page === name;
    b.classList.toggle('active', active);
    const svg = b.querySelector('svg');
    if (svg) svg.style.stroke = active ? '#1040a0' : '#9ca3af';
  });

  // Sidebar nav (desktop)
  ['beranda','tugas','mingguan','karya','skl'].forEach(pg => {
    const btn = document.getElementById('sbn-' + pg);
    if (btn) btn.classList.toggle('active', pg === name);
  });

  // Reset tugas sub-view
  if (name === 'tugas') {
    document.getElementById('view-bab-page').classList.remove('hidden');
    document.getElementById('view-materi-page').classList.add('hidden');
  }

  // Scroll to top
  const ca = document.querySelector('.content-area');
  if (ca) ca.scrollTop = 0;
  else window.scrollTo(0, 0);
}

/* ════ RESPONSIVE: Fix profile-screen display on resize ════ */
window.addEventListener('resize', () => {
  const ps = document.getElementById('profile-screen');
  if (!ps.classList.contains('is-visible')) return;
  if (window.innerWidth >= 768) ps.style.display = '';
  else ps.style.display = 'block';
});

/* ════ JADWAL PELAJARAN ════ */
function renderJadwal(jadwalList, kelasSiswa) {
  document.getElementById('jadwal-kelas-label').textContent = kelasSiswa || '';
  const container = document.getElementById('jadwal-list');
  container.innerHTML = '';
  
  const daftarHari = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  if (!jadwalList || jadwalList.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding:30px; font-size:12px; color:#9ca3af;">Belum ada jadwal pelajaran yang diatur untuk kelas ini.</div>';
    return;
  }

  daftarHari.forEach(hari => {
    // Ambil jadwal khusus untuk hari tersebut
    const items = jadwalList.filter(x => (x.hari || '').toLowerCase() === hari.toLowerCase());
    
    // Urutkan berdasarkan waktu secara otomatis (A-Z)
    items.sort((a, b) => (a.waktu || '').localeCompare(b.waktu || ''));
    
    let itemsHtml = '';
    if (items.length === 0) {
      itemsHtml = `<div style="padding:12px 16px; font-size:11px; color:#9ca3af; font-style:italic;">Libur / Tidak ada mata pelajaran</div>`;
    } else {
      itemsHtml = items.map(i => `
        <div class="j-item">
          <div class="j-time">${i.waktu || '–'}</div>
          <div style="flex:1;">
            <div class="j-detail-title">${i.mapel || 'Istirahat / Jam Kosong'}</div>
            ${i.guru ? `<div class="j-detail-loc"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> ${i.guru}</div>` : ''}
          </div>
        </div>
      `).join('');
    }

    // Gabungkan Header Hari dengan Daftar Mapel
    const groupHtml = `
      <div class="day-group">
        <div class="day-head">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1e40af" stroke-width="2.5" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          ${hari}
        </div>
        ${itemsHtml}
      </div>
    `;
    container.innerHTML += groupHtml;
  });
}

document.addEventListener('DOMContentLoaded', initApp);