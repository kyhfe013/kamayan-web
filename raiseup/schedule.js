(function (root) {
  'use strict';
  var DAY = 86400000;
  function jstDay(time) { return new Date(time + 9 * 3600000).toISOString().slice(0, 10); }
  function validate(payload) {
    if (!payload || payload.ok !== true || !Array.isArray(payload.events) ||
        !Number.isFinite(Date.parse(payload.fetchedAt))) throw new Error('Invalid schedule');
    var seen = new Set();
    return payload.events.map(function (e) {
      var start = Date.parse(e.startsAt), end = Date.parse(e.endsAt);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date) || !Number.isFinite(start) ||
          end !== start + 2 * 3600000 || jstDay(start) !== e.date ||
          !/^第\d+回$/.test(e.round) || !['', '受付中', '受付停止'].includes(e.status) ||
          e.submissionDeadline !== new Date(Date.parse(e.date + 'T00:00:00Z') - 3 * DAY).toISOString().slice(0, 10) ||
          seen.has(e.date)) throw new Error('Invalid event');
      seen.add(e.date);
      return {date: e.date, startsAt: e.startsAt, endsAt: e.endsAt, round: e.round,
        status: e.status, submissionDeadline: e.submissionDeadline};
    }).sort(function (a, b) { return Date.parse(a.startsAt) - Date.parse(b.startsAt); });
  }
  function upcoming(events, now) {
    return events.filter(function (e) { return Date.parse(e.endsAt) > now; }).slice(0, 3);
  }
  function formatDate(date, year) {
    var d = new Date(date + 'T00:00:00+09:00');
    return new Intl.DateTimeFormat('ja-JP', {timeZone: 'Asia/Tokyo',
      year: year ? 'numeric' : undefined, month: 'long', day: 'numeric', weekday: 'short'})
      .format(d).replace(/\((.)\)/, '（$1）');
  }
  var api = {validate: validate, upcoming: upcoming, formatDate: formatDate};
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  var document = root.document;
  if (!document) return;
  var events = [], sequence = 0, running = false, lastAttempt = 0;
  var status = document.getElementById('schedule-status');
  var source = document.getElementById('schedule-source');
  function render() {
    var now = Date.now(), list = upcoming(events, now), next = list[0];
    document.querySelector('[data-next-date]').textContent = next ? formatDate(next.date, false) : '日程を調整中';
    var intro = document.querySelector('[data-schedule-intro]');
    var faq = document.querySelector('[data-schedule-faq]');
    var table = document.querySelector('[data-schedule-list]');
    table.replaceChildren();
    list.forEach(function (e, i) {
      if (i) table.appendChild(document.createElement('br'));
      table.appendChild(document.createTextNode(e.round + ' ' + formatDate(e.date, true)));
    });
    if (!next) {
      table.textContent = '決まり次第ご案内します。';
      intro.textContent = '次回の日程は参加申込フォームをご確認ください。';
      faq.textContent = '1on1シート（自己紹介シート）です。記入は15〜30分ほど。提出期限は参加申込フォームをご確認ください。';
      return;
    }
    var deadline = formatDate(next.submissionDeadline, false);
    var passed = jstDay(now) > next.submissionDeadline;
    intro.replaceChildren(document.createTextNode('次回は'));
    var strong = document.createElement('strong'); strong.textContent = formatDate(next.date, false);
    intro.append(strong, document.createTextNode('。'), document.createElement('br'));
    if (passed) {
      intro.appendChild(document.createTextNode('1on1シートの提出期限は終了しました。提出については運営へご連絡ください。'));
    } else {
      intro.appendChild(document.createTextNode('1on1シートは'));
      var due = document.createElement('strong'); due.textContent = deadline;
      intro.append(due, document.createTextNode('までにご提出ください。'), document.createElement('br'),
        document.createTextNode('そのシートをもとに、テーブルを組みます。'));
    }
    faq.textContent = '1on1シート（自己紹介シート）です。記入は15〜30分ほど。開催3日前までにご提出ください（次回は' +
      deadline + 'まで' + (passed ? '・提出期限終了' : '') + '）。';
  }
  function request() {
    return new Promise(function (resolve, reject) {
      var callback = '__raiseupSchedule' + (++sequence), script = document.createElement('script');
      var timer = setTimeout(function () { cleanup(); reject(new Error('Timeout')); }, 20000);
      function cleanup() { clearTimeout(timer); script.remove(); delete root[callback]; }
      root[callback] = function (data) { cleanup(); resolve(data); };
      script.onerror = function () { cleanup(); reject(new Error('Request failed')); };
      script.referrerPolicy = 'no-referrer';
      var url = new URL(source.dataset.endpoint);
      url.searchParams.set('action', 'schedule'); url.searchParams.set('callback', callback);
      url.searchParams.set('_', String(Date.now())); script.src = url.toString();
      document.head.appendChild(script);
    });
  }
  async function sync() {
    if (running) return;
    running = true; lastAttempt = Date.now();
    try {
      var payload = await request(), updated = validate(payload);
      events = updated; render();
      status.textContent = ''; status.dataset.state = 'live'; status.dataset.fetchedAt = payload.fetchedAt;
    } catch (_) {
      render(); status.textContent = '日程を再確認できませんでした。最新情報は参加申込フォームをご確認ください。';
      status.dataset.state = 'stale';
    } finally { running = false; }
  }
  try { events = validate(JSON.parse(source.textContent)); } catch (_) { events = []; }
  render(); sync();
  setInterval(function () { if (!document.hidden) { render(); if (Date.now() - lastAttempt >= 60000) sync(); } }, 60000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) { render(); sync(); } });
})(typeof window !== 'undefined' ? window : globalThis);
