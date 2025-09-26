// =====================================================
// 画像4択クイズ（50問をランダム順で全問出題）
// - data.json から { id, image, choices[4], correct } を読み込み
// - correct は 'ア' | 'イ' | 'ウ' | 'エ' いずれか
//   ※ 互換: answerIndex(0-3) or img プロパティも許容
// - クリックすると 〇/× を表示し自動で次へ
// =====================================================

const LABELS = ['ア', 'イ', 'ウ', 'エ'];
const els = {
  img: document.getElementById('questionImage'),
  choices: document.getElementById('choices'),
  mark: document.getElementById('markOverlay'),
  progress: document.getElementById('progress'),
  score: document.getElementById('score'),
  live: document.getElementById('live'),
  result: document.getElementById('result'),
  finalScore: document.getElementById('finalScore'),
  restartBtn: document.getElementById('restartBtn'),
  skipBtn: document.getElementById('skipBtn')
};

// フォールバック（data.json が読み込めない場合の最少テストデータ）
const fallbackData = [
  {
    id: 1,
    image: "images/q01.jpg",
    choices: ["サンプルA", "サンプルB", "サンプルC", "サンプルD"],
    correct: "ア"
  },
  {
    id: 2,
    image: "images/q02.jpg",
    choices: ["りんご", "みかん", "バナナ", "ぶどう"],
    correct: "ウ" // 例: バナナ
  },
  {
    id: 3,
    image: "images/q03.jpg",
    choices: ["HTTP:80", "HTTPS:443", "FTP:22", "SMTP:110"],
    correct: "イ" // 例: HTTPS:443
  }
];

let QUESTIONS = [];       // data.json 読み込み済み
let order = [];           // 出題順（シャッフル）
let index = 0;            // 現在の出題ポインタ
let score = 0;            // 正解数
let lock = false;         // 二重連打防止

init();

async function init(){
  // data.json をロード
  try{
    const res = await fetch('data.json', { cache: 'no-store' });
    if(!res.ok) throw new Error('failed');
    const data = await res.json();

    // データ整形：プロパティ名の揺れを許容
    QUESTIONS = data.map(normalizeQuestion);

    // 最低限のバリデーション
    if(!Array.isArray(QUESTIONS) || QUESTIONS.length === 0){
      throw new Error('empty');
    }
  }catch(e){
    // フォールバック
    console.warn('data.json の読み込みに失敗したため、サンプルデータで起動します。', e);
    QUESTIONS = fallbackData.map(normalizeQuestion);
  }

  // 50問を想定。データ数に合わせて動作します
  resetGame();

  // UIイベント
  els.restartBtn.addEventListener('click', () => resetGame());
  els.skipBtn.addEventListener('click', () => nextQuestion());
  window.addEventListener('keydown', handleKey);
}

function normalizeQuestion(raw){
  // image/img どちらでもOK
  const image = raw.image || raw.img || '';
  // choices は 4件に整形
  let choices = raw.choices || [];
  if(!Array.isArray(choices)) choices = [];
  choices = [...choices];
  while(choices.length < 4) choices.push('（未設定）');

  // 正解は correct(ア/イ/ウ/エ) or answerIndex(0..3)
  let correct = raw.correct;
  if(!correct && typeof raw.answerIndex === 'number'){
    correct = LABELS[raw.answerIndex] ?? 'ア';
  }
  // 念のため不正値ガード
  if(!LABELS.includes(correct)) correct = 'ア';

  return {
    id: raw.id ?? null,
    image,
    choices: choices.slice(0,4),
    correct
  };
}

function resetGame(){
  score = 0;
  index = 0;
  lock = false;
  order = shuffle([...Array(QUESTIONS.length).keys()]);
  els.result.hidden = true;
  els.skipBtn.disabled = false;
  updateHUD();
  render();
}

function updateHUD(){
  els.progress.textContent = `${index} / ${QUESTIONS.length}`;
  els.score.textContent = `正解 ${score}`;
}

function render(){
  if(index >= QUESTIONS.length){
    finish();
    return;
  }

  const q = QUESTIONS[order[index]];

  // 画像
  els.img.src = q.image;
  els.img.alt = `問題画像 ${q.id ?? index+1}`;
  // 選択肢
  els.choices.innerHTML = '';
  q.choices.forEach((text, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'choice';
    btn.dataset.key = LABELS[i];

    btn.innerHTML = `
      <span class="badge">${LABELS[i]}</span>
      <span class="text">${escapeHTML(text || '（未設定）')}</span>
    `;

    btn.addEventListener('click', () => choose(btn, q));
    els.choices.appendChild(btn);
  });

  updateHUD();
}

function choose(btn, q){
  if(lock) return;
  lock = true;

  const picked = btn.dataset.key;           // 'ア' | 'イ' | 'ウ' | 'エ'
  const isCorrect = picked === q.correct;

  // 視覚フィードバック（ボタン）
  btn.classList.add(isCorrect ? 'correct' : 'wrong');

  // 〇×オーバーレイ
  showMark(isCorrect);

  // スコア、読み上げ
  if(isCorrect){
    score++;
    els.live.textContent = '正解';
  }else{
    els.live.textContent = '不正解';
  }
  updateHUD();

  // 少し待って次の問題へ
  setTimeout(() => {
    nextQuestion();
  }, 800);
}

function nextQuestion(){
  if(index >= QUESTIONS.length) return finish();
  index++;
  lock = false;
  hideMark();
  render();
}

function finish(){
  els.skipBtn.disabled = true;
  els.result.hidden = false;
  els.finalScore.textContent = `正解数：${score} / ${QUESTIONS.length}`;
  els.live.textContent = '終了';
}

function showMark(ok){
  els.mark.className = ok ? 'ok show' : 'ng show';
  els.mark.innerHTML = `<div class="mark">${ok ? '〇' : '×'}</div>`;
}
function hideMark(){
  els.mark.className = '';
  els.mark.innerHTML = '';
}

function shuffle(arr){
  for(let i = arr.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function handleKey(e){
  // 1〜4 または A/I/U/E の頭文字（日本語配列でも対応しづらいので数値推奨）
  if(e.key >= '1' && e.key <= '4'){
    const idx = Number(e.key) - 1;
    const btn = els.choices.children[idx];
    if(btn) btn.click();
  }
}

// HTMLエスケープ（XSS対策）
function escapeHTML(str){
  return String(str).replace(/[&<>"'`=\/]/g, s => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','/':'&#x2F;','`':'&#x60;','=':'&#x3D;'
  }[s]));
}
