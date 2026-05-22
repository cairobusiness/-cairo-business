const API_BASE = 'https://cairo-business-backend.vercel.app';
const TOKEN_KEY = 'cb_auth_token';
const USER_KEY = 'cb_auth_user';

function getToken() { return localStorage.getItem(TOKEN_KEY); }
function getUser() { try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch(e){ return null; } }
function setAuth(t, u) { localStorage.setItem(TOKEN_KEY, t); localStorage.setItem(USER_KEY, JSON.stringify(u)); }
function clearAuth() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); }
function escapeHtml(s) { return (s == null ? '' : String(s)).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function formatDate(d) { try { return new Date(d).toLocaleDateString('ar-EG', { year:'numeric', month:'short', day:'numeric' }); } catch(e){ return ''; } }
function nowLocalISO() { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0,16); }

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const t = getToken();
  if (t) headers['Authorization'] = 'Bearer ' + t;
  const res = await fetch(API_BASE + path, { ...options, headers });
  let data = null;
  try { data = await res.json(); } catch(e) {}
  return { ok: res.ok, status: res.status, data };
}

const COUNTRIES = [
  ['EG','مصر'],['SA','السعودية'],['AE','الإمارات'],['KW','الكويت'],['QA','قطر'],
  ['BH','البحرين'],['OM','عُمان'],['JO','الأردن'],['LB','لبنان'],['MA','المغرب'],['TN','تونس']
];

const ENTITIES = {
  news: {
    key: 'news', icon: '📰', nameAr: 'الأخبار', singularAr: 'خبر',
    endpoint: '/api/admin/news',
    fields: [
      { id: 'titleAr', label: 'العنوان بالعربية *', type: 'text', required: true },
      { id: 'titleEn', label: 'Title in English *', type: 'text', required: true, dir: 'ltr' },
      { id: 'excerptAr', label: 'الملخص بالعربية *', type: 'textarea', required: true, full: true },
      { id: 'excerptEn', label: 'Excerpt in English *', type: 'textarea', required: true, full: true, dir: 'ltr' },
      { id: 'category', label: 'التصنيف *', type: 'select', required: true, options: [
        ['business','أعمال'],['markets','أسواق'],['realestate','عقارات'],['tech','تكنولوجيا'],
        ['energy','طاقة'],['banking','بنوك'],['startups','شركات ناشئة'],['ma','صفقات واستحواذات']
      ]},
      { id: 'author', label: 'الكاتب *', type: 'text', required: true, default: 'فريق التحرير' },
      { id: 'publishedAt', label: 'تاريخ النشر', type: 'datetime-local', default: () => nowLocalISO() },
      { id: 'imageUrl', label: 'رابط الصورة (اختياري)', type: 'url', dir: 'ltr', nullable: true },
      { id: 'isFeatured', label: 'خبر مميّز — يظهر في القسم الرئيسي', type: 'checkbox', full: true }
    ],
    list: {
      title: n => n.titleAr,
      excerpt: n => (n.excerptAr || '').slice(0, 140) + ((n.excerptAr || '').length > 140 ? '...' : ''),
      thumb: n => n.imageUrl, emoji: '📰',
      badges: n => [
        { text: n.category, kind: 'gold' },
        ...(n.isFeatured ? [{ text: '⭐ مميّز', kind: 'green' }] : []),
      ],
      meta: n => [n.author, formatDate(n.publishedAt)]
    },
    stats: items => ({
      'إجمالي الأخبار': items.length,
      'المميّز': items.filter(n => n.isFeatured).length,
      'آخر إضافة': items[0] ? (items[0].titleAr || items[0].titleEn).slice(0, 30) + '...' : 'لا يوجد'
    })
  },
  events: {
    key: 'events', icon: '📅', nameAr: 'الفعاليات', singularAr: 'فعالية',
    endpoint: '/api/admin/events',
    fields: [
      { id: 'titleAr', label: 'العنوان بالعربية *', type: 'text', required: true },
      { id: 'titleEn', label: 'Title in English *', type: 'text', required: true, dir: 'ltr' },
      { id: 'locationAr', label: 'المكان بالعربية *', type: 'text', required: true },
      { id: 'locationEn', label: 'Location in English *', type: 'text', required: true, dir: 'ltr' },
      { id: 'date', label: 'التاريخ والوقت *', type: 'datetime-local', required: true, default: () => nowLocalISO() },
      { id: 'type', label: 'نوع الفعالية *', type: 'select', required: true, options: [
        ['conference','مؤتمر'],['summit','قمة'],['workshop','ورشة عمل'],['seminar','ندوة'],
        ['networking','تواصل'],['exhibition','معرض'],['launch','إطلاق']
      ]},
      { id: 'country', label: 'الدولة *', type: 'select', required: true, options: COUNTRIES },
      { id: 'attendees', label: 'عدد الحضور المتوقع', type: 'number', default: 0 },
      { id: 'price', label: 'سعر التذكرة (USD)', type: 'number', default: 0 },
      { id: 'descriptionAr', label: 'الوصف بالعربية', type: 'textarea', full: true, nullable: true },
      { id: 'descriptionEn', label: 'Description in English', type: 'textarea', full: true, dir: 'ltr', nullable: true },
      { id: 'speakers', label: 'المتحدثون (مفصول بفاصلة)', type: 'text', nullable: true },
      { id: 'topics', label: 'المواضيع (مفصول بفاصلة)', type: 'text', nullable: true }
    ],
    list: {
      title: e => e.titleAr,
      excerpt: e => (e.descriptionAr || '').slice(0, 140) + ((e.descriptionAr || '').length > 140 ? '...' : ''),
      emoji: '📅',
      badges: e => [
        { text: e.type, kind: 'gold' },
        { text: e.country, kind: 'blue' },
        ...(Number(e.price) > 0 ? [{ text: e.price + ' USD', kind: 'green' }] : [{ text: 'مجاني', kind: 'green' }])
      ],
      meta: e => [e.locationAr, formatDate(e.date), (e.attendees || 0) + ' حاضر']
    },
    stats: items => ({
      'إجمالي الفعاليات': items.length,
      'قادمة': items.filter(e => new Date(e.date) > new Date()).length,
      'أقرب فعالية': (() => {
        const upcoming = items.filter(e => new Date(e.date) > new Date()).sort((a,b)=>new Date(a.date)-new Date(b.date))[0];
        return upcoming ? (upcoming.titleAr || '').slice(0, 30) + '...' : 'لا يوجد';
      })()
    })
  },
  companies: {
    key: 'companies', icon: '🏢', nameAr: 'الشركات', singularAr: 'شركة',
    endpoint: '/api/admin/companies',
    fields: [
      { id: 'nameAr', label: 'الاسم بالعربية *', type: 'text', required: true },
      { id: 'nameEn', label: 'Name in English *', type: 'text', required: true, dir: 'ltr' },
      { id: 'sectorAr', label: 'القطاع بالعربية *', type: 'text', required: true, placeholder: 'مثل: عقارات' },
      { id: 'sectorEn', label: 'Sector in English *', type: 'text', required: true, dir: 'ltr', placeholder: 'e.g., Real Estate' },
      { id: 'country', label: 'الدولة *', type: 'select', required: true, options: COUNTRIES },
      { id: 'hq', label: 'المقر الرئيسي', type: 'text', nullable: true, placeholder: 'القاهرة، مصر' },
      { id: 'revenue', label: 'الإيرادات (مليون $)', type: 'number', nullable: true, step: '0.01' },
      { id: 'growth', label: 'نسبة النمو (%)', type: 'number', nullable: true, step: '0.01' },
      { id: 'employees', label: 'عدد الموظفين', type: 'number', nullable: true },
      { id: 'marketCap', label: 'القيمة السوقية (مليون $)', type: 'number', nullable: true, step: '0.01' },
      { id: 'founded', label: 'سنة التأسيس', type: 'number', nullable: true, placeholder: '1985' },
      { id: 'aiScore', label: 'AI Score (0-100)', type: 'number', default: 0, step: '0.1', min: 0, max: 100 },
      { id: 'logo', label: 'رابط الشعار', type: 'url', dir: 'ltr', nullable: true },
      { id: 'description', label: 'الوصف', type: 'textarea', full: true, nullable: true }
    ],
    list: {
      title: c => c.nameAr,
      excerpt: c => (c.description || '').slice(0, 140) + ((c.description || '').length > 140 ? '...' : ''),
      thumb: c => c.logo, emoji: '🏢',
      badges: c => [
        { text: c.sectorAr || c.sectorEn, kind: 'gold' },
        { text: c.country, kind: 'blue' },
        ...(c.aiScore ? [{ text: 'Score ' + c.aiScore, kind: 'green' }] : [])
      ],
      meta: c => [c.hq || '—', ...(c.revenue ? ['Rev: $' + c.revenue + 'M'] : []), ...(c.employees ? [c.employees + ' موظف'] : [])]
    },
    stats: items => ({
      'إجمالي الشركات': items.length,
      'إجمالي الإيرادات': '$' + items.reduce((s,c)=>s+(c.revenue||0),0).toLocaleString() + 'M',
      'إجمالي الموظفين': items.reduce((s,c)=>s+(c.employees||0),0).toLocaleString()
    })
  },
  businessmen: {
    key: 'businessmen', icon: '👔', nameAr: 'رجال الأعمال', singularAr: 'رجل أعمال',
    endpoint: '/api/admin/businessmen',
    fields: [
      { id: 'nameAr', label: 'الاسم بالعربية *', type: 'text', required: true },
      { id: 'nameEn', label: 'Name in English *', type: 'text', required: true, dir: 'ltr' },
      { id: 'sectorAr', label: 'القطاع بالعربية *', type: 'text', required: true },
      { id: 'sectorEn', label: 'Sector in English *', type: 'text', required: true, dir: 'ltr' },
      { id: 'netWorth', label: 'الثروة (مليار $)', type: 'number', nullable: true, step: '0.01' },
      { id: 'rank', label: 'الترتيب', type: 'number', nullable: true, min: 1 },
      { id: 'age', label: 'العمر', type: 'number', nullable: true, min: 18 },
      { id: 'flag', label: 'كود الدولة (EG, SA, AE...)', type: 'text', dir: 'ltr', nullable: true, placeholder: 'EG' },
      { id: 'companies', label: 'الشركات (مفصول بفاصلة)', type: 'text', nullable: true },
      { id: 'education', label: 'التعليم', type: 'text', nullable: true },
      { id: 'achievements', label: 'الإنجازات', type: 'textarea', full: true, nullable: true },
      { id: 'bio', label: 'السيرة الذاتية', type: 'textarea', full: true, nullable: true }
    ],
    list: {
      title: b => b.nameAr,
      excerpt: b => (b.bio || '').slice(0, 140) + ((b.bio || '').length > 140 ? '...' : ''),
      emoji: '👔',
      badges: b => [
        { text: b.sectorAr || b.sectorEn, kind: 'gold' },
        ...(b.rank ? [{ text: '#' + b.rank, kind: 'blue' }] : []),
        ...(b.netWorth ? [{ text: '$' + b.netWorth + 'B', kind: 'green' }] : [])
      ],
      meta: b => [b.flag || '—', ...(b.age ? [b.age + ' سنة'] : []), ...(b.companies ? [b.companies.split(',')[0]] : [])]
    },
    stats: items => {
      const withAge = items.filter(b => b.age);
      return {
        'إجمالي رجال الأعمال': items.length,
        'إجمالي الثروات': '$' + items.reduce((s,b)=>s+(b.netWorth||0),0).toFixed(1) + 'B',
        'متوسط العمر': withAge.length ? Math.round(withAge.reduce((s,b)=>s+b.age,0) / withAge.length) + ' سنة' : '—'
      };
    }
  },
  realestate: {
    key: 'realestate', icon: '🏠', nameAr: 'العقارات', singularAr: 'عقار',
    endpoint: '/api/admin/realestate',
    fields: [
      { id: 'titleAr', label: 'العنوان بالعربية *', type: 'text', required: true },
      { id: 'titleEn', label: 'Title in English *', type: 'text', required: true, dir: 'ltr' },
      { id: 'area', label: 'المنطقة *', type: 'text', required: true, placeholder: 'مدينتي، التجمع الخامس...' },
      { id: 'type', label: 'النوع *', type: 'select', required: true, options: [
        ['apartment','شقة'],['villa','فيلا'],['townhouse','تاون هاوس'],['office','مكتب'],
        ['retail','محل تجاري'],['land','أرض'],['warehouse','مستودع']
      ]},
      { id: 'price', label: 'السعر (جنيه) *', type: 'number', required: true, step: '1000', min: 0 },
      { id: 'size', label: 'المساحة (م²) *', type: 'number', required: true, step: '1', min: 0 },
      { id: 'beds', label: 'عدد الغرف', type: 'number', nullable: true, min: 0 },
      { id: 'baths', label: 'عدد الحمامات', type: 'number', nullable: true, min: 0 },
      { id: 'developer', label: 'المطوّر', type: 'text', nullable: true },
      { id: 'aiScore', label: 'AI Score (0-100)', type: 'number', default: 0, step: '0.1', min: 0, max: 100 },
      { id: 'features', label: 'المميزات (مفصول بفاصلة)', type: 'text', nullable: true },
      { id: 'description', label: 'الوصف', type: 'textarea', full: true, nullable: true }
    ],
    list: {
      title: r => r.titleAr,
      excerpt: r => (r.description || '').slice(0, 140) + ((r.description || '').length > 140 ? '...' : ''),
      emoji: '🏠',
      badges: r => [
        { text: r.type, kind: 'gold' },
        { text: r.area, kind: 'blue' },
        ...(r.aiScore ? [{ text: 'Score ' + r.aiScore, kind: 'green' }] : [])
      ],
      meta: r => [(r.price/1000000).toFixed(2) + 'M جنيه', r.size + ' م²', ...(r.beds ? [r.beds + ' غرف'] : []), ...(r.developer ? [r.developer] : [])]
    },
    stats: items => ({
      'إجمالي العقارات': items.length,
      'متوسط السعر': items.length ? (items.reduce((s,r)=>s+(r.price||0),0) / items.length / 1000000).toFixed(2) + 'M جنيه' : '—',
      'إجمالي المساحات': items.reduce((s,r)=>s+(r.size||0),0).toLocaleString() + ' م²'
    })
  },
  deals: {
    key: 'deals', icon: '💼', nameAr: 'الفرص الاستثمارية', singularAr: 'فرصة',
    endpoint: '/api/admin/deals',
    fields: [
      { id: 'titleAr', label: 'العنوان بالعربية *', type: 'text', required: true },
      { id: 'titleEn', label: 'Title in English *', type: 'text', required: true, dir: 'ltr' },
      { id: 'type', label: 'النوع *', type: 'select', required: true, options: [
        ['MA','استحواذ / اندماج'],['IPO','طرح عام'],['JV','مشروع مشترك'],
        ['VC','تمويل VC'],['PE','Private Equity'],['REAL_ESTATE','صفقة عقارية'],['DEBT','تمويل دين']
      ]},
      { id: 'value', label: 'القيمة (مليون $) *', type: 'number', required: true, step: '0.01', min: 0 },
      { id: 'locationAr', label: 'المكان بالعربية *', type: 'text', required: true },
      { id: 'locationEn', label: 'Location in English *', type: 'text', required: true, dir: 'ltr' },
      { id: 'deadline', label: 'الموعد النهائي *', type: 'datetime-local', required: true },
      { id: 'status', label: 'الحالة', type: 'select', default: 'ACTIVE', options: [
        ['ACTIVE','نشطة'],['CLOSED','مغلقة'],['EXPIRED','منتهية']
      ]},
      { id: 'descriptionAr', label: 'الوصف بالعربية *', type: 'textarea', required: true, full: true },
      { id: 'descriptionEn', label: 'Description in English *', type: 'textarea', required: true, full: true, dir: 'ltr' },
      { id: 'isHot', label: 'فرصة ساخنة 🔥 — تظهر بأولوية', type: 'checkbox', full: true }
    ],
    list: {
      title: d => d.titleAr,
      excerpt: d => (d.descriptionAr || '').slice(0, 140) + ((d.descriptionAr || '').length > 140 ? '...' : ''),
      emoji: '💼',
      badges: d => [
        { text: d.type, kind: 'gold' },
        { text: d.status === 'ACTIVE' ? 'نشطة' : d.status === 'CLOSED' ? 'مغلقة' : 'منتهية', kind: d.status === 'ACTIVE' ? 'green' : 'blue' },
        ...(d.isHot ? [{ text: '🔥 ساخنة', kind: 'green' }] : [])
      ],
      meta: d => ['$' + (d.value || 0).toLocaleString() + 'M', d.locationAr, 'الموعد: ' + formatDate(d.deadline)]
    },
    stats: items => ({
      'إجمالي الفرص': items.length,
      'القيمة الإجمالية': '$' + items.reduce((s,d)=>s+(d.value||0),0).toLocaleString() + 'M',
      'فرص ساخنة 🔥': items.filter(d=>d.isHot).length
    })
  }
};

let currentEntityKey = 'news';
let currentItems = [];
let editingId = null;
let searchTimer = null;
function currentEntity() { return ENTITIES[currentEntityKey]; }

async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const msg = document.getElementById('login-msg');
  const btn = document.getElementById('login-btn');
  msg.innerHTML = '';
  if (!email || !password) { msg.innerHTML = '<div class="msg msg-error">يرجى إدخال البريد وكلمة المرور</div>'; return; }
  btn.disabled = true;
  btn.textContent = 'جاري التحقق...';
  try {
    const r = await api('/api/auth/signin', { method: 'POST', body: JSON.stringify({ email, password }) });
    if (!r.ok || !r.data?.data?.token) {
      msg.innerHTML = '<div class="msg msg-error">البريد أو كلمة المرور غير صحيحة</div>';
      return;
    }
    const user = r.data.data.user;
    if (user.role !== 'ADMIN') {
      msg.innerHTML = '<div class="msg msg-error">⚠️ هذا الحساب ليس له صلاحيات الأدمن</div>';
      return;
    }
    setAuth(r.data.data.token, user);
    msg.innerHTML = '<div class="msg msg-success">✓ تم تسجيل الدخول بنجاح</div>';
    setTimeout(() => boot(), 600);
  } catch (e) {
    msg.innerHTML = '<div class="msg msg-error">حدث خطأ أثناء الاتصال بالخادم</div>';
  } finally {
    btn.disabled = false;
    btn.textContent = 'تسجيل الدخول';
  }
}

function logout() {
  if (!confirm('هل تريد تسجيل الخروج؟')) return;
  clearAuth();
  location.reload();
}

async function boot() {
  const u = getUser(); const t = getToken();
  if (!t || !u || u.role !== 'ADMIN') {
    if (u && u.role !== 'ADMIN') clearAuth();
    document.getElementById('login-screen').style.display = 'grid';
    document.getElementById('app').style.display = 'none';
    document.getElementById('app-header').style.display = 'none';
    return;
  }
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  document.getElementById('app-header').style.display = 'flex';
  document.getElementById('user-name').textContent = u.name || u.email;
  renderTabs();
  await switchEntity('news');
}

function renderTabs() {
  const wrap = document.getElementById('tabs');
  wrap.innerHTML = Object.values(ENTITIES).map(e =>
    '<button class="tab ' + (e.key === currentEntityKey ? 'active' : '') + '" onclick="switchEntity(\'' + e.key + '\')">' +
    '<span class="tab-icon">' + e.icon + '</span>' + e.nameAr + '</button>'
  ).join('');
}

async function switchEntity(key) {
  if (!ENTITIES[key]) return;
  currentEntityKey = key;
  document.getElementById('search-input').value = '';
  renderTabs();
  const ent = currentEntity();
  document.getElementById('page-title').textContent = ent.icon + ' إدارة ' + ent.nameAr;
  document.getElementById('create-label').textContent = ent.singularAr + ' جديد';
  await loadList();
}

function onSearch() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(loadList, 300);
}

async function loadList() {
  const container = document.getElementById('list-container');
  container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  const ent = currentEntity();
  const search = document.getElementById('search-input').value.trim();
  const qs = search ? '?search=' + encodeURIComponent(search) + '&limit=100' : '?limit=100';
  const r = await api(ent.endpoint + qs);
  if (!r.ok) {
    container.innerHTML = '<div class="msg msg-error">تعذّر التحميل: ' + (r.data?.error || 'خطأ') + '</div>';
    return;
  }
  currentItems = r.data.data || [];
  renderStats();
  renderList();
}

function renderStats() {
  const ent = currentEntity();
  const stats = ent.stats(currentItems);
  document.getElementById('stats-section').innerHTML = Object.entries(stats).map(([label, value]) => {
    const longValue = String(value).length > 12;
    return '<div class="stat"><div class="stat-label">' + escapeHtml(label) + '</div><div class="stat-value" style="' + (longValue ? 'font-size:14px;line-height:1.4;' : '') + '">' + escapeHtml(String(value)) + '</div></div>';
  }).join('');
}

function renderList() {
  const container = document.getElementById('list-container');
  const ent = currentEntity();
  if (!currentItems.length) {
    container.innerHTML = '<div class="empty-state"><div class="icon">' + ent.list.emoji + '</div><div class="title">لا توجد ' + ent.nameAr + ' بعد</div><div>دوس "+ ' + ent.singularAr + ' جديد" لإضافة أول واحدة.</div></div>';
    return;
  }
  const html = currentItems.map(item => {
    const title = ent.list.title(item) || '—';
    const excerpt = ent.list.excerpt(item) || '';
    const thumbUrl = ent.list.thumb ? ent.list.thumb(item) : null;
    const badges = ent.list.badges(item).map(b => '<span class="pill ' + (b.kind === 'green' ? 'pill-green' : b.kind === 'blue' ? 'pill-blue' : '') + '">' + escapeHtml(b.text) + '</span>').join('');
    const metaItems = ent.list.meta(item).filter(Boolean);
    const metaHtml = metaItems.map((m, i) => (i > 0 ? '<span>•</span>' : '') + '<span>' + escapeHtml(m) + '</span>').join('');
    const thumb = thumbUrl
      ? '<div class="item-thumb"><img src="' + escapeHtml(thumbUrl) + '" onerror="this.parentElement.innerHTML=\'' + ent.list.emoji + '\'" /></div>'
      : '<div class="item-thumb">' + ent.list.emoji + '</div>';
    return '<div class="item-row">' + thumb +
      '<div><div class="item-meta">' + badges + (metaItems.length ? '<span>•</span>' : '') + metaHtml + '</div>' +
      '<div class="item-title">' + escapeHtml(title) + '</div>' +
      (excerpt ? '<div class="item-excerpt">' + escapeHtml(excerpt) + '</div>' : '') +
      '</div>' +
      '<div class="item-actions">' +
      '<button class="btn btn-ghost btn-sm" onclick="editItem(\'' + item.id + '\')">✏️ تعديل</button>' +
      '<button class="btn btn-danger btn-sm" onclick="deleteItem(\'' + item.id + '\')">🗑️ حذف</button>' +
      '</div></div>';
  }).join('');
  container.innerHTML = '<div class="item-grid">' + html + '</div>';
}

function buildFormFields() {
  const ent = currentEntity();
  const wrap = document.getElementById('form-fields');
  wrap.innerHTML = ent.fields.map(f => {
    const fullClass = f.full ? ' field-full' : '';
    const dir = f.dir ? ' dir="' + f.dir + '"' : '';
    const placeholder = f.placeholder ? ' placeholder="' + escapeHtml(f.placeholder) + '"' : '';
    const id = 'f-' + f.id;
    if (f.type === 'checkbox') {
      return '<div class="field' + fullClass + '"><label class="checkbox-row"><input id="' + id + '" type="checkbox" /><span>' + escapeHtml(f.label) + '</span></label></div>';
    }
    if (f.type === 'textarea') {
      return '<div class="field' + fullClass + '"><label>' + escapeHtml(f.label) + '</label><textarea id="' + id + '"' + dir + placeholder + '></textarea></div>';
    }
    if (f.type === 'select') {
      const opts = (f.options || []).map(o => '<option value="' + escapeHtml(o[0]) + '">' + escapeHtml(o[1]) + '</option>').join('');
      return '<div class="field' + fullClass + '"><label>' + escapeHtml(f.label) + '</label><select id="' + id + '">' + opts + '</select></div>';
    }
    const step = f.step ? ' step="' + f.step + '"' : '';
    const min = f.min != null ? ' min="' + f.min + '"' : '';
    const max = f.max != null ? ' max="' + f.max + '"' : '';
    return '<div class="field' + fullClass + '"><label>' + escapeHtml(f.label) + '</label><input id="' + id + '" type="' + f.type + '"' + dir + placeholder + step + min + max + ' /></div>';
  }).join('');
}

function setFieldValue(field, value) {
  const el = document.getElementById('f-' + field.id);
  if (!el) return;
  if (field.type === 'checkbox') el.checked = !!value;
  else if (field.type === 'datetime-local' && value) el.value = new Date(value).toISOString().slice(0, 16);
  else el.value = value == null ? '' : value;
}

function getFieldValue(field) {
  const el = document.getElementById('f-' + field.id);
  if (!el) return null;
  if (field.type === 'checkbox') return el.checked;
  if (field.type === 'number') {
    const v = el.value.trim();
    return v === '' ? null : Number(v);
  }
  if (field.type === 'datetime-local') return el.value || null;
  const v = el.value.trim();
  if (field.nullable && v === '') return null;
  return v;
}

function openCreateModal() {
  editingId = null;
  const ent = currentEntity();
  document.getElementById('modal-title').textContent = ent.singularAr + ' جديد';
  buildFormFields();
  ent.fields.forEach(f => {
    const def = typeof f.default === 'function' ? f.default() : f.default;
    setFieldValue(f, def != null ? def : (f.type === 'checkbox' ? false : ''));
  });
  document.getElementById('modal-msg').innerHTML = '';
  document.getElementById('item-modal').classList.add('open');
}

function editItem(id) {
  const item = currentItems.find(x => x.id === id);
  if (!item) return;
  editingId = id;
  const ent = currentEntity();
  document.getElementById('modal-title').textContent = 'تعديل ' + ent.singularAr;
  buildFormFields();
  ent.fields.forEach(f => setFieldValue(f, item[f.id]));
  document.getElementById('modal-msg').innerHTML = '';
  document.getElementById('item-modal').classList.add('open');
}

function closeModal() { document.getElementById('item-modal').classList.remove('open'); }

async function saveItem() {
  const msg = document.getElementById('modal-msg');
  const btn = document.getElementById('save-btn');
  msg.innerHTML = '';
  const ent = currentEntity();
  const payload = {};
  const missing = [];
  ent.fields.forEach(f => {
    const v = getFieldValue(f);
    payload[f.id] = v;
    if (f.required && (v == null || v === '')) missing.push(f.label.replace(/\s*\*\s*$/, ''));
  });
  if (missing.length) {
    msg.innerHTML = '<div class="msg msg-error">يرجى ملء: ' + escapeHtml(missing.join('، ')) + '</div>';
    return;
  }
  btn.disabled = true;
  btn.textContent = 'جاري الحفظ...';
  try {
    const r = editingId
      ? await api(ent.endpoint + '/' + editingId, { method: 'PUT', body: JSON.stringify(payload) })
      : await api(ent.endpoint, { method: 'POST', body: JSON.stringify(payload) });
    if (!r.ok) {
      msg.innerHTML = '<div class="msg msg-error">' + escapeHtml(r.data?.error || 'فشل الحفظ') + '</div>';
      return;
    }
    closeModal();
    await loadList();
  } catch (e) {
    msg.innerHTML = '<div class="msg msg-error">حدث خطأ في الاتصال</div>';
  } finally {
    btn.disabled = false;
    btn.textContent = 'حفظ';
  }
}

async function deleteItem(id) {
  const ent = currentEntity();
  const item = currentItems.find(x => x.id === id);
  const name = item ? (ent.list.title(item) || '') : '';
  if (!confirm('هل أنت متأكد من حذف ' + ent.singularAr + ' "' + name + '"؟ لا يمكن التراجع.')) return;
  const r = await api(ent.endpoint + '/' + id, { method: 'DELETE' });
  if (!r.ok) { alert('فشل الحذف: ' + (r.data?.error || 'خطأ')); return; }
  await loadList();
}

document.getElementById('login-password').addEventListener('keydown', e => {
  if (e.key === 'Enter') doLogin();
});

boot();
