// ══════════════════════════════════════════
//  CONFIG  — Firebase URL & Admin credentials
// ══════════════════════════════════════════
var FB_URL        = 'https://water-issue-reporting-app-default-rtdb.firebaseio.com';
var ADMIN_USER    = 'admin';
var ADMIN_PASS    = 'water@2024';   // ← Change this to your own password

// ══════════════════════════════════════════
//  STATE
// ══════════════════════════════════════════
var session      = null;
var selectedType = '';
var selLat = null, selLng = null;
var reportMapObj = null, reportPin = null;
var userMapObj   = null, userMarkers = [];
var adminMapObj  = null;
var imgBase64    = null;
var allIssues    = {};

var CITIES = {
  Coimbatore: ['Coimbatore City','Gandhipuram','RS Puram','Peelamedu','Saibaba Colony',
               'Singanallur','Ukkadam','Kuniyamuthur','Thudiyalur','Perur',
               'Mettupalayam','Pollachi','Valparai','Annur','Sulur'],
  Chennai:    ['Anna Nagar','Adyar','T Nagar','Velachery','Tambaram','Porur',
               'Chrompet','Sholinganallur','Perambur','Ambattur'],
  Madurai:    ['Madurai City','Anna Nagar','KK Nagar','Arappalayam','Simmakkal','Tallakulam'],
  Salem:      ['Salem City','Shevapet','Fairlands','Ammapet','Suramangalam'],
  Trichy:     ['Trichy City','Srirangam','Ariyamangalam','Thillai Nagar','Woraiyur'],
  Erode:      ['Erode City','Bhavani','Perundurai','Gobichettipalayam']
};

var HINTS = {
  'Leakage':          '💧 Note if water is wasting continuously or intermittently, and the pipe location.',
  'Contamination':    '☠️ Describe the color/smell. Avoid using the water. Note if others are affected too.',
  'No Water Supply':  '🚱 Mention since when supply stopped and if the whole street/area is affected.',
  'Flood':            '🌊 Note the water level and area covered. Mention if roads are blocked.',
  'Drainage Block':   '🚧 Describe overflow severity. Is it a manhole or street drain?',
  'Pipe Burst':       '💥 Dangerous! Note if it is a main line or house connection and road condition.',
  'Sewage Overflow':  '🤢 Public health risk. Describe smell and extent of spread.',
  'Other':            '📌 Please describe the issue clearly so admin can act quickly.'
};

var TYPE_ICON = {
  'Leakage':'💧','Contamination':'☠️','No Water Supply':'🚱','Flood':'🌊',
  'Drainage Block':'🚧','Pipe Burst':'💥','Sewage Overflow':'🤢','Other':'📌'
};

var COLOR_MAP = {
  'Leakage':'red','Contamination':'orange','No Water Supply':'blue','Flood':'violet',
  'Drainage Block':'green','Pipe Burst':'gold','Sewage Overflow':'black','Other':'grey'
};

// ══════════════════════════════════════════
//  FIREBASE HELPERS
// ══════════════════════════════════════════
function fbGet(path) {
  return fetch(FB_URL + path + '.json').then(r => r.json());
}
function fbSet(path, data) {
  return fetch(FB_URL + path + '.json', { method:'PUT', body:JSON.stringify(data) }).then(r => r.json());
}
function fbPush(path, data) {
  return fetch(FB_URL + path + '.json', { method:'POST', body:JSON.stringify(data) }).then(r => r.json());
}
function fbPatch(path, data) {
  return fetch(FB_URL + path + '.json', { method:'PATCH', body:JSON.stringify(data) }).then(r => r.json());
}

// ══════════════════════════════════════════
//  TOAST
// ══════════════════════════════════════════
function toast(msg, color) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.style.background = color || '#0077cc';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2600);
}

// ══════════════════════════════════════════
//  ROUTING
// ══════════════════════════════════════════
function goTo(screen) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + screen).classList.add('active');
  window.scrollTo(0, 0);
  if (screen === 'home')      initHome();
  if (screen === 'report')    initReport();
  if (screen === 'map')       initUserMap();
  if (screen === 'myreports') initMyReports();
  if (screen === 'admin')     initAdmin();
}

// ══════════════════════════════════════════
//  AUTH
// ══════════════════════════════════════════
async function register() {
  var name    = document.getElementById('reg-name').value.trim();
  var user    = document.getElementById('reg-user').value.trim().toLowerCase();
  var phone   = document.getElementById('reg-phone').value.trim();
  var pass    = document.getElementById('reg-pass').value;
  var confirm = document.getElementById('reg-confirm').value;

  if (!name || !user || !phone || !pass) return toast('⚠️ Please fill all fields', '#e63946');
  if (pass.length < 6)  return toast('⚠️ Password min 6 characters', '#e63946');
  if (pass !== confirm) return toast('⚠️ Passwords do not match', '#e63946');

  try {
    var existing = await fbGet('/users/' + user);
    if (existing) return toast('⚠️ Username already taken', '#e63946');
    await fbSet('/users/' + user, { name, username: user, phone, password: pass });
    toast('✅ Account created! Please log in.', '#2dc653');
    setTimeout(() => goTo('login'), 1200);
  } catch(e) {
    toast('❌ Error connecting to database', '#e63946');
  }
}

async function login() {
  var user = document.getElementById('log-user').value.trim().toLowerCase();
  var pass = document.getElementById('log-pass').value;
  if (!user || !pass) return toast('⚠️ Enter username and password', '#e63946');

  try {
    var found = await fbGet('/users/' + user);
    if (!found || found.password !== pass) return toast('❌ Wrong username or password', '#e63946');
    session = { name: found.name, username: found.username, phone: found.phone };
    localStorage.setItem('ww_session', JSON.stringify(session));
    toast('✅ Welcome, ' + found.name + '!', '#2dc653');
    setTimeout(() => goTo('home'), 900);
  } catch(e) {
    toast('❌ Error connecting to database', '#e63946');
  }
}

function logout() {
  if (confirm('Logout from WaterWatch?')) {
    session = null;
    localStorage.removeItem('ww_session');
    goTo('login');
  }
}

function adminLogin() {
  var u = document.getElementById('adm-user').value.trim();
  var p = document.getElementById('adm-pass').value;
  if (u === ADMIN_USER && p === ADMIN_PASS) {
    toast('✅ Welcome, Admin!', '#2dc653');
    setTimeout(() => goTo('admin'), 900);
  } else {
    toast('❌ Wrong admin credentials', '#e63946');
  }
}

function adminLogout() {
  if (confirm('Logout from admin panel?')) goTo('login');
}

// ══════════════════════════════════════════
//  HOME
// ══════════════════════════════════════════
async function initHome() {
  if (!session) { goTo('login'); return; }
  document.getElementById('greetName').textContent = session.name.split(' ')[0];
  document.getElementById('topName').textContent   = session.name.split(' ')[0];

  try {
    var issues = await fbGet('/issues');
    var mine = issues ? Object.values(issues).filter(i => i.username === session.username) : [];
    document.getElementById('myCount').textContent       = mine.length;
    document.getElementById('resolvedCount').textContent = mine.filter(i => i.status === 'Resolved').length;
  } catch(e) {}
}

// ══════════════════════════════════════════
//  REPORT
// ══════════════════════════════════════════
function initReport() {
  if (!session) { goTo('login'); return; }
  document.getElementById('r-phone').value = session.phone || '';

  // Reset form
  selectedType = ''; selLat = null; selLng = null; imgBase64 = null;
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
  document.getElementById('typeHint').style.display = 'none';
  document.getElementById('r-desc').value = '';
  document.getElementById('r-district').value = '';
  document.getElementById('r-city').innerHTML = '<option value="">— Select District First —</option>';
  document.getElementById('r-landmark').value = '';
  document.getElementById('coordNote').textContent = 'Tap the map to mark exact location';
  document.getElementById('imgPreview').style.display = 'none';
  document.getElementById('upIcon').style.display = 'block';
  document.getElementById('upText').style.display = 'block';

  setTimeout(() => {
    if (!reportMapObj) {
      reportMapObj = L.map('reportMap').setView([11.0168, 76.9558], 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution:'© OpenStreetMap' }).addTo(reportMapObj);
      reportMapObj.on('click', function(e) {
        selLat = e.latlng.lat; selLng = e.latlng.lng;
        if (reportPin) reportMapObj.removeLayer(reportPin);
        reportPin = L.marker([selLat, selLng]).addTo(reportMapObj).bindPopup('📍 Issue here').openPopup();
        document.getElementById('coordNote').textContent = 'Pinned: ' + selLat.toFixed(5) + ', ' + selLng.toFixed(5);
      });
    } else {
      reportMapObj.invalidateSize();
    }
  }, 100);
}

function selectType(el, type) {
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  selectedType = type;
  var h = document.getElementById('typeHint');
  h.style.display = 'block';
  h.textContent = HINTS[type] || '';
}

function loadCities() {
  var dist = document.getElementById('r-district').value;
  var sel  = document.getElementById('r-city');
  sel.innerHTML = '<option value="">— Select City —</option>';
  if (CITIES[dist]) {
    CITIES[dist].forEach(c => {
      var o = document.createElement('option'); o.value = c; o.textContent = c;
      sel.appendChild(o);
    });
    if (dist === 'Coimbatore' && reportMapObj) reportMapObj.setView([11.0168, 76.9558], 12);
  }
}

function previewImg(input) {
  if (!input.files[0]) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    imgBase64 = e.target.result;
    var prev = document.getElementById('imgPreview');
    prev.src = imgBase64; prev.style.display = 'block';
    document.getElementById('upIcon').style.display = 'none';
    document.getElementById('upText').style.display = 'none';
  };
  reader.readAsDataURL(input.files[0]);
}

async function submitReport() {
  if (!selectedType) return toast('⚠️ Select an issue type', '#e63946');
  if (!document.getElementById('r-desc').value.trim()) return toast('⚠️ Add a description', '#e63946');
  if (!document.getElementById('r-district').value)    return toast('⚠️ Select a district', '#e63946');
  if (!document.getElementById('r-city').value)        return toast('⚠️ Select a city', '#e63946');

  var report = {
    type:        selectedType,
    desc:        document.getElementById('r-desc').value.trim(),
    district:    document.getElementById('r-district').value,
    city:        document.getElementById('r-city').value,
    landmark:    document.getElementById('r-landmark').value.trim(),
    phone:       document.getElementById('r-phone').value.trim(),
    latitude:    selLat,
    longitude:   selLng,
    image:       imgBase64,
    username:    session.username,
    userFullName:session.name,
    date:        new Date().toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }),
    status:      'Pending',
    adminNote:   ''
  };

  try {
    await fbPush('/issues', report);
    toast('✅ Report submitted! Admin will review it.', '#2dc653');
    setTimeout(() => goTo('home'), 1400);
  } catch(e) {
    toast('❌ Failed to submit. Check connection.', '#e63946');
  }
}

// ══════════════════════════════════════════
//  USER MAP — only current user's issues
// ══════════════════════════════════════════
async function initUserMap() {
  if (!session) { goTo('login'); return; }
  setTimeout(async () => {
    if (!userMapObj) {
      userMapObj = L.map('userMap').setView([11.0168, 76.9558], 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution:'© OpenStreetMap' }).addTo(userMapObj);
    } else {
      userMapObj.invalidateSize();
    }

    userMarkers.forEach(m => userMapObj.removeLayer(m));
    userMarkers = [];

    try {
      var issues = await fbGet('/issues');
      if (!issues) return;
      Object.values(issues).filter(i => i.username === session.username).forEach(issue => {
        if (!issue.latitude || !issue.longitude) return;
        var color = COLOR_MAP[issue.type] || 'grey';
        var icon = L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-' + color + '.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
          iconSize:[25,41], iconAnchor:[12,41], popupAnchor:[1,-34]
        });
        var m = L.marker([issue.latitude, issue.longitude], {icon})
          .addTo(userMapObj)
          .bindPopup('<b>' + issue.type + '</b><br/>📍 ' + issue.city + ', ' + issue.district + '<br/>Status: <b>' + issue.status + '</b>');
        userMarkers.push(m);
      });
    } catch(e) {}
  }, 100);
}

// ══════════════════════════════════════════
//  MY REPORTS — only current user's reports
// ══════════════════════════════════════════
async function initMyReports() {
  if (!session) { goTo('login'); return; }
  var el = document.getElementById('myReportList');
  el.innerHTML = '<div class="loading-spinner">⏳ Loading your reports…</div>';

  try {
    var issues = await fbGet('/issues');
    if (!issues) {
      el.innerHTML = '<div class="empty"><div class="e-icon">📭</div><p>No reports yet.</p></div>';
      return;
    }

    var mine = Object.entries(issues)
      .filter(([k, v]) => v.username === session.username)
      .map(([k, v]) => ({...v, fbKey: k}))
      .reverse();

    if (!mine.length) {
      el.innerHTML = '<div class="empty"><div class="e-icon">📭</div><p>You have not reported any issues yet.</p><br/><button class="btn btn-primary" style="max-width:200px;margin:10px auto 0;" onclick="goTo(\'report\')">Report Now →</button></div>';
      return;
    }

    el.innerHTML = mine.map(issue => {
      var statusClass = issue.status === 'Resolved' ? 'resolved' : issue.status === 'Reviewing' ? 'reviewing' : 'pending';
      var extraBanner = '';
      if (issue.status === 'Resolved') {
        extraBanner = '<div class="solved-banner">✅ <b>Issue Resolved!</b> The admin has marked this as solved. Thank you for reporting!' +
          (issue.adminNote ? '<br/>📝 Admin note: ' + issue.adminNote : '') + '</div>';
      } else if (issue.status === 'Reviewing') {
        extraBanner = '<div class="reviewing-banner">🔍 Admin is currently reviewing this issue.</div>';
      }

      return '<div class="card">' +
        '<div class="report-item">' +
          '<div class="report-icon">' + (TYPE_ICON[issue.type] || '📌') + '</div>' +
          '<div class="report-body" style="flex:1;">' +
            '<h4>' + issue.type + '</h4>' +
            '<div class="r-loc">📍 ' + issue.city + ', ' + issue.district + (issue.landmark ? ' · ' + issue.landmark : '') + '</div>' +
            '<div class="r-meta">📅 ' + issue.date + (issue.phone ? ' · 📞 ' + issue.phone : '') + '</div>' +
            '<div style="margin-top:7px;"><span class="badge badge-' + statusClass + '">' + issue.status + '</span></div>' +
          '</div>' +
        '</div>' +
        (issue.desc ? '<p style="font-size:0.83rem;color:var(--text2);margin-top:10px;line-height:1.5;">' + issue.desc + '</p>' : '') +
        (issue.image ? '<img src="' + issue.image + '" style="width:100%;border-radius:10px;margin-top:10px;max-height:170px;object-fit:cover;"/>' : '') +
        extraBanner +
      '</div>';
    }).join('');

  } catch(e) {
    el.innerHTML = '<div class="empty"><div class="e-icon">⚠️</div><p>Failed to load. Check your connection.</p></div>';
  }
}

// ══════════════════════════════════════════
//  ADMIN — sees ALL reports from ALL users
// ══════════════════════════════════════════
async function initAdmin() {
  var el = document.getElementById('adminReportList');
  el.innerHTML = '<div class="loading-spinner">⏳ Loading all reports…</div>';

  try {
    var issues = await fbGet('/issues');
    allIssues = issues || {};
    var arr = Object.values(allIssues);

    document.getElementById('aTotal').textContent    = arr.length;
    document.getElementById('aPending').textContent  = arr.filter(i => i.status === 'Pending').length;
    document.getElementById('aResolved').textContent = arr.filter(i => i.status === 'Resolved').length;

    // Map
    setTimeout(() => {
      if (!adminMapObj) {
        adminMapObj = L.map('adminMap').setView([11.0168, 76.9558], 10);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution:'© OpenStreetMap' }).addTo(adminMapObj);
      } else {
        adminMapObj.invalidateSize();
      }

      adminMapObj.eachLayer(l => { if (l instanceof L.Marker) adminMapObj.removeLayer(l); });

      arr.forEach(issue => {
        if (!issue.latitude || !issue.longitude) return;
        var color = COLOR_MAP[issue.type] || 'grey';
        var icon = L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-' + color + '.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
          iconSize:[25,41], iconAnchor:[12,41], popupAnchor:[1,-34]
        });
        L.marker([issue.latitude, issue.longitude], {icon})
          .addTo(adminMapObj)
          .bindPopup('<b>' + issue.type + '</b><br/>📍 ' + issue.city + '<br/>👤 ' + issue.userFullName + '<br/>📞 ' + (issue.phone || 'N/A') + '<br/>Status: ' + issue.status);
      });
    }, 150);

    renderAdmin();
  } catch(e) {
    el.innerHTML = '<div class="empty"><div class="e-icon">⚠️</div><p>Failed to load reports.</p></div>';
  }
}

function renderAdmin() {
  var issues  = Object.entries(allIssues).map(([k, v]) => ({...v, fbKey: k}));
  var statusF = document.getElementById('aFilterStatus').value;
  var typeF   = document.getElementById('aFilterType').value;

  var filtered = issues.filter(i =>
    (statusF === 'All Status' || i.status === statusF) &&
    (typeF   === 'All Types'  || i.type   === typeF)
  ).reverse();

  var el = document.getElementById('adminReportList');
  if (!filtered.length) {
    el.innerHTML = '<div class="empty"><div class="e-icon">🔍</div><p>No reports match the filter.</p></div>';
    return;
  }

  el.innerHTML = filtered.map(issue => {
    return '<div class="admin-report-card">' +
      '<div class="arc-head">' +
        '<h3>' + (TYPE_ICON[issue.type] || '📌') + ' ' + issue.type + '</h3>' +
        '<select class="status-sel" onchange="updateStatus(\'' + issue.fbKey + '\',this.value)">' +
          '<option ' + (issue.status === 'Pending'   ? 'selected' : '') + '>Pending</option>' +
          '<option ' + (issue.status === 'Reviewing' ? 'selected' : '') + '>Reviewing</option>' +
          '<option ' + (issue.status === 'Resolved'  ? 'selected' : '') + '>Resolved</option>' +
        '</select>' +
      '</div>' +
      '<div class="arc-body">' +
        '<div class="info-row"><span class="info-label">👤 Reporter</span><span>' + issue.userFullName + ' (@' + issue.username + ')</span></div>' +
        '<div class="info-row"><span class="info-label">📞 Phone</span><span>' + (issue.phone || '—') + '</span></div>' +
        '<div class="info-row"><span class="info-label">📍 Location</span><span>' + issue.city + ', ' + issue.district + (issue.landmark ? ' · ' + issue.landmark : '') + '</span></div>' +
        (issue.latitude ? '<div class="info-row"><span class="info-label">🗺️ GPS</span><span>' + issue.latitude.toFixed(5) + ', ' + issue.longitude.toFixed(5) + '</span></div>' : '') +
        '<div class="info-row"><span class="info-label">📅 Date</span><span>' + issue.date + '</span></div>' +
        '<div class="info-row"><span class="info-label">📝 Description</span><span>' + (issue.desc || '—') + '</span></div>' +
        '<div class="info-row"><span class="info-label">📌 Note to user</span>' +
          '<input class="admin-note-input" type="text" id="note-' + issue.fbKey + '" value="' + (issue.adminNote || '') + '" placeholder="Optional note visible to user…" onblur="saveNote(\'' + issue.fbKey + '\')"/>' +
        '</div>' +
        (issue.image ? '<img src="' + issue.image + '" class="arc-img" alt="Issue photo"/>' : '<p style="font-size:0.78rem;color:var(--text3);margin-top:6px;">📷 No photo uploaded</p>') +
      '</div>' +
    '</div>';
  }).join('');
}

async function updateStatus(fbKey, newStatus) {
  try {
    await fbPatch('/issues/' + fbKey, { status: newStatus });
    allIssues[fbKey].status = newStatus;
    var arr = Object.values(allIssues);
    document.getElementById('aPending').textContent  = arr.filter(i => i.status === 'Pending').length;
    document.getElementById('aResolved').textContent = arr.filter(i => i.status === 'Resolved').length;
    toast('✅ Status updated → ' + newStatus + ' (user will see this now)', '#2dc653');
  } catch(e) {
    toast('❌ Failed to update status', '#e63946');
  }
}

async function saveNote(fbKey) {
  var note = document.getElementById('note-' + fbKey).value;
  try {
    await fbPatch('/issues/' + fbKey, { adminNote: note });
    allIssues[fbKey].adminNote = note;
  } catch(e) {}
}

// ══════════════════════════════════════════
//  INIT — restore session on page load
// ══════════════════════════════════════════
(function init() {
  var saved = localStorage.getItem('ww_session');
  if (saved) {
    session = JSON.parse(saved);
    goTo('home');
  } else {
    goTo('signup');
  }
})();
