let db = { settings: { currency: 'د.ع', company: 'اسم المنشأة', alertPct: 80, pin: '' }, employees: [], moves: [], seq: 1 };
let month = new Date().toISOString().slice(0, 7);
let tab = 'dash', fEmp = '', fType = '', fq = '';
const AL = () => +db.settings.alertPct || 80;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = n => (Number(n) || 0).toLocaleString('en-US') + ' ' + esc(db.settings.currency);
const T = { withdraw: 'سحب', deduct: 'خصم', bonus: 'مكافأة', repay: 'تسديد دين' };
const emp = id => db.employees.find(e => e.id === id);
const active = () => db.employees.filter(e => e.active !== false);
const save = () => api.save(db);
const monthName = m => new Date(m + '-01').toLocaleDateString('ar', { month: 'long', year: 'numeric' });

const nextMonth = mo => { let [y, m] = mo.split('-').map(Number); m++; if (m > 12) { m = 1; y++; } return y + '-' + String(m).padStart(2, '0'); };
const prevMonth = mo => { let [y, m] = mo.split('-').map(Number); m--; if (m < 1) { m = 12; y--; } return y + '-' + String(m).padStart(2, '0'); };
function mstat(e, mo) {
  const m = db.moves.filter(x => x.emp === e.id && x.date.startsWith(mo));
  const s = t => m.filter(x => x.type === t).reduce((a, x) => a + x.amount, 0);
  const w = s('withdraw'), d = s('deduct'), b = s('bonus'), r = s('repay');
  return { w, d, b, r, net: e.salary + b - w - d - r, n: m.filter(x => x.type === 'withdraw').length };
}
/* الدين المتبقي = الدين السابق + ما زاد من السحوبات عن الراتب (يُرحَّل للشهر التالي) − التسديدات */
function stats(e) {
  const since = e.since || month;
  let debt = 0;
  if (month >= since) {
    debt = e.debt0 || 0;
    for (let mo = since; mo < month; mo = nextMonth(mo)) { const x = mstat(e, mo); debt = Math.max(0, debt - x.r) + Math.max(0, -x.net); }
  }
  const x = mstat(e, month), short = Math.max(0, -x.net);
  return { ...x, net: Math.max(0, x.net), prev: debt, short, debt: Math.max(0, debt - x.r) + short };
}
function totals() {
  return active().reduce((t, e) => { const s = stats(e); t.sal += e.salary; t.w += s.w; t.d += s.d; t.b += s.b; t.r += s.r; t.net += s.net; t.debt += s.debt; return t; }, { sal: 0, w: 0, d: 0, b: 0, r: 0, net: 0, debt: 0 });
}

/* نوافذ تنبيه وتأكيد داخل البرنامج (بدل alert/confirm الأصلية التي تُفقد التركيز على ويندوز) */
function notice(msg, ask) {
  return new Promise(res => {
    const d = document.createElement('div'); d.className = 'modal on'; d.style.zIndex = 120;
    d.innerHTML = `<div class="dlg" style="width:380px"><p style="font-size:16px;line-height:1.8">${esc(msg)}</p><div class="act">${ask ? '<button class="btn" id="y">تأكيد</button><button class="btn alt" id="n">إلغاء</button>' : '<button class="btn" id="y">حسناً</button>'}</div></div>`;
    document.body.appendChild(d);
    const done = v => { d.remove(); res(v); };
    d.querySelector('#y').onclick = () => done(true);
    const n = d.querySelector('#n'); if (n) n.onclick = () => done(false);
    d.addEventListener('keydown', e => { if (e.key === 'Escape') done(false); });
    d.querySelector('#y').focus();
  });
}

/* ---------- نافذة النماذج ---------- */
function form(title, fields, onOk) {
  const m = $('#modal');
  m.innerHTML = `<div class="dlg"><h2>${title}</h2>` + fields.map(f => `<label>${f.l}</label>` + (f.opts
    ? `<select id="f_${f.k}">${f.opts.map(o => `<option value="${o[0]}" ${o[0] == f.v ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`
    : `<input id="f_${f.k}" type="${f.t || 'text'}" value="${esc(f.v ?? '')}">`)).join('') +
    `<div class="act"><button class="btn" id="ok">حفظ</button><button class="btn alt" id="no">إلغاء</button></div></div>`;
  m.classList.add('on');
  $('#no').onclick = () => m.classList.remove('on');
  $('#ok').onclick = () => {
    const v = {}; fields.forEach(f => v[f.k] = $('#f_' + f.k).value.trim());
    if (onOk(v) !== false) m.classList.remove('on');
  };
  const first = m.querySelector('input,select'); if (first) first.focus();
}

/* ---------- الموظفون ---------- */
function empForm(id) {
  const e = id ? emp(id) : {};
  form(id ? 'تعديل بيانات الموظف' : 'إضافة موظف', [
    { k: 'name', l: 'اسم الموظف', v: e.name }, { k: 'job', l: 'الوظيفة', v: e.job },
    { k: 'salary', l: 'الراتب الشهري', t: 'number', v: e.salary }, { k: 'phone', l: 'رقم الهاتف', v: e.phone },
    { k: 'debt0', l: 'دين سابق على الموظف (إن وجد)', t: 'number', v: e.debt0 },
    { k: 'inst', l: 'القسط الشهري المتفق عليه لتسديد الدين', t: 'number', v: e.inst },
    { k: 'since', l: 'الدين محسوب اعتباراً من شهر', t: 'month', v: e.since || month },
    { k: 'active', l: 'الحالة', v: e.active === false ? '0' : '1', opts: [['1', 'يعمل حالياً'], ['0', 'متوقف']] }
  ], v => {
    if (!v.name || !(+v.salary >= 0) || v.salary === '') { notice('أدخل اسم الموظف وراتبه'); return false; }
    const o = { name: v.name, job: v.job, salary: +v.salary, phone: v.phone, active: v.active === '1', debt0: +v.debt0 || 0, inst: +v.inst || 0, since: v.since || month };
    if (id) Object.assign(e, o); else db.employees.push({ id: db.seq++, ...o });
    save(); render();
  });
}
async function delEmp(id) {
  if (!await notice('حذف الموظف مع كل سحوباته؟', true)) return;
  db.employees = db.employees.filter(e => e.id !== id); db.moves = db.moves.filter(m => m.emp !== id); save(); render();
}

/* ---------- الحركات ---------- */
function moveForm(empId) {
  if (!active().length) { notice('أضف موظفاً أولاً'); return; }
  const today = new Date().toISOString().slice(0, 10);
  form('تسجيل حركة', [
    { k: 'emp', l: 'الموظف', v: empId || active()[0].id, opts: active().map(e => [e.id, e.name]) },
    { k: 'type', l: 'نوع الحركة', v: 'withdraw', opts: Object.entries(T) },
    { k: 'date', l: 'التاريخ', t: 'date', v: today.startsWith(month) ? today : month + '-01' },
    { k: 'amount', l: 'المبلغ', t: 'number' }, { k: 'note', l: 'ملاحظة (اختياري)' }
  ], v => {
    if (!(+v.amount > 0) || !v.date) { notice('أدخل مبلغاً صحيحاً وتاريخاً'); return false; }
    db.moves.push({ id: db.seq++, emp: +v.emp, type: v.type, date: v.date, amount: +v.amount, note: v.note });
    save(); render();
  });
}
async function delMove(id) { if (await notice('حذف هذه الحركة؟', true)) { db.moves = db.moves.filter(m => m.id !== id); save(); render(); } }
function statement(id) {
  const e = emp(id), s = stats(e);
  const rows = db.moves.filter(x => x.emp === id && x.date.startsWith(month)).sort((a, b) => a.date.localeCompare(b.date));
  const m = $('#modal');
  m.innerHTML = `<div class="dlg"><p class="sub" style="margin:0 0 4px">${esc(db.settings.company)}</p><h2>قسيمة راتب — ${esc(e.name)} — ${monthName(month)}</h2>
  <table><tr><th>التاريخ</th><th>النوع</th><th>المبلغ</th></tr>${rows.map(r => `<tr><td>${r.date}</td><td><span class="tag ${r.type}">${T[r.type]}</span></td><td>${fmt(r.amount)}</td></tr>`).join('') || '<tr><td colspan="3" class="empty">لا توجد حركات هذا الشهر</td></tr>'}</table>
  <p style="margin-top:14px">الراتب: <b>${fmt(e.salary)}</b> — صافي المستحق: <b class="pos">${fmt(s.net)}</b> — الدين المتبقي: <b class="${s.debt ? 'neg' : 'pos'}">${fmt(s.debt)}</b></p>
  <p style="margin-top:34px;display:flex;justify-content:space-between"><span>توقيع المحاسب: ..........</span><span>توقيع الموظف: ..........</span></p><div class="act"><button class="btn brass" id="pr">طباعة القسيمة</button><button class="btn alt" id="no">إغلاق</button></div></div>`;
  m.classList.add('on'); $('#no').onclick = () => m.classList.remove('on');
  $('#pr').onclick = () => { document.body.classList.add('slip'); window.print(); document.body.classList.remove('slip'); api.refocus(); };
}

/* ---------- عرض التبويبات ---------- */
function alertBox(bars) {
  const hot = bars.filter(b => b.p >= AL());
  return hot.length ? `<div class="alert">تنبيه: ${hot.map(b => esc(b.e.name) + ' (' + Math.round(b.p) + '%)').join('، ')} وصلوا إلى ${AL()}% أو أكثر من رواتبهم هذا الشهر</div>` : '';
}
function trendBox() {
  const ms = []; let mo = month;
  for (let i = 0; i < 6; i++) { ms.unshift(mo); mo = prevMonth(mo); }
  const v = ms.map(m => active().reduce((a, e) => a + mstat(e, m).w, 0)), mx = Math.max(...v, 1);
  return `<h3 style="margin-bottom:10px">سحوبات آخر 6 أشهر</h3><div class="box trend">${ms.map((m, i) => `<div class="col"><small>${v[i].toLocaleString('en-US')}</small><i class="${m === month ? 'cur' : ''}" style="height:${Math.round(v[i] / mx * 110) + 4}px"></i><span>${monthName(m)}</span></div>`).join('')}</div>`;
}
function viewDash() {
  const t = totals(), list = active();
  const bars = list.map(e => { const s = stats(e), p = e.salary ? Math.min(100, s.w / e.salary * 100) : 0; return { e, s, p }; }).sort((a, b) => b.p - a.p);
  return `<h1>لوحة المتابعة</h1><p class="sub">${monthName(month)}</p>
  <div class="cards">
    <div class="k"><small>عدد الموظفين</small><strong>${list.length}</strong></div>
    <div class="k b"><small>إجمالي الرواتب</small><strong>${fmt(t.sal)}</strong></div>
    <div class="k r"><small>إجمالي السحوبات</small><strong>${fmt(t.w)}</strong></div>
    <div class="k g"><small>صافي المتبقي للدفع</small><strong>${fmt(t.net)}</strong></div>
    <div class="k r"><small>إجمالي الديون على الموظفين</small><strong>${fmt(t.debt)}</strong></div>
  </div>
  ${alertBox(bars)}${trendBox()}<h3 style="margin-bottom:10px">نسبة السحب من الراتب لكل موظف</h3>
  <div class="box"><table><tr><th>الموظف</th><th>السحوبات</th><th>عدد مرات السحب</th><th>النسبة من الراتب</th><th>الدين المتبقي</th></tr>
  ${bars.map(({ e, s, p }) => `<tr><td>${esc(e.name)}</td><td>${fmt(s.w)}</td><td>${s.n}</td>
  <td><div style="display:flex;align-items:center;gap:10px"><div class="meter" style="flex:1"><i class="${p >= AL() ? 'hi' : p >= AL() * 0.6 ? 'mid' : ''}" style="width:${p}%"></i></div><span>${Math.round(p)}%</span></div></td><td class="${s.debt ? 'neg' : ''}">${fmt(s.debt)}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">أضف موظفين من تبويب «الموظفون» لتبدأ المتابعة</td></tr>'}</table></div>`;
}
function viewEmps() {
  return `<h1>الموظفون</h1><p class="sub">بيانات الموظفين ورواتبهم الأساسية</p>
  <div class="bar"><button class="btn" onclick="empForm()">إضافة موظف</button><input id="fq" placeholder="بحث بالاسم أو الوظيفة" value="${esc(fq)}" oninput="fq=this.value;render();const i=$('#fq');i.focus();i.setSelectionRange(fq.length,fq.length)"></div>
  <div class="box"><table><tr><th>الاسم</th><th>الوظيفة</th><th>الهاتف</th><th>الراتب</th><th>الدين المتبقي</th><th>الحالة</th><th></th></tr>
  ${db.employees.filter(e => !fq || (e.name + ' ' + (e.job || '')).includes(fq)).map(e => `<tr><td><b>${esc(e.name)}</b></td><td>${esc(e.job)}</td><td>${esc(e.phone)}</td><td>${fmt(e.salary)}</td><td class="${stats(e).debt ? 'neg' : ''}">${fmt(stats(e).debt)}</td><td>${e.active === false ? 'متوقف' : 'يعمل'}</td>
  <td><button class="btn alt sm" onclick="statement(${e.id})">قسيمة الراتب</button> <button class="btn alt sm" onclick="empForm(${e.id})">تعديل</button> <button class="btn del sm" onclick="delEmp(${e.id})">حذف</button></td></tr>`).join('') || '<tr><td colspan="7" class="empty">لا يوجد موظفون بعد. اضغط «إضافة موظف».</td></tr>'}</table></div>`;
}
function viewMoves() {
  const rows = db.moves.filter(m => m.date.startsWith(month) && (!fEmp || m.emp == fEmp) && (!fType || m.type === fType)).sort((a, b) => b.date.localeCompare(a.date));
  return `<h1>السحوبات والحركات</h1><p class="sub">${monthName(month)} — سحوبات وخصومات ومكافآت</p>
  <div class="bar"><button class="btn" onclick="moveForm()">تسجيل سحب / حركة</button>
  <select onchange="fEmp=this.value;render()"><option value="">كل الموظفين</option>${db.employees.map(e => `<option value="${e.id}" ${fEmp == e.id ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select>
  <select onchange="fType=this.value;render()"><option value="">كل الأنواع</option>${Object.entries(T).map(([k, v]) => `<option value="${k}" ${fType === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
  <div class="box"><table><tr><th>التاريخ</th><th>الموظف</th><th>النوع</th><th>المبلغ</th><th>ملاحظة</th><th></th></tr>
  ${rows.map(r => `<tr><td>${r.date}</td><td>${esc(emp(r.emp)?.name)}</td><td><span class="tag ${r.type}">${T[r.type]}</span></td><td>${fmt(r.amount)}</td><td>${esc(r.note)}</td><td><button class="btn del sm" onclick="delMove(${r.id})">حذف</button></td></tr>`).join('') || '<tr><td colspan="6" class="empty">لا توجد حركات في هذا الشهر</td></tr>'}</table></div>`;
}
function viewPayroll() {
  const t = totals();
  return `<div class="ph"><h1>${esc(db.settings.company)}</h1></div><h1>كشف رواتب ${monthName(month)}</h1><p class="sub">الراتب + المكافآت − السحوبات − الخصومات − تسديد الدين = صافي المستحق. ما زاد من السحوبات عن الراتب يُرحَّل كدين للشهر التالي</p>
  <div class="bar noprint"><button class="btn brass" onclick="window.print()">طباعة الكشف</button><button class="btn alt" onclick="exportCsv()">تصدير Excel (CSV)</button></div>
  <div class="box"><table><tr><th>الموظف</th><th>الراتب</th><th>مكافآت</th><th>السحوبات</th><th>خصومات</th><th>تسديد دين</th><th>صافي المستحق</th><th>الدين المتبقي</th></tr>
  ${active().map(e => { const s = stats(e); return `<tr><td><b>${esc(e.name)}</b> <button class="btn alt sm noprint" onclick="statement(${e.id})">قسيمة</button></td><td>${fmt(e.salary)}</td><td>${fmt(s.b)}</td><td class="neg">${fmt(s.w)}</td><td>${fmt(s.d)}</td><td>${fmt(s.r)}${e.inst > 0 && s.prev > 0 && !s.r ? ` <button class="btn alt sm noprint" onclick="payInst(${e.id})">خصم القسط</button>` : ''}</td><td><b class="pos">${fmt(s.net)}</b></td><td class="${s.debt ? 'neg' : ''}">${fmt(s.debt)}</td></tr>`; }).join('') || '<tr><td colspan="8" class="empty">لا يوجد موظفون</td></tr>'}</table>
  <table><tfoot><tr><td>الإجمالي</td><td>${fmt(t.sal)}</td><td>${fmt(t.b)}</td><td>${fmt(t.w)}</td><td>${fmt(t.d)}</td><td>${fmt(t.r)}</td><td>${fmt(t.net)}</td><td>${fmt(t.debt)}</td></tr></tfoot></table></div>`;
}
function payInst(id) {
  const e = emp(id), s = stats(e), today = new Date().toISOString().slice(0, 10);
  db.moves.push({ id: db.seq++, emp: id, type: 'repay', date: today.startsWith(month) ? today : month + '-01', amount: Math.min(e.inst, s.prev), note: 'قسط شهري' });
  save(); render();
}
function exportCsv() {
  const h = ['الموظف', 'الراتب', 'مكافآت', 'السحوبات', 'خصومات', 'تسديد دين', 'الصافي', 'الدين المتبقي'];
  const r = active().map(e => { const s = stats(e); return [e.name, e.salary, s.b, s.w, s.d, s.r, s.net, s.debt]; });
  api.saveText(`كشف-رواتب-${month}.csv`, [h, ...r].map(x => x.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n'));
}
function viewSettings() {
  return `<h1>الإعدادات</h1><p class="sub">بيانات المنشأة والنسخ الاحتياطي</p>
  <div class="set"><h3>بيانات الكشف</h3><label>اسم المنشأة (يظهر في الطباعة)</label><input id="s_co" value="${esc(db.settings.company)}">
  <label style="margin-top:12px;display:block">العملة</label><input id="s_cur" value="${esc(db.settings.currency)}">
  <label style="margin-top:12px;display:block">تنبيه عند وصول السحب إلى (% من الراتب)</label><input id="s_al" type="number" min="1" max="100" value="${AL()}">
  <div class="act" style="margin-top:16px"><button class="btn" onclick="saveSettings()">حفظ الإعدادات</button></div></div>
  <div class="set"><h3>النسخ الاحتياطي</h3><div class="bar"><button class="btn alt" onclick="api.backup(db)">حفظ نسخة احتياطية</button><button class="btn alt" onclick="restore()">استرجاع نسخة</button></div>
  <div class="bar" style="margin-top:12px"><button class="btn alt" onclick="api.openBackups()">فتح مجلد النسخ التلقائية</button></div>
  <p class="note">يُحفظ تلقائياً كل يوم نسخة من البيانات (آخر 14 يوماً). خذ نسخة يدوية أيضاً قبل تغيير الجهاز أو إعادة تثبيت ويندوز.</p></div>
  <div class="set"><h3>قفل البرنامج</h3><label>رمز الدخول (4 أرقام أو أكثر)</label><input id="s_pin" type="password" inputmode="numeric" placeholder="${db.settings.pin ? 'القفل مفعّل — اكتب رمزاً جديداً أو اتركه فارغاً لإلغائه' : 'غير مفعّل'}">
  <div class="act" style="margin-top:14px"><button class="btn" onclick="setPin()">حفظ الرمز</button></div>
  <p class="note">القفل يمنع فتح البرنامج بدون الرمز، لكنه لا يشفّر ملف البيانات نفسه.</p></div>`;
}
function saveSettings() { db.settings.company = $('#s_co').value.trim(); db.settings.currency = $('#s_cur').value.trim() || 'د.ع'; db.settings.alertPct = +$('#s_al').value || 80; save(); render(); }
const hash = s => { let h = 5381; for (const c of s + 'ws') h = ((h * 33) ^ c.charCodeAt(0)) | 0; return String(h >>> 0); };
async function setPin() {
  const v = $('#s_pin').value.trim();
  if (!v) { if (db.settings.pin && await notice('إلغاء قفل البرنامج؟', true)) { db.settings.pin = ''; save(); render(); } return; }
  if (v.length < 4) { notice('الرمز 4 أرقام على الأقل'); return; }
  db.settings.pin = hash(v); save(); render(); notice('تم تفعيل القفل');
}
function lockScreen() {
  if (!db.settings.pin) return;
  const d = document.createElement('div'); d.className = 'lock';
  d.innerHTML = '<b>رواتب</b><input type="password" inputmode="numeric" id="lk" placeholder="رمز الدخول"><span id="lm"></span>';
  document.body.appendChild(d);
  const i = d.querySelector('#lk'); i.focus();
  i.oninput = () => { if (hash(i.value) === db.settings.pin) d.remove(); };
  i.onkeydown = ev => { if (ev.key === 'Enter' && hash(i.value) !== db.settings.pin) { d.querySelector('#lm').textContent = 'الرمز غير صحيح'; i.value = ''; } };
}
async function restore() {
  const d = await api.restore();
  if (!d || !d.employees || !d.moves) { notice('الملف غير صالح'); return; }
  if (await notice('سيتم استبدال البيانات الحالية. هل تريد المتابعة؟', true)) { db = d; save(); render(); }
}

const views = { dash: viewDash, emps: viewEmps, moves: viewMoves, payroll: viewPayroll, settings: viewSettings };
function render() {
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === tab));
  document.querySelectorAll('main section').forEach(s => s.classList.toggle('on', s.id === tab));
  $('#' + tab).innerHTML = views[tab]();
}
document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => { tab = b.dataset.t; render(); });
$('#month').value = month;
$('#month').onchange = e => { if (e.target.value) { month = e.target.value; render(); } };
(async () => { const d = await api.load(); if (d) db = d; render(); lockScreen(); })();
