const $ = id => document.getElementById(id);
let payload = null;

async function api(action) {
  const r = await fetch(`/api?action=${encodeURIComponent(action)}`);
  return r.json();
}
function formatTime(ms) {
  const sec = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(sec/60)).padStart(2,"0")}:${String(sec%60).padStart(2,"0")}`;
}
function render(data) {
  payload = data;
  const a = data.active;
  $("participantCount").textContent = `${data.participantCount || 0} മത്സരാർത്ഥികൾ`;
  if (!a || a.finished) {
    $("screenQNumber").textContent = a?.finished ? "FINISHED" : "LIVE";
    $("screenQText").textContent = a?.finished ? "മത്സരം അവസാനിച്ചു — ഫലം താഴെ" : "മത്സരം ആരംഭിക്കുന്നതിനായി കാത്തിരിക്കുക";
    $("screenTimer").textContent = "00:00";
    $("screenQImage").classList.add("hidden");
  } else {
    $("screenQNumber").textContent = `ചോദ്യം ${a.question.number}`;
    $("screenQText").textContent = a.question.text;
    $("screenTimer").textContent = formatTime(a.endsAt - Date.now());
    $("screenTimer").style.opacity = (a.endsAt-Date.now()) <= 30000 ? ".55" : "1";
    if (a.question.image) {
      $("screenQImage").src = a.question.image;
      $("screenQImage").classList.remove("hidden");
    } else $("screenQImage").classList.add("hidden");
  }
  const scores = data.scores || [];
  $("topFive").innerHTML = scores.slice(0,5).map((s,i) => `
    <div class="top-card">
      <div class="rank">#${i+1}</div>
      <div class="name">${escapeHtml(s.name)}</div>
      <div class="points">${s.score} പോയിന്റ്</div>
    </div>`).join("");
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
async function refresh() {
  try { render(await api("public")); } catch {}
}
refresh();
setInterval(refresh, 1000);
setInterval(() => {
  if (payload?.active && !payload.active.finished) {
    $("screenTimer").textContent = formatTime(payload.active.endsAt - Date.now());
  }
}, 250);
