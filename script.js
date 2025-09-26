// =====================================================
// 画像4択クイズ（50問をランダム順で全問出題）
// - data.json から { id, image, choices[4], correct } を読み込み
// - correct は 'ア' | 'イ' | 'ウ' | 'エ' いずれか
// - ×のときは 画像下のカードに「正解は ○（本文）」を表示
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
  skipBtn: document.getElementById('skipBtn'),
  answerBar: document.getElementById('answerBar')
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
    correct: "ウ"
  },
  {
    id: 3,
    image: "images/q03.jpg",
    choices: ["HTTP:80", "HTTPS:443", "FTP:21", "SMTP:25"],
    correct: "イ"
  }
];

let QUESTIONS = [];
let order = [];
let index = 0;
let score = 0;
let lock = false;

init();

async function init(){
  try{
    const res = await fetch('data.json', { cache: 'no-store' });
    if(!res.ok) throw new Error('failed');
    const data = await res.json();

    QUESTIONS = data.map(normalizeQuestion);
    if(!Array.isArray(QUESTIONS) || QUESTIONS.length === 0){
      throw new Error('empty');
    }
  }catch(e){
    console.warn('data.json の読み込みに失敗したため、サンプルデータで起動します。', e);
    QUESTIONS = fallbackData.map(normalizeQuestion);
  }

  resetGame();

  els.restartBtn.addEventListener('click', () => resetGame());
  els.skipBtn.addEventListener('click', () => nextQuestion());
  window.addEventListener('keydown', handleKey);
}

function normalizeQuestion(raw){
  const image = raw.image || raw.img || '';
  let choices = raw.choices || [];
  if(!Array.isArray(choices)) choices = [];
  choices = [...choices];
  while(choices.length < 4) choices.push('（未設定）');

  let correct = raw.correct;
  if(!correct && typeof raw.answerIndex === 'number'){
    correct = LABELS[raw.answerIndex] ?? 'ア';
  }
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
  hideMark();
  hideAnswer();
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

  els.img.src = q.image;
  els.img.alt = `問題画像 ${q.id ?? index+1}`;

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

  hideAnswer(); // 新しい問題に切り替わるたびに下部の答えを消す
  updateHUD();
}

function choose(btn, q){
  if(lock) return;
  lock = true;

  const picked = btn.dataset.key;
  const isCorrect = picked === q.correct;
  const correctIdx = LABELS.indexOf(q.correct);
  const correctText = q.choices[correctIdx] ?? '';

  // 視覚フィードバック（ボタン）
  btn.classList.add(isCorrect ? 'correct' : 'wrong');

  // 〇×オーバーレイ（テキストは出さない）
  showMark(isCorrect);

  // 不正解時は画像の下に正解を表示
  if(isCorrect){
    score++;
    hideAnswer();
    els.live.textContent = '正解';
  }else{
    showAnswer(q.correct, correctText); // ← ここで下部カードに表示
    els.live.textContent = `不正解。正解は${q.correct}：${correctText}`;
  }
  updateHUD();

  // 次の問題へ（×のときは少し長め）
  const delay = isCorrect ? 800 : 1600;
  setTimeout(() => {
    nextQuestion();
  }, delay);
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
  hideAnswer();
}

function showMark(ok){
  els.mark.className = ok ? 'ok show' : 'ng show';
  els.mark.innerHTML = `<div class="mark">${ok ? '〇' : '×'}</div>`;
}
function hideMark(){
  els.mark.className = '';
  els.mark.innerHTML = '';
}

// ==== 画像下の正解カード ====
function showAnswer(label, text){
  els.answerBar.hidden = false;
  els.answerBar.classList.remove('ok','ng');
  els.answerBar.classList.add('ng'); // 今回は不正解時のみ出す仕様
  els.answerBar.innerHTML = `正解は <span class="badge">${label}</span><span class="ct">${escapeHTML(text)}</span>`;
}
function hideAnswer(){
  els.answerBar.hidden = true;
  els.answerBar.classList.remove('ok','ng');
  els.answerBar.textContent = '';
}

function shuffle(arr){
  for(let i = arr.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function handleKey(e){
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
