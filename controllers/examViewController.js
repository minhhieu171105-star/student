const path = require('path');
const fs = require('fs');
const now = () => Math.floor(Date.now() / 1000);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function layout(test) {
  const n = (test.questions || []).length;
  const limit = Math.max(1, Math.min(n, Number(test.questions_per_student || n)));
  const order = Array.from({ length: n }, (_, i) => i);
  if (limit < n) shuffle(order);
  order.length = limit;
  if (test.shuffle_questions) shuffle(order);
  else order.sort((a, b) => a - b);
  const opts = order.map(() => test.shuffle_questions ? shuffle(['A', 'B', 'C', 'D']) : ['A', 'B', 'C', 'D']);
  return { question_order: order, option_orders: opts };
}

function questions(test, a) {
  return (a.question_order || test.questions.map((_, i) => i)).map((source, pos) => {
    const q = test.questions[source];
    const letters = a.option_orders?.[pos] || ['A', 'B', 'C', 'D'];
    return {
      q: q.q,
      opts: letters.map(x => q.opts['ABCD'.indexOf(x)]),
      key: String(letters.indexOf(q.key) >= 0 ? 'ABCD'[letters.indexOf(q.key)] : q.key),
      points: q.points ?? null
    };
  });
}

function score(qs, answers) {
  let s = 0;
  qs.forEach((q, i) => {
    if (String(answers?.[i] || '').toUpperCase() === q.key) {
      s += q.points == null ? 10 / qs.length : Number(q.points);
    }
  });
  return Math.round(s * 100) / 100;
}

function renderPortal({ name, tests, grouped, section, selected, attemptNo }) {
  const menu = `<div class="portal-tabs">
    <a class="portal-tab${section === 'all' ? ' active' : ''}" href="/?section=all">Tất cả kỳ thi <span class="tab-count">${tests.length}</span></a>
    <a class="portal-tab${section === 'results' ? ' active' : ''}" href="/?section=results">Kết quả &amp; lịch sử</a>
  </div>`;

  const cards = tests.map(t => {
    const id = String(t._id);
    const idAttr = esc(id);
    const list = grouped[id] || [];
    const active = list.find(a => !a.submitted_at);
    const chosen = attemptNo ? list.find(a => Number(a.attempt_no) === attemptNo) : (active || list[0]);
    const complete = !!chosen?.submitted_at;
    const max = Number(t.max_attempts ?? 1);
    const canStart = max === 0 || list.length < max;
    const isSelected = selected === id;

    if (section === 'results' && !complete && !list.some(a => a.submitted_at)) return '';

    const attempt = isSelected ? (attemptNo ? chosen : active) : null;
    const visible = attempt ? questions(t, attempt) : [];
    const correctCount = attempt?.submitted_at
      ? visible.reduce((count, question, index) => count + (String(attempt.answers?.[index] || '').toUpperCase() === question.key ? 1 : 0), 0)
      : 0;
    const status = active ? 'Đang làm' : complete ? 'Đã nộp' : now() < t.starts_at ? 'Sắp mở' : 'Đang mở';
    const meta = `<div class="exam-meta"><span>📅 Bắt đầu: ${new Date(t.starts_at * 1000).toLocaleString('vi-VN')}</span><span>⏳ Hạn nộp: ${t.no_deadline ? 'Không giới hạn' : new Date(t.ends_at * 1000).toLocaleString('vi-VN')}</span><span>⏱️ ${Number(t.duration_minutes)} phút</span><span>🔄 Lượt: ${list.length} / ${max === 0 ? 'Không giới hạn' : max}</span></div>`;

    let actions = '';
    if (!isSelected) {
      if (active) actions = `<a class="button" href="/exam?test=${encodeURIComponent(id)}&amp;attempt_no=${active.attempt_no}">Tiếp tục làm bài (lượt ${active.attempt_no})</a>`;
      else if (now() < t.starts_at) actions = '<p>Kỳ thi chưa đến giờ mở.</p>';
      else if (!t.no_deadline && now() > t.ends_at) actions = '<p>Thời gian làm bài đã kết thúc.</p>';
      else if (canStart) actions = `<form method="post" action="/exam" class="start-form"><input type="hidden" name="test_id" value="${idAttr}"><input type="hidden" name="action" value="start"><button>Bắt đầu lượt ${list.length + 1}</button></form>`;
      else actions = '<p>Bạn đã dùng hết số lượt làm bài được giao.</p>';
      if (complete) actions += `<div style="width:100%;margin-top:6px"><p style="margin:4px 0">Điểm lượt gần nhất: <strong>${esc(chosen.score)}/10</strong></p><a href="/?test=${encodeURIComponent(id)}&amp;attempt_no=${chosen.attempt_no}&amp;section=results">Xem bài làm &amp; đáp án →</a></div>`;
    } else if (!attempt) {
      actions = canStart && now() >= t.starts_at && (t.no_deadline || now() <= t.ends_at)
        ? `<form method="post" action="/exam" class="start-form"><input type="hidden" name="test_id" value="${idAttr}"><input type="hidden" name="action" value="start"><button>Bắt đầu lượt ${list.length + 1}</button></form>`
        : '<p>Không có lượt thi đang làm hoặc lượt thi này không còn khả dụng.</p>';
    } else if (attempt.submitted_at) {
      actions = `<h3>Kết quả · Lượt ${attempt.attempt_no}</h3><p class="result">${esc(attempt.score)} / 10 điểm</p><p class="result-summary">Đúng <strong>${correctCount} / ${visible.length}</strong> câu</p>${visible.map((q, i) => `<article class="question-review"><strong>Câu ${i + 1}. ${esc(q.q)}</strong><p>Bạn chọn: ${esc(attempt.answers?.[i] || 'Chưa trả lời')} · Đáp án đúng: <strong>${q.key}</strong> (${esc(q.opts['ABCD'.indexOf(q.key)] || '')})</p></article>`).join('')}<div class="history"><h3>Lịch sử lượt làm</h3>${list.filter(a => a.submitted_at).map(a => `<a href="/?test=${encodeURIComponent(id)}&amp;attempt_no=${a.attempt_no}&amp;section=results">Lượt ${a.attempt_no} · ${esc(a.score)} điểm</a>`).join('')}</div>${canStart && now() >= t.starts_at && (t.no_deadline || now() <= t.ends_at) ? `<div style="margin-top:14px"><form method="post" action="/exam" class="start-form"><input type="hidden" name="test_id" value="${idAttr}"><input type="hidden" name="action" value="start"><button>Bắt đầu lượt tiếp theo</button></form></div>` : ''}`;
    } else {
      const panels = visible.map((q, i) => `<section class="question-panel" data-i="${i}" ${i ? 'hidden' : ''}><h3>Câu ${i + 1}. ${esc(q.q)}</h3>${['A', 'B', 'C', 'D'].map((letter, j) => `<div class="choice"><button type="button" data-answer="${letter}" data-i="${i}" class="${attempt.answers?.[i] === letter ? 'selected' : ''}"><strong>${letter}.</strong> ${esc(q.opts[j])}</button></div>`).join('')}</section>`).join('');
      actions = `<div class="timer-panel">Thời gian còn lại: <strong id="clock" data-deadline="${Number(attempt.deadline)}"></strong></div><div id="exam" data-id="${idAttr}" data-no="${Number(attempt.attempt_no)}"><div id="progress"></div>${panels}<div class="exam-nav"><button type="button" id="prev">← Câu trước</button><button type="button" id="next">Câu tiếp theo →</button></div><p id="save-status" aria-live="polite"></p><button type="button" id="submit">Nộp bài</button></div><script>(()=>{const box=document.querySelector('#exam'),id=box.dataset.id,no=box.dataset.no,panels=[...box.querySelectorAll('.question-panel')],prog=document.querySelector('#progress'),status=document.querySelector('#save-status');let current=0,queue=Promise.resolve(),sent=false;function show(i){current=Math.max(0,Math.min(panels.length-1,i));panels.forEach((p,j)=>p.hidden=j!==current);prog.textContent='Câu '+(current+1)+' / '+panels.length;document.querySelector('#prev').disabled=current===0;document.querySelector('#next').disabled=current===panels.length-1}async function post(data){const r=await fetch('/exam',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({test_id:id,attempt_no:no,...data})});const j=await r.json();if(!r.ok||!j.ok)throw Error(j.error||'error');return j}box.addEventListener('click',e=>{const b=e.target.closest('[data-answer]');if(b){const i=Number(b.dataset.i);panels[i].querySelectorAll('[data-answer]').forEach(x=>x.classList.toggle('selected',x===b));status.textContent='Đang lưu câu trả lời…';queue=queue.then(()=>post({action:'answer',question:i,answer:b.dataset.answer})).then(()=>status.textContent='Đã lưu câu trả lời').catch(()=>status.textContent='Không lưu được, hãy thử lại');}if(e.target.id==='prev')show(current-1);if(e.target.id==='next')show(current+1);if(e.target.id==='submit')submit()});show(0);async function submit(){if(sent)return;sent=true;try{await queue;await post({action:'submit'});location.replace('/?test='+encodeURIComponent(id)+'&section=results')}catch(e){sent=false;status.textContent='Không nộp được bài. Thử lại.'}}document.addEventListener('visibilitychange',async()=>{if(!document.hidden||sent)return;try{const j=await post({action:'violation'});alert(j.submitted?'Bạn đã rời trang 3 lần. Bài thi tự động nộp.':'Cảnh báo: rời trang thi ('+j.count+'/3 lần).');if(j.submitted)location.replace('/?test='+encodeURIComponent(id)+'&section=results')}catch(e){}});const clock=document.querySelector('#clock');function tick(){let left=Number(clock.dataset.deadline)-Math.floor(Date.now()/1000);if(left<=0){submit();return}clock.textContent=Math.floor(left/60)+':'+String(left%60).padStart(2,'0')}tick();setInterval(tick,1000)})();</script>`;
    }
    return `<section class="card exam-card"><div class="exam-card-heading"><div><h2>${esc(t.title)}</h2>${meta}</div><span class="status ${active ? 'status-live' : complete ? 'status-done' : ''}">${status}</span></div>${actions}</section>`;
  }).join('');

  const empty = tests.length === 0 ? `
<div class="empty-state-card">
  <div class="empty-icon-wrap">
    📄
    <span class="empty-check">✓</span>
  </div>
  <h2 class="empty-title">Chưa có bài thi nào</h2>
  <p class="empty-desc">Hiện tại bạn đã hoàn thành hết bài tập. Khi giáo viên giao bài mới, kỳ thi sẽ xuất hiện tại đây ngay lập tức.</p>
  <button type="button" class="empty-refresh-btn" onclick="location.reload()">↻ Kiểm tra bài mới</button>
</div>
<div class="tip-card">
  <div class="tip-icon-wrap">💡</div>
  <div>
    <p class="tip-title">Mẹo làm bài thi online</p>
    <p class="tip-desc">Đảm bảo kết nối mạng ổn định và chuẩn bị không gian yên tĩnh trước mỗi giờ thi.</p>
  </div>
</div>` : '';

  const pageScript = `document.querySelectorAll('.start-form').forEach(f=>f.addEventListener('submit',async e=>{e.preventDefault();const b=f.querySelector('button');b.disabled=true;try{const d=await(await fetch('/exam',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(new FormData(f))})).json();if(!d.ok)throw Error(d.error||'Không thể bắt đầu');location.href='/exam?test='+encodeURIComponent(f.elements.test_id.value)+'&attempt_no='+encodeURIComponent(d.attempt_no)}catch(err){alert(err.message);b.disabled=false}}))`;

  return fs.readFileSync(path.join(__dirname, '..', 'public', 'portal.html'), 'utf8')
    .replaceAll('{{NAME}}', esc(name)).replace('{{MENU}}', menu).replace('{{EMPTY}}', empty)
    .replace('{{CARDS}}', cards).replace('{{PAGE_SCRIPT}}', pageScript);
}

function loginHtml(error = '', confirmName = '') {
  const form = confirmName
    ? `<div class="notice">Xin chào <strong>${esc(confirmName)}</strong>. Đây có phải tài khoản của bạn?</div><form method="post" action="/login"><button name="action" value="confirm">Xác nhận và vào hệ thống</button><button class="button-secondary" name="action" value="cancel">Không phải tôi</button></form>`
    : `<form method="post" action="/login"><input type="hidden" name="action" value="lookup"><label for="birth_date">Mật khẩu (ngày sinh)</label><input id="birth_date" name="birth_date" type="password" inputmode="numeric" pattern="[0-9]{8}" maxlength="8" placeholder="Ví dụ: 01012006" required autofocus><button>Kiểm tra tài khoản</button></form><p style="margin-top:12px;font-size:12px;color:var(--muted)">Nhập 8 chữ số theo thứ tự ngày, tháng, năm.</p>`;
  return fs.readFileSync(path.join(__dirname, '..', 'public', 'login.html'), 'utf8')
    .replace('{{ERROR}}', error ? `<div class="notice notice-error" role="alert">${esc(error)}</div>` : '').replace('{{FORM}}', form);
}

module.exports = { esc, shuffle, layout, questions, score, renderPortal, loginHtml };
