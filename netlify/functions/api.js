import { getStore } from "@netlify/blobs";

const store = getStore({
  name: "rasooliya-quiz",
  consistency: "strong"
});

const json = (statusCode, data) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "no-store"
  },
  body: JSON.stringify(data)
});

async function getData() {
  const data = await store.get("quiz-data", { type: "json" });

  return data || {
    participants: [],
    questions: [],
    submissions: [],
    active: null
  };
}

async function saveData(data) {
  await store.setJSON("quiz-data", data);
}

function adminPasswordOk(event) {
  const password = process.env.ADMIN_PASSWORD;
  const supplied = event.headers?.["x-admin-password"] || "";

  return Boolean(password && supplied && supplied === password);
}

function id() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function publicData(data) {
  const participants = data.participants || [];
  const submissions = data.submissions || [];

  const scoresMap = {};

  for (const p of participants) {
    scoresMap[p.id] = {
      id: p.id,
      name: p.name,
      mobile: p.mobile,
      score: 0
    };
  }

  for (const s of submissions) {
    if (scoresMap[s.participantId] && s.status === "correct") {
      scoresMap[s.participantId].score += Number(s.points || 0);
    }
  }

  const scores = Object.values(scoresMap)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  return {
    participantCount: participants.length,
    active: data.active,
    scores
  };
}

function adminData(data) {
  const submissions = [...(data.submissions || [])]
    .filter(s => !data.active || s.questionId === data.active.question?.id)
    .sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));

  const scores = publicData(data).scores;

  return {
    questions: data.questions || [],
    active: data.active,
    submissions,
    scores
  };
}

export const handler = async (event) => {
  try {
    const params = event.queryStringParameters || {};
    const action = params.action || "public";
    const method = event.httpMethod || "GET";

    const data = await getData();

    // PUBLIC
    if (action === "public" && method === "GET") {
      return json(200, publicData(data));
    }

    // ADMIN STATUS
    if (action === "adminStatus" && method === "GET") {
      if (!process.env.ADMIN_PASSWORD) {
        return json(500, { error: "ADMIN_PASSWORD environment variable is missing" });
      }

      if (!event.headers?.["x-admin-password"]) {
        return json(200, { configured: true });
      }

      if (!adminPasswordOk(event)) {
        return json(401, { error: "Password തെറ്റാണ്" });
      }

      return json(200, { ok: true });
    }

    // Everything below requires admin password
    const adminActions = [
      "adminData",
      "addQuestion",
      "deleteQuestion",
      "startQuestion",
      "nextQuestion",
      "prevQuestion",
      "stopQuestion",
      "markAnswer",
      "reset"
    ];

    if (adminActions.includes(action) && !adminPasswordOk(event)) {
      return json(401, { error: "Admin password തെറ്റാണ്" });
    }

    // ADMIN DATA
    if (action === "adminData" && method === "GET") {
      return json(200, adminData(data));
    }

    // REGISTER
    if (action === "register" && method === "POST") {
      const body = JSON.parse(event.body || "{}");

      const name = String(body.name || "").trim();
      const mobile = String(body.mobile || "").trim();

      if (!name || !mobile) {
        return json(400, { error: "പേര്, മൊബൈൽ നമ്പർ നൽകുക" });
      }

      let participant = data.participants.find(p => p.mobile === mobile);

      if (!participant) {
        participant = {
          id: id(),
          name,
          mobile,
          createdAt: new Date().toISOString()
        };

        data.participants.push(participant);
      } else {
        participant.name = name;
      }

      await saveData(data);

      return json(200, { participant });
    }

    // SUBMIT ANSWER
    if (action === "submit" && method === "POST") {
      const body = JSON.parse(event.body || "{}");

      const participantId = String(body.participantId || "");
      const questionId = String(body.questionId || "");
      const answer = String(body.answer || "").trim();

      if (!participantId || !questionId || !answer) {
        return json(400, { error: "Answer details incomplete" });
      }

      const participant = data.participants.find(p => p.id === participantId);

      if (!participant) {
        return json(404, { error: "Participant not found" });
      }

      const active = data.active;

      if (!active || active.finished || active.question?.id !== questionId) {
        return json(400, { error: "ഈ ചോദ്യം ഇപ്പോൾ active അല്ല" });
      }

      if (Date.now() > active.endsAt) {
        return json(400, { error: "Time കഴിഞ്ഞു" });
      }

      const already = data.submissions.find(
        s => s.participantId === participantId && s.questionId === questionId
      );

      if (already) {
        return json(400, { error: "ഈ ചോദ്യത്തിന് നിങ്ങൾ ഇതിനകം answer submit ചെയ്തു" });
      }

      const submission = {
        id: id(),
        participantId,
        questionId,
        name: participant.name,
        mobile: participant.mobile,
        answer,
        submittedAt: new Date().toISOString(),
        status: "pending",
        points: 0
      };

      data.submissions.push(submission);

      await saveData(data);

      return json(200, { ok: true, submission });
    }

    // ADD QUESTION
    if (action === "addQuestion" && method === "POST") {
      const body = JSON.parse(event.body || "{}");

      const text = String(body.text || "").trim();
      const correctAnswer = String(body.correctAnswer || "").trim();
      const image = String(body.image || "");

      if (!text || !correctAnswer) {
        return json(400, { error: "Question and correct answer ആവശ്യമാണ്" });
      }

      const question = {
        id: id(),
        number: data.questions.length + 1,
        text,
        correctAnswer,
        image
      };

      data.questions.push(question);

      await saveData(data);

      return json(200, { ok: true, question });
    }

    // DELETE QUESTION
    if (action === "deleteQuestion" && method === "POST") {
      const body = JSON.parse(event.body || "{}");
      const questionId = String(body.id || "");

      data.questions = data.questions
        .filter(q => q.id !== questionId)
        .map((q, index) => ({
          ...q,
          number: index + 1
        }));

      data.submissions = data.submissions.filter(
        s => s.questionId !== questionId
      );

      if (data.active?.question?.id === questionId) {
        data.active = null;
      }

      await saveData(data);

      return json(200, { ok: true });
    }

    // START QUESTION
    if (action === "startQuestion" && method === "POST") {
      const body = JSON.parse(event.body || "{}");
      const questionId = String(body.id || "");

      const question = data.questions.find(q => q.id === questionId);

      if (!question) {
        return json(404, { error: "Question not found" });
      }

      data.active = {
        question,
        startedAt: Date.now(),
        endsAt: Date.now() + 3 * 60 * 1000,
        finished: false
      };

      await saveData(data);

      return json(200, { ok: true, active: data.active });
    }

    // NEXT QUESTION
    if (action === "nextQuestion" && method === "POST") {
      let index = -1;

      if (data.active?.question?.id) {
        index = data.questions.findIndex(
          q => q.id === data.active.question.id
        );
      }

      const next = data.questions[index + 1];

      if (!next) {
        data.active = data.active
          ? { ...data.active, finished: true }
          : null;

        await saveData(data);

        return json(200, { ok: true, active: data.active });
      }

      data.active = {
        question: next,
        startedAt: Date.now(),
        endsAt: Date.now() + 3 * 60 * 1000,
        finished: false
      };

      await saveData(data);

      return json(200, { ok: true, active: data.active });
    }

    // PREVIOUS QUESTION
    if (action === "prevQuestion" && method === "POST") {
      let index = -1;

      if (data.active?.question?.id) {
        index = data.questions.findIndex(
          q => q.id === data.active.question.id
        );
      }

      const previous = data.questions[index - 1];

      if (!previous) {
        return json(400, { error: "Previous question ഇല്ല" });
      }

      data.active = {
        question: previous,
        startedAt: Date.now(),
        endsAt: Date.now() + 3 * 60 * 1000,
        finished: false
      };

      await saveData(data);

      return json(200, { ok: true, active: data.active });
    }

    // STOP QUESTION
    if (action === "stopQuestion" && method === "POST") {
      if (data.active) {
        data.active.finished = true;
      }

      await saveData(data);

      return json(200, { ok: true, active: data.active });
    }

    // MARK ANSWER
    if (action === "markAnswer" && method === "POST") {
      const body = JSON.parse(event.body || "{}");

      const submission = data.submissions.find(
        s => s.id === String(body.id || "")
      );

      if (!submission) {
        return json(404, { error: "Submission not found" });
      }

      const status = body.status === "correct" ? "correct" : "wrong";

      submission.status = status;
      submission.points = status === "correct"
        ? Number(body.points || 1)
        : 0;

      await saveData(data);

      return json(200, { ok: true, submission });
    }

    // RESET
    if (action === "reset" && method === "POST") {
      const fresh = {
        participants: [],
        questions: [],
        submissions: [],
        active: null
      };

      await saveData(fresh);

      return json(200, { ok: true });
    }

    return json(404, { error: `Unknown action: ${action}` });

  } catch (error) {
    console.error(error);

    return json(500, {
      error: error?.message || "Server error"
    });
  }
};
