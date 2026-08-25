// ============================================
// Quiz Generator Prototype — client-side only
// Not reading real file content: this is a prototype,
// so "generate" picks random sample questions instead.
// ============================================

const { buildQuestionViewModel } = window.QuizViewModel;

// ---------- Sample question bank (mock data) ----------
const QUESTION_BANK = [
  {
    question: "สมการ 2x + 5 = 11 มีค่า x เท่าใด?",
    choices: ["x = 2", "x = 3", "x = 4", "x = 5"],
    correctIndex: 1,
    explanation: "2x + 5 = 11 → 2x = 6 → x = 3 ดังนั้นคำตอบคือ B"
  },
  {
    question: "ข้อใดคือหน่วยของแรงในระบบ SI?",
    choices: ["จูล (Joule)", "นิวตัน (Newton)", "วัตต์ (Watt)", "ปาสคาล (Pascal)"],
    correctIndex: 1,
    explanation: "แรงมีหน่วยเป็นนิวตัน (N) ตามกฎข้อที่สองของนิวตัน F = ma"
  },
  {
    question: "log10(100) มีค่าเท่าใด?",
    choices: ["1", "2", "10", "100"],
    correctIndex: 1,
    explanation: "log10(100) = log10(10^2) = 2"
  },
  {
    question: "ข้อใดคือความหมายของ Photosynthesis?",
    choices: [
      "กระบวนการหายใจของพืช",
      "กระบวนการสังเคราะห์แสงของพืช",
      "กระบวนการย่อยอาหารของสัตว์",
      "กระบวนการแบ่งเซลล์"
    ],
    correctIndex: 1,
    explanation: "Photosynthesis คือกระบวนการที่พืชใช้แสงแดดเปลี่ยน CO2 และน้ำเป็นพลังงาน"
  },
  {
    question: "ตัวเลข 7 เป็นจำนวนชนิดใด?",
    choices: ["จำนวนคู่", "จำนวนเฉพาะ", "จำนวนประกอบ", "จำนวนลบ"],
    correctIndex: 1,
    explanation: "7 หารลงตัวด้วย 1 และ 7 เท่านั้น จึงเป็นจำนวนเฉพาะ"
  },
  {
    question: "สารเคมีใดที่พืชดูดซึมผ่านปากใบเพื่อสังเคราะห์แสง?",
    choices: ["ออกซิเจน", "คาร์บอนไดออกไซด์", "ไนโตรเจน", "ไฮโดรเจน"],
    correctIndex: 1,
    explanation: "พืชดูดซึม CO2 ผ่านปากใบ (Stomata) เพื่อใช้ในกระบวนการสังเคราะห์แสง"
  },
  {
    question: "ถ้า f(x) = x^2 แล้ว f(4) มีค่าเท่าใด?",
    choices: ["8", "12", "16", "20"],
    correctIndex: 2,
    explanation: "f(4) = 4^2 = 16"
  },
  {
    question: "ข้อใดคือเมืองหลวงของประเทศญี่ปุ่น?",
    choices: ["โอซาก้า", "เกียวโต", "โตเกียว", "นาโกย่า"],
    correctIndex: 2,
    explanation: "โตเกียวเป็นเมืองหลวงของญี่ปุ่นตั้งแต่ปี ค.ศ. 1868"
  },
  {
    question: "ความเร่งโน้มถ่วงของโลกโดยประมาณคือเท่าใด?",
    choices: ["4.9 m/s²", "9.8 m/s²", "12.6 m/s²", "15.0 m/s²"],
    correctIndex: 1,
    explanation: "ความเร่งโน้มถ่วงของโลกโดยประมาณคือ 9.8 m/s²"
  },
  {
    question: "DNA ย่อมาจากอะไร?",
    choices: [
      "Deoxyribonucleic Acid",
      "Dynamic Nuclear Acid",
      "Diribose Nucleic Acid",
      "Deoxy Nitrogen Acid"
    ],
    correctIndex: 0,
    explanation: "DNA ย่อมาจาก Deoxyribonucleic Acid ซึ่งเก็บข้อมูลทางพันธุกรรม"
  }
];

// ---------- State ----------
let uploadedFileName = null;
let quizQuestions = [];
let currentIndex = 0;
let userAnswers = [];

// ---------- Element refs ----------
const uploadScreen = document.getElementById('upload-screen');
const quizScreen = document.getElementById('quiz-screen');
const resultScreen = document.getElementById('result-screen');

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const fileChip = document.getElementById('file-chip');
const fileNameEl = document.getElementById('file-name');
const chipRemove = document.getElementById('chip-remove');
const uploadError = document.getElementById('upload-error');

const qnumInput = document.getElementById('qnum');
const generateBtn = document.getElementById('generate-btn');

const questionLabel = document.querySelector('.question-label');
const progressFill = document.getElementById('progress-fill');
const questionText = document.getElementById('question-text');
const choiceList = document.getElementById('choice-list');
const feedbackText = document.getElementById('feedback-text');
const explainToggle = document.getElementById('explain-toggle');
const explainText = document.getElementById('explain-text');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');

const resultScore = document.getElementById('result-score');
const resultPercent = document.getElementById('result-percent');
const restartBtn = document.getElementById('restart-btn');

// ---------- 1. File upload (click + drag & drop) ----------
dropzone.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', () => {
  if (fileInput.files.length > 0) {
    setUploadedFile(fileInput.files[0].name);
  }
});

['dragenter', 'dragover'].forEach(evt => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.add('drag-over');
  });
});

['dragleave', 'drop'].forEach(evt => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
  });
});

dropzone.addEventListener('drop', (e) => {
  const file = e.dataTransfer.files[0];
  if (file) setUploadedFile(file.name);
});

function setUploadedFile(name) {
  uploadedFileName = name;
  fileNameEl.textContent = `\u{1F4C4} ${name}`;
  fileChip.hidden = false;
  uploadError.hidden = true;
}

chipRemove.addEventListener('click', () => {
  uploadedFileName = null;
  fileInput.value = '';
  fileChip.hidden = true;
});

// ---------- 2. Generate quiz (random picks, prototype only) ----------
generateBtn.addEventListener('click', () => {
  if (!uploadedFileName) {
    uploadError.hidden = false;
    return;
  }
  uploadError.hidden = true;

  const requestedCount = Math.min(
    Math.max(parseInt(qnumInput.value, 10) || 1, 1),
    QUESTION_BANK.length
  );

  quizQuestions = shuffleArray([...QUESTION_BANK]).slice(0, requestedCount);
  userAnswers = new Array(quizQuestions.length).fill(null);
  currentIndex = 0;

  uploadScreen.hidden = true;
  resultScreen.hidden = true;
  quizScreen.hidden = false;

  renderQuestion();
});

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---------- 3. Render current question ----------
function renderQuestion() {
  const view = buildQuestionViewModel(
    quizQuestions[currentIndex],
    currentIndex,
    quizQuestions.length,
    userAnswers[currentIndex]
  );

  renderQuestionHeader(view);
  renderChoiceList(view.choices);
  renderFeedback(view.feedback);
  renderExplanation(view.explanation);
  renderQuestionNavigation(view);
}

function renderQuestionHeader(view) {
  questionLabel.textContent = view.label;
  progressFill.style.width = `${view.progressPercent}%`;
  questionText.textContent = view.questionText;
}

function renderChoiceList(choices) {
  choiceList.innerHTML = '';
  choices.forEach((choice) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'choice-option';
    btn.textContent = choice.label;
    btn.dataset.index = choice.index;
    choice.classes.forEach((className) => btn.classList.add(className));

    btn.addEventListener('click', () => selectAnswer(choice.index));
    choiceList.appendChild(btn);
  });
}

function renderFeedback(feedback) {
  feedbackText.hidden = !feedback.visible;
  feedbackText.textContent = feedback.text;
}

function renderExplanation(explanation) {
  explainText.textContent = explanation;
  explainText.hidden = true;
  explainToggle.textContent = '\u{1F4A1} ดูคำอธิบาย';
}

function renderQuestionNavigation(view) {
  prevBtn.disabled = view.previousDisabled;
  nextBtn.textContent = view.nextLabel;
}

// ---------- 4. Select an answer ----------
function selectAnswer(idx) {
  userAnswers[currentIndex] = idx;
  renderQuestion();
}

// ---------- 5. Explanation toggle ----------
explainToggle.addEventListener('click', () => {
  const isVisible = !explainText.hidden;
  explainText.hidden = isVisible;
  explainToggle.textContent = isVisible ? '\u{1F4A1} ดูคำอธิบาย' : '\u{1F4A1} ซ่อนคำอธิบาย';
});

// ---------- 6. Navigation ----------
prevBtn.addEventListener('click', () => {
  if (currentIndex > 0) {
    currentIndex -= 1;
    renderQuestion();
  }
});

nextBtn.addEventListener('click', () => {
  if (currentIndex < quizQuestions.length - 1) {
    currentIndex += 1;
    renderQuestion();
  } else {
    showResults();
  }
});

// ---------- 7. Results ----------
function showResults() {
  const total = quizQuestions.length;
  const correctCount = userAnswers.reduce((sum, answer, i) => {
    return sum + (answer === quizQuestions[i].correctIndex ? 1 : 0);
  }, 0);

  resultScore.textContent = `${correctCount}/${total}`;
  resultPercent.textContent = `ถูก ${Math.round((correctCount / total) * 100)}%`;

  quizScreen.hidden = true;
  resultScreen.hidden = false;
}

restartBtn.addEventListener('click', () => {
  resultScreen.hidden = true;
  uploadScreen.hidden = false;
  fileChip.hidden = true;
  fileInput.value = '';
  uploadedFileName = null;
  quizQuestions = [];
  userAnswers = [];
  currentIndex = 0;
});
