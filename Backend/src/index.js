const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const natural = require("natural");
const pdfParse = require("pdf-parse");
const { v4: uuidv4 } = require("uuid");
const { evaluateSubjectiveAnswer, getEvaChatResponse } = require("./services/aiService");

let mongoose = null;
try {
  // Optional: enable MongoDB persistence if `mongoose` is installed.
  mongoose = require("mongoose");
} catch (_error) {
  mongoose = null;
}

function loadDotEnv(envPath) {
  try {
    // Minimal .env loader (no external dependency).
    // Format: KEY=VALUE, with optional quotes. Lines starting with # are ignored.
    const content = require("fs").readFileSync(envPath, "utf8");
    content.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const idx = trimmed.indexOf("=");
      if (idx === -1) return;
      const key = trimmed.slice(0, idx).trim();
      let value = trimmed.slice(idx + 1).trim();
      value = value.replace(/^"(.+)"$/, "$1").replace(/^'(.+)'$/, "$1");
      if (!process.env[key]) process.env[key] = value;
    });
  } catch (_error) {
    // Ignore missing .env
  }
}

loadDotEnv(path.join(__dirname, "..", ".env"));

const DEFAULT_PORT = 5050;
const PORT = Number(process.env.PORT) || DEFAULT_PORT;
const uploadDir = path.join(__dirname, "..", "uploads");
const MONGODB_URI = process.env.MONGODB_URI || "";
const JWT_SECRET = process.env.JWT_SECRET || "evalo_dev_secret_change_me";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
const DATA_DIR = path.join(__dirname, "..", "data");
const FILE_STORE_PATH = path.join(DATA_DIR, "store.json");

const MAX_BOOK_SIZE_MB = 20;
const MAX_BOOK_FILES = 5;
const ALLOWED_EXTENSIONS = new Set([".pdf", ".txt"]);
const ROLES = ["student", "teacher", "admin"];
// Exam modes removed from UI; keep defaults for backward compatibility if clients still send `examMode`.
const EXAM_MODE_CONFIG = {
  MTE: { questionCount: 6, durationMinutes: 35 },
  ETE: { questionCount: 10, durationMinutes: 60 }
};

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: MAX_BOOK_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      cb(new Error("Only PDF and TXT books are allowed."));
      return;
    }
    cb(null, true);
  }
});

const tokenizer = new natural.WordTokenizer();

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

// Simple Request Logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Health Check
app.get("/api/health", (req, res) => res.json({ ok: true, timestamp: new Date().toISOString() }));

const bookSessions = new Map();
const quizSessions = new Map();
const tests = new Map();
const users = new Map();
const usersByEmail = new Map();

let dbReady = false;

const LEVELS = ["beginner", "intermediate", "advanced"];
const LEVEL_INDEX = { beginner: 0, intermediate: 1, advanced: 2 };
const DIFFICULTY_LABELS = ["easy", "medium", "hard"];
const QUESTION_FORMATS = ["subjective", "mcq", "mixed"];

function mapDifficultyToLevel(input) {
  const raw = String(input || "").trim().toLowerCase();
  if (raw === "easy") return "beginner";
  if (raw === "hard") return "advanced";
  if (raw === "medium") return "intermediate";
  return null;
}

function normalizeQuestionFormat(input) {
  const raw = String(input || "").trim().toLowerCase();
  if (QUESTION_FORMATS.includes(raw)) return raw;
  return "subjective";
}

function topicMatchScore(topicTokens, question) {
  if (!topicTokens?.length) return 0;
  const keyTokens = (question.keywords || []).map((t) => natural.PorterStemmer.stem(String(t).toLowerCase()));
  const refTokens = sentenceStemTokens(question.reference || "");
  const vocabA = topicTokens;
  // Combine weak (keywords) + strong (reference) matching, capped to [0,1].
  const jKey = jaccardScore(vocabA, keyTokens);
  const jRef = jaccardScore(vocabA, refTokens);
  return Math.max(0, Math.min(1, 0.35 * jKey + 0.65 * jRef));
}

function filterBankByTopic(questionBank, topic) {
  const t = String(topic || "").trim();
  if (!t) return questionBank;
  const tokens = sentenceStemTokens(t);
  if (!tokens.length) return questionBank;
  const scored = (questionBank || [])
    .map((q) => ({ q, score: topicMatchScore(tokens, q) }))
    .sort((a, b) => b.score - a.score);
  const strong = scored.filter((s) => s.score >= 0.12).map((s) => s.q);
  // If topic is too narrow, fall back gracefully to full bank.
  return strong.length >= 10 ? strong : questionBank;
}

function firstSentence(text) {
  const t = String(text || "").trim();
  if (!t) return "";
  return (t.split(/(?<=[.!?])\s+/)[0] || t).slice(0, 220);
}

function uniqueChoices(list, max) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const v = String(item || "").trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
    if (out.length >= max) break;
  }
  return out;
}

function buildMcq(question, pool, rand) {
  const correct = firstSentence(question.reference);
  const distractors = [];
  for (let i = 0; i < Math.min(pool.length, 80); i += 1) {
    const candidate = pool[Math.floor(rand() * pool.length)];
    if (!candidate || candidate.id === question.id) continue;
    distractors.push(firstSentence(candidate.reference));
    if (distractors.length >= 8) break;
  }
  const choices = uniqueChoices([correct, ...distractors], 4);
  while (choices.length < 4) {
    choices.push(`None of the above (review the reference).`);
  }
  // Shuffle but keep track of correct index.
  const shuffled = [...choices].sort(() => rand() - 0.5);
  const correctIndex = Math.max(0, shuffled.findIndex((c) => c === correct));
  return { choices: shuffled, correctIndex, explanation: question.reference || "" };
}

function ensureQuestionFormatOnBank(bank, format, seedInput) {
  if (!Array.isArray(bank) || !bank.length) return [];
  const rand = mulberry32(hashString(seedInput));
  const out = bank.map((q, idx) => {
    const next = { ...q };
    const mode = format === "mixed" ? (idx % 2 === 0 ? "mcq" : "subjective") : format;
    next.type = mode;
    if (mode === "mcq") {
      const built = buildMcq(q, bank, rand);
      next.choices = built.choices;
      next.correctIndex = built.correctIndex;
      next.explanation = built.explanation;
      // Make prompt MCQ friendly.
      next.prompt = `Select the best-supported statement based on the book: ${generatePrompt(
        firstSentence(q.reference || q.prompt),
        q.keywords || topKeywords(q.reference || q.prompt, 3),
        q.difficulty,
        rand
      )}`;
    } else {
      next.choices = undefined;
      next.correctIndex = undefined;
      next.explanation = q.reference || "";
    }
    return next;
  });
  return out;
}

let UserModel = null;
let BookSessionModel = null;
let TestModel = null;
let QuizSessionModel = null;
let UserHistoryModel = null;
let GlobalSettingsModel = null;

if (mongoose) {
  const UserSchema = new mongoose.Schema(
    {
      _id: String,
      name: String,
      email: { type: String, unique: true, index: true },
      passwordHash: String,
      role: { type: String, enum: ROLES, default: "student" },
      isApproved: { type: Boolean, default: false },
      createdAt: Date
    },
    { versionKey: false, strict: false }
  );

  const BookSessionSchema = new mongoose.Schema(
    {
      _id: String,
      title: String,
      createdAt: String,
      ownerId: String,
      fileNames: [String],
      chunks: [{ id: String, text: String }],
      questionBank: [mongoose.Schema.Types.Mixed],
      flowCounter: { type: Number, default: 0 },
      issuedFlowFingerprints: [String]
    },
    { versionKey: false, strict: false }
  );

  const TestSchema = new mongoose.Schema(
    {
      _id: String,
      title: String,
      joinCode: { type: String, index: true },
      bookSessionId: String,
      examMode: String,
      durationMinutes: Number,
      questionCount: Number,
      initialLevel: String,
      totalMarks: Number,
      marksPerQuestion: Number,
      startsAt: String,
      createdBy: String,
      createdAt: String,
      active: Boolean,
      attempts: [mongoose.Schema.Types.Mixed]
    },
    { versionKey: false, strict: false }
  );

  const QuizSessionSchema = new mongoose.Schema(
    {
      _id: String,
      testId: { type: String, index: true },
      bookSessionId: String,
      studentId: { type: String, index: true },
      initialLevel: String,
      currentLevel: String,
      questionCount: Number,
      askedQuestionIds: [String],
      responses: [mongoose.Schema.Types.Mixed],
      questionBank: [mongoose.Schema.Types.Mixed],
      currentQuestionId: String,
      startedAt: Number,
      deadlineAt: Number,
      completed: { type: Boolean, index: true },
      totalMarks: Number,
      marksPerQuestion: Number,
      rollNo: { type: String, index: true },
      proctor: mongoose.Schema.Types.Mixed
    },
    { versionKey: false, strict: false }
  );

  const UserHistorySchema = new mongoose.Schema(
    {
      userId: { type: String, index: true },
      eventType: String,
      payload: mongoose.Schema.Types.Mixed,
      createdAt: { type: Date, default: Date.now }
    },
    { versionKey: false, strict: false }
  );

  const GlobalSettingsSchema = new mongoose.Schema(
    {
      _id: String,
      allowCopyPaste: { type: Boolean, default: false },
      updatedAt: { type: Date, default: Date.now }
    },
    { versionKey: false, strict: false }
  );

  UserModel = mongoose.models.User || mongoose.model("User", UserSchema);
  BookSessionModel = mongoose.models.BookSession || mongoose.model("BookSession", BookSessionSchema);
  TestModel = mongoose.models.Test || mongoose.model("Test", TestSchema);
  QuizSessionModel = mongoose.models.QuizSession || mongoose.model("QuizSession", QuizSessionSchema);
  UserHistoryModel = mongoose.models.UserHistory || mongoose.model("UserHistory", UserHistorySchema);
  GlobalSettingsModel = mongoose.models.GlobalSettings || mongoose.model("GlobalSettings", GlobalSettingsSchema);
}

function bookDocFromSession(book) {
  return {
    _id: book.id,
    title: book.title,
    createdAt: book.createdAt,
    ownerId: book.ownerId,
    fileNames: book.fileNames,
    chunks: book.chunks,
    questionBank: book.questionBank,
    flowCounter: book.flowCounter || 0,
    issuedFlowFingerprints: [...(book.issuedFlowFingerprints || [])]
  };
}

function bookSessionFromDoc(doc) {
  return {
    id: doc._id,
    title: doc.title,
    createdAt: doc.createdAt,
    ownerId: doc.ownerId,
    fileNames: doc.fileNames || [],
    chunks: doc.chunks || [],
    questionBank: doc.questionBank || [],
    flowCounter: doc.flowCounter || 0,
    issuedFlowFingerprints: new Set(doc.issuedFlowFingerprints || [])
  };
}

function testDocFromModel(test) {
  return {
    _id: test.id,
    title: test.title,
    joinCode: test.joinCode,
    bookSessionId: test.bookSessionId,
    examMode: test.examMode,
    durationMinutes: test.durationMinutes,
    questionCount: test.questionCount,
    initialLevel: test.initialLevel,
    totalMarks: test.totalMarks,
    marksPerQuestion: test.marksPerQuestion,
    startsAt: test.startsAt,
    createdBy: test.createdBy,
    createdAt: test.createdAt,
    active: test.active,
    attempts: test.attempts || [],
    topic: test.topic || null,
    difficulty: test.difficulty || null,
    questionFormat: test.questionFormat || "subjective"
  };
}

function testFromDoc(doc) {
  return {
    id: String(doc._id || doc.id),
    title: doc.title,
    joinCode: doc.joinCode,
    bookSessionId: doc.bookSessionId,
    examMode: doc.examMode,
    durationMinutes: doc.durationMinutes,
    questionCount: doc.questionCount,
    initialLevel: doc.initialLevel,
    totalMarks: doc.totalMarks,
    marksPerQuestion: doc.marksPerQuestion,
    startsAt: doc.startsAt,
    createdBy: doc.createdBy,
    createdAt: doc.createdAt,
    active: doc.active,
    attempts: doc.attempts || [],
    topic: doc.topic || null,
    difficulty: doc.difficulty || null,
    questionFormat: doc.questionFormat || "subjective"
  };
}

function quizDocFromSession(quiz) {
  return {
    _id: quiz.id,
    testId: quiz.testId || null,
    bookSessionId: quiz.bookSessionId,
    studentId: quiz.studentId,
    initialLevel: quiz.initialLevel,
    currentLevel: quiz.currentLevel,
    questionCount: quiz.questionCount,
    askedQuestionIds: quiz.askedQuestionIds || [],
    responses: quiz.responses || [],
    questionBank: quiz.questionBank || [],
    currentQuestionId: quiz.currentQuestionId || null,
    startedAt: quiz.startedAt,
    deadlineAt: quiz.deadlineAt,
    completed: quiz.completed || false,
    completedAt: quiz.completedAt ?? null,
    aiPublishAt: quiz.aiPublishAt ?? null,
    teacherPublishedAt: quiz.teacherPublishedAt ?? null,
    publishCount: quiz.publishCount ?? 0,
    lastPublishedReviewHash: quiz.lastPublishedReviewHash ?? null,
    lastReviewEditedAt: quiz.lastReviewEditedAt ?? null,
    teacherOverallMarks: quiz.teacherOverallMarks ?? null,
    teacherOverallRemark: quiz.teacherOverallRemark ?? null,
    totalMarks: quiz.totalMarks ?? null,
    marksPerQuestion: quiz.marksPerQuestion ?? null,
    topic: quiz.topic ?? null,
    questionFormat: quiz.questionFormat ?? "subjective",
    rollNo: quiz.rollNo || null,
    proctor: quiz.proctor || {}
  };
}

function quizSessionFromDoc(doc) {
  let publishCount = Number(doc.publishCount);
  if (!Number.isFinite(publishCount) || publishCount < 0) publishCount = 0;
  // Backward compatibility: older records may have `teacherPublishedAt` without `publishCount`.
  if (publishCount === 0 && doc.teacherPublishedAt) publishCount = 1;
  return {
    id: String(doc._id || doc.id),
    testId: doc.testId || null,
    bookSessionId: doc.bookSessionId,
    studentId: doc.studentId,
    initialLevel: doc.initialLevel,
    currentLevel: doc.currentLevel,
    questionCount: doc.questionCount,
    askedQuestionIds: doc.askedQuestionIds || [],
    responses: doc.responses || [],
    questionBank: doc.questionBank || [],
    currentQuestionId: doc.currentQuestionId || null,
    startedAt: doc.startedAt,
    deadlineAt: doc.deadlineAt,
    completed: doc.completed || false,
    completedAt: doc.completedAt ?? null,
    aiPublishAt: doc.aiPublishAt ?? null,
    teacherPublishedAt: doc.teacherPublishedAt ?? null,
    publishCount,
    lastPublishedReviewHash: doc.lastPublishedReviewHash ?? null,
    lastReviewEditedAt: doc.lastReviewEditedAt ?? null,
    teacherOverallMarks:
      Number.isFinite(Number(doc.teacherOverallMarks)) ? Number(doc.teacherOverallMarks) : null,
    teacherOverallRemark: doc.teacherOverallRemark ?? null,
    totalMarks: doc.totalMarks ?? null,
    marksPerQuestion: doc.marksPerQuestion ?? null,
    topic: doc.topic ?? null,
    questionFormat: doc.questionFormat ?? "subjective",
    rollNo: doc.rollNo || null,
    proctor: doc.proctor || { riskScore: 0, warningCount: 0, warningMessages: [], events: [] }
  };
}

let fileStore = {
  users: [],
  bookSessions: [],
  tests: [],
  quizSessions: [],
  history: [],
  settings: { allowCopyPaste: false }
};
let fileStoreLoaded = false;
let fileStoreQueue = Promise.resolve();

async function loadFileStore() {
  if (fileStoreLoaded) return;
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const data = JSON.parse(raw);
    fileStore = {
      users: Array.isArray(data.users) ? data.users : [],
      bookSessions: Array.isArray(data.bookSessions) ? data.bookSessions : [],
      tests: Array.isArray(data.tests) ? data.tests : [],
      quizSessions: Array.isArray(data.quizSessions) ? data.quizSessions : [],
      history: Array.isArray(data.history) ? data.history : [],
      settings: data.settings || { allowCopyPaste: false }
    };
  } catch (_error) {
    fileStore = { users: [], bookSessions: [], tests: [], quizSessions: [], history: [], settings: { allowCopyPaste: false } };
    await fs.writeFile(FILE_STORE_PATH, JSON.stringify(fileStore, null, 2), "utf8");
  }
  fileStoreLoaded = true;
}

async function saveFileStore() {
  const tmp = `${FILE_STORE_PATH}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(fileStore, null, 2), "utf8");
  await fs.rename(tmp, FILE_STORE_PATH);
}

function upsertById(list, id, record) {
  const idx = list.findIndex((r) => r && (r.id === id || r._id === id));
  if (idx === -1) list.push(record);
  else list[idx] = record;
}

function findById(list, id) {
  return list.find((r) => r && (r.id === id || r._id === id)) || null;
}

function queueFileStoreWrite(mutator) {
  fileStoreQueue = fileStoreQueue.then(async () => {
    await loadFileStore();
    await mutator();
    await saveFileStore();
  });
  return fileStoreQueue;
}

async function logHistory(userId, eventType, payload = {}) {
  if (!userId) return;
  try {
    if (dbReady && UserHistoryModel) {
      await UserHistoryModel.create({
        userId,
        eventType,
        payload,
        createdAt: new Date()
      });
      return;
    }

    await queueFileStoreWrite(async () => {
      fileStore.history.push({
        id: uuidv4(),
        userId,
        eventType,
        payload,
        createdAt: new Date().toISOString()
      });
      // keep history bounded for file store
      if (fileStore.history.length > 20000) {
        fileStore.history = fileStore.history.slice(-20000);
      }
    });
  } catch (error) {
    console.warn("History log failed:", error.message);
  }
}

async function persistUser(user) {
  if (!user) return;
  if (dbReady && UserModel) {
    await UserModel.findByIdAndUpdate(
      user.id,
      {
        _id: user.id,
        name: user.name,
        email: user.email,
        passwordHash: user.passwordHash,
        role: user.role,
        isApproved: Boolean(user.isApproved),
        createdAt: new Date(user.createdAt || Date.now())
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return;
  }

  await queueFileStoreWrite(async () => {
    upsertById(fileStore.users, user.id, { ...user });
  });
}

async function persistBookSession(book) {
  if (!book) return;
  if (dbReady && BookSessionModel) {
    await BookSessionModel.findByIdAndUpdate(book.id, bookDocFromSession(book), { upsert: true });
    return;
  }
  await queueFileStoreWrite(async () => {
    upsertById(fileStore.bookSessions, book.id, bookDocFromSession(book));
  });
}

async function persistTest(test) {
  if (!test) return;
  if (dbReady && TestModel) {
    await TestModel.findByIdAndUpdate(test.id, testDocFromModel(test), { upsert: true });
    return;
  }
  await queueFileStoreWrite(async () => {
    upsertById(fileStore.tests, test.id, testDocFromModel(test));
  });
}

async function persistQuizSession(quiz) {
  if (!quiz) return;
  if (dbReady && QuizSessionModel) {
    await QuizSessionModel.findByIdAndUpdate(quiz.id, quizDocFromSession(quiz), { upsert: true });
    return;
  }
  await queueFileStoreWrite(async () => {
    upsertById(fileStore.quizSessions, quiz.id, quizDocFromSession(quiz));
  });
}

async function persistSettings(settings) {
  if (dbReady && GlobalSettingsModel) {
    await GlobalSettingsModel.updateOne({ _id: "global" }, settings, { upsert: true });
  }
  fileStore.settings = settings;
  await saveFileStore();
}

function hashString(input) {
  let h = 1779033703 ^ input.length;
  for (let i = 0; i < input.length; i += 1) {
    h = Math.imul(h ^ input.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

function reviewSignatureFromResponses(responses, overallMarks, overallRemark) {
  const list = (responses || [])
    .map((r) => {
      const qid = String(r.questionId || "").trim();
      const marksRaw = r.teacherMarksAwarded;
      const marks = Number.isFinite(Number(marksRaw)) ? Number(Number(marksRaw).toFixed(2)) : null;
      const feedback = String(r.teacherFeedback || "").trim();
      return { qid, marks, feedback };
    })
    .filter((x) => x.qid)
    .sort((a, b) => a.qid.localeCompare(b.qid));

  const payload = {
    responses: list,
    overallMarks: Number.isFinite(Number(overallMarks)) ? Number(Number(overallMarks).toFixed(2)) : null,
    overallRemark: String(overallRemark || "").trim() || null
  };

  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function mulberry32(seed) {
  return function rand() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function cleanText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/[^\x20-\x7E\n\r\t]/g, " ")
    .trim();
}

function splitIntoChunks(text, sentenceWindow = 4) {
  const sentences = cleanText(text)
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 35);

  const chunks = [];
  for (let i = 0; i < sentences.length; i += sentenceWindow) {
    const part = sentences.slice(i, i + sentenceWindow).join(" ");
    if (part.length > 120) {
      chunks.push({
        id: `chunk_${chunks.length + 1}`,
        text: part
      });
    }
  }
  return chunks;
}

function topKeywords(text, count = 8) {
  const tokens = tokenizer
    .tokenize(cleanText(text).toLowerCase())
    .filter((token) => /^[a-z]+$/.test(token))
    .filter((token) => !natural.stopwords.includes(token))
    .filter((token) => token.length > 2);

  const freq = new Map();
  for (const token of tokens) {
    freq.set(token, (freq.get(token) || 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([word]) => word);
}

function sentenceStemTokens(text) {
  return tokenizer
    .tokenize(cleanText(text).toLowerCase())
    .filter((token) => /^[a-z]+$/.test(token))
    .filter((token) => !natural.stopwords.includes(token))
    .filter((token) => token.length > 2)
    .map((token) => natural.PorterStemmer.stem(token));
}

function cosineSimilarity(tokensA, tokensB) {
  const vocab = [...new Set([...tokensA, ...tokensB])];
  if (vocab.length === 0) return 0;

  const freq = (tokens) => {
    const m = new Map();
    for (const token of tokens) {
      m.set(token, (m.get(token) || 0) + 1);
    }
    return m;
  };

  const a = freq(tokensA);
  const b = freq(tokensB);

  let dot = 0;
  let aMag = 0;
  let bMag = 0;

  for (const term of vocab) {
    const av = a.get(term) || 0;
    const bv = b.get(term) || 0;
    dot += av * bv;
    aMag += av * av;
    bMag += bv * bv;
  }

  if (!aMag || !bMag) return 0;
  return dot / (Math.sqrt(aMag) * Math.sqrt(bMag));
}

function jaccardScore(tokensA, tokensB) {
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  if (!setA.size && !setB.size) return 0;
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection += 1;
  }
  const union = setA.size + setB.size - intersection;
  return union ? intersection / union : 0;
}

function generatePrompt(conceptSummary, keywords, difficulty, rand) {
  const kw1 = keywords[0] || "this concept";
  const kw2 = keywords[1] || "its applications";
  const kw3 = keywords[2] || "related principles";

  const beginnerTemplates = [
    `What is ${kw1}? Explain it in your own words with a simple example.`,
    `Define ${kw1} and explain why it is important in the context of ${kw2}.`,
    `In simple terms, describe what happens when ${kw1} is used. Provide a real-world analogy.`,
    `List and briefly explain the key characteristics of ${kw1}.`,
    `How does ${kw1} relate to ${kw2}? Explain with a basic example.`,
    `What problem does ${kw1} solve? Describe a scenario where it would be useful.`
  ];

  const intermediateTemplates = [
    `Compare and contrast ${kw1} with ${kw2}. What are the advantages of each approach?`,
    `Explain the working mechanism of ${kw1}. How does it interact with ${kw2} in practice?`,
    `Describe a real-world scenario where ${kw1} is applied. What challenges might arise and how are they addressed?`,
    `Analyze how ${kw1} impacts ${kw2}. Discuss at least two trade-offs involved.`,
    `What are the key differences between ${kw1} and ${kw3}? When would you choose one over the other?`,
    `Explain the step-by-step process of ${kw1}. What role does ${kw2} play in this process?`
  ];

  const advancedTemplates = [
    `Critically evaluate the effectiveness of ${kw1} in solving problems related to ${kw2}. Discuss its limitations and propose improvements.`,
    `Design a solution using ${kw1} that addresses a complex problem involving ${kw2} and ${kw3}. Justify your design choices.`,
    `Analyze the trade-offs between using ${kw1} versus alternative approaches for ${kw2}. Under what conditions does each excel?`,
    `How would you optimize a system that relies on ${kw1} for ${kw2}? Consider scalability, efficiency, and maintainability.`,
    `Discuss the theoretical foundations of ${kw1}. How do these principles apply to real-world implementations involving ${kw2}?`,
    `Evaluate the impact of ${kw1} on modern practices in ${kw2}. What emerging trends could change this landscape?`
  ];

  let templates;
  if (difficulty === "beginner") templates = beginnerTemplates;
  else if (difficulty === "intermediate") templates = intermediateTemplates;
  else templates = advancedTemplates;

  return templates[Math.floor(rand() * templates.length)];
}

function extractCoreConcepts(chunkText) {
  // Extract the most information-dense sentences from the chunk
  const sentences = chunkText
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 30 && s.length < 500);

  if (sentences.length === 0) return { summary: chunkText.slice(0, 200), sentences: [chunkText.slice(0, 200)] };

  // Score each sentence by keyword density (more unique content words = more informative)
  const scored = sentences.map(s => {
    const words = tokenizer.tokenize(cleanText(s).toLowerCase())
      .filter(t => /^[a-z]+$/.test(t))
      .filter(t => !natural.stopwords.includes(t))
      .filter(t => t.length > 2);
    return { text: s, score: new Set(words).size, words };
  });

  scored.sort((a, b) => b.score - a.score);

  // Take top 3 most informative sentences
  const best = scored.slice(0, 3);
  const summary = best.map(s => s.text).join(" ");
  return { summary, sentences: best.map(s => s.text) };
}

function generateQuestionBank(chunks, seedInput) {
  const rand = mulberry32(hashString(seedInput));
  const bank = [];

  chunks.slice(0, 160).forEach((chunk, index) => {
    const { summary } = extractCoreConcepts(chunk.text);
    const keywords = topKeywords(chunk.text, 10);
    const options = ["beginner", "intermediate", "advanced"];

    const primary = options[Math.floor(rand() * options.length)];
    const secondary = options[Math.floor(rand() * options.length)];

    for (const difficulty of [primary, secondary]) {
      bank.push({
        id: `q_${index + 1}_${difficulty}_${Math.floor(rand() * 100000)}`,
        difficulty,
        prompt: generatePrompt(summary, keywords, difficulty, rand),
        reference: chunk.text,
        keywords: keywords,
        chunkId: chunk.id
      });
    }
  });

  return bank;
}

function adjustLevel(currentLevel, score) {
  let idx = LEVEL_INDEX[currentLevel] ?? 1;
  if (score >= 82 && idx < LEVELS.length - 1) idx += 1;
  if (score <= 45 && idx > 0) idx -= 1;
  return LEVELS[idx];
}

function pickNextQuestion(quizSession, questionBank) {
  if (quizSession.askedQuestionIds.length >= quizSession.questionCount) {
    return null;
  }

  const asked = new Set(quizSession.askedQuestionIds);
  const targetLevel = quizSession.currentLevel;
  const candidates = questionBank.filter((q) => !asked.has(q.id));
  if (!candidates.length) return null;

  const same = candidates.filter((q) => q.difficulty === targetLevel);
  const lower = candidates.filter(
    (q) => LEVEL_INDEX[q.difficulty] === Math.max(0, LEVEL_INDEX[targetLevel] - 1)
  );
  const higher = candidates.filter(
    (q) => LEVEL_INDEX[q.difficulty] === Math.min(2, LEVEL_INDEX[targetLevel] + 1)
  );

  const orderedPool = [...same, ...higher, ...lower];
  const next = orderedPool[0] || candidates[0];
  quizSession.askedQuestionIds.push(next.id);
  return next;
}

function evaluateAnswer(answer, question) {
  const answerTokens = sentenceStemTokens(answer);
  const referenceTokens = sentenceStemTokens(question.reference);

  const cosine = cosineSimilarity(answerTokens, referenceTokens);
  const jaccard = jaccardScore(answerTokens, referenceTokens);

  const answerRaw = tokenizer
    .tokenize(cleanText(answer).toLowerCase())
    .filter((t) => /^[a-z]+$/.test(t));
  const keywordHits = question.keywords.filter((k) => answerRaw.includes(k)).length;
  const keywordCoverage = question.keywords.length ? keywordHits / question.keywords.length : 0;

  const combined = 0.5 * cosine + 0.3 * keywordCoverage + 0.2 * jaccard;
  const percentage = Math.max(0, Math.min(100, Math.round(combined * 100)));

  let feedback = "Weak answer. Add core definitions and technical points from the concept.";
  if (percentage >= 75) {
    feedback = "Strong answer. Good concept coverage and alignment with source material.";
  } else if (percentage >= 50) {
    feedback = "Decent answer. Improve depth and add more key terminology.";
  }

  return {
    percentage,
    details: {
      cosine: Number(cosine.toFixed(3)),
      keywordCoverage: Number(keywordCoverage.toFixed(3)),
      jaccard: Number(jaccard.toFixed(3))
    },
    feedback,
    explanation: question.reference || ""
  };
}

function questionPayload(question, index, total) {
  return {
    id: question.id,
    prompt: question.prompt,
    difficulty: question.difficulty,
    type: question.type || "subjective",
    choices: Array.isArray(question.choices) ? question.choices : null,
    number: index,
    total
  };
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const digest = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${digest}`;
}

function verifyPassword(password, storedHash) {
  const [salt, digest] = String(storedHash || "").split(":");
  if (!salt || !digest) return false;
  const check = crypto.scryptSync(password, salt, 64).toString("hex");
  const digestBuf = Buffer.from(digest, "hex");
  const checkBuf = Buffer.from(check, "hex");
  if (digestBuf.length !== checkBuf.length) return false;
  return crypto.timingSafeEqual(digestBuf, checkBuf);
}

function base64UrlEncode(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input), "utf8");
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(input) {
  const pad = 4 - (input.length % 4 || 4);
  const safe = input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  return Buffer.from(safe, "base64").toString("utf8");
}

function parseExpiresToSeconds(input) {
  const raw = String(input || "").trim().toLowerCase();
  if (!raw) return 7 * 24 * 60 * 60;
  const m = raw.match(/^(\d+)(s|m|h|d)$/);
  if (!m) return 7 * 24 * 60 * 60;
  const n = Number(m[1]);
  const unit = m[2];
  const mult = unit === "s" ? 1 : unit === "m" ? 60 : unit === "h" ? 3600 : 86400;
  return Math.max(60, Math.min(n * mult, 90 * 86400));
}

function signToken(payload) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const exp = now + parseExpiresToSeconds(JWT_EXPIRES_IN);

  const body = { ...payload, iat: now, exp };
  const headerPart = base64UrlEncode(JSON.stringify(header));
  const payloadPart = base64UrlEncode(JSON.stringify(body));
  const data = `${headerPart}.${payloadPart}`;
  const sig = crypto.createHmac("sha256", JWT_SECRET).update(data).digest();
  const sigPart = base64UrlEncode(sig);
  return `${data}.${sigPart}`;
}

function verifyToken(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) return null;
  const [headerPart, payloadPart, sigPart] = parts;
  const data = `${headerPart}.${payloadPart}`;
  const expected = base64UrlEncode(crypto.createHmac("sha256", JWT_SECRET).update(data).digest());
  if (expected.length !== sigPart.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sigPart))) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(payloadPart));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && now > payload.exp) return null;
    return payload;
  } catch (_error) {
    return null;
  }
}

function issueToken(user) {
  return signToken({ uid: user.id, role: user.role });
}

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isApproved: user.role === 'admin' ? true : Boolean(user.isApproved),
    createdAt: user.createdAt
  };
}

async function authRequired(req, res, next) {
  const raw = req.headers.authorization || "";
  const token = raw.startsWith("Bearer ") ? raw.slice(7) : "";
  if (!token) {
    return res.status(401).json({ error: "Unauthorized. Login required." });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: "Invalid or expired session. Please login again." });
  }

  let user = users.get(payload.uid);
  if (!user && dbReady) {
    const userDoc = await UserModel.findById(payload.uid).lean();
    if (userDoc) {
      user = {
        id: String(userDoc._id),
        name: userDoc.name,
        email: userDoc.email,
        passwordHash: userDoc.passwordHash,
        role: userDoc.role,
        isApproved: Boolean(userDoc.isApproved),
        createdAt: userDoc.createdAt?.toISOString?.() || new Date(userDoc.createdAt).toISOString()
      };
      users.set(user.id, user);
      usersByEmail.set(user.email, user.id);
    }
  }
  if (!user) {
    await loadFileStore();
    const stored = findById(fileStore.users, payload.uid);
    if (stored) {
      user = stored;
      users.set(user.id, user);
      usersByEmail.set(user.email, user.id);
    }
  }

  if (!user) {
    return res.status(401).json({ error: "Unauthorized. Login required." });
  }

  req.user = user;
  return next();
}

function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden for your role." });
    }
    return next();
  };
}

function randomJoinCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

async function readBookText(file) {
  const absolute = path.resolve(file.path);
  const extension = path.extname(file.originalname).toLowerCase();
  const isPdf =
    file.mimetype === "application/pdf" ||
    extension === ".pdf" ||
    file.originalname.toLowerCase().endsWith(".pdf");

  try {
    if (isPdf) {
      const dataBuffer = await fs.readFile(absolute);
      const data = await pdfParse(dataBuffer);
      return cleanText(data.text);
    }
    const plain = await fs.readFile(absolute, "utf-8");
    return cleanText(plain);
  } finally {
    await fs.unlink(absolute).catch(() => { });
  }
}

async function createBookSession(files, ownerId) {
  const texts = await Promise.all(files.map((file) => readBookText(file)));
  const combined = cleanText(texts.join(" "));
  if (combined.length < 600) {
    throw new Error("Book content is too short. Upload richer DSA material.");
  }

  const chunks = splitIntoChunks(combined, 4);
  if (!chunks.length) {
    throw new Error("Could not extract enough content from the books.");
  }

  const bookSessionId = uuidv4();
  const questionBank = generateQuestionBank(chunks, `${bookSessionId}_${files[0].originalname}`);
  const firstName = files[0]?.originalname || "Book";
  const title = path.basename(firstName, path.extname(firstName));

  const session = {
    id: bookSessionId,
    title,
    createdAt: new Date().toISOString(),
    ownerId,
    fileNames: files.map((f) => f.originalname),
    chunks,
    questionBank,
    flowCounter: 0,
    issuedFlowFingerprints: new Set()
  };

  bookSessions.set(bookSessionId, session);
  await persistBookSession(session);
  await logHistory(ownerId, "book_session_created", {
    bookSessionId,
    files: session.fileNames,
    chunks: session.chunks.length,
    questions: session.questionBank.length
  });
  return session;
}

function createQuizSession({ bookSession, studentId, initialLevel, questionCount, testId, durationMinutes, topic, questionFormat, rollNo }) {
  const safeLevel = LEVEL_INDEX[initialLevel] !== undefined ? initialLevel : "intermediate";
  const safeQuestionCount = Math.min(Math.max(Number(questionCount) || 8, 1), 20);

  const flowOrdinal = (bookSession.flowCounter || 0) + 1;
  bookSession.flowCounter = flowOrdinal;

  const seed = hashString(`${studentId || "anon"}_${bookSession.id}_${flowOrdinal}`);
  const rand = mulberry32(seed);

  const format = normalizeQuestionFormat(questionFormat);
  const topicFiltered = filterBankByTopic(bookSession.questionBank || [], topic);
  let shuffled = [...topicFiltered].sort(() => rand() - 0.5);
  const flowFingerprintLength = Math.min(safeQuestionCount, 8);
  const usedFingerprints = bookSession.issuedFlowFingerprints || new Set();

  for (let attempt = 0; attempt < shuffled.length; attempt += 1) {
    const fp = shuffled
      .slice(0, flowFingerprintLength)
      .map((q) => q.id)
      .join("|");
    if (!usedFingerprints.has(fp)) {
      usedFingerprints.add(fp);
      break;
    }
    shuffled = [...shuffled.slice(1), shuffled[0]];
  }

  bookSession.issuedFlowFingerprints = usedFingerprints;
  // Persist updated flow state so student flows stay unique after restart.
  persistBookSession(bookSession).catch(() => { });

  // Apply question format (subjective/mcq/mixed) deterministically for this flow.
  shuffled = ensureQuestionFormatOnBank(
    shuffled,
    format,
    `${studentId || "anon"}_${bookSession.id}_${flowOrdinal}_${format}`
  );

  const quizId = uuidv4();
  const startedAt = Date.now();
  const deadlineAt = startedAt + Math.max(5, Number(durationMinutes) || 20) * 60 * 1000;

  const quizSession = {
    id: quizId,
    testId: testId || null,
    bookSessionId: bookSession.id,
    studentId,
    rollNo: rollNo || null,
    initialLevel: safeLevel,
    currentLevel: safeLevel,
    questionCount: safeQuestionCount,
    askedQuestionIds: [],
    responses: [],
    questionBank: shuffled,
    currentQuestionId: null,
    startedAt,
    deadlineAt,
    completed: false,
    publishCount: 0,
    lastPublishedReviewHash: null,
    lastReviewEditedAt: null,
    teacherOverallMarks: null,
    teacherOverallRemark: null,
    totalMarks: 100,
    marksPerQuestion: Number((100 / safeQuestionCount).toFixed(2)),
    topic: String(topic || "").trim() || null,
    questionFormat: format,
    proctor: {
      riskScore: 0,
      warningCount: 0,
      warningMessages: [],
      events: []
    }
  };

  const firstQuestion = pickNextQuestion(quizSession, quizSession.questionBank);
  if (!firstQuestion) {
    throw new Error("Unable to start quiz due to empty question pool.");
  }

  quizSession.currentQuestionId = firstQuestion.id;
  quizSessions.set(quizId, quizSession);

  // Persist asynchronously
  persistQuizSession(quizSession).catch(() => { });
  logHistory(studentId, "quiz_started", {
    quizId,
    testId: testId || null,
    bookSessionId: bookSession.id,
    deadlineAt: quizSession.deadlineAt
  }).catch(() => { });

  return {
    quizSession,
    firstQuestion
  };
}

function buildResult(quizSession) {
  const marksPerQuestion = quizSession.marksPerQuestion ?? 100 / (quizSession.questionCount || 1);
  const processedResponses = quizSession.responses.map((r) => {
    // If marksAwarded is null but percentage exists, calculate it based on fallback marksPerQuestion
    let marksAwarded = r.marksAwarded;
    if (marksAwarded === null && r.percentage !== null) {
      marksAwarded = Number(((r.percentage / 100) * marksPerQuestion).toFixed(2));
    }
    return {
      ...r, // Keep all original properties
      marksAwarded // Override or set marksAwarded
    };
  });

  const scores = processedResponses.map((r) => r.percentage);
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const byDifficulty = {
    beginner: [],
    intermediate: [],
    advanced: []
  };

  processedResponses.forEach((entry) => byDifficulty[entry.difficulty].push(entry.percentage));

  const mean = (list) =>
    list.length ? Number((list.reduce((a, b) => a + b, 0) / list.length).toFixed(2)) : null;

  const effectiveMarksObtained = (() => {
    if (quizSession.teacherPublishedAt && Number.isFinite(Number(quizSession.teacherOverallMarks))) {
      return Number(Number(quizSession.teacherOverallMarks).toFixed(2));
    }
    if (typeof quizSession.totalMarks !== "number") return null;
    const obtained =
      quizSession.responses.reduce((sum, r) => {
        const effective =
          quizSession.teacherPublishedAt && typeof r.teacherMarksAwarded === "number"
            ? r.teacherMarksAwarded
            : r.marksAwarded;
        return sum + (Number(effective) || 0);
      }, 0) || 0;
    return Number(obtained.toFixed(2));
  })();

  const marksPercent = (() => {
    if (typeof quizSession.totalMarks !== "number" || !quizSession.totalMarks) return null;
    const obtained = effectiveMarksObtained ?? 0;
    return Math.max(0, Math.min(100, Number(((obtained / quizSession.totalMarks) * 100).toFixed(2))));
  })();

  const scoreForRemark = marksPercent ?? Number(avg.toFixed(2));
  const remark = (() => {
    if (scoreForRemark >= 90) return { label: "Outstanding", emoji: "🏆" };
    if (scoreForRemark >= 75) return { label: "Great work", emoji: "🔥" };
    if (scoreForRemark >= 60) return { label: "Good progress", emoji: "✅" };
    if (scoreForRemark >= 40) return { label: "Needs improvement", emoji: "📘" };
    return { label: "Critical: revise basics", emoji: "⚠️" };
  })();

  return {
    totalQuestions: quizSession.responses.length,
    averagePercentage: Number(avg.toFixed(2)),
    totalMarks: quizSession.totalMarks ?? null,
    marksObtained: typeof quizSession.totalMarks === "number" ? effectiveMarksObtained : null,
    teacherOverallRemark: quizSession.teacherOverallRemark ?? null,
    remark,
    levelProgression: {
      started: quizSession.initialLevel,
      ended: quizSession.currentLevel
    },
    difficultyBreakdown: {
      beginner: mean(byDifficulty.beginner),
      intermediate: mean(byDifficulty.intermediate),
      advanced: mean(byDifficulty.advanced)
    },
    proctoring: {
      riskScore: quizSession.proctor.riskScore,
      warningCount: quizSession.proctor.warningCount,
      warningMessages: quizSession.proctor.warningMessages
    },
    timedOut: Date.now() > quizSession.deadlineAt,
    aiPublished: quizSession.aiPublishAt ? Date.now() >= quizSession.aiPublishAt : true,
    teacherPublished: Boolean(quizSession.teacherPublishedAt),
    teacherPublishedAt: quizSession.teacherPublishedAt ?? null,
    testTitle: quizSession.testId ? (tests.get(String(quizSession.testId))?.title || null) : null,
    responses: quizSession.responses.map((r, idx) => ({
      questionNo: idx + 1,
      percentage: r.percentage,
      difficulty: r.difficulty,
      marksAwarded: r.marksAwarded ?? null,
      teacherMarksAwarded: r.teacherMarksAwarded ?? null,
      feedback: r.feedback || null,
      isAI: r.isAI || false,
      aiReasoning: r.aiReasoning || null,
      aiConfidence: r.aiConfidence || null
    }))
  };
}

function registerProctorEvent(quizSession, type, meta = {}) {
  const weights = {
    tab_hidden: 10,
    window_blur: 6,
    fullscreen_exit: 12,
    media_muted: 14,
    copy_attempt: 5,
    paste_attempt: 8,
    context_menu: 3,
    no_face: 10,
    multiple_faces: 20,
    mobile_phone: 30,
    suspicious_noise: 7
  };

  const increase = weights[type] || 5;
  quizSession.proctor.riskScore = Math.min(100, quizSession.proctor.riskScore + increase);
  quizSession.proctor.events.push({
    type,
    meta,
    at: new Date().toISOString(),
    riskScore: quizSession.proctor.riskScore
  });

  let warning = "";
  let autoCancel = false;
  const risk = quizSession.proctor.riskScore;

  if (type === "mobile_phone") {
    const mobileWarnings = quizSession.proctor.events.filter(e => e.type === "mobile_phone").length;
    if (mobileWarnings >= 3) {
      warning = "Auto-cancelled: Mobile phone detected 3 times";
      autoCancel = true;
    } else {
      warning = `Warning: Mobile phone detected (${mobileWarnings}/3)`;
      quizSession.proctor.warningMessages.push(`Mobile phone detected`);
    }
  } else if (type === "multiple_faces") {
    warning = "Warning: More than 1 person in the camera";
    quizSession.proctor.warningMessages.push("Multiple persons detected");
  } else if (risk >= 100) {
    warning = "Auto-cancelled: Cheating risk reached 100%";
    autoCancel = true;
  } else if (risk >= 80 && !quizSession.proctor.warningMessages.includes("Critical warning")) {
    warning = "Critical warning: suspicious behavior detected repeatedly.";
    quizSession.proctor.warningMessages.push("Critical warning");
  } else if (risk >= 55 && !quizSession.proctor.warningMessages.includes("High warning")) {
    warning = "High warning: return to fullscreen and focus on the exam.";
    quizSession.proctor.warningMessages.push("High warning");
  } else if (risk >= 30 && !quizSession.proctor.warningMessages.includes("Early warning")) {
    warning = "Warning: unusual exam behavior detected.";
    quizSession.proctor.warningMessages.push("Early warning");
  }

  if (warning && !autoCancel && !quizSession.completed) {
    quizSession.proctor.warningCount += 1;
  }

  if (autoCancel && !quizSession.completed) {
    quizSession.completed = true;
    quizSession.completedAt = Date.now();
    quizSession.proctor.warningMessages.push(warning);
  }

  return {
    riskScore: quizSession.proctor.riskScore,
    warning,
    warningCount: quizSession.proctor.warningCount,
    cancelled: autoCancel
  };
}

async function ensureQuizAccess(req, res) {
  let quizSession = quizSessions.get(req.params.quizId);
  if (!quizSession && dbReady) {
    const doc = await QuizSessionModel.findById(req.params.quizId).lean();
    if (doc) {
      quizSession = quizSessionFromDoc(doc);
      quizSessions.set(quizSession.id, quizSession);
    }
  }
  if (!quizSession) {
    res.status(404).json({ error: "Invalid quizId." });
    return null;
  }

  const isOwner = String(req.user.id) === String(quizSession.studentId);
  const isElevated = req.user.role === "admin";
  const isTeacher = req.user.role === "teacher";

  // Privacy Fix: If teacher, they must own the test associated with the quiz
  if (isTeacher && quizSession.testId) {
    const test = tests.get(quizSession.testId);
    if (test && String(test.createdBy) !== String(req.user.id)) {
      res.status(403).json({ error: "Access denied. You do not own this test." });
      return null;
    }
  }

  if (!isOwner && !isElevated && !isTeacher) {
    res.status(403).json({ error: "Quiz access denied." });
    return null;
  }

  return quizSession;
}

// DELETE Student History
app.delete("/api/users/me/quizzes", authRequired, async (req, res) => {
  try {
    if (dbReady) {
      await QuizSessionModel.deleteMany({ studentId: req.user.id });
    }
    // Clear from memory
    for (const [id, session] of quizSessions.entries()) {
      if (session.studentId === req.user.id) {
        quizSessions.delete(id);
      }
    }
    // Sync to fileStore
    await queueFileStoreWrite(async () => {
      fileStore.quizSessions = (fileStore.quizSessions || []).filter((q) => q.studentId !== req.user.id);
    });

    await logHistory(req.user.id, "history_cleared", {});
    return res.json({ message: "Test history cleared successfully." });
  } catch (error) {
    return res.status(500).json({ error: "Failed to clear history." });
  }
});

// DELETE Teacher Test
app.delete("/api/tests/:testId", authRequired, requireRoles("teacher", "admin"), async (req, res) => {
  const testId = req.params.testId;
  const test = tests.get(testId);
  if (!test) return res.status(404).json({ error: "Test not found." });

  if (test.createdBy !== req.user.id && req.user.role !== "admin") {
    return res.status(403).json({ error: "You cannot delete this test." });
  }

  try {
    const out = await deleteTestEverywhere(testId, { wipeHistory: true });
    if (!out.ok) return res.status(500).json({ error: "Failed to delete test fully." });

    await logHistory(req.user.id, "test_deleted", { testId });
    return res.json({ message: "Test and associated data deleted." });
  } catch (error) {
    return res.status(500).json({ error: "Failed to delete test." });
  }
});

function compactTestPayload(test) {
  return {
    id: test.id,
    title: test.title,
    joinCode: test.joinCode,
    questionCount: test.questionCount,
    durationMinutes: test.durationMinutes,
    initialLevel: test.initialLevel,
    totalMarks: test.totalMarks,
    marksPerQuestion: test.marksPerQuestion,
    startsAt: test.startsAt,
    createdAt: test.createdAt,
    createdBy: test.createdBy,
    bookSessionId: test.bookSessionId,
    topic: test.topic || null,
    difficulty: test.difficulty || null,
    questionFormat: test.questionFormat || "subjective"
  };
}

async function seedAdmin() {
  const memExisting = [...users.values()].find((u) => u.email === "admin@evalo.ai");
  if (memExisting) return memExisting;

  if (dbReady) {
    const existingDoc = await UserModel.findOne({ email: "admin@evalo.ai" }).lean();
    if (existingDoc) {
      const user = {
        id: existingDoc._id,
        name: existingDoc.name,
        email: existingDoc.email,
        passwordHash: existingDoc.passwordHash,
        role: existingDoc.role,
        createdAt: existingDoc.createdAt?.toISOString?.() || new Date(existingDoc.createdAt).toISOString()
      };
      users.set(user.id, user);
      usersByEmail.set(user.email, user.id);
      return user;
    }
  }

  const id = uuidv4();
  const adminUser = {
    id,
    name: "Evalo Admin",
    email: "admin@evalo.ai",
    passwordHash: hashPassword("admin123"),
    role: "admin",
    isApproved: true,
    createdAt: new Date().toISOString()
  };
  users.set(id, adminUser);
  usersByEmail.set(adminUser.email, id);
  if (dbReady) {
    await persistUser(adminUser);
    await logHistory(adminUser.id, "admin_seeded", { email: adminUser.email });
  }
  return adminUser;
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    app: "Evalo",
    port: process.env.ACTIVE_PORT || PORT,
    users: users.size,
    tests: tests.size,
    dbReady,
    timestamp: new Date().toISOString()
  });
});

app.post("/api/auth/signup", async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || String(name).trim().length < 2) {
    return res.status(400).json({ error: "Name is required." });
  }
  const emailNorm = String(email || "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(emailNorm)) {
    return res.status(400).json({ error: "Valid email is required." });
  }
  if (usersByEmail.has(emailNorm)) return res.status(409).json({ error: "Already registered user sign in instead" });
  if (dbReady) {
    const existing = await UserModel.findOne({ email: emailNorm }).lean();
    if (existing) return res.status(409).json({ error: "Already registered user sign in instead" });
  }
  if (!password || String(password).length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters." });
  }

  const role = ROLES.includes(req.body?.role) ? req.body.role : "student";
  const id = uuidv4();
  const user = {
    id,
    name: String(name).trim(),
    email: emailNorm,
    passwordHash: hashPassword(String(password)),
    role,
    isApproved: false,
    createdAt: new Date().toISOString()
  };

  users.set(id, user);
  usersByEmail.set(emailNorm, id);

  if (dbReady) {
    await persistUser(user);
    await logHistory(user.id, "signup", { email: user.email, role: user.role });
  }

  const token = issueToken(user);
  return res.status(201).json({ token, user: sanitizeUser(user) });
});

app.post("/api/auth/login", async (req, res) => {
  const emailNorm = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");

  const userId = usersByEmail.get(emailNorm);
  let user = userId ? users.get(userId) : null;
  if (!user && dbReady) {
    const userDoc = await UserModel.findOne({ email: emailNorm }).lean();
    if (userDoc) {
      user = {
        id: String(userDoc._id),
        name: userDoc.name,
        email: userDoc.email,
        passwordHash: userDoc.passwordHash,
        role: userDoc.role,
        isApproved: Boolean(userDoc.isApproved),
        createdAt: userDoc.createdAt?.toISOString?.() || new Date(userDoc.createdAt).toISOString()
      };
      users.set(user.id, user);
      usersByEmail.set(user.email, user.id);
    }
  }

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  if (dbReady) {
    await logHistory(user.id, "login", { email: user.email });
  }

  const token = issueToken(user);
  return res.json({ token, user: sanitizeUser(user) });
});

app.get("/api/auth/me", authRequired, (req, res) => {
  return res.json({ user: sanitizeUser(req.user) });
});

app.post("/api/auth/logout", authRequired, (req, res) => {
  return res.json({ ok: true });
});

app.get("/api/settings", async (_req, res) => {
  return res.json(fileStore.settings || { allowCopyPaste: false });
});

app.post("/api/settings", authRequired, requireRoles("admin"), async (req, res) => {
  const { allowCopyPaste, password } = req.body;

  if (allowCopyPaste === true) {
    // Verification of admin password required to enable feature
    if (!password) {
      return res.status(400).json({ error: "Password is required to enable copy-paste functionality." });
    }
    const adminUser = users.get(req.user.id);
    if (!adminUser || !verifyPassword(password, adminUser.passwordHash)) {
      return res.status(401).json({ error: "Incorrect admin password verification failed." });
    }
  }

  const nextSettings = {
    ...fileStore.settings,
    allowCopyPaste: !!allowCopyPaste,
    updatedAt: new Date().toISOString()
  };

  await persistSettings(nextSettings);

  await logHistory(req.user.id, "update_settings", {
    allowCopyPaste: nextSettings.allowCopyPaste
  });

  return res.json({ ok: true, settings: nextSettings });
});

app.get("/api/users/me/history", authRequired, async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query?.limit) || 200, 10), 500);
  if (dbReady && UserHistoryModel) {
    const history = await UserHistoryModel.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return res.json({ history });
  }

  await loadFileStore();
  const history = fileStore.history
    .filter((e) => e.userId === req.user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
  return res.json({ history });
});

app.get("/api/users/me/quizzes", authRequired, async (req, res) => {
  const buildSummary = (q) => ({
    quizId: q.id,
    testId: q.testId || null,
    testTitle: q.testId ? tests.get(String(q.testId))?.title || null : null,
    joinCode: q.testId ? tests.get(String(q.testId))?.joinCode || null : null,
    topic: q.testId ? tests.get(String(q.testId))?.topic || null : null,
    difficulty: q.testId ? tests.get(String(q.testId))?.difficulty || null : null,
    questionFormat: q.testId ? tests.get(String(q.testId))?.questionFormat || null : (q.questionFormat || null),
    startedAt: q.startedAt,
    deadlineAt: q.deadlineAt,
    completed: Boolean(q.completed),
    completedAt: q.completedAt ?? null,
    aiPublishAt: q.aiPublishAt ?? null,
    teacherPublishedAt: q.teacherPublishedAt ?? null,
    totalAnswered: (q.responses || []).length,
    questionCount: q.questionCount,
    averagePercentage: q.responses?.length
      ? Number(
        (
          q.responses.reduce((sum, r) => sum + (Number(r.percentage) || 0), 0) / q.responses.length
        ).toFixed(2)
      )
      : null
  });

  if (dbReady && QuizSessionModel) {
    const docs = await QuizSessionModel.find({ studentId: req.user.id }).sort({ startedAt: -1 }).limit(200).lean();
    const mapped = docs
      .map((d) => buildSummary(quizSessionFromDoc(d)))
      .filter((q) => q.testId ? tests.has(String(q.testId)) : true); // SKIP sessions where test was deleted
    return res.json({ quizzes: mapped });
  }

  await loadFileStore();
  const quizzes = fileStore.quizSessions
    .filter((q) => q.studentId === req.user.id)
    .map((q) => buildSummary(quizSessionFromDoc(q)))
    .filter((q) => q.testId ? tests.has(String(q.testId)) : true) // SKIP sessions where test was deleted
    .sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0))
    .slice(0, 200);
  return res.json({ quizzes });
});

// Eva AI Chat Assistant
app.post("/api/chat/eva", authRequired, async (req, res) => {
  const { message, history } = req.body;
  if (!message) return res.status(400).json({ error: "Message is required." });

  try {
    const response = await getEvaChatResponse(message, history || []);
    return res.json(response);
  } catch (error) {
    console.error("Eva Route Error:", error);
    return res.status(500).json({ error: "Assistant is currently resting. Try again soon." });
  }
});

app.get("/api/admin/users/:userId/history", authRequired, requireRoles("admin"), async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query?.limit) || 200, 10), 500);
  if (dbReady && UserHistoryModel) {
    const history = await UserHistoryModel.find({ userId: req.params.userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return res.json({ history });
  }

  await loadFileStore();
  const history = fileStore.history
    .filter((e) => e.userId === req.params.userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
  return res.json({ history });
});

app.get("/api/admin/users", authRequired, requireRoles("admin", "teacher"), (req, res) => {
  const respond = async () => {
    if (dbReady) {
      const docs = await UserModel.find({}).lean();
      return res.json({
        users: docs.map((d) => ({
          id: d._id,
          name: d.name,
          email: d.email,
          role: d.role,
          isApproved: Boolean(d.isApproved),
          createdAt: d.createdAt?.toISOString?.() || new Date(d.createdAt).toISOString()
        })),
        canEditRoles: req.user.role === "admin"
      });
    }

    return res.json({
      users: [...users.values()].map((u) => sanitizeUser(u)),
      canEditRoles: req.user.role === "admin"
    });
  };

  respond().catch((error) => res.status(500).json({ error: error.message || "Failed to list users." }));
});

app.patch("/api/admin/users/:userId/role", authRequired, requireRoles("admin"), async (req, res) => {
  let user = users.get(req.params.userId);
  const role = String(req.body?.role || "").toLowerCase();

  if (!user && dbReady) {
    const userDoc = await UserModel.findById(req.params.userId).lean();
    if (userDoc) {
      user = {
        id: String(userDoc._id),
        name: userDoc.name,
        email: userDoc.email,
        passwordHash: userDoc.passwordHash,
        role: userDoc.role,
        isApproved: Boolean(userDoc.isApproved),
        createdAt: userDoc.createdAt?.toISOString?.() || new Date(userDoc.createdAt).toISOString()
      };
      users.set(user.id, user);
      usersByEmail.set(user.email, user.id);
    }
  }

  if (!user) return res.status(404).json({ error: "User not found." });
  if (user.role === "admin") return res.status(403).json({ error: "Cannot demote an admin." });
  if (req.params.userId === req.user.id) {
    return res.status(400).json({ error: "Admin cannot change their own role." });
  }
  if (!ROLES.includes(role)) return res.status(400).json({ error: "Invalid role." });

  user.role = role;
  users.set(user.id, user);
  if (dbReady) {
    await persistUser(user);
    await logHistory(req.user.id, "role_updated", {
      targetUserId: user.id,
      targetEmail: user.email,
      newRole: role
    });
  }
  return res.json({ user: sanitizeUser(user) });
});

app.patch("/api/admin/users/:userId/approve", authRequired, requireRoles("admin"), async (req, res) => {
  let user = users.get(req.params.userId);
  if (!user && dbReady) {
    const userDoc = await UserModel.findById(req.params.userId).lean();
    if (userDoc) {
      user = {
        id: String(userDoc._id),
        name: userDoc.name,
        email: userDoc.email,
        passwordHash: userDoc.passwordHash,
        role: userDoc.role,
        isApproved: Boolean(userDoc.isApproved),
        createdAt: userDoc.createdAt?.toISOString?.() || new Date(userDoc.createdAt).toISOString()
      };
      users.set(user.id, user); // Add to cache
      usersByEmail.set(user.email, user.id);
    }
  }

  if (!user) return res.status(404).json({ error: "User not found." });
  if (user.role === "admin") return res.status(403).json({ error: "Admin approval status is fixed." });

  user.isApproved = req.body.isApproved === true;
  users.set(user.id, user);
  if (dbReady) {
    await persistUser(user);
    await logHistory(req.user.id, "user_approval_updated", {
      targetUserId: user.id,
      isApproved: user.isApproved
    });
  }
  return res.json({ user: sanitizeUser(user) });
});

app.post("/api/admin/users/add", authRequired, requireRoles("admin"), async (req, res) => {
  const { name, email, password, role } = req.body || {};
  const emailNorm = String(email || "").trim().toLowerCase();

  if (!name || name.trim().length < 2) return res.status(400).json({ error: "Name required." });
  if (!emailNorm || !emailNorm.includes("@")) return res.status(400).json({ error: "Valid email required." });
  if (usersByEmail.has(emailNorm)) return res.status(400).json({ error: "Email already exists." });
  if (!password || password.length < 6) return res.status(400).json({ error: "Password (min 6 chars) required." });

  const id = uuidv4();
  const user = {
    id,
    name: name.trim(),
    email: emailNorm,
    passwordHash: hashPassword(password),
    role: ROLES.includes(role) ? role : "student",
    isApproved: true,
    createdAt: new Date().toISOString()
  };

  users.set(id, user);
  usersByEmail.set(emailNorm, id);
  if (dbReady) await persistUser(user);

  await logHistory(req.user.id, "user_added_by_admin", { targetEmail: emailNorm, role: user.role });
  return res.json({ user: sanitizeUser(user) });
});

app.delete("/api/admin/users/:userId", authRequired, requireRoles("admin"), async (req, res) => {
  const { userId } = req.params;
  let user = users.get(userId);

  if (!user && dbReady) {
    const userDoc = await UserModel.findById(userId).lean();
    if (userDoc) {
      user = {
        id: String(userDoc._id),
        name: userDoc.name,
        email: userDoc.email,
        passwordHash: userDoc.passwordHash,
        role: userDoc.role,
        isApproved: Boolean(userDoc.isApproved),
        createdAt: userDoc.createdAt?.toISOString?.() || new Date(userDoc.createdAt).toISOString()
      };
    }
  }

  if (!user) return res.status(404).json({ error: "User not found." });
  if (user.role === "admin") return res.status(403).json({ error: "Admins cannot be deleted." });

  users.delete(user.id);
  usersByEmail.delete(user.email);

  // Sync to fileStore
  await queueFileStoreWrite(async () => {
    fileStore.users = (fileStore.users || []).filter((u) => (u?.id || u?._id) !== user.id);
  });

  if (dbReady && UserModel) {
    await UserModel.findByIdAndDelete(user.id);
  }

  await logHistory(req.user.id, "user_deleted_by_admin", { targetEmail: user.email });
  return res.json({ ok: true });
});

async function deleteTestEverywhere(testId, opts = {}) {
  const wipeHistory = opts.wipeHistory !== false;

  // Ensure in-memory has latest view.
  let test = tests.get(testId) || null;
  if (!test && dbReady && TestModel) {
    const doc = await TestModel.findById(testId).lean();
    if (doc) {
      test = testFromDoc(doc);
      tests.set(test.id, test);
    }
  }
  if (!test && !dbReady) {
    await loadFileStore();
    const stored = findById(fileStore.tests, testId);
    if (stored) {
      test = testFromDoc(stored);
      tests.set(test.id, test);
    }
  }
  if (!test) return { ok: false, reason: "not_found" };

  const joinCode = test.joinCode;

  // Find all quizIds for this test.
  const quizIds = new Set();
  (test.attempts || []).forEach((a) => a?.quizId && quizIds.add(a.quizId));
  [...quizSessions.values()].forEach((q) => {
    if (q?.testId === testId) quizIds.add(q.id);
  });

  if (dbReady && TestModel && QuizSessionModel) {
    // DB delete: quiz sessions then test
    await QuizSessionModel.deleteMany({ testId });
    await TestModel.deleteOne({ _id: testId });

    if (wipeHistory && UserHistoryModel) {
      const quizList = [...quizIds.values()];
      const or = [{ "payload.testId": testId }, { "payload.joinCode": joinCode }];
      if (quizList.length) or.push({ "payload.quizId": { $in: quizList } });
      await UserHistoryModel.deleteMany({ $or: or }).catch(() => { });
    }
  }

  // ALWAYS Sync to fileStore to prevent stale data recurrence
  await queueFileStoreWrite(async () => {
    fileStore.tests = (fileStore.tests || []).filter((t) => (t?._id || t?.id) !== testId);
    fileStore.quizSessions = (fileStore.quizSessions || []).filter((q) => q?.testId !== testId);
    if (wipeHistory) {
      const quizList = [...quizIds.values()];
      fileStore.history = (fileStore.history || []).filter((h) => {
        const p = h?.payload || {};
        if (p?.testId === testId) return false;
        if (joinCode && p?.joinCode === joinCode) return false;
        if (quizList.length && p?.quizId && quizList.includes(p.quizId)) return false;
        return true;
      });
    }
  });

  // In-memory cleanup
  tests.delete(testId);
  quizIds.forEach((id) => quizSessions.delete(id));

  return { ok: true, testId, removedQuizIds: [...quizIds.values()] };
}

app.get("/api/admin/tests", authRequired, requireRoles("admin"), async (_req, res) => {
  const respond = async () => {
    if (dbReady && TestModel) {
      const docs = await TestModel.find({}).sort({ createdAt: -1 }).lean();
      return res.json({
        tests: docs.map((d) => {
          const t = testFromDoc(d);
          return { ...compactTestPayload(t), attempts: (t.attempts || []).length };
        })
      });
    }
    return res.json({
      tests: [...tests.values()]
        .map((t) => ({ ...compactTestPayload(t), attempts: (t.attempts || []).length }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    });
  };
  respond().catch((error) => res.status(500).json({ error: error.message || "Failed to list tests." }));
});

app.delete("/api/admin/tests/:testId", authRequired, requireRoles("admin"), async (req, res) => {
  const wipeHistory = String(req.query?.wipeHistory || "true").toLowerCase() !== "false";
  try {
    const out = await deleteTestEverywhere(req.params.testId, { wipeHistory });
    if (!out.ok && out.reason === "not_found") return res.status(404).json({ error: "Test not found." });
    await logHistory(req.user.id, "admin_test_deleted", { testId: req.params.testId, wipeHistory });
    return res.json({ ok: true, testId: req.params.testId });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to delete test." });
  }
});

app.get("/api/admin/stats", authRequired, requireRoles("admin"), async (req, res) => {
  try {
    let userCount = 0;
    let criticalAlerts = 0;

    if (dbReady && UserModel) {
      userCount = await UserModel.countDocuments();
      criticalAlerts = await UserHistoryModel.countDocuments({
        eventType: { $regex: /error|failed|security|unauthorized/i }
      });
    } else {
      userCount = users.size;
      criticalAlerts = fileStore.history.filter(h =>
        /error|failed|security|unauthorized/i.test(h.eventType)
      ).length;
    }

    // Logic for system integrity (mocked for now, but based on "real" checks)
    const integrity = {
      nodePerformance: "Optimal",
      infrastructureCheck: "Healthy",
      securityReview: criticalAlerts > 5 ? "Action Required" : "Secure",
      automatedScan: "Completed",
      flags: criticalAlerts
    };

    return res.json({
      userCount,
      criticalAlerts,
      integrity
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to fetch stats." });
  }
});

app.get("/api/admin/audit-logs", authRequired, requireRoles("admin"), async (req, res) => {
  try {
    if (dbReady && UserHistoryModel) {
      const docs = await UserHistoryModel.find().sort({ createdAt: -1 }).limit(100).lean();
      return res.json({
        logs: docs.map((d) => ({
          id: d._id,
          userId: d.userId,
          eventType: d.eventType,
          payload: d.payload,
          createdAt: d.createdAt
        }))
      });
    }
    await loadFileStore();
    const logs = [...fileStore.history]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 100);
    return res.json({ logs });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to fetch audit logs." });
  }
});

app.post("/api/admin/clear-cache", authRequired, requireRoles("admin"), async (req, res) => {
  try {
    bookSessions.clear();
    quizSessions.clear();
    tests.clear();
    // Also clear in-memory user maps if needed, though they are usually in sync with store.
    // users.clear();
    // usersByEmail.clear();
    return res.json({ message: "In-memory session cache cleared successfully." });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to clear cache." });
  }
});

app.post("/api/admin/optimize-storage", authRequired, requireRoles("admin"), async (req, res) => {
  try {
    // 1. Cleanup uploads directory (orphan files)
    const files = await fs.readdir(uploadDir);
    let deletedCount = 0;
    for (const file of files) {
      if (file === ".gitkeep") continue;
      await fs.unlink(path.join(uploadDir, file)).catch(() => { });
      deletedCount++;
    }

    // 2. Prune old history if using MongoDB
    let historyPruned = false;
    if (dbReady && UserHistoryModel) {
      const count = await UserHistoryModel.countDocuments();
      if (count > 5000) {
        const oldestToKeep = await UserHistoryModel.find().sort({ createdAt: -1 }).skip(4999).limit(1);
        if (oldestToKeep.length) {
          await UserHistoryModel.deleteMany({ createdAt: { $lt: oldestToKeep[0].createdAt } });
          historyPruned = true;
        }
      }
    } else {
      // FileStore history is already capped at 20000 in logHistory, but we can tighten it here.
      await queueFileStoreWrite(async () => {
        if (fileStore.history.length > 5000) {
          fileStore.history = fileStore.history.slice(-5000);
          historyPruned = true;
        }
      });
    }

    return res.json({
      message: "Storage optimized successfully.",
      details: { tempFilesDeleted: deletedCount, historyPruned }
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to optimize storage." });
  }
});

app.post("/api/admin/reset", authRequired, requireRoles("admin"), async (req, res) => {
  const scope = String(req.body?.scope || "data").toLowerCase(); // data|all
  const wipeUsers = scope === "all";

  try {
    if (dbReady && mongoose) {
      // Wipe platform data (but keep users by default).
      await BookSessionModel.deleteMany({});
      await TestModel.deleteMany({});
      await QuizSessionModel.deleteMany({});
      if (UserHistoryModel) await UserHistoryModel.deleteMany({});
      if (wipeUsers && UserModel) {
        await UserModel.deleteMany({ _id: { $ne: req.user.id } });
      }
    } else {
      await queueFileStoreWrite(async () => {
        fileStore.bookSessions = [];
        fileStore.tests = [];
        fileStore.quizSessions = [];
        fileStore.history = [];
        if (wipeUsers) {
          fileStore.users = (fileStore.users || []).filter((u) => (u?.id || u?._id) === req.user.id);
        }
      });
    }

    // In-memory reset
    bookSessions.clear();
    tests.clear();
    quizSessions.clear();
    if (wipeUsers) {
      const keep = users.get(req.user.id);
      users.clear();
      usersByEmail.clear();
      if (keep) {
        users.set(keep.id, keep);
        usersByEmail.set(keep.email, keep.id);
      }
    }

    await logHistory(req.user.id, "admin_reset", { scope });
    return res.json({ ok: true, scope });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Reset failed." });
  }
});

app.post("/api/books/upload", authRequired, requireRoles("teacher", "admin"), upload.array("books", MAX_BOOK_FILES), async (req, res) => {
  try {
    const files = req.files || [];
    if (files.length < 1) {
      return res.status(400).json({ error: "Upload at least 1 book (PDF/TXT)." });
    }

    const session = await createBookSession(files, req.user.id);

    return res.json({
      bookSessionId: session.id,
      message: "Books uploaded and indexed successfully.",
      stats: {
        chunks: session.chunks.length,
        questions: session.questionBank.length
      }
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Book processing failed." });
  }
});

app.get("/api/books/mine", authRequired, requireRoles("teacher", "admin"), (req, res) => {
  const respond = async () => {
    if (dbReady) {
      const query = req.user.role === "admin" ? {} : { ownerId: req.user.id };
      const docs = await BookSessionModel.find(query).sort({ createdAt: -1 }).lean();
      return res.json({
        books: docs.map((b) => ({
          id: b._id,
          title: b.title,
          createdAt: b.createdAt,
          fileNames: b.fileNames || [],
          chunks: (b.chunks || []).length,
          questions: (b.questionBank || []).length
        }))
      });
    }

    const mine = [...bookSessions.values()]
      .filter((b) => b.ownerId === req.user.id || req.user.role === "admin")
      .map((b) => ({
        id: b.id,
        title: b.title,
        createdAt: b.createdAt,
        fileNames: b.fileNames,
        chunks: b.chunks.length,
        questions: b.questionBank.length
      }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return res.json({ books: mine });
  };

  respond().catch((error) => res.status(500).json({ error: error.message || "Failed to list books." }));
});

app.post("/api/tests", authRequired, requireRoles("teacher", "admin"), async (req, res) => {
  const {
    title,
    bookSessionId,
    durationMinutes,
    questionCount,
    totalMarks,
    examMode, // backward compat (older clients)
    startsAt,
    initialLevel = "intermediate",
    difficulty,
    topic,
    questionFormat
  } = req.body || {};

  const bookSession = bookSessions.get(bookSessionId);
  if (!bookSession) {
    return res.status(404).json({ error: "Invalid bookSessionId." });
  }
  if (bookSession.ownerId !== req.user.id && req.user.role !== "admin") {
    return res.status(403).json({ error: "Book session does not belong to you." });
  }

  const modeKey = EXAM_MODE_CONFIG[examMode] ? examMode : "MTE";
  const duration = Math.min(
    Math.max(Number(durationMinutes) || EXAM_MODE_CONFIG[modeKey].durationMinutes, 5),
    180
  );
  const questions = Math.min(
    Math.max(Number(questionCount) || EXAM_MODE_CONFIG[modeKey].questionCount, 1),
    20
  );
  const total = Math.min(Math.max(Number(totalMarks) || 100, 10), 1000);
  const marksPerQuestion = Number((total / questions).toFixed(2));
  const mapped = mapDifficultyToLevel(difficulty);
  const level = LEVEL_INDEX[mapped || initialLevel] !== undefined ? (mapped || initialLevel) : "intermediate";
  const difficultyLabel = DIFFICULTY_LABELS.includes(String(difficulty || "").toLowerCase())
    ? String(difficulty).toLowerCase()
    : mapped
      ? ({ beginner: "easy", intermediate: "medium", advanced: "hard" }[mapped] || null)
      : null;
  const startIso = startsAt ? new Date(startsAt).toISOString() : new Date().toISOString();
  const format = normalizeQuestionFormat(questionFormat);

  const id = uuidv4();
  const joinCode = randomJoinCode();

  const test = {
    id,
    title: String(title || "Untitled Evalo Test").trim(),
    joinCode,
    bookSessionId,
    durationMinutes: duration,
    questionCount: questions,
    initialLevel: level,
    totalMarks: total,
    marksPerQuestion,
    startsAt: startIso,
    createdBy: req.user.id,
    createdAt: new Date().toISOString(),
    active: true,
    attempts: [],
    topic: String(topic || "").trim() || null,
    difficulty: difficultyLabel,
    questionFormat: format
  };

  tests.set(id, test);
  await persistTest(test);
  await logHistory(req.user.id, "test_created", {
    testId: test.id,
    joinCode: test.joinCode,
    bookSessionId: test.bookSessionId,
    durationMinutes: test.durationMinutes,
    questionCount: test.questionCount
  });
  return res.status(201).json({ test: compactTestPayload(test) });
});

app.get("/api/tests/mine", authRequired, requireRoles("teacher", "admin"), (req, res) => {
  const respond = async () => {
    if (dbReady) {
      const query = req.user.role === "admin" ? {} : { createdBy: req.user.id };
      const docs = await TestModel.find(query).sort({ createdAt: -1 }).lean();
      return res.json({
        tests: docs.map((d) => ({
          ...compactTestPayload(testFromDoc(d)),
          attempts: (d.attempts || []).length
        }))
      });
    }

    const mine = [...tests.values()]
      .filter((test) => test.createdBy === req.user.id || req.user.role === "admin")
      .map((test) => ({ ...compactTestPayload(test), attempts: test.attempts.length }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return res.json({ tests: mine });
  };

  respond().catch((error) => res.status(500).json({ error: error.message || "Failed to list tests." }));
});

app.get("/api/tests/open", authRequired, requireRoles("student", "admin"), (_req, res) => {
  const openTests = [...tests.values()]
    .filter((test) => test.active)
    .map((test) => ({
      id: test.id,
      title: test.title,
      durationMinutes: test.durationMinutes,
      questionCount: test.questionCount,
      totalMarks: test.totalMarks,
      topic: test.topic || null,
      difficulty: test.difficulty || null,
      questionFormat: test.questionFormat || "subjective",
      startsAt: test.startsAt,
      createdAt: test.createdAt
    }));
  return res.json({ tests: openTests });
});

app.patch("/api/tests/:testId", authRequired, requireRoles("teacher", "admin"), async (req, res) => {
  const test = tests.get(req.params.testId);
  if (!test) return res.status(404).json({ error: "Test not found." });
  if (test.createdBy !== req.user.id && req.user.role !== "admin") {
    return res.status(403).json({ error: "You cannot edit this test." });
  }

  const patch = req.body || {};
  if (typeof patch.title === "string" && patch.title.trim()) test.title = patch.title.trim();
  if (patch.active !== undefined) test.active = Boolean(patch.active);
  if (patch.topic !== undefined) test.topic = String(patch.topic || "").trim() || null;
  if (patch.questionFormat !== undefined) test.questionFormat = normalizeQuestionFormat(patch.questionFormat);
  if (patch.difficulty !== undefined) {
    const mapped = mapDifficultyToLevel(patch.difficulty);
    const lvl = LEVEL_INDEX[mapped || patch.difficulty] !== undefined ? (mapped || patch.difficulty) : null;
    if (lvl) {
      test.initialLevel = lvl;
      test.difficulty = DIFFICULTY_LABELS.includes(String(patch.difficulty || "").toLowerCase())
        ? String(patch.difficulty).toLowerCase()
        : ({ beginner: "easy", intermediate: "medium", advanced: "hard" }[lvl] || null);
    }
  }
  if (patch.startsAt) test.startsAt = new Date(patch.startsAt).toISOString();
  if (patch.durationMinutes) {
    test.durationMinutes = Math.min(Math.max(Number(patch.durationMinutes) || test.durationMinutes, 5), 180);
  }
  if (patch.questionCount) {
    test.questionCount = Math.min(Math.max(Number(patch.questionCount) || test.questionCount, 1), 20);
  }
  if (patch.totalMarks) {
    test.totalMarks = Math.min(Math.max(Number(patch.totalMarks) || test.totalMarks, 10), 1000);
  }
  // recompute marksPerQuestion if needed
  test.marksPerQuestion = Number((Number(test.totalMarks) / Number(test.questionCount)).toFixed(2));

  tests.set(test.id, test);
  await persistTest(test);
  await logHistory(req.user.id, "test_updated", { testId: test.id, patch: Object.keys(patch) });

  return res.json({ test: compactTestPayload(test) });
});

app.post("/api/tests/join", authRequired, requireRoles("student", "admin"), async (req, res) => {
  const joinCode = String(req.body?.joinCode || "").trim().toUpperCase();
  if (!joinCode) return res.status(400).json({ error: "joinCode is required." });

  let test = [...tests.values()].find((item) => item.joinCode === joinCode && item.active);
  if (!test && dbReady) {
    const testDoc = await TestModel.findOne({ joinCode, active: true }).lean();
    if (testDoc) {
      test = testFromDoc(testDoc);
      tests.set(test.id, test);
    }
  }
  if (!test) return res.status(404).json({ error: "Test not found for this join code." });
  if (test.startsAt && Date.now() < new Date(test.startsAt).getTime()) {
    return res.status(403).json({ error: `Test not started yet. Starts at ${test.startsAt}` });
  }

  // Check if test has already ended
  if (test.startsAt && test.durationMinutes) {
    const endsAt = new Date(test.startsAt).getTime() + test.durationMinutes * 60 * 1000;
    if (Date.now() > endsAt) {
      return res.status(403).json({ error: "The Test has Already Ended , You Are Late" });
    }
  }

  let bookSession = bookSessions.get(test.bookSessionId);
  if (!bookSession && dbReady) {
    const bookDoc = await BookSessionModel.findById(test.bookSessionId).lean();
    if (bookDoc) {
      bookSession = bookSessionFromDoc(bookDoc);
      bookSessions.set(bookSession.id, bookSession);
    }
  }
  if (!bookSession) {
    return res.status(404).json({ error: "Book session missing for this test." });
  }

  let existingQuizzes = [...quizSessions.values()].filter(
    (quiz) => quiz.testId === test.id && quiz.studentId === req.user.id
  );
  if (dbReady) {
    const quizDocs = await QuizSessionModel.find({
      testId: test.id,
      studentId: req.user.id
    }).lean();
    quizDocs.forEach(doc => {
      if (!existingQuizzes.find(q => q.id === doc._id)) {
        const q = quizSessionFromDoc(doc);
        existingQuizzes.push(q);
        quizSessions.set(q.id, q);
      }
    });
  }

  const completedQuiz = existingQuizzes.find(q => q.completed);
  if (completedQuiz) {
    return res.status(403).json({ error: "You have already completed this test. Multiple attempts are not allowed." });
  }

  const existingQuiz = existingQuizzes.find(q => !q.completed);
  if (existingQuiz) {
    const activeQuestion = existingQuiz.questionBank.find((q) => q.id === existingQuiz.currentQuestionId);
    return res.json({
      quizId: existingQuiz.id,
      test: compactTestPayload(test),
      question: activeQuestion
        ? questionPayload(
          activeQuestion,
          existingQuiz.responses.length + 1,
          existingQuiz.questionCount
        )
        : null,
      deadlineAt: existingQuiz.deadlineAt,
      timeLeftSec: Math.max(0, Math.floor((existingQuiz.deadlineAt - Date.now()) / 1000)),
      proctor: existingQuiz.proctor,
      marks: {
        totalMarks: test.totalMarks,
        marksPerQuestion: test.marksPerQuestion
      },
      security: {
        cameraRequired: true,
        micRequired: true,
        fullscreenRequired: true
      }
    });
  }

  const rollNo = String(req.body?.rollNo || "").trim();
  if (!rollNo) {
    return res.status(400).json({ error: "Roll Number is required to start the test." });
  }

  try {
    const { quizSession, firstQuestion } = createQuizSession({
      bookSession,
      studentId: req.user.id,
      initialLevel: test.initialLevel,
      questionCount: test.questionCount,
      testId: test.id,
      durationMinutes: test.durationMinutes,
      topic: test.topic,
      questionFormat: test.questionFormat,
      rollNo
    });
    quizSession.totalMarks = test.totalMarks;
    quizSession.marksPerQuestion = test.marksPerQuestion;
    persistQuizSession(quizSession).catch(() => { });

    test.attempts.push({ userId: req.user.id, quizId: quizSession.id, startedAt: new Date().toISOString() });
    tests.set(test.id, test);
    persistTest(test).catch(() => { });
    logHistory(req.user.id, "test_joined", { testId: test.id, joinCode: test.joinCode, quizId: quizSession.id }).catch(
      () => { }
    );

    return res.json({
      quizId: quizSession.id,
      test: compactTestPayload(test),
      question: questionPayload(firstQuestion, 1, quizSession.questionCount),
      deadlineAt: quizSession.deadlineAt,
      timeLeftSec: Math.max(0, Math.floor((quizSession.deadlineAt - Date.now()) / 1000)),
      proctor: quizSession.proctor,
      marks: {
        totalMarks: test.totalMarks,
        marksPerQuestion: test.marksPerQuestion
      },
      security: {
        cameraRequired: true,
        micRequired: true,
        fullscreenRequired: true
      }
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Unable to join this test." });
  }
});

app.post("/api/quiz/:quizId/proctor-event", authRequired, requireRoles("student", "admin"), async (req, res) => {
  const quizSession = await ensureQuizAccess(req, res);
  if (!quizSession) return;

  if (quizSession.completed) {
    return res.json({
      riskScore: quizSession.proctor.riskScore,
      warning: "",
      warningCount: quizSession.proctor.warningCount,
      completed: true
    });
  }

  const type = String(req.body?.type || "").trim().toLowerCase();
  if (!type) return res.status(400).json({ error: "Proctor event type is required." });

  const summary = registerProctorEvent(quizSession, type, req.body?.meta || {});
  persistQuizSession(quizSession).catch(() => { });
  logHistory(req.user.id, "proctor_event", { quizId: quizSession.id, type, riskScore: summary.riskScore }).catch(
    () => { }
  );
  return res.json({ ...summary, completed: summary.cancelled || false });
});

// Auto-save endpoint - allows partial saves without validation
app.patch("/api/quiz/:quizId/autosave", authRequired, requireRoles("student", "admin"), async (req, res) => {
  const quizSession = await ensureQuizAccess(req, res);
  if (!quizSession) return;

  if (quizSession.completed) {
    return res.json({ ok: true, completed: true });
  }

  if (Date.now() > quizSession.deadlineAt) {
    return res.json({ ok: true, timedOut: true });
  }

  const currentQuestion = quizSession.questionBank.find((q) => q.id === quizSession.currentQuestionId);
  if (!currentQuestion) {
    return res.status(400).json({ error: "No active question found." });
  }

  const answer = String(req.body?.answer || "");
  const wordCount = answer.trim().split(/\s+/).filter(w => w.length > 0).length;
  const characterCount = answer.length;

  // Find or create draft response
  let draftResponse = quizSession.responses.find(r => r.questionId === currentQuestion.id && r.isDraft);

  if (draftResponse) {
    // Update existing draft
    draftResponse.answer = answer;
    draftResponse.wordCount = wordCount;
    draftResponse.characterCount = characterCount;
    draftResponse.lastSavedAt = Date.now();
  } else {
    // Create new draft
    quizSession.responses.push({
      questionId: currentQuestion.id,
      answer,
      wordCount,
      characterCount,
      isDraft: true,
      lastSavedAt: Date.now()
    });
  }

  await persistQuizSession(quizSession);

  return res.json({
    ok: true,
    saved: true,
    wordCount,
    characterCount,
    timestamp: Date.now()
  });
});

app.post("/api/quiz/:quizId/answer", authRequired, requireRoles("student", "admin"), async (req, res) => {
  const quizSession = await ensureQuizAccess(req, res);
  if (!quizSession) return;

  if (quizSession.completed) {
    return res.json({
      completed: true,
      result: buildResult(quizSession)
    });
  }

  if (Date.now() > quizSession.deadlineAt) {
    quizSession.completed = true;
    quizSession.currentQuestionId = null;
    persistQuizSession(quizSession).catch(() => { });
    logHistory(req.user.id, "quiz_timed_out", { quizId: quizSession.id }).catch(() => { });
    return res.json({
      completed: true,
      timedOut: true,
      result: buildResult(quizSession)
    });
  }

  const currentQuestion = quizSession.questionBank.find((q) => q.id === quizSession.currentQuestionId);
  if (!currentQuestion) {
    return res.status(400).json({ error: "No active question found." });
  }

  const isMcq = (currentQuestion.type || "subjective") === "mcq";
  const answer = String(req.body?.answer || "");
  const mcqChoiceRaw = req.body?.mcqChoice;

  if (isMcq) {
    const choice = Number(mcqChoiceRaw);
    if (!Number.isFinite(choice) || choice < 0 || choice >= (currentQuestion.choices || []).length) {
      return res.status(400).json({ error: "Invalid MCQ choice." });
    }
  } else {
    if (answer.trim().length < 10) {
      return res.status(400).json({ error: "Answer is too short for subjective evaluation." });
    }
  }

  let baseEvaluation;

  if (isMcq) {
    const choice = Number(mcqChoiceRaw);
    const correctIndex = Number(currentQuestion.correctIndex);
    const correct = Number.isFinite(correctIndex) ? choice === correctIndex : false;
    const percentage = correct ? 100 : 0;
    const feedback = correct ? "Correct. Good selection based on the reference." : "Incorrect. Re-check the concept in the reference text.";
    baseEvaluation = {
      percentage,
      details: { correct, choice, correctIndex: Number.isFinite(correctIndex) ? correctIndex : null },
      feedback,
      explanation: currentQuestion.explanation || currentQuestion.reference || ""
    };
  } else {
    // Subjective AI-enhanced scoring
    try {
      if (process.env.OPENAI_API_KEY) {
        const aiResult = await evaluateSubjectiveAnswer(answer, currentQuestion.prompt, currentQuestion.reference, 100);
        baseEvaluation = {
          percentage: aiResult.score,
          feedback: aiResult.feedback,
          reasoning: aiResult.reasoning,
          confidence: aiResult.confidence,
          rubric: aiResult.rubric,
          isAI: true
        };
      } else {
        console.warn("OPENAI_API_KEY is missing. Falling back to simple NLP Scoring.");
        baseEvaluation = evaluateAnswer(answer, currentQuestion);
        baseEvaluation.isAI = false;
        baseEvaluation.feedback = `${baseEvaluation.feedback} (Note: true AI scoring is currently disabled)`;
      }
    } catch (err) {
      console.error("AI scoring failed, using fallback NLP:", err.message);
      baseEvaluation = evaluateAnswer(answer, currentQuestion);
      baseEvaluation.isAI = false;
    }
  }
  const cheatingPenalty = Math.floor(quizSession.proctor.riskScore / 35) * 4;
  const adjustedPercentage = Math.max(0, baseEvaluation.percentage - cheatingPenalty);

  const evaluation = {
    ...baseEvaluation,
    basePercentage: baseEvaluation.percentage,
    cheatingPenalty,
    percentage: adjustedPercentage,
    feedback:
      cheatingPenalty > 0
        ? `${baseEvaluation.feedback} Proctoring risk penalty applied (${cheatingPenalty}%).`
        : baseEvaluation.feedback
  };

  const marksPerQuestion = typeof quizSession.marksPerQuestion === "number" ? quizSession.marksPerQuestion : null;
  const marksAwarded =
    marksPerQuestion === null ? null : Number(((evaluation.percentage / 100) * marksPerQuestion).toFixed(2));
  evaluation.marksPerQuestion = marksPerQuestion;
  evaluation.marksAwarded = marksAwarded;

  quizSession.responses.push({
    questionId: currentQuestion.id,
    difficulty: currentQuestion.difficulty,
    answer: isMcq ? "" : answer,
    mcqChoice: isMcq ? Number(mcqChoiceRaw) : null,
    mcqCorrectIndex: isMcq ? (Number.isFinite(Number(currentQuestion.correctIndex)) ? Number(currentQuestion.correctIndex) : null) : null,
    percentage: evaluation.percentage,
    details: evaluation.details,
    cheatingPenalty,
    marksAwarded,
    feedback: evaluation.feedback || null,
    explanation: evaluation.explanation || null,
    isAI: evaluation.isAI,
    aiReasoning: evaluation.reasoning || null,
    aiConfidence: evaluation.confidence || null
  });

  quizSession.currentLevel = adjustLevel(quizSession.currentLevel, evaluation.percentage);
  persistQuizSession(quizSession).catch(() => { });
  logHistory(req.user.id, "answer_submitted", {
    quizId: quizSession.id,
    questionId: currentQuestion.id,
    percentage: evaluation.percentage,
    cheatingPenalty
  }).catch(() => { });

  const completed = quizSession.responses.length >= quizSession.questionCount;
  if (completed) {
    quizSession.currentQuestionId = null;
    quizSession.completed = true;
    quizSession.completedAt = Date.now();
    // Results are AI-checked immediately and released immediately (no delay).
    quizSession.aiPublishAt = quizSession.completedAt;
    quizSession.teacherPublishedAt = quizSession.teacherPublishedAt ?? null;
    persistQuizSession(quizSession).catch(() => { });
    logHistory(req.user.id, "quiz_completed", { quizId: quizSession.id, average: buildResult(quizSession).averagePercentage }).catch(
      () => { }
    );
    return res.json({
      evaluation,
      completed: true,
      result: buildResult(quizSession),
      timeLeftSec: Math.max(0, Math.floor((quizSession.deadlineAt - Date.now()) / 1000)),
      proctor: quizSession.proctor
    });
  }

  const nextQuestion = pickNextQuestion(quizSession, quizSession.questionBank);
  if (!nextQuestion) {
    quizSession.currentQuestionId = null;
    quizSession.completed = true;
    return res.json({
      evaluation,
      completed: true,
      result: buildResult(quizSession),
      timeLeftSec: Math.max(0, Math.floor((quizSession.deadlineAt - Date.now()) / 1000)),
      proctor: quizSession.proctor
    });
  }

  quizSession.currentQuestionId = nextQuestion.id;
  return res.json({
    evaluation,
    completed: false,
    currentLevel: quizSession.currentLevel,
    question: questionPayload(nextQuestion, quizSession.responses.length + 1, quizSession.questionCount),
    timeLeftSec: Math.max(0, Math.floor((quizSession.deadlineAt - Date.now()) / 1000)),
    proctor: quizSession.proctor
  });
});

app.get("/api/quiz/:quizId/result", authRequired, (req, res) => {
  const respond = async () => {
    const quizSession = await ensureQuizAccess(req, res);
    if (!quizSession) return;
    // Students see results only after AI publish time OR after teacher final publish.
    const isOwnerStudent = req.user.id === quizSession.studentId && req.user.role === "student";
    const now = Date.now();
    const aiReady = !quizSession.aiPublishAt || now >= quizSession.aiPublishAt;
    const teacherReady = Boolean(quizSession.teacherPublishedAt);
    if (isOwnerStudent && !aiReady && !teacherReady) {
      return res.json({
        pending: true,
        availableInSec: Math.max(0, Math.floor((quizSession.aiPublishAt - now) / 1000)),
        message: "Results will be published after AI checking window."
      });
    }
    return res.json(buildResult(quizSession));
  };
  return respond().catch((error) => res.status(500).json({ error: error.message || "Failed to fetch result." }));
});

app.get("/api/quizzes/:quizId", authRequired, async (req, res) => {
  const quizSession = await ensureQuizAccess(req, res);
  if (!quizSession) return;

  const test = quizSession.testId ? tests.get(quizSession.testId) : null;
  const now = Date.now();
  const aiReady = !quizSession.aiPublishAt || now >= quizSession.aiPublishAt;
  const teacherReady = Boolean(quizSession.teacherPublishedAt);
  const publishLimit = 3;

  const isOwnerStudent = req.user.id === quizSession.studentId && req.user.role === "student";
  const canSeeAi = !isOwnerStudent || aiReady || teacherReady;

  const questionById = new Map(
    (quizSession.questionBank || []).map((q) => [
      q.id,
      { id: q.id, prompt: q.prompt, difficulty: q.difficulty, type: q.type || "subjective", choices: q.choices || null }
    ])
  );

  return res.json({
    quizId: quizSession.id,
    test: test ? compactTestPayload(test) : null,
    studentName: users.get(quizSession.studentId)?.name || null,
    studentEmail: users.get(quizSession.studentId)?.email || null,
    rollNo: quizSession.rollNo || null,
    status: {
      completed: Boolean(quizSession.completed),
      completedAt: quizSession.completedAt ?? null,
      aiPublishAt: quizSession.aiPublishAt ?? null,
      teacherPublishedAt: quizSession.teacherPublishedAt ?? null,
      canSeeAi,
      publishCount: Number(quizSession.publishCount) || 0,
      publishLimit,
      lastReviewEditedAt: quizSession.lastReviewEditedAt ?? null
    },
    marks: {
      totalMarks: quizSession.totalMarks ?? null,
      marksPerQuestion: quizSession.marksPerQuestion ?? null,
      teacherOverallMarks: quizSession.teacherOverallMarks ?? null,
      teacherOverallRemark: quizSession.teacherOverallRemark ?? null
    },
    responses: (quizSession.responses || []).map((r, idx) => ({
      index: idx + 1,
      question: questionById.get(r.questionId) || { id: r.questionId, prompt: "(Question unavailable)", difficulty: r.difficulty },
      answer: r.answer,
      mcqChoice: r.mcqChoice ?? null,
      // Hide AI scores until publish window for students.
      percentage: canSeeAi ? r.percentage : null,
      marksAwarded: canSeeAi ? r.marksAwarded ?? null : null,
      explanation: canSeeAi ? r.explanation ?? null : null,
      teacherMarksAwarded: r.teacherMarksAwarded ?? null,
      teacherFeedback: r.teacherFeedback ?? null
    }))
  });
});

app.get("/api/tests/:testId/attempts", authRequired, requireRoles("teacher", "admin"), async (req, res) => {
  const test = tests.get(req.params.testId);
  if (!test) return res.status(404).json({ error: "Test not found." });
  if (test.createdBy !== req.user.id && req.user.role !== "admin") {
    return res.status(403).json({ error: "You cannot view attempts for this test." });
  }

  const attempts = (test.attempts || []).map((a) => {
    const u = users.get(a.userId);
    const quiz = quizSessions.get(a.quizId);
    return {
      userId: a.userId,
      studentName: u?.name || null,
      studentEmail: u?.email || null,
      quizId: a.quizId,
      rollNo: quiz?.rollNo || null,
      startedAt: a.startedAt,
      completed: Boolean(quiz?.completed),
      teacherPublishedAt: quiz?.teacherPublishedAt ?? null,
      publishCount: Number(quiz?.publishCount) || 0,
      aiPublishAt: quiz?.aiPublishAt ?? null
    };
  });

  return res.json({ test: compactTestPayload(test), attempts });
});

app.patch("/api/quizzes/:quizId/review", authRequired, requireRoles("teacher", "admin"), async (req, res) => {
  const quizSession = await ensureQuizAccess(req, res);
  if (!quizSession) return;
  if (!quizSession.testId) return res.status(400).json({ error: "This quiz is not associated with a test." });

  const test = tests.get(quizSession.testId);
  if (!test) return res.status(404).json({ error: "Test not found for this quiz." });
  if (test.createdBy !== req.user.id && req.user.role !== "admin") {
    return res.status(403).json({ error: "You cannot review this quiz." });
  }

  const updates = Array.isArray(req.body?.responses) ? req.body.responses : [];
  const publishFinal = Boolean(req.body?.publishFinal);
  const teacherOverallMarksRaw = req.body?.teacherOverallMarks;
  const teacherOverallRemarkRaw = req.body?.teacherOverallRemark;

  const baselinePublishedSig =
    quizSession.lastPublishedReviewHash ||
    (quizSession.teacherPublishedAt
      ? reviewSignatureFromResponses(
        quizSession.responses || [],
        quizSession.teacherOverallMarks,
        quizSession.teacherOverallRemark
      )
      : null);

  const byQ = new Map(updates.map((u) => [u.questionId, u]));
  quizSession.responses = (quizSession.responses || []).map((r) => {
    const u = byQ.get(r.questionId);
    if (!u) return r;
    const next = { ...r };
    if (u.teacherFeedback !== undefined) next.teacherFeedback = String(u.teacherFeedback || "");
    if (u.teacherMarksAwarded !== undefined) {
      const n = Number(u.teacherMarksAwarded);
      next.teacherMarksAwarded = Number.isFinite(n) ? Math.max(0, n) : next.teacherMarksAwarded;
    }
    return next;
  });

  if (teacherOverallMarksRaw !== undefined) {
    const raw = teacherOverallMarksRaw;
    if (raw === null || String(raw).trim() === "") {
      quizSession.teacherOverallMarks = null;
    } else {
      const n = Number(raw);
      quizSession.teacherOverallMarks = Number.isFinite(n) ? Math.max(0, n) : quizSession.teacherOverallMarks;
    }
  }
  if (teacherOverallRemarkRaw !== undefined) {
    quizSession.teacherOverallRemark = String(teacherOverallRemarkRaw || "").trim() || null;
  }

  quizSession.lastReviewEditedAt = Date.now();

  if (publishFinal) {
    if (!quizSession.completed) {
      return res.status(400).json({ error: "Cannot publish before the student completes the test." });
    }
    if (!Number.isFinite(Number(quizSession.teacherOverallMarks))) {
      return res.status(400).json({ error: "Overall marks are required before publishing." });
    }

    const publishLimit = 3;
    const publishCount = Number(quizSession.publishCount) || 0;
    if (publishCount >= publishLimit) {
      return res.status(409).json({ error: "Republish limit reached (3/3). No further publishing allowed." });
    }

    const signature = reviewSignatureFromResponses(
      quizSession.responses || [],
      quizSession.teacherOverallMarks,
      quizSession.teacherOverallRemark
    );
    const lastSig = baselinePublishedSig || null;

    if (publishCount > 0 && lastSig && signature === lastSig) {
      return res.status(409).json({ error: "No changes detected since last publish. Edit the review to republish." });
    }

    quizSession.teacherPublishedAt = Date.now();
    quizSession.publishCount = publishCount + 1;
    quizSession.lastPublishedReviewHash = signature;
  }

  await persistQuizSession(quizSession);
  await logHistory(req.user.id, "teacher_review", {
    quizId: quizSession.id,
    publishFinal,
    publishCount: Number(quizSession.publishCount) || 0
  });

  return res.json({
    ok: true,
    quizId: quizSession.id,
    teacherPublishedAt: quizSession.teacherPublishedAt ?? null,
    publishCount: Number(quizSession.publishCount) || 0,
    publishLimit: 3,
    lastReviewEditedAt: quizSession.lastReviewEditedAt ?? null
  });
});

// Bulk publish endpoint - publish multiple student results at once
app.post("/api/tests/:testId/bulk-publish", authRequired, requireRoles("teacher", "admin"), async (req, res) => {
  const testId = req.params.testId;
  const test = tests.get(testId);

  if (!test) {
    return res.status(404).json({ error: "Test not found." });
  }

  if (test.createdBy !== req.user.id && req.user.role !== "admin") {
    return res.status(403).json({ error: "You cannot publish results for this test." });
  }

  const quizIds = Array.isArray(req.body?.quizIds) ? req.body.quizIds : [];

  if (quizIds.length === 0) {
    return res.status(400).json({ error: "No quiz IDs provided for bulk publish." });
  }

  const results = [];
  const publishLimit = 3;

  for (const quizId of quizIds) {
    try {
      const quizSession = quizSessions.get(quizId);

      if (!quizSession) {
        results.push({ quizId, success: false, error: "Quiz not found" });
        continue;
      }

      if (quizSession.testId !== testId) {
        results.push({ quizId, success: false, error: "Quiz does not belong to this test" });
        continue;
      }

      if (!quizSession.completed) {
        results.push({ quizId, success: false, error: "Student has not completed the quiz" });
        continue;
      }

      if (!Number.isFinite(Number(quizSession.teacherOverallMarks))) {
        results.push({ quizId, success: false, error: "Overall marks not set" });
        continue;
      }

      const publishCount = Number(quizSession.publishCount) || 0;
      if (publishCount >= publishLimit) {
        results.push({ quizId, success: false, error: "Publish limit reached (3/3)" });
        continue;
      }

      // Check if there are changes since last publish
      const signature = reviewSignatureFromResponses(
        quizSession.responses || [],
        quizSession.teacherOverallMarks,
        quizSession.teacherOverallRemark
      );
      const lastSig = quizSession.lastPublishedReviewHash || null;

      if (publishCount > 0 && lastSig && signature === lastSig) {
        results.push({ quizId, success: false, error: "No changes since last publish" });
        continue;
      }

      // Publish the quiz
      quizSession.teacherPublishedAt = Date.now();
      quizSession.publishCount = publishCount + 1;
      quizSession.lastPublishedReviewHash = signature;

      await persistQuizSession(quizSession);
      await logHistory(req.user.id, "bulk_publish", {
        quizId: quizSession.id,
        testId,
        publishCount: quizSession.publishCount
      });

      results.push({
        quizId,
        success: true,
        publishCount: quizSession.publishCount,
        teacherPublishedAt: quizSession.teacherPublishedAt
      });
    } catch (error) {
      results.push({ quizId, success: false, error: error.message || "Unknown error" });
    }
  }

  const successCount = results.filter(r => r.success).length;
  const failureCount = results.length - successCount;

  return res.json({
    ok: true,
    total: results.length,
    successCount,
    failureCount,
    results
  });
});

// Backward compatible demo endpoints
app.post("/api/upload-books", upload.array("books", MAX_BOOK_FILES), async (req, res) => {
  try {
    const files = req.files || [];
    if (files.length < 1) {
      return res.status(400).json({ error: "Upload at least 1 book (PDF/TXT)." });
    }

    const session = await createBookSession(files, "public-demo");

    return res.json({
      bookSessionId: session.id,
      message: "Books uploaded and indexed successfully.",
      stats: {
        chunks: session.chunks.length,
        questions: session.questionBank.length
      }
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Book processing failed." });
  }
});

app.post("/api/start-quiz", (req, res) => {
  const { bookSessionId, studentId = "anonymous", initialLevel = "intermediate", questionCount = 8 } =
    req.body || {};
  const bookSession = bookSessions.get(bookSessionId);
  if (!bookSession) {
    return res.status(404).json({ error: "Invalid bookSessionId. Upload books first." });
  }

  try {
    const { quizSession, firstQuestion } = createQuizSession({
      bookSession,
      studentId,
      initialLevel,
      questionCount,
      durationMinutes: 30
    });

    return res.json({
      quizId: quizSession.id,
      studentId,
      currentLevel: quizSession.currentLevel,
      question: questionPayload(firstQuestion, 1, quizSession.questionCount)
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Unable to start quiz." });
  }
});


// Analytics endpoint - aggregated data for a test
app.get("/api/tests/:testId/analytics", authRequired, requireRoles("teacher", "admin"), async (req, res) => {
  const testId = req.params.testId;
  const test = tests.get(testId);

  if (!test) return res.status(404).json({ error: "Test not found." });
  if (test.createdBy !== req.user.id && req.user.role !== "admin") {
    return res.status(403).json({ error: "Access denied." });
  }

  // Get all attempts for this test
  const attempts = Array.from(quizSessions.values()).filter((s) => s.testId === testId);
  const completed = attempts.filter((s) => s.completed);

  if (attempts.length === 0) {
    return res.json({ empty: true, testTitle: test.title });
  }

  const stats = {
    testTitle: test.title,
    totalStudents: attempts.length,
    completedCount: completed.length,
    completionRate: ((completed.length / attempts.length) * 100).toFixed(1),
    averageScore: 0,
    highestScore: 0,
    lowestScore: attempts.length > 0 ? Infinity : 0,
    averageRisk: 0,
    maxMarks: test.totalMarks,
    riskDistribution: { low: 0, medium: 0, high: 0, critical: 0 }
  };

  let totalScore = 0;
  let totalRisk = 0;

  attempts.forEach((s) => {
    const risk = s.proctor?.riskScore || 0;
    totalRisk += risk;

    if (risk < 30) stats.riskDistribution.low++;
    else if (risk < 55) stats.riskDistribution.medium++;
    else if (risk < 80) stats.riskDistribution.high++;
    else stats.riskDistribution.critical++;

    if (s.completed) {
      const score = Number(s.teacherOverallMarks) || 0;
      totalScore += score;
      if (score > stats.highestScore) stats.highestScore = score;
      if (score < stats.lowestScore) stats.lowestScore = score;
    }
  });

  if (completed.length > 0) {
    stats.averageScore = (totalScore / completed.length).toFixed(1);
    if (stats.lowestScore === Infinity) stats.lowestScore = 0;
  } else {
    stats.lowestScore = 0;
  }

  stats.averageRisk = (totalRisk / attempts.length).toFixed(1);

  return res.json(stats);
});

// Proctoring log endpoint - get detailed proctor events for a quiz
app.get("/api/quiz/:quizId/proctor-logs", authRequired, requireRoles("teacher", "admin"), async (req, res) => {
  const quizSession = quizSessions.get(req.params.quizId);
  if (!quizSession) return res.status(404).json({ error: "Quiz session not found." });

  const test = tests.get(quizSession.testId);
  if (!test) return res.status(404).json({ error: "Associated test not found." });

  if (test.createdBy !== req.user.id && req.user.role !== "admin") {
    return res.status(403).json({ error: "Access denied." });
  }

  return res.json({
    proctor: quizSession.proctor || { events: [], riskScore: 0, warningCount: 0 },
    studentName: quizSession.studentName,
    studentEmail: quizSession.studentEmail
  });
});

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        error: `File too large. Max allowed size is ${MAX_BOOK_SIZE_MB}MB per book.`
      });
    }
    return res.status(400).json({ error: error.message || "Upload error." });
  }

  if (error) {
    return res.status(400).json({ error: error.message || "Request failed." });
  }

  return res.status(500).json({ error: "Unexpected error." });
});

async function startServer(port) {
  return new Promise((resolve, reject) => {
    const server = app
      .listen(port, () => resolve(server))
      .on("error", (error) => reject(error));
  });
}

async function bootstrap() {
  await fs.mkdir(uploadDir, { recursive: true });

  if (mongoose && MONGODB_URI) {
    try {
      await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 4000 });
      dbReady = true;
      console.log("MongoDB connected.");

      const userDocs = await UserModel.find({}).lean();
      userDocs.forEach((d) => {
        const u = {
          id: d._id,
          name: d.name,
          email: d.email,
          passwordHash: d.passwordHash,
          role: d.role,
          isApproved: Boolean(d.isApproved),
          createdAt: d.createdAt?.toISOString?.() || new Date(d.createdAt).toISOString()
        };
        users.set(u.id, u);
        usersByEmail.set(u.email, u.id);
      });

      const bookDocs = await BookSessionModel.find({}).lean();
      bookDocs.forEach((d) => {
        const b = bookSessionFromDoc(d);
        bookSessions.set(b.id, b);
      });

      const testDocs = await TestModel.find({}).lean();
      testDocs.forEach((d) => {
        const t = testFromDoc(d);
        tests.set(t.id, t);
      });
    } catch (error) {
      dbReady = false;
      console.warn("MongoDB not connected. Running in in-memory mode. Error:", error.message);
    }
  } else if (MONGODB_URI && !mongoose) {
    console.warn("MONGODB_URI is set, but `mongoose` is not installed. Falling back to file store.");
  } else {
    console.warn("MongoDB disabled. Falling back to file store.");
  }

  if (!dbReady) {
    await loadFileStore();
    fileStore.users.forEach((u) => {
      if (!u?.id) return;
      users.set(u.id, u);
      usersByEmail.set(u.email, u.id);
    });
    fileStore.bookSessions.forEach((b) => {
      if (!b?._id) return;
      bookSessions.set(b._id, bookSessionFromDoc(b));
    });
    fileStore.tests.forEach((t) => {
      if (!t?._id) return;
      tests.set(t._id, testFromDoc(t));
    });
    fileStore.quizSessions.forEach((q) => {
      if (!q?._id) return;
      quizSessions.set(q._id, quizSessionFromDoc(q));
    });
  }

  await seedAdmin();

  try {
    await startServer(PORT);
    process.env.ACTIVE_PORT = String(PORT);
    console.log(`Backend running on http://localhost:${PORT}`);
    console.log("Seeded admin login: admin@evalo.ai / admin123");
  } catch (error) {
    if (error?.code === "EADDRINUSE" && !process.env.PORT) {
      const fallbackPort = PORT + 1;
      await startServer(fallbackPort);
      process.env.ACTIVE_PORT = String(fallbackPort);
      console.log(`Port ${PORT} is busy. Backend running on fallback http://localhost:${fallbackPort}`);
      console.log("Seeded admin login: admin@evalo.ai / admin123");
      return;
    }
    throw error;
  }
}
bootstrap().catch((error) => {
  console.error("Failed to start backend:", error);
  process.exit(1);
});