// 旧公開先の端末記録を、新しい会員ページの本人用リンクへ引き継ぐ。
// 鍵はフラグメントに保持し、クエリ文字列・アクセスログへ含めない。
const memberPage = new URL('https://members.re-rayzner.jp/');
const explicitKey = location.hash.match(/^#attendance-key=([a-f0-9]{64})$/);
let deviceKey = '';
try { deviceKey = localStorage.getItem('rr-attendance-key-v1') || ''; } catch (error) { /* 記録不可の場合は通常表示へ */ }
const replyKey = explicitKey ? explicitKey[1] : /^[a-f0-9]{64}$/.test(deviceKey) ? deviceKey : '';
if (replyKey) memberPage.hash = 'attendance-key=' + replyKey;
else if (['#attendance', '#calendar', '#membership'].includes(location.hash)) memberPage.hash = location.hash;
document.getElementById('member-page').href = memberPage.href;
location.replace(memberPage.href);
