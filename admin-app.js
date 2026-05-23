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


/* Image picker that resizes + compresses on the client and stores as base64 data URL.
   Requires no backend or storage service. Default max dimensions 1600x900, quality 0.82. */
async function pickAndCompressImage(targetInputId, maxW, maxH, quality) {
  maxW = maxW || 1600; maxH = maxH || 900; quality = quality || 0.82;
  return new Promise((resolve, reject) => {
    const fi = document.createElement('input');
    fi.type = 'file';
    fi.accept = 'image/jpeg,image/png,image/webp,image/gif';
    fi.onchange = async () => {
      const file = fi.files && fi.files[0];
      if (!file) return resolve(null);
      const statusEl = document.getElementById(targetInputId + '-status');
      if (statusEl) statusEl.textContent = 'جاري المعالجة...';
      try {
        const dataUrl = await new Promise((res, rej) => {
          const fr = new FileReader();
          fr.onload = () => res(fr.result);
          fr.onerror = rej;
          fr.readAsDataURL(file);
        });
        const img = await new Promise((res, rej) => {
          const i = new Image();
          i.onload = () => res(i);
          i.onerror = rej;
          i.src = dataUrl;
        });
        let w = img.width, h = img.height;
        if (w > maxW || h > maxH) {
          const r = Math.min(maxW / w, maxH / h);
          w = Math.round(w * r);
          h = Math.round(h * r);
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#0a0e1a';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        const finalDataUrl = canvas.toDataURL('image/jpeg', quality);
        const sizeKB = Math.round(finalDataUrl.length * 0.75 / 1024);
        const input = document.getElementById(targetInputId);
        if (input) {
          input.value = finalDataUrl;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        const preview = document.getElementById(targetInputId + '-preview');
        if (preview) {
          preview.innerHTML = '<img src="' + finalDataUrl + '" style="max-width:200px;max-height:120px;border-radius:8px;border:1px solid var(--border);" />';
        }
        if (statusEl) statusEl.textContent = '✓ تم معالجة الصورة (' + w + '×' + h + ', ' + sizeKB + 'KB)';
        resolve(finalDataUrl);
      } catch (e) {
        if (statusEl) statusEl.textContent = '✗ خطأ في معالجة الصورة';
        reject(e);
      }
    };
    fi.click();
  });
}

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
  const mk = (key, icon, label, fn) => '<button class="tab ' + (currentEntityKey === key ? 'active' : '') + '" onclick="' + fn + '()"><span class="tab-icon">' + icon + '</span>' + label + '</button>';
  const user = getUser() || {};
  const isAdmin = user.role === 'ADMIN';
  const dashboardTab = mk('__dashboard__', '📊', 'الرئيسية', 'switchToDashboard');
  const entityTabs = Object.values(ENTITIES).map(e =>
    '<button class="tab ' + (e.key === currentEntityKey ? 'active' : '') + '" onclick="switchEntity(\'' + e.key + '\')">' +
    '<span class="tab-icon">' + e.icon + '</span>' + e.nameAr + '</button>'
  ).join('');
  const briefingTab = mk('__briefing__', '🌅', 'النشرة الصباحية', 'switchToBriefing');
  // Admin-only tabs
  const adminOnlyTabs = isAdmin ? (
    mk('__users__', '👥', 'المستخدمين', 'switchToUsers') +
    mk('__messages__', '📧', 'الرسائل', 'switchToMessages') +
    mk('__newsletter__', '📨', 'النشرة', 'switchToNewsletter') +
    mk('__regs__', '🎫', 'تسجيلات الفعاليات', 'switchToRegs') +
    mk('__aichats__', '💬', 'محادثات AI', 'switchToAIChats') +
    mk('__settings__', '🔌', 'التكاملات', 'switchToIntegrations') +
    mk('__analytics__', '📈', 'التحليلات', 'switchToAnalytics')
  ) : '';
  wrap.innerHTML = dashboardTab + entityTabs + briefingTab + adminOnlyTabs;
}

function setupListView(title) {
  currentEntityKey = title.key;
  renderTabs();
  document.getElementById('page-title').textContent = title.label;
  document.getElementById('stats-section').innerHTML = '';
  document.getElementById('search-input').style.display = 'none';
  document.querySelector('.actions button.btn-primary').style.display = 'none';
  document.getElementById('list-container').innerHTML = '<div class="loading"><div class="spinner"></div></div>';
}

async function switchToMessages() {
  setupListView({ key: '__messages__', label: '📧 رسائل التواصل' });
  const r = await api('/api/admin/messages?limit=100');
  if (!r.ok) { document.getElementById('list-container').innerHTML = '<div class="msg msg-error">تعذّر التحميل</div>'; return; }
  const items = r.data.data || [];
  if (!items.length) { document.getElementById('list-container').innerHTML = '<div class="empty-state"><div class="icon">📧</div><div class="title">مفيش رسائل لسه</div></div>'; return; }
  const rows = items.map(m => '<div class="item-row"><div class="item-thumb">📧</div><div>' +
    '<div class="item-meta"><span class="pill">' + (m.subject || m.status || '—') + '</span><span>' + formatDate(m.createdAt) + '</span></div>' +
    '<div class="item-title">' + escapeHtml((m.fromUser && (m.fromUser.name || m.fromUser.email)) || m.fromName || m.fromEmail || 'مجهول') + '</div>' +
    '<div class="item-excerpt">' + escapeHtml((m.body || m.message || '').slice(0, 200)) + '</div>' +
    '</div><div class="item-actions">' +
    (m.fromEmail ? '<a class="btn btn-ghost btn-sm" href="mailto:' + m.fromEmail + '">رد</a>' : '') +
    '</div></div>').join('');
  document.getElementById('list-container').innerHTML = '<div class="item-grid">' + rows + '</div>';
}

function downloadCsv(filename, rows) {
  if (!rows || !rows.length) { alert('مفيش بيانات للتصدير'); return; }
  const headers = Object.keys(rows[0]);
  const esc = v => '"' + String(v == null ? '' : v).replace(/"/g, '""').replace(/\n/g, ' ') + '"';
  const csv = '﻿' + headers.join(',') + '\n' + rows.map(r => headers.map(h => esc(r[h])).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function switchToNewsletter() {
  setupListView({ key: '__newsletter__', label: '📨 مشتركي النشرة البريدية' });
  const r = await api('/api/admin/newsletter?limit=500');
  if (!r.ok) { document.getElementById('list-container').innerHTML = '<div class="msg msg-error">تعذّر التحميل</div>'; return; }
  const items = r.data.data || [];
  const csvRows = items.map(s => ({ email: s.email, name: s.name || '', subscribedAt: s.createdAt }));
  const exportBtn = '<button class="btn btn-primary" onclick=\'downloadCsv("newsletter-subscribers.csv", ' + JSON.stringify(csvRows).replace(/'/g, '&#39;') + ')\'>📥 تصدير CSV</button>';
  if (!items.length) { document.getElementById('list-container').innerHTML = '<div class="empty-state"><div class="icon">📨</div><div class="title">مفيش مشتركين</div></div>'; return; }
  const rows = items.map(s => '<div class="item-row"><div class="item-thumb">📧</div><div>' +
    '<div class="item-meta"><span>' + formatDate(s.createdAt) + '</span></div>' +
    '<div class="item-title">' + escapeHtml(s.email) + '</div>' +
    (s.name ? '<div class="item-excerpt">' + escapeHtml(s.name) + '</div>' : '') +
    '</div></div>').join('');
  document.getElementById('list-container').innerHTML = '<div style="margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;"><span class="pill">إجمالي ' + items.length + ' مشترك</span>' + exportBtn + '</div><div class="item-grid">' + rows + '</div>';
}

async function switchToRegs() {
  setupListView({ key: '__regs__', label: '🎫 تسجيلات الفعاليات' });
  const r = await api('/api/admin/event-registrations?limit=200');
  if (!r.ok) { document.getElementById('list-container').innerHTML = '<div class="msg msg-error">تعذّر التحميل</div>'; return; }
  const items = r.data.data || [];
  const csvRows = items.map(x => ({ event: (x.event && x.event.titleAr) || '', date: (x.event && x.event.date) || '', user: (x.user && x.user.name) || x.name || '', email: (x.user && x.user.email) || x.email || '', registeredAt: x.createdAt }));
  const exportBtn = '<button class="btn btn-primary" onclick=\'downloadCsv("event-registrations.csv", ' + JSON.stringify(csvRows).replace(/'/g, '&#39;') + ')\'>📥 تصدير CSV</button>';
  if (!items.length) { document.getElementById('list-container').innerHTML = '<div class="empty-state"><div class="icon">🎫</div><div class="title">مفيش تسجيلات</div></div>'; return; }
  const rows = items.map(x => '<div class="item-row"><div class="item-thumb">🎫</div><div>' +
    '<div class="item-meta"><span class="pill">' + ((x.event && x.event.titleAr) || '—') + '</span><span>' + formatDate(x.createdAt) + '</span></div>' +
    '<div class="item-title">' + escapeHtml((x.user && x.user.name) || x.name || '—') + '</div>' +
    '<div class="item-excerpt">' + escapeHtml((x.user && x.user.email) || x.email || '') + '</div>' +
    '</div></div>').join('');
  document.getElementById('list-container').innerHTML = '<div style="margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;"><span class="pill">إجمالي ' + items.length + ' تسجيل</span>' + exportBtn + '</div><div class="item-grid">' + rows + '</div>';
}

async function switchToAIChats() {
  setupListView({ key: '__aichats__', label: '💬 سجل محادثات الـ AI' });
  const r = await api('/api/admin/ai-chats?limit=100');
  if (!r.ok) { document.getElementById('list-container').innerHTML = '<div class="msg msg-error">تعذّر التحميل</div>'; return; }
  const items = r.data.data || [];
  const meta = r.data.meta || {};
  const topQs = (meta.topQuestions || []).slice(0, 5);
  const topHtml = topQs.length ? '<div class="item-row" style="grid-template-columns:1fr;"><div><div class="item-title">🔥 أكتر 5 أسئلة تكراراً</div><div style="margin-top:10px;">' +
    topQs.map((q, i) => '<div style="padding:8px 0;border-bottom:1px solid var(--border);"><span class="pill">' + (q._count.id) + '×</span> <span style="margin-inline-start:8px;">' + escapeHtml((q.question || '').slice(0, 120)) + '</span></div>').join('') +
    '</div></div></div>' : '';
  const summary = '<div class="stats" style="margin-bottom:14px;">' +
    '<div class="stat"><div class="stat-label">إجمالي المحادثات</div><div class="stat-value">' + (meta.total || 0).toLocaleString() + '</div></div>' +
    '<div class="stat"><div class="stat-label">إجمالي التكلفة</div><div class="stat-value">$' + (Number(meta.totalCostUsd || 0).toFixed(2)) + '</div></div>' +
    '<div class="stat"><div class="stat-label">متوسط لكل سؤال</div><div class="stat-value">$' + ((meta.totalCostUsd && meta.total) ? (meta.totalCostUsd / meta.total).toFixed(4) : '0.00') + '</div></div>' +
    '</div>';
  if (!items.length) { document.getElementById('list-container').innerHTML = summary + topHtml + '<div class="empty-state"><div class="icon">💬</div><div class="title">مفيش محادثات بعد</div></div>'; return; }
  const rows = items.map(c => '<div class="item-row"><div class="item-thumb">💬</div><div>' +
    '<div class="item-meta"><span class="pill">' + (c.tier || 'free') + '</span><span>' + formatDate(c.createdAt) + '</span>' + (c.costUsd ? '<span>$' + Number(c.costUsd).toFixed(4) + '</span>' : '') + '</div>' +
    '<div class="item-title">' + escapeHtml((c.question || '').slice(0, 100)) + '</div>' +
    '<div class="item-excerpt">' + escapeHtml((c.answer || '').slice(0, 200)) + '</div>' +
    '</div></div>').join('');
  document.getElementById('list-container').innerHTML = summary + topHtml + '<div class="item-grid" style="margin-top:14px;">' + rows + '</div>';
}

async function switchToIntegrations() {
  setupListView({ key: '__settings__', label: '🔌 حالة التكاملات والمراقبة' });
  const r = await api('/api/admin/integrations');
  if (!r.ok) { document.getElementById('list-container').innerHTML = '<div class="msg msg-error">تعذّر التحميل</div>'; return; }
  const d = r.data.data || {};
  const env = d.env || {};
  const apis = d.externalApis || {};
  const envRow = Object.entries(env).map(([k, v]) =>
    '<div class="item-row" style="grid-template-columns:1fr auto;"><div><div class="item-title">' + k + '</div><div class="item-excerpt">' + (v ? 'مكوّن في Vercel' : 'غير مكوّن — التكامل معطّل') + '</div></div>' +
    '<div>' + (v ? '<span class="pill pill-green">✓ فعّال</span>' : '<span class="pill" style="color:var(--red);border-color:rgba(239,68,68,0.3);">✗ غير مفعّل</span>') + '</div></div>'
  ).join('');
  const apisRow = Object.entries(apis).map(([k, v]) => {
    const ok = v && v.ok;
    return '<div class="item-row" style="grid-template-columns:1fr auto;"><div><div class="item-title">' + k + '</div><div class="item-excerpt">Latency: ' + (v && v.latencyMs ? v.latencyMs + 'ms' : '—') + ' · HTTP ' + (v && v.status ? v.status : '—') + '</div></div>' +
      '<div>' + (ok ? '<span class="pill pill-green">✓ متاح</span>' : '<span class="pill" style="color:var(--red);border-color:rgba(239,68,68,0.3);">✗ معطّل</span>') + '</div></div>';
  }).join('');
  document.getElementById('list-container').innerHTML =
    '<h3 style="margin-bottom:10px;color:var(--gold);">🔑 متغيرات البيئة (Env Vars)</h3>' +
    '<div class="item-grid">' + envRow + '</div>' +
    '<h3 style="margin:20px 0 10px;color:var(--gold);">🌐 الـ APIs الخارجية</h3>' +
    '<div class="item-grid">' + apisRow + '</div>' +
    '<div style="margin-top:20px;font-size:12px;color:var(--text-3);">آخر تحديث: ' + formatDate(d.timestamp || new Date()) + '</div>';
}

async function switchToDashboard() {
  currentEntityKey = '__dashboard__';
  renderTabs();
  document.getElementById('page-title').textContent = '📊 لوحة التحكم — نظرة عامة';
  document.getElementById('stats-section').innerHTML = '';
  document.getElementById('search-input').style.display = 'none';
  document.querySelector('.actions button.btn-primary').style.display = 'none';
  const container = document.getElementById('list-container');
  container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  const r = await api('/api/admin/stats');
  if (!r.ok) {
    container.innerHTML = '<div class="msg msg-error">تعذّر تحميل الإحصائيات</div>';
    return;
  }
  const d = r.data.data || {};
  const c = d.counts || {};
  const g = d.growth || {};
  const ur = d.usersByRole || {};
  const cards = [
    { label: 'المستخدمين', value: c.users || 0, sub: '+' + (g.usersThisWeek || 0) + ' هذا الأسبوع', color: '#3b82f6' },
    { label: 'الأخبار', value: c.news || 0, sub: '+' + (g.newsThisWeek || 0) + ' هذا الأسبوع', color: '#10b981' },
    { label: 'الفعاليات', value: c.events || 0, sub: 'تسجيلات: ' + (c.eventRegistrations || 0), color: '#f59e0b' },
    { label: 'الشركات', value: c.companies || 0, sub: '', color: '#8b5cf6' },
    { label: 'رجال الأعمال', value: c.businessmen || 0, sub: '', color: '#ec4899' },
    { label: 'العقارات', value: c.realEstate || 0, sub: '', color: '#06b6d4' },
    { label: 'الصفقات', value: c.deals || 0, sub: '+' + (g.dealsThisWeek || 0) + ' هذا الأسبوع', color: '#ef4444' },
    { label: 'رسائل التواصل', value: c.messages || 0, sub: '', color: '#84cc16' },
    { label: 'النشرة البريدية', value: c.newsletter || 0, sub: 'مشتركين', color: '#f97316' },
    { label: 'محادثات الـ AI', value: c.aiChats || 0, sub: 'سؤال مجاب', color: '#a855f7' },
  ];
  const cardsHtml = cards.map(card =>
    '<div class="stat" style="border-color:' + card.color + '40;">' +
    '<div class="stat-label">' + card.label + '</div>' +
    '<div class="stat-value" style="color:' + card.color + '">' + card.value.toLocaleString() + '</div>' +
    (card.sub ? '<div style="font-size:11px;color:var(--text-3);margin-top:4px;">' + card.sub + '</div>' : '') +
    '</div>'
  ).join('');
  const roleHtml = '<div class="item-row" style="grid-template-columns:1fr;">' +
    '<div><div class="item-title">توزيع المستخدمين حسب الباقة</div>' +
    '<div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:10px;">' +
    Object.entries(ur).map(([k, v]) => '<span class="pill">' + k + ': ' + v + '</span>').join('') +
    '</div></div></div>';
  const latestUser = d.latest && d.latest.user;
  const latestNews = d.latest && d.latest.news;
  const latestHtml = '<div class="item-row" style="grid-template-columns:1fr;">' +
    '<div><div class="item-title">آخر نشاط</div><div style="margin-top:10px;font-size:13px;color:var(--text-2);">' +
    (latestUser ? 'آخر مستخدم: <span style="color:var(--gold);">' + (latestUser.name || latestUser.email) + '</span> · ' + new Date(latestUser.createdAt).toLocaleDateString('ar-EG') + '<br>' : '') +
    (latestNews ? 'آخر خبر: <span style="color:var(--gold);">' + (latestNews.titleAr || '—').slice(0, 60) + '</span>' : '') +
    '</div></div></div>';
  container.innerHTML = '<div class="stats" style="margin-bottom:20px;">' + cardsHtml + '</div>' + roleHtml + '<div style="height:14px;"></div>' + latestHtml;
}

async function switchToUsers() {
  currentEntityKey = '__users__';
  renderTabs();
  document.getElementById('page-title').textContent = '👥 إدارة المستخدمين';
  document.getElementById('stats-section').innerHTML = '';
  document.getElementById('search-input').style.display = '';
  document.querySelector('.actions button.btn-primary').style.display = 'none';
  const container = document.getElementById('list-container');
  container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  const r = await api('/api/admin/users?limit=100');
  if (!r.ok) {
    container.innerHTML = '<div class="msg msg-error">تعذّر تحميل المستخدمين</div>';
    return;
  }
  const users = r.data.data || [];
  if (users.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="icon">👤</div><div class="title">مفيش مستخدمين</div></div>';
    return;
  }
  const rows = users.map(u => {
    const roleColor = u.role === 'ADMIN' ? 'var(--gold)' : (u.role === 'PRO' ? '#3b82f6' : 'var(--text-2)');
    return '<div class="item-row">' +
      '<div class="item-thumb">' + (u.name ? u.name[0].toUpperCase() : '?') + '</div>' +
      '<div>' +
      '<div class="item-meta"><span class="pill" style="color:' + roleColor + ';border-color:' + roleColor + '40;">' + (u.role || 'FREE') + '</span>' +
      '<span>' + new Date(u.createdAt).toLocaleDateString('ar-EG') + '</span></div>' +
      '<div class="item-title">' + (u.name || '—') + '</div>' +
      '<div class="item-excerpt">' + u.email + (u.company ? ' · ' + u.company : '') + '</div>' +
      '</div>' +
      '<div class="item-actions">' +
      '<button class="btn btn-ghost btn-sm" onclick="editUserRole(\'' + u.id + '\',\'' + (u.role || 'FREE') + '\')">تغيير الباقة</button>' +
      '<button class="btn btn-danger btn-sm" onclick="deleteUser(\'' + u.id + '\',\'' + (u.email || '').replace(/\'/g, '') + '\')">حذف</button>' +
      '</div></div>';
  }).join('');
  container.innerHTML = '<div class="item-grid">' + rows + '</div>';
}

async function editUserRole(id, currentRole) {
  const newRole = prompt('الباقة الجديدة (FREE / PRO / PREMIUM / ADMIN):', currentRole);
  if (!newRole) return;
  const role = newRole.trim().toUpperCase();
  if (!['FREE', 'PRO', 'PREMIUM', 'ADMIN'].includes(role)) {
    alert('باقة غير صحيحة');
    return;
  }
  const r = await api('/api/admin/users/' + id, { method: 'PUT', body: JSON.stringify({ role }) });
  if (!r.ok) {
    alert('فشل التعديل: ' + (r.data?.error || 'خطأ'));
    return;
  }
  await switchToUsers();
}

async function deleteUser(id, email) {
  if (!confirm('تأكيد حذف المستخدم: ' + email + '؟ هذا الإجراء نهائي.')) return;
  const r = await api('/api/admin/users/' + id, { method: 'DELETE' });
  if (!r.ok) {
    alert('فشل الحذف: ' + (r.data?.error || 'خطأ'));
    return;
  }
  await switchToUsers();
}

async function switchToAnalytics() {
  currentEntityKey = '__analytics__';
  renderTabs();
  document.getElementById('page-title').textContent = '📈 التحليلات والنمو';
  document.getElementById('stats-section').innerHTML = '';
  document.getElementById('search-input').style.display = 'none';
  document.querySelector('.actions button.btn-primary').style.display = 'none';
  const container = document.getElementById('list-container');
  container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  const r = await api('/api/admin/stats');
  if (!r.ok) {
    container.innerHTML = '<div class="msg msg-error">تعذّر تحميل البيانات</div>';
    return;
  }
  const d = r.data.data || {};
  const g = d.growth || {};
  const c = d.counts || {};
  const ur = d.usersByRole || {};
  const totalUsers = c.users || 1;
  const proPct = Math.round(((ur.PRO || 0) + (ur.PREMIUM || 0)) / totalUsers * 100);
  const html = '<div class="stats" style="margin-bottom:20px;">' +
    '<div class="stat"><div class="stat-label">نمو المستخدمين (7 أيام)</div><div class="stat-value">+' + (g.usersThisWeek || 0) + '</div></div>' +
    '<div class="stat"><div class="stat-label">نمو الأخبار (7 أيام)</div><div class="stat-value">+' + (g.newsThisWeek || 0) + '</div></div>' +
    '<div class="stat"><div class="stat-label">نمو الصفقات (7 أيام)</div><div class="stat-value">+' + (g.dealsThisWeek || 0) + '</div></div>' +
    '<div class="stat"><div class="stat-label">معدل التحويل لـ Pro</div><div class="stat-value">' + proPct + '%</div></div>' +
    '<div class="stat"><div class="stat-label">إجمالي محادثات AI</div><div class="stat-value">' + (c.aiChats || 0).toLocaleString() + '</div></div>' +
    '<div class="stat"><div class="stat-label">مشتركي النشرة</div><div class="stat-value">' + (c.newsletter || 0).toLocaleString() + '</div></div>' +
    '</div>' +
    '<div class="item-row" style="grid-template-columns:1fr;"><div><div class="item-title">روابط مفيدة</div>' +
    '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px;">' +
    '<a class="btn btn-ghost btn-sm" target="_blank" href="https://analytics.google.com/">Google Analytics 4</a>' +
    '<a class="btn btn-ghost btn-sm" target="_blank" href="https://search.google.com/search-console">Search Console</a>' +
    '<a class="btn btn-ghost btn-sm" target="_blank" href="https://vercel.com/cairobusiness-projects/cairo-business-backend">Vercel Backend</a>' +
    '<a class="btn btn-ghost btn-sm" target="_blank" href="https://console.groq.com/">Groq Console</a>' +
    '</div></div></div>';
  container.innerHTML = html;
}

async function switchEntity(key) {
  if (!ENTITIES[key]) return;
  currentEntityKey = key;
  document.getElementById('search-input').value = '';
  document.getElementById('search-input').style.display = '';
  document.querySelector('.actions button.btn-primary').style.display = '';
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

function openCreateModal() {
  editingId = null;
  const ent = currentEntity();
  document.getElementById('modal-title').textContent = ent.singularAr + ' جديد';
  renderForm({});
  document.getElementById('item-modal').classList.add('open');
}

function editItem(id) {
  editingId = id;
  const item = currentItems.find(x => x.id === id);
  if (!item) return;
  const ent = currentEntity();
  document.getElementById('modal-title').textContent = 'تعديل ' + ent.singularAr;
  renderForm(item);
  document.getElementById('item-modal').classList.add('open');
}

function closeModal() {
  document.getElementById('item-modal').classList.remove('open');
  document.getElementById('modal-msg').innerHTML = '';
  editingId = null;
}

async function deleteItem(id) {
  const ent = currentEntity();
  if (!confirm('تأكيد حذف؟ لا يمكن التراجع.')) return;
  const r = await api(ent.endpoint + '/' + id, { method: 'DELETE' });
  if (!r.ok) { alert('فشل الحذف: ' + (r.data?.error || 'خطأ')); return; }
  await loadList();
}

function renderForm(item) {
  const ent = currentEntity();
  const grid = document.getElementById('form-fields');
  grid.innerHTML = ent.fields.map(f => {
    const v = item[f.id];
    const full = f.full ? 'field-full' : '';
    const dir = f.dir ? ' dir="' + f.dir + '"' : '';
    let input = '';
    if (f.type === 'textarea') input = '<textarea id="f_' + f.id + '"' + dir + '>' + escapeHtml(v || (typeof f.default === 'function' ? f.default() : f.default || '')) + '</textarea>';
    else if (f.type === 'select') input = '<select id="f_' + f.id + '">' + (f.options || []).map(o => '<option value="' + o[0] + '"' + (v === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select>';
    else if (f.type === 'checkbox') input = '<div class="checkbox-row"><input id="f_' + f.id + '" type="checkbox"' + (v ? ' checked' : '') + ' /><label for="f_' + f.id + '">' + f.label + '</label></div>';
    else input = '<input id="f_' + f.id + '" type="' + f.type + '"' + dir + ' value="' + escapeHtml(v != null ? v : (typeof f.default === 'function' ? f.default() : f.default || '')) + '" />';
    if (f.type === 'checkbox') return '<div class="field ' + full + '">' + input + '</div>';
    return '<div class="field ' + full + '"><label>' + f.label + '</label>' + input + '</div>';
  }).join('');
}

async function saveItem() {
  const ent = currentEntity();
  const msg = document.getElementById('modal-msg');
  const btn = document.getElementById('save-btn');
  msg.innerHTML = '';
  const payload = {};
  const missing = [];
  for (const f of ent.fields) {
    const el = document.getElementById('f_' + f.id);
    if (!el) continue;
    let val;
    if (f.type === 'checkbox') val = el.checked;
    else if (f.type === 'number') val = el.value === '' ? null : Number(el.value);
    else val = el.value.trim();
    if (f.required && (val === '' || val == null)) missing.push(f.label);
    if (val !== '' && val != null) payload[f.id] = val;
  }
  if (missing.length) { msg.innerHTML = '<div class="msg msg-error">يرجى ملء: ' + escapeHtml(missing.join('، ')) + '</div>'; return; }
  btn.disabled = true; btn.textContent = 'جاري الحفظ...';
  try {
    const r = editingId
      ? await api(ent.endpoint + '/' + editingId, { method: 'PUT', body: JSON.stringify(payload) })
      : await api(ent.endpoint, { method: 'POST', body: JSON.stringify(payload) });
    if (!r.ok) { msg.innerHTML = '<div class="msg msg-error">' + escapeHtml(r.data?.error || 'فشل الحفظ') + '</div>'; return; }
    closeModal();
    await loadList();
  } catch (e) {
    msg.innerHTML = '<div class="msg msg-error">حدث خطأ في الاتصال</div>';
  } finally { btn.disabled = false; btn.textContent = 'حفظ'; }
}

const DEFAULT_BRIEFING_ITEMS = Array.from({length:5}, (_,i) => ({num:i+1,title_ar:'',title_en:'',sector_ar:'',sector_en:'',impact:'neutral'}));
const DEFAULT_BRIEFING_RATES = [
  { symbol:'USD/EGP', name_ar:'دولار/جنيه', name_en:'USD/EGP', value:'52.92', change:'0.2', category:'currency' },
  { symbol:'EGX30', name_ar:'EGX30', name_en:'EGX30', value:'31245', change:'1.8', category:'index' }
];

async function switchToBriefing() {
  currentEntityKey = '__briefing__';
  renderTabs();
  document.getElementById('page-title').textContent = '🌅 النشرة الصباحية';
  document.getElementById('search-input').style.display = 'none';
  document.querySelector('.actions button.btn-primary').style.display = 'none';
  document.getElementById('stats-section').innerHTML = '';
  const container = document.getElementById('list-container');
  container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  const r = await api('/api/admin/briefing');
  let briefing = (r.ok && r.data && r.data.data) || null;
  const items = (briefing && briefing.items) || DEFAULT_BRIEFING_ITEMS;
  const rates = (briefing && briefing.rates) || DEFAULT_BRIEFING_RATES;
  const deal = (briefing && briefing.dealOfDay) || { title_ar:'', title_en:'', value:'' };
  let html = '<div class="form-grid" style="grid-template-columns:1fr;">';
  html += '<div class="field field-full"><label>تاريخ النشرة</label><input id="bf-date" type="date" value="' + (briefing && briefing.date ? new Date(briefing.date).toISOString().slice(0,10) : new Date().toISOString().slice(0,10)) + '" /></div>';
  html += '<div class="field field-full"><label>أهم 5 أخبار (JSON)</label><textarea id="bf-items" style="min-height:200px;font-family:monospace;">' + JSON.stringify(items, null, 2) + '</textarea></div>';
  html += '<div class="field field-full"><label>أسعار ومؤشرات (JSON)</label><textarea id="bf-rates" style="min-height:160px;font-family:monospace;">' + JSON.stringify(rates, null, 2) + '</textarea></div>';
  html += '<div class="field field-full"><label>صفقة اليوم (JSON)</label><textarea id="bf-deal" style="min-height:120px;font-family:monospace;">' + JSON.stringify(deal, null, 2) + '</textarea></div>';
  html += '<div class="field field-full"><button class="btn btn-primary" onclick="saveBriefing()">حفظ النشرة</button></div>';
  html += '</div>';
  container.innerHTML = html;
}

async function saveBriefing() {
  try {
    const date = document.getElementById('bf-date').value;
    const items = JSON.parse(document.getElementById('bf-items').value);
    const rates = JSON.parse(document.getElementById('bf-rates').value);
    const dealOfDay = JSON.parse(document.getElementById('bf-deal').value);
    const r = await api('/api/admin/briefing', { method: 'POST', body: JSON.stringify({ date, items, rates, dealOfDay }) });
    if (!r.ok) { alert('فشل الحفظ: ' + (r.data?.error || 'خطأ')); return; }
    alert('تم حفظ النشرة');
  } catch (e) { alert('خطأ في JSON: ' + e.message); }
}

document.getElementById('login-password').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
boot();
