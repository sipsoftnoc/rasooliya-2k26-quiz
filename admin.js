const $ = id => document.getElementById(id);
const A = { password: sessionStorage.getItem("rasooliyaAdminPassword") || "", questions: [], active: null };

async function api(action, method="GET", body=null) {
  const opts = { method, headers: {} };
  if (A.password) opts.headers["x-admin-password"] = A.password;
  if (body) { opts.headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(body); }
  const r = await fetch(`/api?action=${encodeURIComponent(action)}`, opts);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "Server error");
  return data;
}
function formatTime(ms){const s=Math.max(0,Math.ceil(ms/1000));return `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`}

async function login(e){
  e.preventDefault();
  const pass=$("password").value;
  try{
    await api("adminStatus","GET",null); // validates env if available
    const check = await fetch(`/api?action=adminStatus`, {headers:{"x-admin-password":pass}});
    if(!check.ok) throw new Error("Password തെറ്റാണ്");
    A.password=pass; sessionStorage.setItem("rasooliyaAdminPassword",pass);
    showAdmin(); await refresh();
  }catch(err){$("loginMsg").textContent=err.message}
}
function showAdmin(){$("loginCard").classList.add("hidden");$("adminApp").classList.remove("hidden")}
function logout(){sessionStorage.removeItem("rasooliyaAdminPassword");location.reload()}

async function refresh(){
  try{
    const data=await api("adminData");
    A.questions=data.questions||[];
    A.active=data.active;
    renderQuestions();
    renderActive(data);
    renderScores(data.scores||[]);
    $("contestStatus").textContent = data.active ? (data.active.finished ? "Finished" : `Question ${data.active.question.number} Live`) : "Waiting";
  }catch(err){
    if(String(err.message).toLowerCase().includes("password")){sessionStorage.removeItem("rasooliyaAdminPassword");location.reload();}
  }
}

function renderQuestions(){
  $("questionCount").textContent=A.questions.length;
  $("questionList").innerHTML=A.questions.length ? A.questions.map(q=>`
    <div class="question-item ${A.active?.question?.id===q.id?"active":""}">
      <h3>Q${q.number}. ${escapeHtml(q.text)}</h3>
      <div class="meta">Correct answer: ${escapeHtml(q.correctAnswer || "—")}</div>
      <div class="question-actions">
        <button class="btn primary small" onclick="startQuestion('${q.id}')">Start</button>
        <button class="btn danger small" onclick="deleteQuestion('${q.id}')">Delete</button>
      </div>
    </div>`).join("") : `<div class="muted">ചോദ്യങ്ങൾ ഒന്നുമില്ല.</div>`;
}

function renderActive(data){
  const a=data.active;
  if(!a){$("activeQuestionBox").innerHTML=`<div class="muted">നിലവിൽ ചോദ്യം ആരംഭിച്ചിട്ടില്ല.</div>`;$("submissionList").innerHTML="";return;}
  const remaining=Math.max(0,a.endsAt-Date.now());
  $("activeQuestionBox").innerHTML=`
    <strong>Q${a.question.number}. ${escapeHtml(a.question.text)}</strong>
    <div class="meta">Remaining: ${formatTime(remaining)} • Correct answer: ${escapeHtml(a.question.correctAnswer||"—")}</div>`;
  $("submissionList").innerHTML=(data.submissions||[]).length ? data.submissions.map((s,i)=>`
    <div class="submission ${i===0?"first":""}">
      <div class="submission-head">
        <div><strong>${escapeHtml(s.name)}</strong><div class="meta">${escapeHtml(s.mobile)} • ${new Date(s.submittedAt).toLocaleTimeString()}</div></div>
        ${i===0?'<span class="priority">FIRST ANSWER</span>':""}
      </div>
      <div class="submission-answer">${escapeHtml(s.answer)}</div>
      <div class="submission-actions">
        <button class="btn primary small" onclick="mark('${s.id}','correct')">✓ Correct</button>
        <button class="btn danger small" onclick="mark('${s.id}','wrong')">✕ Wrong</button>
        <span class="meta">Status: ${escapeHtml(s.status||"pending")} • Score: ${s.points||0}</span>
      </div>
    </div>`).join("") : `<div class="muted">ഈ ചോദ്യത്തിന് ഉത്തരങ്ങൾ ഇതുവരെ വന്നിട്ടില്ല.</div>`;
}

function renderScores(scores){
  $("scoreList").innerHTML=scores.length?scores.map((s,i)=>`
    <div class="score-row ${i<5?"top":""}">
      <div class="rank">#${i+1}</div><div><strong>${escapeHtml(s.name)}</strong><div class="meta">${escapeHtml(s.mobile)}</div></div><div><strong>${s.score}</strong> pts</div>
    </div>`).join(""):`<div class="muted">Scoreboard ശൂന്യമാണ്.</div>`;
}

async function addQuestion(e){
  e.preventDefault();
  const file=$("qImage").files[0];
  let image="";
  if(file){
    if(file.size>2.5*1024*1024){$("questionMsg").textContent="Image 2.5MB-ൽ താഴെ ആക്കുക.";return;}
    image=await fileToDataURL(file);
  }
  try{
    await api("addQuestion","POST",{text:$("qText").value.trim(),correctAnswer:$("correctAnswer").value.trim(),image});
    $("questionForm").reset();$("imagePreviewWrap").classList.add("hidden");$("questionMsg").textContent="ചോദ്യം ചേർത്തു ✓";refresh();
  }catch(err){$("questionMsg").textContent=err.message}
}
function fileToDataURL(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file)})}
async function deleteQuestion(id){if(!confirm("ഈ ചോദ്യം delete ചെയ്യണോ?"))return;try{await api("deleteQuestion","POST",{id});refresh()}catch(e){alert(e.message)}}
async function startQuestion(id){try{await api("startQuestion","POST",{id});refresh()}catch(e){alert(e.message)}}
async function nextQuestion(){try{await api("nextQuestion","POST",{});refresh()}catch(e){alert(e.message)}}
async function prevQuestion(){try{await api("prevQuestion","POST",{});refresh()}catch(e){alert(e.message)}}
async function stopQuestion(){try{await api("stopQuestion","POST",{});refresh()}catch(e){alert(e.message)}}
async function mark(id,status){try{await api("markAnswer","POST",{id,status,points:status==="correct"?1:0});refresh()}catch(e){alert(e.message)}}
async function resetContest(){if(!confirm("Contest data reset ചെയ്യണോ? Participants, answers, scores എന്നിവ reset ചെയ്യും."))return;try{await api("reset","POST",{});refresh()}catch(e){alert(e.message)}}
function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

$("loginForm").addEventListener("submit",login);
$("questionForm").addEventListener("submit",addQuestion);
$("qImage").addEventListener("change",()=>{const f=$("qImage").files[0];if(f){$("imagePreview").src=URL.createObjectURL(f);$("imagePreviewWrap").classList.remove("hidden")}});
$("logoutAdmin").addEventListener("click",logout);
$("nextBtn").addEventListener("click",nextQuestion);
$("prevBtn").addEventListener("click",prevQuestion);
$("startBtn").addEventListener("click",()=>A.questions[0]&&startQuestion(A.questions[0].id));
$("stopBtn").addEventListener("click",stopQuestion);
$("resetBtn").addEventListener("click",resetContest);

if(A.password){showAdmin();refresh()}
setInterval(()=>{if(!$("adminApp").classList.contains("hidden"))refresh()},2000);
