const $ = (id) => document.getElementById(id);
const state = { participant: null, active: null, questions: [] };

async function api(action, method="GET", body=null) {
  const opts = { method, headers: {} };
  if (body) { opts.headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(body); }
  const r = await fetch(`/api?action=${encodeURIComponent(action)}`, opts);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "Server error");
  return data;
}

function loadParticipant() {
  try { return JSON.parse(localStorage.getItem("rasooliyaParticipant") || "null"); } catch { return null; }
}
function saveParticipant(p) { localStorage.setItem("rasooliyaParticipant", JSON.stringify(p)); }

async function register(e) {
  e.preventDefault();
  $("registerMsg").textContent = "രജിസ്റ്റർ ചെയ്യുന്നു...";
  try {
    const p = await api("register", "POST", { name: $("name").value.trim(), mobile: $("mobile").value.trim() });
    state.participant = p.participant;
    saveParticipant(state.participant);
    showQuiz();
  } catch (err) { $("registerMsg").textContent = err.message; }
}

function showQuiz() {
  $("registerCard").classList.add("hidden");
  $("quizCard").classList.remove("hidden");
  $("participantName").textContent = state.participant.name;
}

function logout() {
  localStorage.removeItem("rasooliyaParticipant");
  location.reload();
}

function formatTime(ms) {
  const sec = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(sec/60)).padStart(2,"0")}:${String(sec%60).padStart(2,"0")}`;
}

async function submitAnswer(e) {
  e.preventDefault();
  if (!state.active || $("submitAnswer").disabled) return;
  const answer = $("answer").value.trim();
  if (!answer) return;
  $("submitAnswer").disabled = true;
  try {
    await api("submit", "POST", {
      participantId: state.participant.id,
      questionId: state.active.question.id,
      answer
    });
    $("answerForm").classList.add("hidden");
    $("submittedBox").classList.remove("hidden");
  } catch (err) {
    $("submitAnswer").disabled = false;
    alert(err.message);
  }
}

function renderActive(payload) {
  const active = payload.active;
  if (!active) {
    state.active = null;
    $("waiting").classList.remove("hidden");
    $("questionArea").classList.add("hidden");
    $("finished").classList.add("hidden");
    return;
  }
  if (active.finished) {
    $("waiting").classList.add("hidden");
    $("questionArea").classList.add("hidden");
    $("finished").classList.remove("hidden");
    return;
  }
  state.active = active;
  $("waiting").classList.add("hidden");
  $("finished").classList.add("hidden");
  $("questionArea").classList.remove("hidden");
  $("questionNumber").textContent = `ചോദ്യം ${active.question.number}`;
  $("questionText").textContent = active.question.text;
  if (active.question.image) {
    $("questionImage").src = active.question.image;
    $("questionImage").classList.remove("hidden");
  } else $("questionImage").classList.add("hidden");

  const remaining = Math.max(0, active.endsAt - Date.now());
  $("timer").textContent = formatTime(remaining);
  $("timer").classList.toggle("low", remaining <= 30000);

  if (active.submitted) {
    $("answerForm").classList.add("hidden");
    $("submittedBox").classList.remove("hidden");
  } else {
    $("answerForm").classList.remove("hidden");
    $("submittedBox").classList.add("hidden");
    $("submitAnswer").disabled = remaining <= 0;
  }
}

async function refresh() {
  try {
    const payload = await api("public");
    renderActive(payload);
  } catch {}
}

$("registerForm").addEventListener("submit", register);
$("answerForm").addEventListener("submit", submitAnswer);
$("logoutBtn").addEventListener("click", logout);

state.participant = loadParticipant();
if (state.participant) showQuiz();
refresh();
setInterval(refresh, 1000);
setInterval(() => {
  if (state.active && !state.active.finished) {
    const remaining = Math.max(0, state.active.endsAt - Date.now());
    $("timer").textContent = formatTime(remaining);
    $("timer").classList.toggle("low", remaining <= 30000);
    if (remaining <= 0) $("submitAnswer").disabled = true;
  }
}, 250);
