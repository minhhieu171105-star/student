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

function renderPortal({ name, tests, grouped, section, selected, attemptNo, viewDetail = '', vocabSets = [], selectedVocabId = '' }) {
  const menu = `<div class="portal-tabs">
    <a class="portal-tab${(section === 'all' || !section) && !viewDetail ? ' active' : ''}" href="/?section=all">Tất cả kỳ thi <span class="tab-count">${tests.length}</span></a>
    <a class="portal-tab${section === 'vocab' ? ' active' : ''}" href="/?section=vocab">📖 Ôn luyện từ vựng <span class="tab-count">${vocabSets.length}</span></a>
  </div>`;

  let content = '';
  let empty = '';

  // 1. Detailed Review / Results view (when clicking "Xem bài làm & đáp án")
  if (viewDetail === 'results' && selected) {
    const t = tests.find(item => String(item._id) === selected);
    const list = grouped[selected] || [];
    const chosen = attemptNo ? list.find(a => Number(a.attempt_no) === attemptNo) : (list.find(a => a.submitted_at) || list[0]);

    if (t && chosen && chosen.submitted_at) {
      const visible = questions(t, chosen);
      const correctCount = visible.reduce((count, q, index) =>
        count + (String(chosen.answers?.[index] || '').toUpperCase() === q.key ? 1 : 0), 0);
      const max = Number(t.max_attempts ?? 1);
      const canStart = max === 0 || list.length < max;

      content = `
        <div style="margin-bottom:16px;">
          <a class="back-link" href="/?section=all">← Quay lại danh sách kỳ thi</a>
        </div>
        <section class="card" style="padding:24px;margin-bottom:20px;">
          <div style="border-bottom:1px solid var(--line);padding-bottom:16px;margin-bottom:20px;">
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
              <h2 style="font-size:20px;margin:0;color:var(--ink);">${esc(t.title)}</h2>
              <span class="status status-done">Lượt ${chosen.attempt_no}</span>
            </div>
            <div style="margin-top:8px;font-size:13px;color:var(--muted);">
              Nộp lúc: ${chosen.submitted_at ? new Date(chosen.submitted_at * 1000).toLocaleString('vi-VN') : '—'} · Lượt: ${chosen.attempt_no} / ${max === 0 ? 'Không giới hạn' : max}
            </div>
          </div>

          <div class="result-stats">
            <div class="result-stat result-stat-score">
              <div class="result-stat-label">Điểm số</div>
              <div class="result-stat-value">${esc(chosen.score)}<span> / 10</span></div>
            </div>
            <div class="result-stat result-stat-correct">
              <div class="result-stat-label">Số câu đúng</div>
              <div class="result-stat-value">✓ ${correctCount} câu</div>
            </div>
            <div class="result-stat result-stat-wrong">
              <div class="result-stat-label">Số câu sai</div>
              <div class="result-stat-value">✗ ${visible.length - correctCount} câu</div>
            </div>
            <div class="result-stat result-stat-total">
              <div class="result-stat-label">Tổng số câu</div>
              <div class="result-stat-value">${visible.length} câu</div>
            </div>
          </div>

          <h3 style="font-size:16px;margin:24px 0 14px;">Chi tiết từng câu hỏi</h3>
          ${visible.map((q, i) => {
            const studentAns = String(chosen.answers?.[i] || '').toUpperCase();
            const isCorrect = studentAns === q.key;
            const badgeBg = isCorrect ? '#d1fae5' : '#fee2e2';
            const badgeColor = isCorrect ? '#065f46' : '#991b1b';
            return `
              <article class="question-review" style="padding:14px 0;border-top:1px solid var(--line);">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:6px;">
                  <strong style="color:var(--ink);flex:1;min-width:0;overflow-wrap:anywhere;">Câu ${i+1}. ${esc(q.q)}</strong>
                  <span style="display:inline-flex;align-items:center;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:700;background:${badgeBg};color:${badgeColor};flex-shrink:0;white-space:nowrap;">${isCorrect ? '✓ Đúng' : '✗ Sai'}</span>
                </div>
                <div style="font-size:13px;line-height:1.6;">
                  <p style="margin:2px 0;">Bạn chọn: <strong>${studentAns || '—'}</strong>${studentAns && 'ABCD'.indexOf(studentAns) >= 0 ? '. ' + esc(q.opts['ABCD'.indexOf(studentAns)]) : (studentAns ? '' : ' (Chưa trả lời)')}</p>
                  ${!isCorrect ? `<p style="margin:2px 0;color:#15803d;">Đáp án đúng: <strong>${q.key}</strong>. ${esc(q.opts['ABCD'.indexOf(q.key)] || '')}</p>` : ''}
                </div>
              </article>
            `;
          }).join('')}

          ${list.filter(a => a.submitted_at).length > 1 ? `
            <div class="history" style="margin-top:24px;padding-top:16px;border-top:1px solid var(--line);">
              <h3 style="font-size:14px;margin-bottom:8px;">Các lượt làm bài khác của bạn:</h3>
              <div style="display:flex;gap:8px;flex-wrap:wrap;">
                ${list.filter(a => a.submitted_at).map(a => `
                  <a class="button button-secondary" style="font-size:12px;padding:4px 10px;" href="/?test=${encodeURIComponent(selected)}&amp;attempt_no=${a.attempt_no}&amp;view_detail=results">Lượt ${a.attempt_no}: ${esc(a.score)} điểm</a>
                `).join('')}
              </div>
            </div>
          ` : ''}

          ${canStart && now() >= t.starts_at && (t.no_deadline || now() <= t.ends_at) ? `
            <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--line);">
              <form method="post" action="/exam" class="start-form">
                <input type="hidden" name="test_id" value="${esc(selected)}">
                <input type="hidden" name="action" value="start">
                <button type="submit">Bắt đầu lượt tiếp theo (${list.length + 1})</button>
              </form>
            </div>
          ` : ''}
        </section>
      `;
    }
  }

  // 2. Vocabulary Practice section
  else if (section === 'vocab') {
    if (selectedVocabId) {
      const vocab = vocabSets.find(v => String(v._id) === selectedVocabId);
      if (vocab) {
        const words = vocab.words || [];
        content = `
          <div style="margin-bottom:16px;">
            <a class="back-link" href="/?section=vocab">← Danh sách bộ từ vựng</a>
          </div>
          <div class="card" style="margin-bottom:20px;">
            <div class="vocab-detail-header">
              <div>
                <div class="vocab-detail-badges">
                  <span class="vocab-badge-lang">${esc(vocab.language || 'Ngoại ngữ')}</span>
                  <span class="vocab-badge-level">${esc(vocab.level || 'Cơ bản')}</span>
                </div>
                <h2 class="vocab-detail-title">${esc(vocab.title)}</h2>
                <p class="vocab-detail-meta">📖 ${words.length} từ vựng cần ôn tập</p>
              </div>
              <div class="vocab-detail-tabs">
                <button type="button" class="button" id="tab-flashcard-btn" style="font-size:13px;padding:6px 14px;">🎴 Thẻ Flashcard</button>
                <button type="button" class="button button-secondary" id="tab-list-btn" style="font-size:13px;padding:6px 14px;">📋 Bảng từ vựng</button>
              </div>
            </div>
          </div>

          <!-- FLASHCARD VIEW -->
          <div id="flashcard-view" class="flashcard-arena">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <span id="fc-counter" style="font-size:13px;font-weight:700;color:var(--muted);">Từ 1 / ${words.length}</span>
            </div>

            <div class="flashcard-wrap" id="fc-click-area">
              <div class="flashcard" id="fc-card">
                <div id="fc-face-front">
                  <div class="flashcard-word" id="fc-word-text">—</div>
                  <button type="button" class="speak-btn" id="fc-speak-btn">🔊 Nghe phát âm</button>
                </div>
                <div id="fc-face-back" style="display:none;">
                  <div style="font-size:12px;color:var(--muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em;font-weight:700;">Nghĩa tiếng Việt</div>
                  <div class="flashcard-meaning" id="fc-meaning-text">—</div>
                  <code id="fc-sub-phonetic" style="display:block;margin-top:14px;color:var(--primary);font-size:14px;"></code>
                </div>
              </div>
            </div>
            <div style="display:flex;justify-content:center;margin-top:14px;">
              <button type="button" class="button button-secondary" id="fc-shuffle-btn">🔀 Trộn từ</button>
            </div>
          </div>

          <!-- WORD LIST VIEW -->
          <div id="list-view" class="card" style="display:none;">
            <div style="margin-bottom:14px;">
              <input type="search" id="vocab-table-search" placeholder="🔍 Tìm kiếm từ vựng, phiên âm hoặc nghĩa..." style="max-width:360px;">
            </div>
            <div class="table-wrap">
              <table id="vocab-study-table">
                <thead>
                  <tr><th>STT</th><th>Từ vựng</th><th>Phát âm</th><th>Phiên âm</th><th>Tiếng Việt (Nghĩa)</th></tr>
                </thead>
                <tbody>
                  ${words.map((w, idx) => `
                    <tr data-word="${esc(w.word.toLowerCase())}" data-meaning="${esc(w.meaning.toLowerCase())}">
                      <td>${idx + 1}</td>
                      <td><strong style="color:var(--ink);font-size:15px;">${esc(w.word)}</strong></td>
                      <td><button type="button" class="speak-btn" style="min-height:28px;padding:2px 10px;font-size:12px;" data-speak-word="${esc(w.word)}">🔊 Nghe</button></td>
                      <td><code style="color:var(--primary);font-size:13px;">${esc(w.phonetic || '—')}</code></td>
                      <td><span style="font-weight:600;color:#15803d;">${esc(w.meaning)}</span></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <script>
          (function() {
            const rawWords = ${JSON.stringify(words)};
            let words = [...rawWords];
            let currentIdx = 0;
            let isFlipped = false;
            const langName = ${JSON.stringify(vocab.language || 'Tiếng Anh')};

            function getVoiceLang() {
              const l = langName.toLowerCase();
              if (l.includes('nhật')) return 'ja-JP';
              if (l.includes('hàn')) return 'ko-KR';
              if (l.includes('trung')) return 'zh-CN';
              if (l.includes('pháp')) return 'fr-FR';
              if (l.includes('đức')) return 'de-DE';
              return 'en-US';
            }

            window.speakWord = function(text) {
              if (!text || !window.speechSynthesis) return;
              window.speechSynthesis.cancel();
              const u = new SpeechSynthesisUtterance(text);
              u.lang = getVoiceLang();
              const voicePrefix = u.lang.slice(0, 2).toLowerCase();
              const voice = window.speechSynthesis.getVoices().find(item => item.lang.toLowerCase().startsWith(voicePrefix));
              if (voice) u.voice = voice;
              u.rate = 0.9;
              window.speechSynthesis.speak(u);
              window.speechSynthesis.resume();
              window.setTimeout(() => window.speechSynthesis.resume(), 150);
            };

            const card = document.getElementById('fc-card');
            const front = document.getElementById('fc-face-front');
            const back = document.getElementById('fc-face-back');
            const wordEl = document.getElementById('fc-word-text');
            const meaningEl = document.getElementById('fc-meaning-text');
            const subPhoneticEl = document.getElementById('fc-sub-phonetic');
            const counterEl = document.getElementById('fc-counter');

            function renderCard() {
              if (!words.length) return;
              const w = words[currentIdx];
              wordEl.textContent = w.word || '';
              meaningEl.textContent = w.meaning || '';
              subPhoneticEl.textContent = w.phonetic ? w.phonetic : '';
              counterEl.textContent = 'Từ ' + (currentIdx + 1) + ' / ' + words.length;
              isFlipped = false;
              card.classList.remove('is-flipped');
              front.style.display = 'block';
              back.style.display = 'none';
            }

            function toggleFlip() {
              isFlipped = !isFlipped;
              card.classList.toggle('is-flipped', isFlipped);
              front.style.display = isFlipped ? 'none' : 'block';
              back.style.display = isFlipped ? 'block' : 'none';
            }

            let didSwipe = false;
            document.getElementById('fc-click-area').addEventListener('click', (e) => {
              if (e.target.closest('#fc-speak-btn')) return;
              if (didSwipe) { didSwipe = false; return; }
              toggleFlip();
            });

            document.getElementById('fc-speak-btn').addEventListener('click', (e) => {
              e.stopPropagation();
              if (words[currentIdx]) speakWord(words[currentIdx].word);
            });

            document.getElementById('list-view').addEventListener('click', event => {
              const button = event.target.closest('[data-speak-word]');
              if (button) speakWord(button.dataset.speakWord || '');
            });

            function previousWord() {
              currentIdx = (currentIdx - 1 + words.length) % words.length;
              renderCard();
            }

            function nextWord() {
              currentIdx = (currentIdx + 1) % words.length;
              renderCard();
            }

            document.getElementById('fc-shuffle-btn').addEventListener('click', () => {
              for (let i = words.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [words[i], words[j]] = [words[j], words[i]];
              }
              currentIdx = 0;
              renderCard();
            });

            let dragStartX = null;
            let dragDeltaX = 0;
            let isAnimating = false;
            const swipeArea = document.getElementById('fc-click-area');
            function resetCardPosition() {
              card.style.transition = 'transform .2s ease, opacity .2s ease';
              card.style.transform = '';
              card.style.opacity = '';
            }
            function changeWordByDrag(direction) {
              if (isAnimating) return;
              isAnimating = true;
              didSwipe = true;
              const exitX = direction < 0 ? -window.innerWidth : window.innerWidth;
              card.style.transition = 'transform .18s ease-in, opacity .18s ease-in';
              card.style.transform = 'translateX(' + exitX + 'px) rotate(' + (direction * 10) + 'deg)';
              card.style.opacity = '0';
              window.setTimeout(() => {
                if (direction < 0) nextWord(); else previousWord();
                card.style.transition = 'none';
                card.style.transform = 'translateX(' + (-exitX) + 'px) rotate(' + (-direction * 8) + 'deg)';
                card.style.opacity = '0';
                requestAnimationFrame(() => requestAnimationFrame(() => {
                  resetCardPosition();
                  isAnimating = false;
                }));
              }, 180);
            }
            swipeArea.addEventListener('pointerdown', event => {
              if (event.target.closest('#fc-speak-btn') || isAnimating) return;
              dragStartX = event.clientX;
              dragDeltaX = 0;
              swipeArea.setPointerCapture?.(event.pointerId);
              card.style.transition = 'none';
            });
            swipeArea.addEventListener('pointermove', event => {
              if (dragStartX === null) return;
              dragDeltaX = event.clientX - dragStartX;
              card.style.transform = 'translateX(' + dragDeltaX + 'px) rotate(' + (dragDeltaX / 24) + 'deg)';
              card.style.opacity = String(Math.max(.45, 1 - Math.abs(dragDeltaX) / 420));
            });
            swipeArea.addEventListener('pointerup', event => {
              if (dragStartX === null) return;
              const delta = dragDeltaX;
              dragStartX = null;
              if (Math.abs(delta) < 70) return resetCardPosition();
              changeWordByDrag(delta < 0 ? -1 : 1);
            });
            swipeArea.addEventListener('pointercancel', () => { dragStartX = null; resetCardPosition(); });

            document.addEventListener('keydown', (e) => {
              if (document.activeElement.tagName === 'INPUT') return;
              if (e.key === 'ArrowRight') nextWord();
              if (e.key === 'ArrowLeft') previousWord();
              if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleFlip(); }
            });

            // View toggle (Flashcard vs List)
            const flashcardView = document.getElementById('flashcard-view');
            const listView = document.getElementById('list-view');
            const tabFcBtn = document.getElementById('tab-flashcard-btn');
            const tabListBtn = document.getElementById('tab-list-btn');

            tabFcBtn.addEventListener('click', () => {
              flashcardView.style.display = 'block';
              listView.style.display = 'none';
              tabFcBtn.className = 'button';
              tabListBtn.className = 'button button-secondary';
            });

            tabListBtn.addEventListener('click', () => {
              flashcardView.style.display = 'none';
              listView.style.display = 'block';
              tabListBtn.className = 'button';
              tabFcBtn.className = 'button button-secondary';
            });

            // Search filter for table
            const searchInput = document.getElementById('vocab-table-search');
            if (searchInput) {
              searchInput.addEventListener('input', function() {
                const q = this.value.toLowerCase().trim();
                document.querySelectorAll('#vocab-study-table tbody tr').forEach(tr => {
                  const w = tr.getAttribute('data-word') || '';
                  const m = tr.getAttribute('data-meaning') || '';
                  tr.style.display = (w.includes(q) || m.includes(q)) ? '' : 'none';
                });
              });
            }

            renderCard();
          })();
          </script>
        `;
      }
    } else {
      // List of assigned vocab sets
      if (!vocabSets.length) {
        content = `
          <div class="empty-state-card">
            <div class="empty-icon-wrap">📖</div>
            <h2 class="empty-title">Chưa có bộ từ vựng nào</h2>
            <p class="empty-desc">Khi giáo viên giao bài ôn tập từ vựng, các bộ từ vựng sẽ hiển thị tại đây để bạn luyện tập.</p>
          </div>
        `;
      } else {
        content = `
          <div class="vocab-grid">
            ${vocabSets.map(v => `
              <div class="vocab-card">
                <div>
                  <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;">
                    <span class="vocab-badge-lang">${esc(v.language || 'Ngoại ngữ')}</span>
                    <span class="vocab-badge-level">${esc(v.level || 'Cơ bản')}</span>
                  </div>
                  <h3 style="margin:0 0 8px;font-size:17px;font-weight:700;color:var(--ink);">${esc(v.title)}</h3>
                  <p style="margin:0;font-size:13px;color:var(--muted);">📖 ${v.words?.length || v.total_words || 0} từ vựng kèm phiên âm và nghĩa</p>
                </div>
                <div style="margin-top:14px;">
                  <a class="button" style="width:100%;" href="/?section=vocab&amp;vocab_id=${encodeURIComponent(String(v._id))}">🚀 Bắt đầu ôn luyện</a>
                </div>
              </div>
            `).join('')}
          </div>
        `;
      }
    }
  }

  // 3. Exam list (default section === 'all')
  else {
    const cards = tests.map(t => {
      const id = String(t._id);
      const idAttr = esc(id);
      const list = grouped[id] || [];
      const active = list.find(a => !a.submitted_at);
      const chosen = attemptNo ? list.find(a => Number(a.attempt_no) === attemptNo) : (active || list[0]);
      const complete = !!chosen?.submitted_at;
      const max = Number(t.max_attempts ?? 1);
      const canStart = max === 0 || list.length < max;
      const status = active ? 'Đang làm' : complete ? 'Đã nộp' : now() < t.starts_at ? 'Sắp mở' : 'Đang mở';
      const meta = `<div class="exam-meta"><span>📅 Bắt đầu: ${new Date(t.starts_at * 1000).toLocaleString('vi-VN')}</span><span>⏳ Hạn nộp: ${t.no_deadline ? 'Không giới hạn' : new Date(t.ends_at * 1000).toLocaleString('vi-VN')}</span><span>⏱️ ${Number(t.duration_minutes)} phút</span><span>🔄 Lượt: ${list.length} / ${max === 0 ? 'Không giới hạn' : max}</span></div>`;

      let actions = '';
      if (active) actions = `<a class="button" href="/exam?test=${encodeURIComponent(id)}&amp;attempt_no=${active.attempt_no}">Tiếp tục làm bài (lượt ${active.attempt_no})</a>`;
      else if (now() < t.starts_at) actions = '<p>Kỳ thi chưa đến giờ mở.</p>';
      else if (!t.no_deadline && now() > t.ends_at) actions = '<p>Thời gian làm bài đã kết thúc.</p>';
      else if (canStart) actions = `<form method="post" action="/exam" class="start-form"><input type="hidden" name="test_id" value="${idAttr}"><input type="hidden" name="action" value="start"><button>Bắt đầu lượt ${list.length + 1}</button></form>`;
      else actions = '<p>Bạn đã dùng hết số lượt làm bài được giao.</p>';
      if (complete) actions += `<div style="width:100%;margin-top:8px"><p style="margin:4px 0">Điểm lượt gần nhất: <strong style="color:var(--primary);font-size:15px;">${esc(chosen.score)}/10</strong></p><a class="button button-secondary" style="font-size:13px;padding:6px 14px;" href="/?test=${encodeURIComponent(id)}&amp;attempt_no=${chosen.attempt_no}&amp;view_detail=results">Xem bài làm &amp; đáp án →</a></div>`;
      return `<section class="card exam-card"><div class="exam-card-heading"><div><h2>${esc(t.title)}</h2>${meta}</div><span class="status ${active ? 'status-live' : complete ? 'status-done' : ''}">${status}</span></div>${actions}</section>`;
    }).join('');

    if (tests.length === 0) {
      empty = `
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
</div>`;
    }

    content = cards;
  }

  const pageScript = `document.querySelectorAll('.start-form').forEach(f=>f.addEventListener('submit',async e=>{e.preventDefault();const b=f.querySelector('button');b.disabled=true;try{const d=await(await fetch('/exam',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(new FormData(f))})).json();if(!d.ok)throw Error(d.error||'Không thể bắt đầu');location.href='/exam?test='+encodeURIComponent(f.elements.test_id.value)+'&attempt_no='+encodeURIComponent(d.attempt_no)}catch(err){alert(err.message);b.disabled=false}}))`;

  return fs.readFileSync(path.join(__dirname, '..', 'public', 'portal.html'), 'utf8')
    .replaceAll('{{NAME}}', esc(name)).replace('{{MENU}}', menu).replace('{{EMPTY}}', empty)
    .replace('{{CARDS}}', content).replace('{{PAGE_SCRIPT}}', pageScript);
}

function loginHtml(error = '', confirmName = '') {
  const form = confirmName
    ? `<div class="student-confirm"><p>Xin chào <strong>${esc(confirmName)}</strong>.</p><p>Đây có phải tài khoản của bạn?</p></div><form method="post" action="/login"><button name="action" value="confirm">Xác nhận và vào hệ thống</button><button class="button-secondary" name="action" value="cancel">Không phải tôi</button></form>`
    : `<form method="post" action="/login"><input type="hidden" name="action" value="lookup"><label for="birth_date">Mật khẩu (ngày sinh)</label><input id="birth_date" name="birth_date" type="password" inputmode="numeric" pattern="[0-9]{8}" maxlength="8" placeholder="Ví dụ: 01012006" required autofocus><button>Kiểm tra tài khoản</button></form><p style="margin-top:12px;font-size:12px;color:var(--muted)">Nhập 8 chữ số theo thứ tự ngày, tháng, năm.</p>`;
  return fs.readFileSync(path.join(__dirname, '..', 'public', 'login.html'), 'utf8')
    .replace('{{ERROR}}', error ? `<div class="notice notice-error" role="alert">${esc(error)}</div>` : '').replace('{{FORM}}', form);
}

module.exports = { esc, shuffle, layout, questions, score, renderPortal, loginHtml };
