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
      { id: 'titleAr', label: 'المنصب بالعربية', type: 'text', nullable: true, placeholder: 'رئيس مجلس الإدارة، مؤسس...' },
      { id: 'titleEn', label: 'Title in English', type: 'text', dir: 'ltr', nullable: true, placeholder: 'Chairman, Founder...' },
      { id: 'sectorAr', label: 'القطاع بالعربية *', type: 'text', required: true },
      { id: 'sectorEn', label: 'Sector in English *', type: 'text', required: true, dir: 'ltr' },
      { id: 'imageUrl', label: '📷 رابط الصورة الشخصية', type: 'url', dir: 'ltr', nullable: true, full: true, placeholder: 'https://...' },
      { id: 'isPowerPerson', label: '⭐ عرض في قسم "أقوى الشخصيات في البيزنس" (المجلة)', type: 'checkbox', full: true },
      { id: 'isTop50Egypt', label: '📕 عرض في قسم "أقوى 50 رجل أعمال في مصر" (كتاب Taschen)', type: 'checkbox', full: true },
      { id: 'quote', label: '"اقتباس مميز (يظهر في صفحة الكتاب)', type: 'textarea', full: true, nullable: true, placeholder: 'اقتباس قصير يلخّص فلسفته أو إنجازه...' },
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
      excerpt: b => (b.titleAr || b.bio || '').slice(0, 140) + ((b.titleAr || b.bio || '').length > 140 ? '...' : ''),
      thumb: b => b.imageUrl, emoji: '👔',
      badges: b => [
        ...(b.isPowerPerson ? [{ text: '⭐ مجلة', kind: 'gold' }] : []),
        ...(b.isTop50Egypt ? [{ text: '📕 Top 50', kind: 'gold' }] : []),
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
  top50egypt: {
    key: 'top50egypt', icon: '📕', nameAr: 'أقوى 50 في مصر', singularAr: 'رجل أعمال (Top 50)',
    endpoint: '/api/admin/businessmen',
    filterFn: items => (items || []).filter(b => b.isTop50Egypt === true || b.isTop50Egypt === 'true'),
    defaults: { isTop50Egypt: true, flag: 'EG' },
    publicLink: id => 'https://cairobusiness.net/#top50/' + id,
    sectionLink: 'https://cairobusiness.net/#top50',
    fields: [
      { id: 'nameAr', label: 'الاسم بالعربية *', type: 'text', required: true },
      { id: 'nameEn', label: 'Name in English *', type: 'text', required: true, dir: 'ltr' },
      { id: 'titleAr', label: 'المنصب بالعربية', type: 'text', nullable: true, placeholder: 'رئيس مجلس الإدارة، مؤسس...' },
      { id: 'titleEn', label: 'Title in English', type: 'text', dir: 'ltr', nullable: true, placeholder: 'Chairman, Founder...' },
      { id: 'sectorAr', label: 'القطاع بالعربية *', type: 'text', required: true, placeholder: 'صناعة، عقارات، اتصالات...' },
      { id: 'sectorEn', label: 'Sector in English *', type: 'text', required: true, dir: 'ltr' },
      { id: 'imageUrl', label: '📷 رابط الصورة الشخصية (يظهر في الكتاب)', type: 'url', dir: 'ltr', nullable: true, full: true, placeholder: 'https://...' },
      { id: 'quote', label: '"اقتباس مميز (يظهر بخط مائل في صفحة الكتاب)', type: 'textarea', full: true, nullable: true, placeholder: 'سطرين عن فلسفته أو أكبر إنجاز...' },
      { id: 'bio', label: 'السيرة الذاتية الكاملة (تظهر في الصفحة التفصيلية)', type: 'textarea', full: true, nullable: true },
      { id: 'achievements', label: 'الإنجازات (سطر لكل إنجاز)', type: 'textarea', full: true, nullable: true, placeholder: 'إنجاز 1\nإنجاز 2\nإنجاز 3...' },
      { id: 'companies', label: 'الشركات (مفصول بفاصلة أو ·)', type: 'text', nullable: true, placeholder: 'OCI · Adidas · LafargeHolcim' },
      { id: 'netWorth', label: 'الثروة (مليار $)', type: 'number', nullable: true, step: '0.01' },
      { id: 'rank', label: 'الترتيب في الـ Top 50 *', type: 'number', nullable: true, min: 1, max: 50, placeholder: '1' },
      { id: 'age', label: 'العمر', type: 'number', nullable: true, min: 18 },
      { id: 'education', label: 'التعليم', type: 'text', nullable: true },
      { id: 'flag', label: 'كود الدولة', type: 'text', dir: 'ltr', nullable: true, placeholder: 'EG' },
      { id: 'isTop50Egypt', label: '📕 مفعّل في قسم الـ Top 50 (لا تطفّيها إلا لو عايز تشيله من القسم)', type: 'checkbox', full: true },
      { id: 'isPowerPerson', label: '⭐ عرض كمان في قسم "أقوى الشخصيات في البيزنس" (المجلة)', type: 'checkbox', full: true }
    ],
    list: {
      title: b => '#' + (b.rank || '—') + ' · ' + (b.nameAr || b.nameEn),
      excerpt: b => (b.quote || b.titleAr || b.bio || '').slice(0, 160) + ((b.quote || b.titleAr || b.bio || '').length > 160 ? '...' : ''),
      thumb: b => b.imageUrl, emoji: '📕',
      badges: b => [
        ...(b.rank ? [{ text: '#' + b.rank, kind: 'gold' }] : [{ text: 'بدون ترتيب', kind: 'red' }]),
        { text: b.sectorAr || b.sectorEn, kind: 'blue' },
        ...(b.netWorth ? [{ text: '$' + b.netWorth + 'B', kind: 'green' }] : []),
        ...(b.imageUrl ? [{ text: '📷', kind: 'green' }] : [{ text: 'بدون صورة', kind: 'red' }])
      ],
      meta: b => [b.flag || '—', ...(b.companies ? [b.companies.split(/[,،·]/)[0].trim()] : [])]
    },
    stats: items => {
      const filtered = (items || []).filter(b => b.isTop50Egypt);
      const withPhoto = filtered.filter(b => b.imageUrl);
      const totalWealth = filtered.reduce((s,b) => s + (b.netWorth||0), 0);
      return {
        'إجمالي الـ Top 50': filtered.length + ' / 50',
        'بصور': withPhoto.length,
        'إجمالي الثروة': '$' + (totalWealth >= 1000 ? (totalWealth/1000).toFixed(1) + 'T' : totalWealth.toFixed(1) + 'B')
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
  },
  startups: {
    key: 'startups', icon: '🚀', nameAr: 'الشركات الناشئة', singularAr: 'شركة ناشئة',
    endpoint: '/api/admin/startups',
    fields: [
      { id: 'nameAr', label: 'الاسم بالعربية *', type: 'text', required: true },
      { id: 'nameEn', label: 'Name in English *', type: 'text', required: true, dir: 'ltr' },
      { id: 'sector', label: 'القطاع *', type: 'select', required: true, options: [
        ['fintech','فينتك'],['edtech','تعليم'],['healthtech','صحة'],['ecommerce','تجارة'],
        ['logistics','لوجستيات'],['saas','SaaS'],['ai','ذكاء اصطناعي'],['proptech','عقارات تقنية'],
        ['agritech','زراعة'],['cleantech','طاقة نظيفة'],['other','أخرى']
      ]},
      { id: 'stage', label: 'المرحلة *', type: 'select', required: true, options: [
        ['pre-seed','Pre-Seed'],['seed','Seed'],['series-a','Series A'],['series-b','Series B'],
        ['series-c','Series C+'],['growth','Growth'],['unicorn','Unicorn 🦄']
      ]},
      { id: 'raised', label: 'إجمالي التمويل (مليون $) *', type: 'number', required: true, step: '0.1', min: 0 },
      { id: 'founded', label: 'سنة التأسيس *', type: 'number', required: true, min: 1990, max: 2030 },
      { id: 'employees', label: 'عدد الموظفين', type: 'number', nullable: true, min: 0 },
      { id: 'investors', label: 'المستثمرون (مفصول بفاصلة)', type: 'text', nullable: true, placeholder: 'Sequoia, A16z, BECO Capital' },
      { id: 'milestones', label: 'إنجازات (مفصول بفاصلة)', type: 'text', nullable: true },
      { id: 'description', label: 'الوصف', type: 'textarea', full: true, nullable: true }
    ],
    list: {
      title: s => s.nameAr,
      excerpt: s => (s.description || '').slice(0, 140) + ((s.description || '').length > 140 ? '...' : ''),
      emoji: '🚀',
      badges: s => [
        { text: s.stage, kind: 'gold' },
        { text: s.sector, kind: 'blue' },
        ...(s.stage === 'unicorn' ? [{ text: '🦄', kind: 'green' }] : [])
      ],
      meta: s => ['$' + (s.raised || 0).toLocaleString() + 'M raised', 'تأسست ' + s.founded, ...(s.employees ? [s.employees + ' موظف'] : [])]
    },
    stats: items => ({
      'إجمالي الشركات': items.length,
      'إجمالي التمويل': '$' + items.reduce((sm,s)=>sm+(s.raised||0),0).toLocaleString() + 'M',
      'يونيكورن': items.filter(s=>s.stage==='unicorn').length
    })
  },
  compounds: {
    key: 'compounds', icon: '🏙️', nameAr: 'الكمبوندات', singularAr: 'كمبوند',
    endpoint: '/api/admin/compounds',
    fields: [
      { id: 'nameAr', label: 'اسم الكمبوند بالعربية *', type: 'text', required: true },
      { id: 'nameEn', label: 'Name in English *', type: 'text', required: true, dir: 'ltr' },
      { id: 'developer', label: 'المطوّر', type: 'text', nullable: true, placeholder: 'TMG, Emaar, SODIC...' },
      { id: 'cityAr', label: 'المدينة بالعربية', type: 'text', nullable: true, placeholder: 'القاهرة الجديدة' },
      { id: 'cityEn', label: 'City in English', type: 'text', nullable: true, dir: 'ltr' },
      { id: 'areaAr', label: 'المنطقة بالعربية', type: 'text', nullable: true, placeholder: 'التجمع الخامس' },
      { id: 'areaEn', label: 'Area in English', type: 'text', nullable: true, dir: 'ltr' },
      { id: 'sizeFromM2', label: 'أصغر وحدة (م²)', type: 'number', nullable: true, min: 0 },
      { id: 'sizeToM2', label: 'أكبر وحدة (م²)', type: 'number', nullable: true, min: 0 },
      { id: 'priceFromEgp', label: 'سعر يبدأ من (جنيه)', type: 'number', nullable: true, step: '10000', min: 0 },
      { id: 'priceToEgp', label: 'سعر يصل إلى (جنيه)', type: 'number', nullable: true, step: '10000', min: 0 },
      { id: 'unitsCount', label: 'عدد الوحدات', type: 'number', nullable: true, min: 0 },
      { id: 'deliveryYear', label: 'سنة التسليم', type: 'number', nullable: true, min: 2020, max: 2040 },
      { id: 'imageUrl', label: 'رابط الصورة', type: 'text', nullable: true, dir: 'ltr', placeholder: 'https://...' },
      { id: 'detailsUrl', label: 'رابط تفاصيل الكمبوند', type: 'text', nullable: true, dir: 'ltr' },
      { id: 'sortOrder', label: 'ترتيب العرض (الأصغر يظهر أولاً)', type: 'number', default: 0 },
      { id: 'isFeatured', label: 'كمبوند مميز ⭐ — يظهر في أعلى القائمة', type: 'checkbox', full: true },
      { id: 'descriptionAr', label: 'الوصف بالعربية', type: 'textarea', full: true, nullable: true },
      { id: 'descriptionEn', label: 'Description in English', type: 'textarea', full: true, nullable: true, dir: 'ltr' }
    ],
    list: {
      title: c => c.nameAr,
      excerpt: c => (c.descriptionAr || '').slice(0, 140) + ((c.descriptionAr || '').length > 140 ? '...' : ''),
      emoji: '🏙️',
      thumb: c => c.imageUrl || null,
      badges: c => [
        ...(c.isFeatured ? [{ text: '⭐ مميز', kind: 'gold' }] : []),
        ...(c.cityAr ? [{ text: c.cityAr, kind: 'blue' }] : []),
        ...(c.developer ? [{ text: c.developer, kind: 'green' }] : [])
      ],
      meta: c => [
        ...(c.areaAr ? [c.areaAr] : []),
        ...(c.sizeFromM2 ? [(c.sizeFromM2) + (c.sizeToM2 ? '-'+c.sizeToM2 : '') + ' م²'] : []),
        ...(c.priceFromEgp ? ['من ' + (c.priceFromEgp/1000000).toFixed(1) + 'M جنيه'] : []),
        ...(c.deliveryYear ? ['تسليم ' + c.deliveryYear] : [])
      ]
    },
    stats: items => ({
      'إجمالي الكمبوندات': items.length,
      'مميزة ⭐': items.filter(c=>c.isFeatured).length,
      'مطوّرين مختلفين': new Set(items.map(c=>c.developer).filter(Boolean)).size
    })
  },
  videos: {
    key: 'videos', icon: '🎬', nameAr: 'الفيديوهات', singularAr: 'فيديو',
    endpoint: '/api/admin/videos',
    fields: [
      { id: 'titleAr', label: 'العنوان بالعربية *', type: 'text', required: true },
      { id: 'titleEn', label: 'Title in English *', type: 'text', required: true, dir: 'ltr' },
      { id: 'youtubeUrl', label: 'رابط YouTube أو Vimeo *', type: 'url', dir: 'ltr', placeholder: 'https://youtube.com/watch?v=... أو https://youtu.be/...', full: true, required: true },
      { id: 'category', label: 'التصنيف *', type: 'select', required: true, default: 'interview', options: [
        ['interview','مقابلات'],['analysis','تحليلات'],['events','فعاليات'],
        ['education','تعليمي'],['reels','ريلز / قصير'],['series','سلسلة']
      ]},
      { id: 'durationSec', label: 'المدة بالثواني (مثلاً 195 لـ 3:15)', type: 'number', nullable: true, min: 0 },
      { id: 'views', label: 'عدد المشاهدات (نص: 480K, 1.2M)', type: 'text', nullable: true, placeholder: '120K' },
      { id: 'presenterAr', label: 'اسم المقدّم بالعربية', type: 'text', nullable: true, placeholder: 'محمد الغمراوي' },
      { id: 'presenterEn', label: 'Presenter Name in English', type: 'text', nullable: true, dir: 'ltr' },
      { id: 'thumbnailUrl', label: 'صورة مصغّرة مخصّصة (اختياري — تُسحب تلقائياً من YouTube)', type: 'url', dir: 'ltr', nullable: true, full: true },
      { id: 'descriptionAr', label: 'الوصف بالعربية', type: 'textarea', full: true, nullable: true },
      { id: 'descriptionEn', label: 'Description in English', type: 'textarea', full: true, nullable: true, dir: 'ltr' },
      { id: 'isFeatured', label: '⭐ فيديو مميّز — يظهر في الفيديو الرئيسي بالأعلى (واحد فقط)', type: 'checkbox', full: true },
      { id: 'isTrending', label: '🔥 رائج — يظهر في القائمة الجانبية', type: 'checkbox', full: true },
      { id: 'isReel', label: '⚡ ريل — يظهر في شريط الفيديوهات القصيرة', type: 'checkbox', full: true },
      { id: 'isSeries', label: '📚 سلسلة — يظهر كبطاقة سلسلة (يتطلب عدد الحلقات)', type: 'checkbox', full: true },
      { id: 'seriesEpisodes', label: 'عدد حلقات السلسلة (لو isSeries مفعّل)', type: 'number', nullable: true, min: 0 },
      { id: 'seriesTotalHrs', label: 'إجمالي ساعات السلسلة (مثل 18:42)', type: 'text', nullable: true, placeholder: '18:42' },
      { id: 'sortOrder', label: 'ترتيب العرض (الأصغر يظهر أولاً)', type: 'number', default: 0 },
      { id: 'publishedAt', label: 'تاريخ النشر', type: 'datetime-local', default: () => nowLocalISO() }
    ],
    list: {
      title: v => v.titleAr,
      excerpt: v => (v.descriptionAr || v.descriptionEn || '').slice(0, 140) + (((v.descriptionAr||v.descriptionEn||'').length > 140) ? '...' : ''),
      thumb: v => v.thumbnailUrl || (v.youtubeId ? 'https://i.ytimg.com/vi/' + v.youtubeId + '/hqdefault.jpg' : null),
      emoji: '🎬',
      badges: v => [
        { text: v.category, kind: 'gold' },
        ...(v.isFeatured ? [{ text: '⭐ مميّز', kind: 'green' }] : []),
        ...(v.isTrending ? [{ text: '🔥 رائج', kind: 'red' }] : []),
        ...(v.isReel ? [{ text: '⚡ ريل', kind: 'purple' }] : []),
        ...(v.isSeries ? [{ text: '📚 سلسلة', kind: 'blue' }] : []),
      ],
      meta: v => [
        ...(v.presenterAr ? ['تقديم: ' + v.presenterAr] : []),
        ...(v.durationSec ? [Math.floor(v.durationSec/60)+':'+String(v.durationSec%60).padStart(2,'0')] : []),
        ...(v.views ? [v.views + ' مشاهدة'] : [])
      ]
    },
    stats: items => ({
      'إجمالي الفيديوهات': items.length,
      'مميّز ⭐': items.filter(v=>v.isFeatured).length,
      'ريلز ⚡': items.filter(v=>v.isReel).length,
      'سلاسل 📚': items.filter(v=>v.isSeries).length
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
  const role = user.role || 'FREE';
  const isAdmin = role === 'ADMIN';
  const isEditor = role === 'EDITOR';
  const isWriter = role === 'WRITER';
  const isModerator = role === 'MODERATOR';
  // Role label chip in header
  const roleChip = document.getElementById('user-role-chip');
  if (roleChip) roleChip.textContent = '· ' + role;
  const dashboardTab = mk('__dashboard__', '📊', 'الرئيسية', 'switchToDashboard');
  // Filter entity tabs based on role
  let allowedEntities = Object.values(ENTITIES);
  if (isWriter) allowedEntities = allowedEntities.filter(e => e.key === 'news');
  if (isModerator) allowedEntities = allowedEntities.filter(e => e.key === 'news' || e.key === 'events');
  const entityTabs = allowedEntities.map(e =>
    '<button class="tab ' + (e.key === currentEntityKey ? 'active' : '') + '" onclick="switchEntity(\'' + e.key + '\')">' +
    '<span class="tab-icon">' + e.icon + '</span>' + e.nameAr + '</button>'
  ).join('');
  // Briefing for Admin + Editor + Moderator only
  const briefingTab = (isAdmin || isEditor || isModerator) ? mk('__briefing__', '🌅', 'النشرة الصباحية', 'switchToBriefing') : '';
  // CBI Indices for Admin + Editor
  const cbiTab = (isAdmin || isEditor) ? mk('__cbi__', '📊', 'مؤشرات CBI', 'switchToCBI') : '';
  // Section Layout (CMS homepage controller) — Admin only
  const layoutTab = isAdmin ? mk('__layout__', '🎛️', 'تخطيط الصفحة', 'switchToLayout') : '';
  // Hero (waterhole CMS) — Admin + Editor
  const heroTab = (isAdmin || isEditor) ? mk('__hero__', '🎯', 'الواجهة (Hero)', 'switchToHero') : '';
  /* News Drafts tab removed per user request — drafts feature deprecated.
   * The switchToDrafts/loadDraftsUI/generateDraftsNow functions remain in code
   * but are unreachable from the UI. */
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
  // Moderator gets messages
  const modOnlyTabs = isModerator ? mk('__messages__', '📧', 'الرسائل', 'switchToMessages') : '';
  wrap.innerHTML = dashboardTab + entityTabs + briefingTab + cbiTab + heroTab + layoutTab + adminOnlyTabs + modOnlyTabs;
}

/* Drafts counter kept for backward compat (no longer displayed) */
let draftsCount = 0;

// ═════════════════════════════════════════════════════════════
// Dark/Light theme toggle for admin panel
// ═════════════════════════════════════════════════════════════
function toggleAdminTheme() {
  const html = document.documentElement;
  const cur = html.getAttribute('data-theme') || 'dark';
  const next = cur === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  try { localStorage.setItem('cb-admin-theme', next); } catch (_) {}
  const btn = document.getElementById('theme-btn');
  const label = document.getElementById('theme-label');
  if (label) label.textContent = next === 'dark' ? 'داكن' : 'فاتح';
  if (btn) btn.innerHTML = (next === 'dark' ? '🌙 ' : '☀️ ') + '<span id="theme-label">' + (next === 'dark' ? 'داكن' : 'فاتح') + '</span>';
}
// Restore saved theme on load
(function restoreAdminTheme() {
  try {
    const t = localStorage.getItem('cb-admin-theme');
    if (t === 'light') document.documentElement.setAttribute('data-theme', 'light');
  } catch (_) {}
})();

// ═════════════════════════════════════════════════════════════
// Live Preview — open news article in new tab with full styling
// ═════════════════════════════════════════════════════════════
function previewNews() {
  const titleAr = (document.getElementById('f_titleAr') || {}).value || '';
  const excerptAr = (document.getElementById('f_excerptAr') || {}).value || '';
  const author = (document.getElementById('f_author') || {}).value || '';
  const category = (document.getElementById('f_category') || {}).value || '';
  const imageUrl = (document.getElementById('f_imageUrl') || {}).value || '';
  const html = '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>معاينة: ' +
    titleAr + '</title><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;800&display=swap" rel="stylesheet">' +
    '<style>body{font-family:Cairo,sans-serif;max-width:780px;margin:40px auto;padding:0 20px;background:#0a0e1a;color:#f3f4f6;line-height:1.8}' +
    'h1{font-size:32px;font-weight:800;color:#D4AF37;margin-bottom:8px}' +
    '.meta{color:#9ca3af;font-size:14px;margin-bottom:20px;display:flex;gap:14px}' +
    '.cat{background:rgba(212,175,55,0.2);color:#D4AF37;padding:3px 10px;border-radius:9999px;font-size:11px;font-weight:600}' +
    '.preview-banner{position:fixed;top:0;left:0;right:0;background:#D4AF37;color:#0a0e1a;text-align:center;padding:8px;font-weight:700;font-size:13px;z-index:9999}' +
    'img{max-width:100%;border-radius:14px;margin:20px 0}' +
    '.excerpt{font-size:18px;color:#e5e7eb;margin-bottom:20px;font-weight:500}' +
    '</style></head><body>' +
    '<div class="preview-banner">⚠️ معاينة فقط — هذا الخبر لم يُنشر بعد</div>' +
    '<div style="margin-top:50px"></div>' +
    '<div class="meta"><span class="cat">' + category + '</span><span>' + author + '</span><span>' + new Date().toLocaleDateString('ar-EG') + '</span></div>' +
    '<h1>' + escapeHtml(titleAr) + '</h1>' +
    (imageUrl ? '<img src="' + imageUrl + '" alt="" />' : '') +
    '<p class="excerpt">' + escapeHtml(excerptAr) + '</p>' +
    '</body></html>';
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  window.open(URL.createObjectURL(blob), '_blank');
}

// ═════════════════════════════════════════════════════════════
// SEO analysis helpers (simple scoring)
// ═════════════════════════════════════════════════════════════
function analyzeSEO(titleAr, descAr, slug) {
  const checks = [];
  if (titleAr.length >= 30 && titleAr.length <= 65) checks.push(['good', '✓ طول العنوان مناسب (' + titleAr.length + ')']);
  else checks.push([titleAr.length < 30 ? 'warn' : 'bad', '⚠ العنوان (' + titleAr.length + ') — الأفضل 30-65 حرف']);
  if (descAr.length >= 120 && descAr.length <= 160) checks.push(['good', '✓ طول الوصف مناسب (' + descAr.length + ')']);
  else checks.push([descAr.length < 120 ? 'warn' : 'bad', '⚠ الوصف (' + descAr.length + ') — الأفضل 120-160']);
  if (slug && /^[a-z0-9-]+$/.test(slug)) checks.push(['good', '✓ Slug صحيح']);
  else if (slug) checks.push(['bad', '✗ Slug لازم يكون أحرف صغيرة وأرقام و-']);
  return checks;
}
function slugify(s) {
  return (s || '').toLowerCase()
    .replace(/[^\w\s؀-ۿ-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

// ═════════════════════════════════════════════════════════════
// AI Assistant — 10 actions powered by Groq + Tavily
// ═════════════════════════════════════════════════════════════

function useHeadline(idx) {
  const v = (window.__headlineVariants || [])[idx];
  if (v) {
    document.getElementById('f_titleAr').value = v;
    document.getElementById('ai-status').innerHTML = '';
  }
}

async function callAI(action, payload) {
  const r = await api('/api/admin/ai-assistant', { method: 'POST', body: JSON.stringify({ action, ...payload }) });
  if (!r.ok) throw new Error(r.data?.error || 'AI request failed');
  return r.data.data;
}

function showAIStatus(msg, type) {
  const el = document.getElementById('ai-status');
  if (!el) return;
  const color = type === 'error' ? 'var(--red)' : (type === 'success' ? 'var(--green)' : 'var(--gold)');
  el.innerHTML = '<div style="padding:8px 12px;background:rgba(255,255,255,0.05);border-radius:8px;color:' + color + ';font-size:12px;">' + msg + '</div>';
}

async function aiGenerateSEO() {
  const titleAr = (document.getElementById('f_titleAr') || {}).value || '';
  const excerptAr = (document.getElementById('f_excerptAr') || {}).value || '';
  if (!titleAr) { alert('اكتب العنوان أولاً'); return; }
  showAIStatus('🤖 جاري توليد SEO تلقائياً...', 'info');
  try {
    const d = await callAI('generate-seo', { titleAr, excerptAr });
    if (d.seoTitle) document.getElementById('f_seoTitle').value = d.seoTitle;
    if (d.metaDescription) document.getElementById('f_metaDescription').value = d.metaDescription;
    if (d.slug) document.getElementById('f_slug').value = d.slug;
    if (d.keywords) document.getElementById('f_metaKeywords').value = d.keywords;
    updateSEOScore();
    showAIStatus('✅ تم توليد SEO بنجاح', 'success');
  } catch (e) { showAIStatus('❌ ' + e.message, 'error'); }
}

async function aiTranslate() {
  const titleAr = (document.getElementById('f_titleAr') || {}).value || '';
  const excerptAr = (document.getElementById('f_excerptAr') || {}).value || '';
  if (!titleAr) { alert('اكتب العنوان العربي أولاً'); return; }
  showAIStatus('🌐 جاري الترجمة...', 'info');
  try {
    const d = await callAI('translate', { titleAr, excerptAr });
    if (d.titleEn) document.getElementById('f_titleEn').value = d.titleEn;
    if (d.excerptEn) document.getElementById('f_excerptEn').value = d.excerptEn;
    showAIStatus('✅ تمت الترجمة', 'success');
  } catch (e) { showAIStatus('❌ ' + e.message, 'error'); }
}

async function aiSuggestHeadlines() {
  const titleAr = (document.getElementById('f_titleAr') || {}).value || '';
  const excerptAr = (document.getElementById('f_excerptAr') || {}).value || '';
  if (!excerptAr) { alert('اكتب الملخص أولاً'); return; }
  showAIStatus('💡 جاري اقتراح 5 عناوين بديلة...', 'info');
  try {
    const d = await callAI('headline-variants', { titleAr, excerptAr });
    const variants = (d.variants || []);
    window.__headlineVariants = variants;
    const html = '<div style="background:var(--card-2);padding:12px;border-radius:10px;margin-top:8px;"><div style="font-size:11px;color:var(--gold);margin-bottom:8px;font-weight:700;">اقتراحات الـ AI — اضغط لاستخدام:</div>' +
      variants.map((v, i) => '<div onclick="useHeadline(' + i + ')" style="padding:8px 10px;margin:4px 0;background:rgba(255,255,255,0.04);border-radius:6px;cursor:pointer;font-size:13px;border:1px solid transparent;"><span style="color:var(--gold);font-weight:700;margin-inline-end:6px;">' + (i + 1) + '.</span>' + escapeHtml(v) + '</div>').join('') +
      '</div>';
    document.getElementById('ai-status').innerHTML = html;
  } catch (e) { showAIStatus('❌ ' + e.message, 'error'); }
}

async function aiSuggestTags() {
  const titleAr = (document.getElementById('f_titleAr') || {}).value || '';
  const excerptAr = (document.getElementById('f_excerptAr') || {}).value || '';
  if (!titleAr) { alert('اكتب العنوان أولاً'); return; }
  showAIStatus('🏷️ جاري اقتراح التصنيف والـ tags...', 'info');
  try {
    const d = await callAI('suggest-tags', { titleAr, excerptAr });
    if (d.category) {
      const sel = document.getElementById('f_category');
      if (sel) sel.value = d.category;
    }
    const html = '<div style="background:var(--card-2);padding:12px;border-radius:10px;margin-top:8px;font-size:12px;">' +
      '<div><b>التصنيف المقترح:</b> ' + (d.category || '—') + '</div>' +
      '<div style="margin-top:6px;"><b>Tags:</b> ' + ((d.tags || []).map(t => '<span class="pill" style="margin-inline-end:4px;">' + escapeHtml(t) + '</span>').join('')) + '</div>' +
      '<div style="margin-top:6px;"><b>شركات مذكورة:</b> ' + ((d.companies || []).join('، ') || '—') + '</div>' +
      '<div style="margin-top:6px;"><b>أشخاص مذكورين:</b> ' + ((d.people || []).join('، ') || '—') + '</div>' +
      '</div>';
    document.getElementById('ai-status').innerHTML = html;
  } catch (e) { showAIStatus('❌ ' + e.message, 'error'); }
}

async function aiSentiment() {
  const titleAr = (document.getElementById('f_titleAr') || {}).value || '';
  const excerptAr = (document.getElementById('f_excerptAr') || {}).value || '';
  if (!titleAr) { alert('اكتب الخبر أولاً'); return; }
  showAIStatus('🎭 جاري تحليل المشاعر...', 'info');
  try {
    const d = await callAI('sentiment', { text: titleAr + '. ' + excerptAr });
    const emoji = { positive: '🟢 إيجابي', negative: '🔴 سلبي', neutral: '🟡 محايد' };
    document.getElementById('ai-status').innerHTML = '<div style="background:var(--card-2);padding:12px;border-radius:10px;font-size:13px;"><b>' + (emoji[d.sentiment] || d.sentiment) + '</b> · ثقة ' + Math.round((d.confidence || 0) * 100) + '%<br><span style="color:var(--text-2);font-size:12px;">' + escapeHtml(d.reason || '') + '</span></div>';
  } catch (e) { showAIStatus('❌ ' + e.message, 'error'); }
}

async function aiSpellcheck() {
  const excerptAr = (document.getElementById('f_excerptAr') || {}).value || '';
  if (!excerptAr) { alert('اكتب الملخص أولاً'); return; }
  showAIStatus('✓ جاري المراجعة الإملائية...', 'info');
  try {
    const d = await callAI('spellcheck', { text: excerptAr, lang: 'ar' });
    if (d.corrected && confirm('🔍 وجدت أخطاء/تحسينات:\n\n' + (d.changes || []).join('\n') + '\n\nاستبدل النص؟')) {
      document.getElementById('f_excerptAr').value = d.corrected;
    }
    showAIStatus('✅ تمت المراجعة (' + (d.changes || []).length + ' تعديل)', 'success');
  } catch (e) { showAIStatus('❌ ' + e.message, 'error'); }
}

async function aiFromUrl() {
  const url = prompt('الصق رابط الخبر من Reuters/Bloomberg/CNBC وسأكتبه بالعربي:');
  if (!url) return;
  showAIStatus('🔗 جاري قراءة الرابط وكتابة الخبر...', 'info');
  try {
    const d = await callAI('from-url', { url });
    if (d.titleAr) document.getElementById('f_titleAr').value = d.titleAr;
    if (d.titleEn) document.getElementById('f_titleEn').value = d.titleEn;
    if (d.excerptAr) document.getElementById('f_excerptAr').value = d.excerptAr;
    if (d.excerptEn) document.getElementById('f_excerptEn').value = d.excerptEn;
    if (d.category) document.getElementById('f_category').value = d.category;
    showAIStatus('✅ تم توليد الخبر من الرابط', 'success');
  } catch (e) { showAIStatus('❌ ' + e.message, 'error'); }
}

async function aiTopicIdeas() {
  showAIStatus('💭 جاري جلب أفكار موضوعات اليوم...', 'info');
  try {
    const d = await callAI('topic-ideas', {});
    const html = '<div style="background:var(--card-2);padding:12px;border-radius:10px;font-size:12px;"><div style="font-weight:700;color:var(--gold);margin-bottom:8px;">💡 أفكار موضوعات اليوم:</div>' +
      (d.topics || []).map((t, i) => '<div style="padding:8px;border-bottom:1px solid var(--border);"><div><span style="color:var(--gold);font-weight:700;">' + (i + 1) + '.</span> ' + escapeHtml(t.title || '') + '</div><div style="color:var(--text-2);font-size:11px;margin-top:4px;">' + escapeHtml(t.angle || '') + (t.url ? ' · <a href="' + t.url + '" target="_blank" style="color:var(--gold);">المصدر</a>' : '') + '</div></div>').join('') +
      '</div>';
    document.getElementById('ai-status').innerHTML = html;
  } catch (e) { showAIStatus('❌ ' + e.message, 'error'); }
}

async function aiSummarize() {
  const body = prompt('الصق النص الكامل للمقالة وسأطلع لك ملخص:');
  if (!body) return;
  showAIStatus('📝 جاري التلخيص...', 'info');
  try {
    const d = await callAI('summarize', { body });
    if (d.excerpt) {
      document.getElementById('f_excerptAr').value = d.excerpt;
      showAIStatus('✅ تم التلخيص', 'success');
    }
  } catch (e) { showAIStatus('❌ ' + e.message, 'error'); }
}

async function aiSocialPosts() {
  const titleAr = (document.getElementById('f_titleAr') || {}).value || '';
  const excerptAr = (document.getElementById('f_excerptAr') || {}).value || '';
  if (!titleAr) { alert('اكتب الخبر أولاً'); return; }
  showAIStatus('📱 جاري توليد بوستات السوشيال ميديا...', 'info');
  try {
    const d = await callAI('social-posts', { titleAr, excerptAr });
    const html = '<div style="background:var(--card-2);padding:12px;border-radius:10px;font-size:12px;">' +
      '<div style="margin-bottom:10px;"><b>𝕏 Twitter:</b><br><div style="background:rgba(0,0,0,0.2);padding:8px;border-radius:6px;margin-top:4px;cursor:pointer;" onclick="navigator.clipboard.writeText(this.textContent)">' + escapeHtml(d.twitter || '') + '</div></div>' +
      '<div style="margin-bottom:10px;"><b>💼 LinkedIn:</b><br><div style="background:rgba(0,0,0,0.2);padding:8px;border-radius:6px;margin-top:4px;cursor:pointer;" onclick="navigator.clipboard.writeText(this.textContent)">' + escapeHtml(d.linkedin || '') + '</div></div>' +
      '<div style="margin-bottom:10px;"><b>📸 Instagram:</b><br><div style="background:rgba(0,0,0,0.2);padding:8px;border-radius:6px;margin-top:4px;cursor:pointer;" onclick="navigator.clipboard.writeText(this.textContent)">' + escapeHtml(d.instagram || '') + '</div></div>' +
      '<div><b>💬 WhatsApp:</b><br><div style="background:rgba(0,0,0,0.2);padding:8px;border-radius:6px;margin-top:4px;cursor:pointer;" onclick="navigator.clipboard.writeText(this.textContent)">' + escapeHtml(d.whatsapp || '') + '</div></div>' +
      '<div style="margin-top:8px;font-size:10px;color:var(--text-3);">اضغط على أي بوست للنسخ</div>' +
      '</div>';
    document.getElementById('ai-status').innerHTML = html;
  } catch (e) { showAIStatus('❌ ' + e.message, 'error'); }
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
  const newBtn = document.querySelector('.actions button.btn-primary');
  newBtn.style.display = '';
  newBtn.setAttribute('onclick', 'openCreateUserModal()');
  document.getElementById('create-label').textContent = 'مستخدم جديد';
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

function openCreateUserModal() {
  const modal = document.getElementById('item-modal');
  document.getElementById('modal-title').textContent = '👤 مستخدم جديد';
  document.getElementById('modal-msg').innerHTML = '';
  document.getElementById('form-fields').innerHTML =
    '<div class="field field-full"><label>الاسم الكامل *</label><input id="nu-name" type="text" placeholder="مثلاً: أحمد محمد" /></div>' +
    '<div class="field"><label>البريد الإلكتروني *</label><input id="nu-email" type="email" placeholder="editor@cairobusiness.net" dir="ltr" /></div>' +
    '<div class="field"><label>كلمة السر * (6 أحرف على الأقل)</label><input id="nu-password" type="text" placeholder="كلمة سر قوية" dir="ltr" /></div>' +
    '<div class="field"><label>الباقة/الدور *</label><select id="nu-role">' +
    '<option value="EDITOR" selected>EDITOR — محرر (أخبار + فعاليات + إلخ)</option>' +
    '<option value="ADMIN">ADMIN — مسؤول كامل</option>' +
    '<option value="PRO">PRO — مشترك مدفوع</option>' +
    '<option value="PREMIUM">PREMIUM — مشترك مميز</option>' +
    '<option value="FREE">FREE — مستخدم عادي</option>' +
    '</select></div>' +
    '<div class="field"><label>اللغة المفضلة</label><select id="nu-lang"><option value="ar" selected>العربية</option><option value="en">English</option></select></div>';
  const saveBtn = document.getElementById('save-btn');
  saveBtn.textContent = 'إنشاء المستخدم';
  saveBtn.setAttribute('onclick', 'createNewUser()');
  modal.classList.add('open');
}

async function createNewUser() {
  const name = document.getElementById('nu-name').value.trim();
  const email = document.getElementById('nu-email').value.trim();
  const password = document.getElementById('nu-password').value;
  const role = document.getElementById('nu-role').value;
  const lang = document.getElementById('nu-lang').value;
  const msg = document.getElementById('modal-msg');
  if (!name || !email || !password) {
    msg.innerHTML = '<div class="msg msg-error">كل الحقول مطلوبة</div>';
    return;
  }
  if (password.length < 6) {
    msg.innerHTML = '<div class="msg msg-error">كلمة السر لازم 6 أحرف على الأقل</div>';
    return;
  }
  const saveBtn = document.getElementById('save-btn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'جاري الإنشاء...';
  const r = await api('/api/admin/users', { method: 'POST', body: JSON.stringify({ name, email, password, role, lang }) });
  saveBtn.disabled = false;
  if (!r.ok) {
    msg.innerHTML = '<div class="msg msg-error">' + escapeHtml(r.data?.error || 'فشل الإنشاء') + '</div>';
    saveBtn.textContent = 'إنشاء المستخدم';
    return;
  }
  closeModal();
  // Restore save button for entity edits
  saveBtn.setAttribute('onclick', 'saveItem()');
  saveBtn.textContent = 'حفظ';
  alert('✅ تم إنشاء المستخدم: ' + email + '\nالدور: ' + role + '\nيقدر يدخل admin.html بإيميله/كلمة سره');
  await switchToUsers();
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
  let items = r.data.data || [];
  if (typeof ent.filterFn === 'function') {
    try { items = ent.filterFn(items) || []; } catch (e) { console.warn('filterFn failed', e); }
  }
  currentItems = items;
  renderStats();
  renderList();
  /* Render section-level links if entity exposes them */
  renderEntityLinks();
}

function renderEntityLinks() {
  const ent = currentEntity();
  if (!ent) return;
  let host = document.getElementById('entity-links');
  if (!host) {
    const stats = document.getElementById('stats-section');
    if (!stats) return;
    host = document.createElement('div');
    host.id = 'entity-links';
    host.style.cssText = 'margin:14px 0;display:flex;gap:10px;flex-wrap:wrap;align-items:center;';
    stats.parentElement.insertBefore(host, stats.nextSibling);
  }
  host.innerHTML = '';
  if (ent.sectionLink) {
    host.innerHTML += '<span style="font-size:12px;opacity:.7">رابط السكشن الكامل:</span>' +
      '<input readonly value="' + ent.sectionLink + '" onclick="this.select()" style="font-size:12px;padding:6px 10px;border:1px solid var(--border,#333);background:transparent;color:inherit;min-width:280px;border-radius:6px" />' +
      '<button class="btn btn-ghost btn-sm" onclick="navigator.clipboard.writeText(\'' + ent.sectionLink + '\').then(()=>alert(\'تم نسخ الرابط ✓\'))">📋 نسخ</button>' +
      '<a href="' + ent.sectionLink + '" target="_blank" class="btn btn-ghost btn-sm">🔗 افتح في تبويبة جديدة</a>';
  }
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
    const linkBtn = (typeof ent.publicLink === 'function') ?
      '<button class="btn btn-ghost btn-sm" onclick="copyEntityLink(\'' + item.id + '\')" title="نسخ رابط مباشر">🔗 رابط</button>' : '';
    return '<div class="item-row">' + thumb +
      '<div><div class="item-meta">' + badges + (metaItems.length ? '<span>•</span>' : '') + metaHtml + '</div>' +
      '<div class="item-title">' + escapeHtml(title) + '</div>' +
      (excerpt ? '<div class="item-excerpt">' + escapeHtml(excerpt) + '</div>' : '') +
      '</div>' +
      '<div class="item-actions">' +
      linkBtn +
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
  const initial = (ent && typeof ent.defaults === 'object') ? Object.assign({}, ent.defaults) : {};
  renderForm(initial);
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

function copyEntityLink(id) {
  const ent = currentEntity();
  if (!ent || typeof ent.publicLink !== 'function') return;
  const url = ent.publicLink(id);
  if (!url) return;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => alert('تم نسخ الرابط ✓\n' + url));
    } else {
      window.prompt('انسخ الرابط:', url);
    }
  } catch (e) { window.prompt('انسخ الرابط:', url); }
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
  item = item || {};
  const ent = currentEntity();
  const grid = document.getElementById('form-fields');
  let html = ent.fields.map(f => {
    const v = item[f.id];
    const full = f.full ? 'field-full' : '';
    const dir = f.dir ? ' dir="' + f.dir + '"' : '';
    let input = '';
    const defaultVal = (typeof f.default === 'function' ? f.default() : f.default) || '';
    if (f.type === 'textarea') input = '<textarea id="f_' + f.id + '"' + dir + '>' + escapeHtml(v != null ? v : defaultVal) + '</textarea>';
    else if (f.type === 'select') input = '<select id="f_' + f.id + '">' + (f.options || []).map(o => '<option value="' + o[0] + '"' + (v === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select>';
    else if (f.type === 'checkbox') input = '<div class="checkbox-row"><input id="f_' + f.id + '" type="checkbox"' + (v ? ' checked' : '') + ' /><label for="f_' + f.id + '">' + f.label + '</label></div>';
    else input = '<input id="f_' + f.id + '" type="' + f.type + '"' + dir + ' value="' + escapeHtml(v != null ? v : defaultVal) + '" />';
    if (f.type === 'checkbox') return '<div class="field ' + full + '">' + input + '</div>';
    return '<div class="field ' + full + '"><label>' + f.label + '</label>' + input + '</div>';
  }).join('');

  if (ent.key === 'news') {
    // AI Assistant toolbar
    html = '<div class="field field-full" style="background:linear-gradient(135deg,rgba(212,175,55,0.08),rgba(212,175,55,0.02));border:1px solid rgba(212,175,55,0.3);border-radius:12px;padding:12px;margin-bottom:8px;">' +
      '<div style="font-size:11px;font-weight:700;color:var(--gold);margin-bottom:8px;letter-spacing:0.1em;">🤖 مساعد كايرو AI — 10 أدوات</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:6px;">' +
      '<button type="button" class="btn btn-ghost btn-sm" onclick="aiGenerateSEO()">🔍 SEO تلقائي</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" onclick="aiTranslate()">🌐 ترجم</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" onclick="aiSummarize()">📝 ولّد ملخص</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" onclick="aiSuggestHeadlines()">💡 5 عناوين</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" onclick="aiSpellcheck()">✓ تصحيح</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" onclick="aiSentiment()">🎭 مشاعر</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" onclick="aiSuggestTags()">🏷️ tags</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" onclick="aiFromUrl()">🔗 من URL</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" onclick="aiTopicIdeas()">💭 أفكار</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" onclick="aiSocialPosts()">📱 سوشيال</button>' +
      '</div><div id="ai-status" style="margin-top:8px;"></div></div>' + html;
    // SEO collapsible
    html += '<details class="seo-collapse" style="grid-column:1/-1;"><summary>🔍 أدوات SEO لمحركات البحث <span id="seo-score-chip"></span></summary><div class="form-grid">' +
      '<div class="field field-full"><label>SEO Title</label><input id="f_seoTitle" type="text" value="' + escapeHtml(item.seoTitle || item.titleAr || '') + '" oninput="updateSEOScore()" /></div>' +
      '<div class="field field-full"><label>Meta Description</label><textarea id="f_metaDescription" oninput="updateSEOScore()">' + escapeHtml(item.metaDescription || item.excerptAr || '') + '</textarea></div>' +
      '<div class="field"><label>URL Slug</label><input id="f_slug" type="text" dir="ltr" value="' + escapeHtml(item.slug || '') + '" oninput="updateSEOScore()" /></div>' +
      '<div class="field field-full"><label>OG Image URL</label><input id="f_ogImage" type="url" dir="ltr" value="' + escapeHtml(item.ogImage || item.imageUrl || '') + '" /></div>' +
      '<div class="field field-full"><label>Meta Keywords</label><input id="f_metaKeywords" type="text" value="' + escapeHtml(item.metaKeywords || '') + '" /></div>' +
      '<div class="field field-full" id="seo-analysis" style="font-size:12px;"></div>' +
      '</div></details>';
  }

  grid.innerHTML = html;
  if (ent.key === 'news') setTimeout(updateSEOScore, 100);
  // Add Preview button
  setTimeout(() => {
    const footer = document.querySelector('.modal-footer');
    if (footer && ent.key === 'news' && !document.getElementById('preview-btn')) {
      const btn = document.createElement('button');
      btn.id = 'preview-btn'; btn.className = 'btn btn-ghost'; btn.type = 'button';
      btn.textContent = '👁️ معاينة مباشرة';
      btn.onclick = previewNews;
      footer.insertBefore(btn, footer.firstChild);
    }
  }, 50);
}

function updateSEOScore() {
  const title = (document.getElementById('f_seoTitle') || {}).value || '';
  const desc = (document.getElementById('f_metaDescription') || {}).value || '';
  const slug = (document.getElementById('f_slug') || {}).value || '';
  const checks = analyzeSEO(title, desc, slug);
  const goodCount = checks.filter(c => c[0] === 'good').length;
  const score = Math.round((goodCount / checks.length) * 100);
  const cls = score >= 80 ? 'good' : (score >= 50 ? 'warn' : 'bad');
  const chip = document.getElementById('seo-score-chip');
  if (chip) chip.innerHTML = '<span class="seo-score ' + cls + '">' + score + '/100</span>';
  const analysis = document.getElementById('seo-analysis');
  if (analysis) {
    analysis.innerHTML = checks.map(c => '<div style="margin:4px 0;padding:6px 10px;border-radius:6px;background:rgba(255,255,255,0.03);">' + c[1] + '</div>').join('');
  }
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
  if (ent.key === 'news') {
    ['seoTitle', 'metaDescription', 'slug', 'ogImage', 'metaKeywords'].forEach(k => {
      const el = document.getElementById('f_' + k);
      if (el && el.value.trim()) payload[k] = el.value.trim();
    });
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
  } catch (e) { msg.innerHTML = '<div class="msg msg-error">خطأ في الاتصال</div>'; }
  finally { btn.disabled = false; btn.textContent = 'حفظ'; }
}

async function switchToBriefing() {
  currentEntityKey = '__briefing__';
  renderTabs();
  document.getElementById('page-title').textContent = '🌅 النشرة الصباحية';
  document.getElementById('search-input').style.display = 'none';
  document.querySelector('.actions button.btn-primary').style.display = 'none';
  document.getElementById('stats-section').innerHTML = '';
  await loadBriefingUI();
}

async function loadBriefingUI() {
  const container = document.getElementById('list-container');
  container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  const r = await api('/api/admin/briefing');
  const briefing = (r.ok && r.data && r.data.data) || null;
  const items = (briefing && briefing.items) || [{num:1,title_ar:'',title_en:'',sector_ar:'',sector_en:'',impact:'neutral'}];
  const rates = (briefing && briefing.rates) || [];
  const deal = (briefing && briefing.dealOfDay) || {};
  const dateStr = briefing && briefing.date ? new Date(briefing.date).toISOString().slice(0,10) : new Date().toISOString().slice(0,10);

  let html = '';

  /* === Auto-generate banner === */
  html += '<div style="background:linear-gradient(135deg,rgba(244,208,63,0.12),rgba(212,175,55,0.06));border:1px solid rgba(244,208,63,0.4);border-radius:14px;padding:18px 20px;margin-bottom:22px;">';
  html += '  <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">';
  html += '    <div style="flex:1;min-width:240px;">';
  html += '      <div style="font-size:16px;font-weight:700;color:#F4D03F;margin-bottom:4px;">🤖 توليد بريفينج جديد بالذكاء الاصطناعي</div>';
  html += '      <div style="font-size:13px;opacity:0.75;line-height:1.6;">يتم تلقائياً كل يوم الساعة 7 صباحاً. اضغط الزر لتشغيله الآن يدوياً — هيقرأ آخر أخبار + أسعار + فرص ويولّد بريفينج اليوم.</div>';
  html += '    </div>';
  html += '    <button class="btn btn-primary" id="bf-regen-btn" onclick="regenerateBriefingNow()" style="font-size:14px;padding:12px 22px;">🤖 ولّد الآن</button>';
  html += '  </div>';
  html += '  <div id="bf-regen-status" style="margin-top:12px;font-size:13px;line-height:1.6;display:none;"></div>';
  html += '</div>';

  /* === Items list (5 items in friendly inputs, not raw JSON) === */
  html += '<div class="field field-full" style="margin-bottom:18px;">';
  html += '  <label>📅 تاريخ النشرة</label>';
  html += '  <input id="bf-date" type="date" value="' + dateStr + '" style="max-width:200px;" />';
  html += '</div>';

  html += '<div style="margin-bottom:8px;font-weight:700;color:#F4D03F;font-size:14px;">📰 أهم 5 أحداث اليوم</div>';
  html += '<div id="bf-items-list" style="display:flex;flex-direction:column;gap:10px;margin-bottom:22px;">';
  for (let i = 0; i < 5; i++) {
    const it = items[i] || { num: i+1, title_ar: '', title_en: '', sector_ar: '', sector_en: '', impact: 'neutral' };
    html += '  <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border,rgba(255,255,255,0.1));border-radius:10px;padding:12px;">';
    html += '    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">';
    html += '      <div style="width:28px;height:28px;border-radius:50%;background:#F4D03F;color:#0A0E27;display:grid;place-items:center;font-weight:900;font-size:13px;">' + (i+1) + '</div>';
    html += '      <select data-bf-impact="' + i + '" style="font-size:12px;padding:5px 10px;background:rgba(255,255,255,0.05);border:1px solid var(--border,rgba(255,255,255,0.1));border-radius:6px;color:inherit;">';
    html += '        <option value="positive"' + (it.impact==='positive'?' selected':'') + '>📈 إيجابي</option>';
    html += '        <option value="negative"' + (it.impact==='negative'?' selected':'') + '>📉 سلبي</option>';
    html += '        <option value="neutral"' + (it.impact==='neutral'?' selected':'') + '>⚪ حيادي</option>';
    html += '      </select>';
    html += '      <input data-bf-sectorAr="' + i + '" type="text" placeholder="القطاع بالعربية" value="' + escapeAttr(it.sector_ar || '') + '" style="flex:1;font-size:12px;padding:5px 10px;background:rgba(255,255,255,0.05);border:1px solid var(--border,rgba(255,255,255,0.1));border-radius:6px;color:inherit;" />';
    html += '      <input data-bf-sectorEn="' + i + '" type="text" placeholder="Sector" dir="ltr" value="' + escapeAttr(it.sector_en || '') + '" style="flex:1;font-size:12px;padding:5px 10px;background:rgba(255,255,255,0.05);border:1px solid var(--border,rgba(255,255,255,0.1));border-radius:6px;color:inherit;" />';
    html += '    </div>';
    html += '    <input data-bf-titleAr="' + i + '" type="text" placeholder="العنوان بالعربية" value="' + escapeAttr(it.title_ar || '') + '" style="width:100%;padding:8px 12px;background:rgba(255,255,255,0.05);border:1px solid var(--border,rgba(255,255,255,0.1));border-radius:6px;color:inherit;margin-bottom:6px;" />';
    html += '    <input data-bf-titleEn="' + i + '" type="text" placeholder="English title" dir="ltr" value="' + escapeAttr(it.title_en || '') + '" style="width:100%;padding:8px 12px;background:rgba(255,255,255,0.05);border:1px solid var(--border,rgba(255,255,255,0.1));border-radius:6px;color:inherit;" />';
    html += '  </div>';
  }
  html += '</div>';

  /* === Deal of the day === */
  html += '<div style="margin-bottom:8px;font-weight:700;color:#F4D03F;font-size:14px;">💎 صفقة اليوم</div>';
  html += '<div style="background:rgba(255,255,255,0.03);border:1px solid var(--border,rgba(255,255,255,0.1));border-radius:10px;padding:14px;margin-bottom:22px;display:grid;grid-template-columns:1fr 1fr 120px 120px;gap:10px;">';
  html += '  <input id="bf-deal-nameAr" type="text" placeholder="اسم الصفقة بالعربية" value="' + escapeAttr(deal.name_ar || '') + '" style="padding:8px 12px;background:rgba(255,255,255,0.05);border:1px solid var(--border,rgba(255,255,255,0.1));border-radius:6px;color:inherit;" />';
  html += '  <input id="bf-deal-nameEn" type="text" placeholder="Deal name in English" dir="ltr" value="' + escapeAttr(deal.name_en || '') + '" style="padding:8px 12px;background:rgba(255,255,255,0.05);border:1px solid var(--border,rgba(255,255,255,0.1));border-radius:6px;color:inherit;" />';
  html += '  <input id="bf-deal-value" type="text" placeholder="$3 مليار" value="' + escapeAttr(deal.value || '') + '" style="padding:8px 12px;background:rgba(255,255,255,0.05);border:1px solid var(--border,rgba(255,255,255,0.1));border-radius:6px;color:inherit;text-align:center;" />';
  html += '  <input id="bf-deal-score" type="number" min="0" max="100" placeholder="85" value="' + (deal.score || 0) + '" style="padding:8px 12px;background:rgba(255,255,255,0.05);border:1px solid var(--border,rgba(255,255,255,0.1));border-radius:6px;color:inherit;text-align:center;" />';
  html += '</div>';

  /* === Advanced: raw JSON for rates (kept as textarea since rates come from scrapers) === */
  html += '<details style="margin-bottom:18px;">';
  html += '  <summary style="cursor:pointer;opacity:0.7;font-size:13px;">⚙️ الأسعار (JSON متقدم — تتحدث تلقائياً من الـ scrapers)</summary>';
  html += '  <textarea id="bf-rates" style="width:100%;min-height:140px;font-family:monospace;font-size:11px;margin-top:8px;background:rgba(255,255,255,0.05);border:1px solid var(--border,rgba(255,255,255,0.1));border-radius:6px;padding:10px;color:inherit;">' + escapeAttr(JSON.stringify(rates, null, 2)) + '</textarea>';
  html += '</details>';

  html += '<div style="display:flex;gap:10px;justify-content:flex-end;">';
  html += '  <button class="btn btn-ghost" onclick="loadBriefingUI()">🔄 تحديث الصفحة</button>';
  html += '  <button class="btn btn-primary" onclick="saveBriefing()" style="font-size:14px;padding:10px 24px;">💾 حفظ التغييرات</button>';
  html += '</div>';

  container.innerHTML = html;
}

function escapeAttr(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function regenerateBriefingNow() {
  const btn = document.getElementById('bf-regen-btn');
  const status = document.getElementById('bf-regen-status');
  if (!btn || !status) return;
  btn.disabled = true;
  btn.style.opacity = '0.6';
  const original = btn.textContent;
  btn.textContent = '⏳ جاري التوليد...';
  status.style.display = 'block';
  status.innerHTML = '<span style="color:#F4D03F">⏳ جاري الاتصال بالـ AI وقراءة آخر البيانات...</span>';
  try {
    const res = await fetch('https://cairo-business-backend.vercel.app/api/cron/generate-briefing', { cache: 'no-store' });
    const j = await res.json();
    if (!j.success) {
      status.innerHTML = '<span style="color:#ef4444">❌ فشل التوليد: ' + (j.error || 'unknown') + '</span>';
      return;
    }
    const action = j.meta?.action || 'updated';
    const ic = (j.data?.items || []).length;
    const rc = (j.data?.rates || []).length;
    status.innerHTML = '<span style="color:#16a34a">✓ تم التوليد بنجاح — ' + action + ' بريفينج بـ ' + ic + ' عناوين و' + rc + ' سعر</span><br>' +
      '<span style="opacity:0.7;font-size:12px;">جاري تحديث الصفحة بالمحتوى الجديد...</span>';
    /* Reload the form to show new content */
    setTimeout(() => { loadBriefingUI(); }, 1200);
  } catch (e) {
    status.innerHTML = '<span style="color:#ef4444">❌ خطأ في الاتصال: ' + (e.message || e) + '</span>';
  } finally {
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.textContent = original;
  }
}

async function saveBriefing() {
  try {
    const date = document.getElementById('bf-date').value;
    /* Collect 5 items from the friendly inputs */
    const items = [];
    for (let i = 0; i < 5; i++) {
      const tAr = (document.querySelector('[data-bf-titleAr="' + i + '"]')?.value || '').trim();
      const tEn = (document.querySelector('[data-bf-titleEn="' + i + '"]')?.value || '').trim();
      const sAr = (document.querySelector('[data-bf-sectorAr="' + i + '"]')?.value || '').trim();
      const sEn = (document.querySelector('[data-bf-sectorEn="' + i + '"]')?.value || '').trim();
      const imp = document.querySelector('[data-bf-impact="' + i + '"]')?.value || 'neutral';
      items.push({ num: i+1, title_ar: tAr, title_en: tEn, sector_ar: sAr, sector_en: sEn, impact: imp });
    }
    const rates = JSON.parse(document.getElementById('bf-rates').value || '[]');
    const dealOfDay = {
      name_ar: (document.getElementById('bf-deal-nameAr')?.value || '').trim(),
      name_en: (document.getElementById('bf-deal-nameEn')?.value || '').trim(),
      value: (document.getElementById('bf-deal-value')?.value || '').trim(),
      score: Number(document.getElementById('bf-deal-score')?.value || 0)
    };
    const r = await api('/api/admin/briefing', { method: 'POST', body: JSON.stringify({ date, items, rates, dealOfDay }) });
    if (!r.ok) { alert('فشل: ' + (r.data?.error || 'خطأ')); return; }
    alert('✓ تم حفظ النشرة الصباحية');
  } catch (e) { alert('خطأ: ' + e.message); }
}

// ═════════════════════════════════════════════════════════════
// CBI Indices tab — manual edit + AI refresh
// ═════════════════════════════════════════════════════════════
async function switchToCBI() {
  currentEntityKey = '__cbi__';
  renderTabs();
  document.getElementById('page-title').textContent = '📊 مؤشرات كايرو بيزنس';
  document.getElementById('search-input').style.display = 'none';
  const addBtn = document.querySelector('.actions button.btn-primary');
  if (addBtn) addBtn.style.display = 'none';
  document.getElementById('stats-section').innerHTML = '';
  await loadCBIUI();
}

async function loadCBIUI() {
  const container = document.getElementById('list-container');
  container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  const r = await api('/api/admin/cbi');
  if (!r.ok) {
    container.innerHTML = '<div class="msg msg-error">فشل التحميل: ' + escapeHtml(r.data?.error || 'unknown') + '<br><br>تأكد أنك شغلت الـ migration الأول: <code>/api/admin/migrate-cbi</code></div>';
    return;
  }
  const items = (r.data && r.data.items) || [];

  let html = '';
  /* Banner with refresh button */
  html += '<div style="background:linear-gradient(135deg,rgba(244,208,63,0.12),rgba(212,175,55,0.06));border:1px solid rgba(244,208,63,0.4);border-radius:14px;padding:18px 20px;margin-bottom:22px;">';
  html += '  <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">';
  html += '    <div style="flex:1;min-width:240px;">';
  html += '      <div style="font-size:16px;font-weight:700;color:#F4D03F;margin-bottom:4px;">🤖 تحديث المؤشرات بالذكاء الاصطناعي</div>';
  html += '      <div style="font-size:13px;opacity:0.75;line-height:1.6;">يتم تلقائياً <strong>مرة كل شهر</strong> (أول كل شهر، 6 صباحاً). اضغط الزر لتشغيله يدوياً في أي وقت — هيقرأ آخر أخبار MENA من Tavily ويستخدم Groq AI لتحديث قيمة كل مؤشر.</div>';
  html += '    </div>';
  html += '    <button class="btn btn-primary" id="cbi-refresh-btn" onclick="refreshCBINow()" style="font-size:14px;padding:12px 22px;">🤖 حدّث الآن</button>';
  html += '  </div>';
  html += '  <div id="cbi-refresh-status" style="margin-top:12px;font-size:13px;line-height:1.6;display:none;"></div>';
  html += '</div>';

  /* Indices table */
  if (!items.length) {
    html += '<div class="empty">⚠️ لا توجد مؤشرات. شغّل الـ migration الأول: <a href="https://cairo-business-backend.vercel.app/api/admin/migrate-cbi" target="_blank">/api/admin/migrate-cbi</a></div>';
  } else {
    html += '<div style="display:flex;flex-direction:column;gap:12px;">';
    for (const it of items) {
      const lastRefresh = it.lastRefreshAt ? new Date(it.lastRefreshAt).toLocaleString('ar-EG') : 'لم يُحدّث بعد';
      const upClass = (Number(it.change) >= 0) ? 'color:#22c55e' : 'color:#ef4444';
      html += '<div style="background:rgba(255,255,255,0.03);border:1px solid var(--border,rgba(255,255,255,0.1));border-radius:12px;padding:14px 16px;">';
      html += '  <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:10px;">';
      html += '    <div style="width:34px;height:34px;border-radius:50%;background:#F4D03F;color:#0A0E27;display:grid;place-items:center;font-weight:900;font-size:14px;">' + (it.sortOrder || '?') + '</div>';
      html += '    <div style="flex:1;min-width:200px;">';
      html += '      <div style="font-weight:700;font-size:15px;">' + escapeHtml(it.nameAr || it.name) + '</div>';
      html += '      <div style="font-size:11px;opacity:0.55;direction:ltr;text-align:start;">' + escapeHtml(it.name) + ' · ' + (it.category || '—') + ' · ' + (it.period || 'monthly') + '</div>';
      html += '    </div>';
      html += '    <div style="font-size:11px;opacity:0.55;">آخر تحديث AI: ' + escapeHtml(lastRefresh) + '</div>';
      html += '  </div>';
      html += '  <div style="display:grid;grid-template-columns:140px 100px 1fr 120px;gap:8px;align-items:end;">';
      html += '    <div><label style="font-size:11px;opacity:0.6;">القيمة</label><input data-cbi-value="' + escapeAttr(it.name) + '" type="number" step="0.1" value="' + (it.value || 0) + '" style="width:100%;padding:8px 10px;background:rgba(255,255,255,0.05);border:1px solid var(--border,rgba(255,255,255,0.1));border-radius:6px;color:inherit;" /></div>';
      html += '    <div><label style="font-size:11px;opacity:0.6;">% التغيير</label><input data-cbi-change="' + escapeAttr(it.name) + '" type="number" step="0.1" value="' + (it.change || 0) + '" style="width:100%;padding:8px 10px;' + upClass + ';background:rgba(255,255,255,0.05);border:1px solid var(--border,rgba(255,255,255,0.1));border-radius:6px;" /></div>';
      html += '    <div><label style="font-size:11px;opacity:0.6;">السبب (AI rationale)</label><input data-cbi-rationale="' + escapeAttr(it.name) + '" type="text" value="' + escapeAttr(it.aiRationale || '') + '" placeholder="مثلاً: ارتفاع بسبب أرباح أرامكو" style="width:100%;padding:8px 10px;background:rgba(255,255,255,0.05);border:1px solid var(--border,rgba(255,255,255,0.1));border-radius:6px;color:inherit;" /></div>';
      html += '    <button class="btn btn-primary" onclick="saveCBIRow(\'' + escapeAttr(it.name) + '\')" style="padding:8px 16px;font-size:13px;">💾 حفظ</button>';
      html += '  </div>';
      html += '</div>';
    }
    html += '</div>';
  }

  container.innerHTML = html;
}

async function refreshCBINow() {
  const btn = document.getElementById('cbi-refresh-btn');
  const status = document.getElementById('cbi-refresh-status');
  if (!btn || !status) return;
  btn.disabled = true;
  btn.style.opacity = '0.6';
  const original = btn.textContent;
  btn.textContent = '⏳ جاري التحديث...';
  status.style.display = 'block';
  status.innerHTML = '<span style="color:#F4D03F">⏳ Groq + Tavily شغالين على 7 مؤشرات (قد يستغرق ~30 ثانية)...</span>';
  try {
    /* Manual override — force=true bypasses the monthly interval guard */
    const res = await fetch('https://cairo-business-backend.vercel.app/api/cron/refresh-cbi?force=true', { cache: 'no-store' });
    const j = await res.json();
    if (!j.success) {
      status.innerHTML = '<span style="color:#ef4444">❌ فشل: ' + (j.error || 'unknown') + '</span>';
      return;
    }
    const updated = (j.updates || []).filter(u => u.status === 'updated' || u.status === 'computed').length;
    const failed = (j.updates || []).filter(u => u.status === 'ai-failed' || u.status === 'db-error').length;
    status.innerHTML = '<span style="color:#16a34a">✓ تم تحديث ' + updated + ' مؤشر' + (failed ? ' · فشل ' + failed : '') + '</span><br>' +
      '<span style="opacity:0.7;font-size:12px;">جاري إعادة تحميل الصفحة...</span>';
    setTimeout(() => { loadCBIUI(); }, 1200);
  } catch (e) {
    status.innerHTML = '<span style="color:#ef4444">❌ خطأ في الاتصال: ' + (e.message || e) + '</span>';
  } finally {
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.textContent = original;
  }
}

async function saveCBIRow(slug) {
  const value = parseFloat(document.querySelector('[data-cbi-value="' + slug + '"]')?.value || '0');
  const change = parseFloat(document.querySelector('[data-cbi-change="' + slug + '"]')?.value || '0');
  const aiRationale = document.querySelector('[data-cbi-rationale="' + slug + '"]')?.value || '';
  const r = await api('/api/admin/cbi/' + encodeURIComponent(slug), { method: 'PUT', body: JSON.stringify({ value, change, aiRationale }) });
  if (r.ok) alert('تم الحفظ ✓');
  else alert('فشل الحفظ: ' + (r.data?.error || 'unknown'));
}

// ═════════════════════════════════════════════════════════════
// News Drafts tab — AI-generated drafts awaiting manual approval
// ═════════════════════════════════════════════════════════════
/* ═══════════════════════════════════════════════════════════════
 * News Drafts Editor — full manual review workflow
 * Two views: 'pending' (DRAFT) | 'published' (PUBLISHED).
 * Each draft is generated by AI with full body, lead, tags, and source URL.
 * Editor uses Quill for rich-text body editing.
 * ═══════════════════════════════════════════════════════════════ */

let draftsView = 'pending';    /* 'pending' | 'published' */
let draftsItems = [];          /* current visible list */
let quillEditor = null;        /* Quill instance for full-edit modal */

async function switchToDrafts() {
  currentEntityKey = '__drafts__';
  draftsView = 'pending';
  renderTabs();
  document.getElementById('page-title').textContent = '📝 مسودات الأخبار — في انتظار المراجعة';
  document.getElementById('search-input').style.display = 'none';
  const addBtn = document.querySelector('.actions button.btn-primary');
  if (addBtn) addBtn.style.display = 'none';
  document.getElementById('stats-section').innerHTML = '';
  await loadDraftsUI();
}

async function loadDraftsUI() {
  const container = document.getElementById('list-container');
  container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  const statusParam = draftsView === 'published' ? 'PUBLISHED' : 'DRAFT';
  const r = await api('/api/admin/news?status=' + statusParam + '&limit=100');
  if (!r.ok) {
    container.innerHTML = '<div class="msg msg-error">فشل التحميل: ' + escapeHtml(r.data?.error || 'unknown') +
      '<br><br>لو ده أول مرة، شغّل الـ migrations: ' +
      '<a href="https://cairo-business-backend.vercel.app/api/admin/migrate-news-status" target="_blank">migrate-news-status</a> ' +
      'و <a href="https://cairo-business-backend.vercel.app/api/admin/migrate-news-fields" target="_blank">migrate-news-fields</a></div>';
    return;
  }
  draftsItems = (r.data && r.data.data) || [];
  const counts = r.data?.meta?.counts || {};
  draftsCount = counts.DRAFT || 0;
  renderTabs();

  let html = '';

  /* ── View toggle: Pending Drafts / Approved ─────────────────── */
  html += '<div style="display:flex;gap:6px;margin-bottom:18px;border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:12px;">';
  html += '  <button onclick="switchDraftsView(\'pending\')" class="' + (draftsView==='pending'?'btn btn-primary':'btn btn-ghost') + '" style="padding:8px 18px;font-size:13px;">📝 في الانتظار <span style="opacity:0.7;font-size:11px;">(' + (counts.DRAFT||0) + ')</span></button>';
  html += '  <button onclick="switchDraftsView(\'published\')" class="' + (draftsView==='published'?'btn btn-primary':'btn btn-ghost') + '" style="padding:8px 18px;font-size:13px;">✅ المعتمدة <span style="opacity:0.7;font-size:11px;">(' + (counts.PUBLISHED||0) + ')</span></button>';
  html += '</div>';

  /* ── Generation panel (only for pending view) ────────────────── */
  if (draftsView === 'pending') {
    html += '<details open style="background:linear-gradient(135deg,rgba(244,208,63,0.10),rgba(212,175,55,0.04));border:1px solid rgba(244,208,63,0.35);border-radius:14px;padding:16px 20px;margin-bottom:22px;">';
    html += '  <summary style="cursor:pointer;font-size:15px;font-weight:700;color:#F4D03F;list-style:none;">🤖 توليد مسودات بالذكاء الاصطناعي ▾</summary>';
    html += '  <div style="margin-top:14px;font-size:13px;opacity:0.75;line-height:1.6;">يقرأ Tavily أخبار MENA الأخيرة وGroq يصيغها كمقال كامل (عنوان + مقدمة + جسم + وسوم). <strong>لن يُنشر أي خبر تلقائياً</strong>.</div>';
    html += '  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-top:14px;">';
    html += '    <div><label style="font-size:11px;opacity:0.7;display:block;margin-bottom:4px;">📂 المجالات</label>';
    html += '      <select id="gen-category" multiple size="4" style="width:100%;padding:6px 10px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:inherit;font-size:12px;">';
    const cats = [['business','أعمال'],['markets','أسواق'],['realestate','عقارات'],['energy','طاقة'],['technology','تكنولوجيا'],['trade','تجارة'],['finance','بنوك ومالية']];
    for (const [v,l] of cats) html += '<option value="' + v + '">' + l + '</option>';
    html += '      </select><div style="font-size:10px;opacity:0.5;margin-top:3px;">Ctrl+click لاختيار متعدد. فاضي = الكل.</div></div>';
    html += '    <div><label style="font-size:11px;opacity:0.7;display:block;margin-bottom:4px;">🌐 اللغة</label>';
    html += '      <select id="gen-language" style="width:100%;padding:8px 10px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:inherit;font-size:13px;">';
    html += '        <option value="ar_fusha">عربية فصحى (رسمي)</option>';
    html += '        <option value="ar_egy">مصرية عامية</option>';
    html += '        <option value="en">English</option>';
    html += '      </select></div>';
    html += '    <div><label style="font-size:11px;opacity:0.7;display:block;margin-bottom:4px;">🎨 درجة الإبداع</label>';
    html += '      <select id="gen-creativity" style="width:100%;padding:8px 10px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:inherit;font-size:13px;">';
    html += '        <option value="conservative">محافظ — التزام بالنص الأصلي</option>';
    html += '        <option value="balanced" selected>متوازن (مُوصى به)</option>';
    html += '        <option value="creative">إبداعي — صياغة جديدة</option>';
    html += '      </select></div>';
    html += '    <div><label style="font-size:11px;opacity:0.7;display:block;margin-bottom:4px;">🔢 عدد الأخبار</label>';
    html += '      <input id="gen-count" type="number" min="3" max="15" value="5" style="width:100%;padding:8px 10px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:inherit;font-size:13px;" />';
    html += '      <div style="font-size:10px;opacity:0.5;margin-top:3px;">يُنصح بـ 3-7 لتجنب الـ timeout.</div></div>';
    html += '  </div>';
    html += '  <div style="margin-top:12px;">';
    html += '    <label style="font-size:11px;opacity:0.7;display:block;margin-bottom:4px;">🚫 مواضيع/كلمات يجب تجنّبها</label>';
    html += '    <input id="gen-avoid" type="text" placeholder="مثلاً: سياسة داخلية، أسماء أشخاص محددة..." style="width:100%;padding:8px 10px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:inherit;font-size:13px;" />';
    html += '  </div>';
    html += '  <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:14px;">';
    html += '    <button class="btn btn-primary" id="drafts-gen-btn" onclick="generateDraftsNow()" style="font-size:14px;padding:11px 22px;">🤖 ولّد مسودات الآن</button>';
    html += '    <span style="font-size:12px;opacity:0.6;">يستغرق ~45-90 ثانية</span>';
    html += '  </div>';
    html += '  <div id="drafts-gen-status" style="margin-top:12px;font-size:13px;line-height:1.6;display:none;"></div>';
    html += '</details>';
  }

  /* ── List ─────────────────────────────────────────────────────── */
  const totalLabel = draftsView==='pending' ? (draftsItems.length + ' مسودة في انتظار المراجعة') : (draftsItems.length + ' خبر منشور');
  html += '<div style="margin-bottom:14px;font-weight:700;font-size:15px;">' + (draftsView==='pending'?'📝 ':'✅ ') + totalLabel + '</div>';

  if (!draftsItems.length) {
    html += '<div class="empty-state"><div class="icon">' + (draftsView==='pending'?'📝':'✅') + '</div><div class="title">' + (draftsView==='pending'?'لا توجد مسودات':'لا توجد أخبار منشورة بعد') + '</div></div>';
  } else {
    html += '<div style="display:flex;flex-direction:column;gap:14px;">';
    for (const it of draftsItems) html += renderDraftCard(it);
    html += '</div>';
  }

  container.innerHTML = html;
}

function renderDraftCard(it) {
  const dateStr = it.publishedAt ? new Date(it.publishedAt).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }) : '';
  let tags = [];
  try { tags = it.tags ? JSON.parse(it.tags) : []; } catch (_) { tags = []; }
  const lead = it.lead || it.excerptAr || '';
  const bodyPreview = (it.body || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 280);
  const thumb = it.imageUrl
    ? '<img src="' + escapeAttr(it.imageUrl) + '" style="width:160px;height:110px;object-fit:cover;border-radius:10px;flex-shrink:0;" onerror="this.style.display=\'none\'" />'
    : '<div style="width:160px;height:110px;background:rgba(255,255,255,0.05);border-radius:10px;display:grid;place-items:center;font-size:38px;flex-shrink:0;">📰</div>';
  const langBadge = ({ ar_fusha:'فصحى', ar_egy:'مصري', en:'English' })[it.language || 'ar_fusha'] || 'فصحى';
  const sourceLink = it.sourceUrl
    ? '<a href="' + escapeAttr(it.sourceUrl) + '" target="_blank" style="font-size:11px;color:#60a5fa;text-decoration:none;">🔗 المصدر الأصلي</a>'
    : '';

  let html = '<div style="background:rgba(255,255,255,0.03);border:1px solid var(--border,rgba(255,255,255,0.1));border-radius:14px;padding:16px;display:flex;gap:14px;align-items:flex-start;">';
  html += thumb;
  html += '<div style="flex:1;min-width:0;">';

  /* Meta row */
  html += '<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap;">';
  html += '<span style="display:inline-block;background:rgba(244,208,63,0.18);color:#F4D03F;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;">' + escapeHtml(it.category || 'business') + '</span>';
  html += '<span style="display:inline-block;background:rgba(99,102,241,0.18);color:#a5b4fc;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:600;">' + langBadge + '</span>';
  if (it.aiGenerated) html += '<span style="display:inline-block;background:rgba(34,197,94,0.18);color:#86efac;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:600;">🤖 AI</span>';
  html += '<span style="font-size:11px;opacity:0.6;">' + escapeHtml(dateStr) + '</span>';
  if (sourceLink) html += sourceLink;
  html += '</div>';

  /* Title + Lead */
  html += '<div style="font-weight:800;font-size:16px;line-height:1.4;margin-bottom:6px;">' + escapeHtml(it.titleAr || it.titleEn || '(بدون عنوان)') + '</div>';
  if (lead) html += '<div style="font-size:13px;color:rgba(255,255,255,0.85);line-height:1.65;margin-bottom:8px;font-style:italic;">' + escapeHtml(lead.slice(0, 200)) + (lead.length>200?'...':'') + '</div>';
  if (bodyPreview) html += '<div style="font-size:12px;opacity:0.6;line-height:1.6;max-height:42px;overflow:hidden;">' + escapeHtml(bodyPreview) + '...</div>';

  /* Tags */
  if (tags.length) {
    html += '<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:8px;">';
    for (const t of tags) html += '<span style="background:rgba(255,255,255,0.05);color:rgba(255,255,255,0.7);padding:2px 8px;border-radius:6px;font-size:10px;">#' + escapeHtml(t) + '</span>';
    html += '</div>';
  }

  /* Actions */
  html += '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">';
  if (draftsView === 'pending') {
    html += '<button class="btn btn-primary" onclick="publishDraft(\'' + escapeAttr(it.id) + '\')" style="padding:7px 14px;font-size:13px;background:#16a34a;border-color:#16a34a;">✅ موافقة ونشر</button>';
    html += '<button class="btn btn-ghost" onclick="openArticleEditor(\'' + escapeAttr(it.id) + '\')" style="padding:7px 14px;font-size:13px;">✏️ تعديل كامل</button>';
    html += '<button class="btn btn-ghost" onclick="regenerateDraft(\'' + escapeAttr(it.id) + '\')" style="padding:7px 14px;font-size:13px;color:#60a5fa;border-color:#60a5fa;">🔄 إعادة توليد</button>';
    html += '<button class="btn btn-ghost" onclick="rejectDraft(\'' + escapeAttr(it.id) + '\')" style="padding:7px 14px;font-size:13px;color:#ef4444;border-color:#ef4444;">🗑️ رفض</button>';
  } else {
    html += '<button class="btn btn-ghost" onclick="openArticleEditor(\'' + escapeAttr(it.id) + '\')" style="padding:7px 14px;font-size:13px;">✏️ تعديل</button>';
    html += '<a href="https://cairobusiness.net/news.html#' + escapeAttr(it.id) + '" target="_blank" class="btn btn-ghost" style="padding:7px 14px;font-size:13px;text-decoration:none;">🔗 عرض على الموقع</a>';
    html += '<button class="btn btn-ghost" onclick="rejectDraft(\'' + escapeAttr(it.id) + '\')" style="padding:7px 14px;font-size:13px;color:#ef4444;border-color:#ef4444;">🗑️ حذف</button>';
  }
  html += '</div>';

  html += '</div></div>';
  return html;
}

function switchDraftsView(view) {
  draftsView = view;
  document.getElementById('page-title').textContent = view==='pending' ? '📝 مسودات الأخبار — في انتظار المراجعة' : '✅ الأخبار المعتمدة';
  loadDraftsUI();
}

async function generateDraftsNow() {
  const btn = document.getElementById('drafts-gen-btn');
  const status = document.getElementById('drafts-gen-status');
  if (!btn || !status) return;
  const cats = Array.from(document.getElementById('gen-category')?.selectedOptions || []).map(o => o.value).filter(Boolean);
  const language = document.getElementById('gen-language')?.value || 'ar_fusha';
  const creativity = document.getElementById('gen-creativity')?.value || 'balanced';
  const count = parseInt(document.getElementById('gen-count')?.value || '5', 10);
  const avoid = (document.getElementById('gen-avoid')?.value || '').trim();

  const params = new URLSearchParams();
  params.set('force', 'true');
  params.set('days', '7');
  params.set('limit', String(count));
  params.set('language', language);
  params.set('creativity', creativity);
  if (cats.length) params.set('category', cats.join(','));
  if (avoid) params.set('avoid', avoid);

  btn.disabled = true; btn.style.opacity = '0.6';
  const original = btn.textContent;
  btn.textContent = '⏳ جاري التوليد...';
  status.style.display = 'block';
  status.innerHTML = '<span style="color:#F4D03F">⏳ Tavily + Groq يصيغان ' + count + ' خبر بـ ' + ({ar_fusha:'العربية الفصحى',ar_egy:'العامية المصرية',en:'English'}[language]||'العربية') + ' (~' + Math.round(count*8) + ' ثانية)...</span>';
  try {
    const res = await fetch('https://cairo-business-backend.vercel.app/api/cron/fetch-news?' + params.toString(), { cache: 'no-store' });
    /* Robust parsing — if Vercel returns HTML (timeout / 5xx), don't crash with "Unexpected token" */
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      const text = await res.text();
      const isTimeout = res.status === 504 || text.toLowerCase().includes('timeout') || text.toLowerCase().includes('gateway');
      if (isTimeout) {
        status.innerHTML = '<span style="color:#f59e0b">⏱️ الخادم ما رجعش في الوقت المحدد. قلّل العدد لـ 3-4 أخبار وحاول تاني.</span>';
      } else {
        status.innerHTML = '<span style="color:#ef4444">❌ الخادم رجّع خطأ (HTTP ' + res.status + '). حاول تاني بعد دقيقة.</span>';
      }
      return;
    }
    const j = await res.json();
    if (!j.success) {
      status.innerHTML = '<span style="color:#ef4444">❌ فشل: ' + (j.error || 'unknown') + '</span>';
      return;
    }
    const inserted = j.meta?.insertedCount || 0;
    const fetched = j.meta?.fetched || 0;
    if (inserted === 0) {
      status.innerHTML = '<span style="color:#f59e0b">⚠️ تم جلب ' + fetched + ' خبر لكن مفيش جديد. قلل عدد الأخبار أو غيّر المجال.</span>';
    } else {
      status.innerHTML = '<span style="color:#16a34a;font-size:14px;font-weight:700;">✓ تم إضافة ' + inserted + ' مسودة جديدة بأجسام كاملة</span>';
      setTimeout(() => loadDraftsUI(), 1500);
    }
  } catch (e) {
    status.innerHTML = '<span style="color:#ef4444">❌ خطأ في الاتصال: ' + (e.message || e) + '</span>';
  } finally {
    btn.disabled = false; btn.style.opacity = '1'; btn.textContent = original;
  }
}

async function publishDraft(id) {
  if (!confirm('تأكد إنك راجعت الخبر؟ هينتشر على cairobusiness.net فوراً.')) return;
  const r = await fetch('https://cairo-business-backend.vercel.app/api/admin/news/' + encodeURIComponent(id) + '/publish?refreshDate=true', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('cb_admin_token') || '') }
  });
  const j = await r.json();
  if (j.success) await loadDraftsUI();
  else alert('فشل النشر: ' + (j.error || 'unknown'));
}

async function rejectDraft(id) {
  if (!confirm('رفض الخبر ده وحذفه نهائياً؟')) return;
  const r = await api('/api/admin/news/' + encodeURIComponent(id), { method: 'DELETE' });
  if (r.ok) await loadDraftsUI();
  else alert('فشل الحذف: ' + (r.data?.error || 'unknown'));
}

async function regenerateDraft(id) {
  const lang = prompt('اللغة الجديدة:\n  ar_fusha (فصحى)\n  ar_egy (مصري)\n  en (إنجليزي)\n\n(اتركه فاضي للحفاظ على نفس اللغة)', '') || 'ar_fusha';
  const creativity = prompt('درجة الإبداع:\n  conservative\n  balanced\n  creative', 'balanced') || 'balanced';
  const card = document.querySelector('[onclick="regenerateDraft(\'' + id + '\')"]');
  if (card) { card.disabled = true; card.textContent = '⏳ جاري...'; }
  try {
    const res = await fetch('https://cairo-business-backend.vercel.app/api/admin/news/' + encodeURIComponent(id) + '/regenerate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (localStorage.getItem('cb_admin_token') || '') },
      body: JSON.stringify({ language: lang, creativity })
    });
    const j = await res.json();
    if (j.success) await loadDraftsUI();
    else alert('فشل: ' + (j.error || 'unknown'));
  } catch (e) {
    alert('خطأ: ' + (e.message || e));
  }
}

/* ── Full Article Editor Modal (with Quill) ──────────────────── */
async function openArticleEditor(id) {
  const r = await api('/api/admin/news/' + encodeURIComponent(id));
  if (!r.ok) { alert('فشل التحميل'); return; }
  const it = r.data.data;
  let tags = [];
  try { tags = it.tags ? JSON.parse(it.tags) : []; } catch (_) { tags = []; }

  /* Build modal */
  const overlay = document.createElement('div');
  overlay.className = 'article-modal-backdrop';
  overlay.onclick = e => { if (e.target === overlay) closeArticleEditor(); };

  let html = '<div class="article-modal" onclick="event.stopPropagation()">';
  html += '<h2>✏️ تعديل كامل للخبر</h2>';

  /* Title */
  html += '<div class="am-field"><label>📰 العنوان</label>';
  html += '<input id="am-title" type="text" value="' + escapeAttr(it.titleAr || '') + '" /></div>';

  /* Lead */
  html += '<div class="am-field"><label>✨ المقدمة (Lead) — فقرة افتتاحية قصيرة</label>';
  html += '<textarea id="am-lead">' + escapeHtml(it.lead || '') + '</textarea></div>';

  /* Body — Quill mounts here */
  html += '<div class="am-field"><label>📝 جسم الخبر (Rich Text)</label>';
  html += '<div id="am-quill-container" style="background:rgba(255,255,255,0.03);border-radius:8px;overflow:hidden;"></div></div>';

  /* Image */
  html += '<div class="am-row">';
  html += '<div class="am-field"><label>🖼️ رابط الصورة</label>';
  html += '<input id="am-image" type="text" value="' + escapeAttr(it.imageUrl || '') + '" dir="ltr" /></div>';
  html += '<div class="am-field"><label>📂 الفئة</label>';
  html += '<select id="am-category">';
  for (const [v,l] of [['business','أعمال'],['markets','أسواق'],['realestate','عقارات'],['energy','طاقة'],['technology','تكنولوجيا'],['trade','تجارة'],['finance','مالية']]) {
    html += '<option value="' + v + '"' + (it.category===v?' selected':'') + '>' + l + '</option>';
  }
  html += '</select></div>';
  html += '</div>';

  /* Tags + Source */
  html += '<div class="am-row">';
  html += '<div class="am-field"><label>🏷️ الوسوم (Tags) — افصل بفواصل</label>';
  html += '<input id="am-tags" type="text" value="' + escapeAttr(tags.join(', ')) + '" placeholder="أرامكو, النفط, صفقات" /></div>';
  html += '<div class="am-field"><label>🔗 المصدر الأصلي</label>';
  html += '<input id="am-source" type="text" value="' + escapeAttr(it.sourceUrl || '') + '" dir="ltr" /></div>';
  html += '</div>';

  /* Actions */
  html += '<div class="am-actions">';
  html += '<button class="btn btn-ghost" onclick="closeArticleEditor()">إلغاء</button>';
  html += '<button class="btn btn-ghost" onclick="previewArticle()" style="color:#60a5fa;border-color:#60a5fa;">👁️ معاينة</button>';
  html += '<button class="btn btn-ghost" onclick="saveArticle(\'' + escapeAttr(id) + '\', false)">💾 حفظ التعديلات</button>';
  html += '<button class="btn btn-primary" onclick="saveArticle(\'' + escapeAttr(id) + '\', true)" style="background:#16a34a;border-color:#16a34a;">✅ حفظ ونشر مباشرة</button>';
  html += '</div>';

  html += '</div>';
  overlay.innerHTML = html;
  document.body.appendChild(overlay);

  /* Initialize Quill */
  setTimeout(() => {
    if (typeof Quill === 'undefined') {
      document.getElementById('am-quill-container').innerHTML = '<textarea id="am-body-fallback" style="width:100%;min-height:240px;padding:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:inherit;font-family:inherit;direction:rtl;">' + escapeHtml(it.body || '') + '</textarea>';
      return;
    }
    quillEditor = new Quill('#am-quill-container', {
      theme: 'snow',
      modules: {
        toolbar: [
          [{ header: [2, 3, false] }],
          ['bold', 'italic', 'underline'],
          [{ list: 'ordered' }, { list: 'bullet' }],
          ['blockquote', 'link'],
          [{ align: [] }],
          ['clean']
        ]
      },
      placeholder: 'اكتب جسم الخبر هنا...'
    });
    quillEditor.root.innerHTML = it.body || '';
  }, 50);
}

function closeArticleEditor() {
  const ov = document.querySelector('.article-modal-backdrop');
  if (ov) ov.remove();
  quillEditor = null;
}

function previewArticle() {
  const title = document.getElementById('am-title').value;
  const lead = document.getElementById('am-lead').value;
  const body = quillEditor ? quillEditor.root.innerHTML : (document.getElementById('am-body-fallback')?.value || '');
  const image = document.getElementById('am-image').value;
  const w = window.open('', '_blank', 'width=820,height=900');
  if (!w) return alert('السماح بالنوافذ المنبثقة مطلوب للمعاينة');
  w.document.write('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>معاينة</title><style>body{font-family:Cairo,Inter,sans-serif;max-width:720px;margin:30px auto;padding:0 20px;line-height:1.8;color:#222;background:#fff;}h1{font-size:30px;line-height:1.3;margin:0 0 14px;}.lead{font-size:18px;color:#444;font-style:italic;margin-bottom:24px;border-right:3px solid #c9a227;padding-right:14px;}img{max-width:100%;border-radius:10px;margin-bottom:20px;}p{margin:0 0 14px;font-size:16px;}h2,h3{margin-top:24px;}</style></head><body>');
  if (image) w.document.write('<img src="' + image + '" />');
  w.document.write('<h1>' + (title || '(بدون عنوان)') + '</h1>');
  if (lead) w.document.write('<div class="lead">' + lead + '</div>');
  w.document.write(body || '<p>(لا يوجد محتوى)</p>');
  w.document.write('</body></html>');
  w.document.close();
}

async function saveArticle(id, publishAlso) {
  const title = document.getElementById('am-title').value.trim();
  const lead = document.getElementById('am-lead').value.trim();
  const body = quillEditor ? quillEditor.root.innerHTML : (document.getElementById('am-body-fallback')?.value || '');
  const imageUrl = document.getElementById('am-image').value.trim();
  const category = document.getElementById('am-category').value;
  const tagsStr = document.getElementById('am-tags').value;
  const sourceUrl = document.getElementById('am-source').value.trim();
  const tags = tagsStr.split(',').map(s => s.trim()).filter(Boolean);

  if (!title) { alert('العنوان مطلوب'); return; }

  /* Save edits */
  const r = await api('/api/admin/news/' + encodeURIComponent(id), {
    method: 'PUT',
    body: JSON.stringify({
      titleAr: title, lead, body, excerptAr: lead.slice(0, 280),
      imageUrl, category, tags, sourceUrl
    })
  });
  if (!r.ok) { alert('فشل الحفظ: ' + (r.data?.error || 'unknown')); return; }

  /* Optionally publish */
  if (publishAlso) {
    const pub = await fetch('https://cairo-business-backend.vercel.app/api/admin/news/' + encodeURIComponent(id) + '/publish?refreshDate=true', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('cb_admin_token') || '') }
    });
    const pj = await pub.json();
    if (!pj.success) { alert('تم الحفظ لكن فشل النشر: ' + (pj.error || 'unknown')); return; }
  }
  closeArticleEditor();
  await loadDraftsUI();
}

/* ═════════════════════════════════════════════════════════════
   Section Layout Controller — drag-drop reorder + visibility toggle
   for all homepage sections. Admin only.
   ═════════════════════════════════════════════════════════════ */
let _layoutData = [];
let _layoutDragSlug = null;

async function switchToLayout() {
  currentEntityKey = '__layout__';
  renderTabs();
  document.getElementById('page-title').textContent = '🎛️ تخطيط الصفحة الرئيسية';
  document.getElementById('search-input').style.display = 'none';
  const addBtn = document.querySelector('.actions button.btn-primary');
  if (addBtn) addBtn.style.display = 'none';
  document.getElementById('stats-section').innerHTML = '';
  await loadLayoutUI();
}

async function loadLayoutUI() {
  const container = document.getElementById('list-container');
  container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  const r = await api('/api/admin/section-layout');
  if (!r.ok) {
    container.innerHTML =
      '<div class="msg msg-error">فشل التحميل: ' + escapeHtml(r.data?.error || 'unknown') +
      '<br><br>شغّل الـ migration أولاً: <a href="https://cairo-business-backend.vercel.app/api/admin/migrate-section-layout" target="_blank">/api/admin/migrate-section-layout</a></div>';
    return;
  }
  _layoutData = r.data.data || [];
  if (!_layoutData.length) {
    container.innerHTML = '<div class="empty-state"><div class="icon">🎛️</div><div class="title">لسه ما اتزرعش</div><div class="subtitle">شغّل: <a href="https://cairo-business-backend.vercel.app/api/admin/migrate-section-layout" target="_blank">/api/admin/migrate-section-layout</a></div></div>';
    return;
  }
  renderLayoutList();
}

function renderLayoutList() {
  const container = document.getElementById('list-container');
  let html = '';
  /* Header banner */
  html += '<div style="background:linear-gradient(135deg,rgba(244,208,63,0.12),rgba(212,175,55,0.06));border:1px solid rgba(244,208,63,0.4);border-radius:14px;padding:18px 20px;margin-bottom:18px;">';
  html += '  <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">';
  html += '    <div style="flex:1;min-width:240px;">';
  html += '      <div style="font-size:16px;font-weight:700;color:#F4D03F;margin-bottom:4px;">🎛️ تحكّم كامل في تخطيط الصفحة الرئيسية</div>';
  html += '      <div style="font-size:13px;opacity:0.75;line-height:1.6;">اسحب الأقسام لإعادة ترتيبها، وفعّل/عطّل ظهور أي قسم في الصفحة. التغييرات تنعكس على الموقع فوراً بعد الحفظ.</div>';
  html += '    </div>';
  html += '    <button class="btn btn-primary" id="layout-save-btn" onclick="saveLayoutOrder()" style="font-size:14px;padding:12px 22px;">💾 حفظ الترتيب الجديد</button>';
  html += '  </div>';
  html += '  <div id="layout-save-status" style="margin-top:10px;font-size:13px;display:none;"></div>';
  html += '</div>';

  /* Draggable list */
  html += '<div id="layout-list" style="display:flex;flex-direction:column;gap:8px;">';
  for (const s of _layoutData) {
    const pinned = !!s.isPinned;
    const visible = !!s.isVisible;
    const lockedBadge = pinned ? '<span class="pill" style="background:rgba(244,208,63,0.18);color:#F4D03F;font-size:10px;">📌 مثبّت</span>' : '';
    const hiddenBg = !visible ? 'opacity:0.45;background:rgba(255,255,255,0.02);' : 'background:rgba(255,255,255,0.04);';
    html += '<div class="layout-row" draggable="' + (!pinned) + '" data-slug="' + escapeAttr(s.slug) + '"';
    html += '  ondragstart="layoutDragStart(event)"';
    html += '  ondragover="layoutDragOver(event)"';
    html += '  ondrop="layoutDrop(event)"';
    html += '  ondragend="layoutDragEnd(event)"';
    html += '  style="border:1px solid var(--border,rgba(255,255,255,0.1));border-radius:10px;padding:12px 14px;display:flex;align-items:center;gap:12px;' + hiddenBg + 'cursor:' + (pinned ? 'not-allowed' : 'grab') + ';transition:all 0.2s;">';
    /* Drag handle */
    html += '  <div style="font-size:20px;opacity:0.5;width:24px;text-align:center;">' + (pinned ? '🔒' : '⋮⋮') + '</div>';
    /* Sort badge */
    html += '  <div style="width:30px;height:30px;border-radius:50%;background:#F4D03F;color:#0A0E27;display:grid;place-items:center;font-weight:900;font-size:12px;">' + (s.sortOrder || 0) + '</div>';
    /* Labels */
    html += '  <div style="flex:1;min-width:0;">';
    html += '    <div style="font-weight:700;font-size:15px;margin-bottom:2px;">' + escapeHtml(s.labelAr) + '</div>';
    html += '    <div style="font-size:11px;opacity:0.55;direction:ltr;text-align:start;">#' + escapeHtml(s.slug) + ' · ' + escapeHtml(s.labelEn) + '</div>';
    html += '  </div>';
    /* Locked badge */
    html += '  <div>' + lockedBadge + '</div>';
    /* Visibility toggle */
    html += '  <label style="display:flex;align-items:center;gap:8px;cursor:' + (pinned ? 'not-allowed' : 'pointer') + ';font-size:13px;user-select:none;">';
    html += '    <input type="checkbox" ' + (visible ? 'checked' : '') + ' ' + (pinned ? 'disabled' : '') + ' onchange="toggleSectionVisibility(\'' + escapeAttr(s.slug) + '\', this.checked)" style="width:18px;height:18px;cursor:' + (pinned ? 'not-allowed' : 'pointer') + ';" />';
    html += '    <span style="color:' + (visible ? '#22c55e' : '#94a3b8') + ';font-weight:600;">' + (visible ? 'مرئي' : 'مخفي') + '</span>';
    html += '  </label>';
    html += '</div>';
  }
  html += '</div>';

  /* Help footer */
  html += '<div style="margin-top:18px;font-size:12px;opacity:0.6;line-height:1.7;">';
  html += '  💡 <strong>تلميحات:</strong><br/>';
  html += '  • اسحب وأفلت أي صف لإعادة ترتيبه (الأقسام المثبّتة 🔒 ثابتة).<br/>';
  html += '  • تفعيل/إيقاف الـ checkbox يحفظ تلقائياً.<br/>';
  html += '  • بعد إعادة الترتيب، اضغط «حفظ الترتيب الجديد» لتثبيت الترتيب على الموقع.<br/>';
  html += '  • التغييرات قد تأخذ حتى دقيقة للظهور على الموقع (cache).';
  html += '</div>';

  container.innerHTML = html;
}

function layoutDragStart(e) {
  const row = e.currentTarget;
  if (row.getAttribute('draggable') !== 'true') { e.preventDefault(); return; }
  _layoutDragSlug = row.dataset.slug;
  row.style.opacity = '0.4';
  e.dataTransfer.effectAllowed = 'move';
}
function layoutDragOver(e) {
  e.preventDefault();
  const row = e.currentTarget;
  if (row.dataset.slug === _layoutDragSlug) return;
  row.style.borderColor = '#F4D03F';
}
function layoutDragEnd(e) {
  const rows = document.querySelectorAll('.layout-row');
  rows.forEach(r => { r.style.opacity = ''; r.style.borderColor = ''; });
  _layoutDragSlug = null;
}
function layoutDrop(e) {
  e.preventDefault();
  const targetRow = e.currentTarget;
  const targetSlug = targetRow.dataset.slug;
  if (!_layoutDragSlug || targetSlug === _layoutDragSlug) return;
  /* Reorder _layoutData: move dragged item to target's position */
  const fromIdx = _layoutData.findIndex(s => s.slug === _layoutDragSlug);
  const toIdx = _layoutData.findIndex(s => s.slug === targetSlug);
  if (fromIdx < 0 || toIdx < 0) return;
  /* Don't allow dropping onto a pinned row if it's at the top/bottom edge */
  const [moved] = _layoutData.splice(fromIdx, 1);
  _layoutData.splice(toIdx, 0, moved);
  /* Renumber sortOrder by index * 10 */
  _layoutData.forEach((s, i) => { s.sortOrder = i * 10; });
  renderLayoutList();
}

async function toggleSectionVisibility(slug, isVisible) {
  const status = document.getElementById('layout-save-status');
  if (status) {
    status.style.display = 'block';
    status.innerHTML = '<span style="color:#F4D03F">⏳ جاري الحفظ...</span>';
  }
  const r = await api('/api/admin/section-layout/' + encodeURIComponent(slug), { method: 'PATCH', body: JSON.stringify({ isVisible }) });
  if (!r.ok || !r.data?.success) {
    if (status) status.innerHTML = '<span style="color:#ef4444">❌ ' + escapeHtml(r.data?.error || 'فشل الحفظ') + '</span>';
    /* Revert local state */
    const it = _layoutData.find(s => s.slug === slug);
    if (it) it.isVisible = !isVisible;
    renderLayoutList();
    return;
  }
  /* Update local state */
  const it = _layoutData.find(s => s.slug === slug);
  if (it) it.isVisible = isVisible;
  if (status) status.innerHTML = '<span style="color:#22c55e">✅ تم تحديث ' + escapeHtml(slug) + ' → ' + (isVisible ? 'مرئي' : 'مخفي') + '</span>';
  renderLayoutList();
}

async function saveLayoutOrder() {
  const btn = document.getElementById('layout-save-btn');
  const status = document.getElementById('layout-save-status');
  if (!btn || !status) return;
  btn.disabled = true;
  btn.style.opacity = '0.6';
  const orig = btn.textContent;
  btn.textContent = '⏳ جاري الحفظ...';
  status.style.display = 'block';
  status.innerHTML = '<span style="color:#F4D03F">⏳ حفظ الترتيب الجديد...</span>';
  const order = _layoutData.map(s => ({ slug: s.slug, sortOrder: s.sortOrder }));
  const r = await api('/api/admin/section-layout', { method: 'POST', body: JSON.stringify({ order }) });
  btn.disabled = false;
  btn.style.opacity = '1';
  btn.textContent = orig;
  if (!r.ok || !r.data?.success) {
    status.innerHTML = '<span style="color:#ef4444">❌ فشل الحفظ: ' + escapeHtml(r.data?.error || 'unknown') + '</span>';
    return;
  }
  status.innerHTML = '<span style="color:#22c55e">✅ تم حفظ ترتيب ' + (r.data.updated || 0) + ' قسم. التغيير ينعكس على الموقع خلال دقيقة.</span>';
}

/* ═════════════════════════════════════════════════════════════
   Hero (singleton) — CMS form for the homepage hero section
   ═════════════════════════════════════════════════════════════ */
let _heroData = null;

async function switchToHero() {
  currentEntityKey = '__hero__';
  renderTabs();
  document.getElementById('page-title').textContent = '🎯 تحرير الواجهة (Hero)';
  document.getElementById('search-input').style.display = 'none';
  const addBtn = document.querySelector('.actions button.btn-primary');
  if (addBtn) addBtn.style.display = 'none';
  document.getElementById('stats-section').innerHTML = '';
  await loadHeroUI();
}

async function loadHeroUI() {
  const container = document.getElementById('list-container');
  container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  const r = await api('/api/admin/hero');
  if (!r.ok || !r.data?.data) {
    container.innerHTML =
      '<div class="msg msg-error">لم يتم تحميل بيانات الواجهة. شغّل الـ migration أولاً: '
      + '<a href="https://cairo-business-backend.vercel.app/api/admin/migrate-hero" target="_blank">/api/admin/migrate-hero</a>'
      + '</div>';
    return;
  }
  _heroData = r.data.data;
  renderHeroForm();
}

function renderHeroForm() {
  const h = _heroData || {};
  const fld = (key, label, type) => {
    const v = (h[key] || '').replace(/"/g, '&quot;');
    const dir = key.endsWith('En') ? 'ltr' : 'rtl';
    if (type === 'textarea') {
      return '<div class="hero-field"><label>' + label + '</label>'
        + '<textarea data-hero-key="' + key + '" dir="' + dir + '" rows="3" style="width:100%;padding:10px;background:rgba(255,255,255,0.05);border:1px solid var(--border,rgba(255,255,255,0.1));border-radius:8px;color:inherit;resize:vertical;">' + v + '</textarea></div>';
    }
    return '<div class="hero-field"><label>' + label + '</label>'
      + '<input data-hero-key="' + key + '" dir="' + dir + '" type="text" value="' + v + '" style="width:100%;padding:10px;background:rgba(255,255,255,0.05);border:1px solid var(--border,rgba(255,255,255,0.1));border-radius:8px;color:inherit;" /></div>';
  };

  let html = '';
  html += '<style>.hero-field{margin-bottom:14px}.hero-field label{display:block;font-size:12px;opacity:0.7;margin-bottom:6px;font-weight:600}.hero-section{background:rgba(255,255,255,0.03);border:1px solid var(--border,rgba(255,255,255,0.08));border-radius:12px;padding:18px;margin-bottom:18px}.hero-section h3{font-size:14px;color:#F4D03F;margin-bottom:14px;font-weight:700}</style>';

  /* Top action bar */
  html += '<div style="background:linear-gradient(135deg,rgba(244,208,63,0.12),rgba(212,175,55,0.06));border:1px solid rgba(244,208,63,0.4);border-radius:14px;padding:14px 18px;margin-bottom:18px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">';
  html += '  <div><div style="font-size:15px;font-weight:700;color:#F4D03F">🎯 تحرير قسم الواجهة (Hero)</div><div style="font-size:12px;opacity:0.7;margin-top:2px;">عدّل أي نص واضغط حفظ — التغييرات تنعكس على الموقع خلال دقيقة.</div></div>';
  html += '  <button class="btn btn-primary" id="hero-save-btn" onclick="saveHero()" style="font-size:14px;padding:10px 24px;">💾 حفظ التغييرات</button>';
  html += '</div>';
  html += '<div id="hero-save-status" style="margin-bottom:14px;font-size:13px;display:none;"></div>';

  /* Section: Headers */
  html += '<div class="hero-section"><h3>📢 الترويسة (Eyebrow + العنوان الرئيسي)</h3>';
  html += fld('eyebrowAr', 'الترويسة بالعربية (Eyebrow AR)', 'text');
  html += fld('eyebrowEn', 'Eyebrow EN', 'text');
  html += fld('titleTopAr', 'العنوان السطر الأول بالعربية', 'text');
  html += fld('titleTopEn', 'Title — top line EN', 'text');
  html += fld('titleMidAr', 'العنوان السطر الثاني بالعربية', 'text');
  html += fld('titleMidEn', 'Title — middle line EN', 'text');
  html += fld('subtitleAr', 'الوصف بالعربية', 'textarea');
  html += fld('subtitleEn', 'Subtitle EN', 'textarea');
  html += '</div>';

  /* Section: AI Search */
  html += '<div class="hero-section"><h3>🔍 شريط البحث (AI Search)</h3>';
  html += fld('searchPlaceholderAr', 'نص داخل الـ input بالعربية', 'text');
  html += fld('searchPlaceholderEn', 'Search placeholder EN', 'text');
  html += fld('ctaLabelAr', 'نص زر اسأل بالعربية', 'text');
  html += fld('ctaLabelEn', 'CTA button label EN', 'text');
  html += '</div>';

  /* Section: Chips */
  html += '<div class="hero-section"><h3>💬 اقتراحات تظهر تحت البحث (4 أزرار)</h3>';
  for (let i = 1; i <= 4; i++) {
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">';
    html += fld('chip' + i + 'Ar', 'الاقتراح ' + i + ' بالعربية', 'text');
    html += fld('chip' + i + 'En', 'Chip ' + i + ' EN', 'text');
    html += '</div>';
  }
  html += '</div>';

  /* Section: Stats */
  html += '<div class="hero-section"><h3>📊 الإحصائيات (4 أرقام تحت البحث)</h3>';
  for (let i = 1; i <= 4; i++) {
    html += '<div style="background:rgba(0,0,0,0.15);border-radius:10px;padding:14px;margin-bottom:12px;">';
    html += '<div style="font-size:13px;color:#F4D03F;font-weight:700;margin-bottom:10px;">الرقم ' + i + '</div>';
    html += '<div style="display:grid;grid-template-columns:1fr 100px;gap:12px;">';
    html += fld('stat' + i + 'Value', 'القيمة (رقم أو نص مثل 24/7)', 'text');
    html += fld('stat' + i + 'Suffix', 'لاحقة (+, K, M)', 'text');
    html += '</div>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">';
    html += fld('stat' + i + 'LabelAr', 'الوصف بالعربية', 'text');
    html += fld('stat' + i + 'LabelEn', 'Label EN', 'text');
    html += '</div>';
    html += '</div>';
  }
  html += '</div>';

  /* Bottom save button (sticky) */
  html += '<div style="position:sticky;bottom:0;background:linear-gradient(180deg,transparent,var(--bg,#0A0E27) 30%);padding:18px 0;text-align:center;">';
  html += '<button class="btn btn-primary" onclick="saveHero()" style="font-size:15px;padding:12px 32px;">💾 حفظ كل التغييرات</button>';
  html += '</div>';

  document.getElementById('list-container').innerHTML = html;
}

async function saveHero() {
  const btn = document.getElementById('hero-save-btn');
  const status = document.getElementById('hero-save-status');
  if (status) {
    status.style.display = 'block';
    status.innerHTML = '<span style="color:#F4D03F">⏳ جاري الحفظ...</span>';
  }
  if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; }

  /* Collect all field values */
  const updates = {};
  document.querySelectorAll('[data-hero-key]').forEach(el => {
    updates[el.dataset.heroKey] = el.value;
  });

  const r = await api('/api/admin/hero', { method: 'PATCH', body: JSON.stringify(updates) });
  if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
  if (!r.ok || !r.data?.success) {
    if (status) status.innerHTML = '<span style="color:#ef4444">❌ فشل الحفظ: ' + escapeHtml(r.data?.error || 'unknown') + '</span>';
    return;
  }
  _heroData = r.data.data;
  if (status) status.innerHTML = '<span style="color:#22c55e">✅ تم الحفظ بنجاح — التغيير ينعكس على الموقع خلال دقيقة.</span>';
}

const _lp = document.getElementById('login-password');
if (_lp) _lp.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
boot();
