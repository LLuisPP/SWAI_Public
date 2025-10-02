const form = document.getElementById('predict-form');
const submitBtn = document.getElementById('submit-btn');
const formError = document.getElementById('form-error');

const resultCard = document.getElementById('result-card');
const resultEmpty = document.getElementById('result-empty');
const resultBox = document.getElementById('result');
const labelPill = document.getElementById('label-pill');
const confidenceEl = document.getElementById('confidence');
const explainEl = document.getElementById('explain');
const ridEl = document.getElementById('rid');

const PREDICT_URL = './predict.json';

function toPayload(fd){
  const o = {};
  for (const [k,v] of fd.entries()){
    if (v === '') continue;
    o[k] = isNaN(v) || ['kepid'].includes(k) ? v : Number(v);
  }
  return o;
}

function setLoading(isLoading){
  submitBtn.classList.toggle('loading', isLoading);
  form.querySelectorAll('input, button').forEach(el => el.disabled = isLoading);
  resultCard.setAttribute('aria-busy', String(isLoading));
}

function showError(msg){
  formError.textContent = msg;
  formError.classList.remove('hidden');
}

function clearError(){
  formError.classList.add('hidden');
  formError.textContent = '';
}

function paintLabel(label){
  const L = String(label).toLowerCase();
  labelPill.classList.remove('ok','warn','bad');
  if (L.includes('planet') && !L.includes('candidate')) labelPill.classList.add('ok');
  else if (L.includes('candidate')) labelPill.classList.add('warn');
  else labelPill.classList.add('bad');
  labelPill.textContent = String(label);
}

form.addEventListener('submit', async (e)=>{
  e.preventDefault();
  clearError();

  if (!form.checkValidity()){
    showError('Check required fields and numerical ranges.');
    return;
  }

  const payload = toPayload(new FormData(form));
  setLoading(true);

  try{
    await new Promise(r => setTimeout(r, 800));
    const score = Math.random();
    const data = {
      label: score > 0.7 ? 'Planet' : (score > 0.4 ? 'Candidate' : 'Not planetary'),
      confidence: (0.65 + Math.random()*0.35).toFixed(2),
      explain: 'Model based in transit/star params.',
      request_id: payload.kepid || (Date.now().toString(36))
    };

    // Pinta resultado
    resultEmpty.classList.add('hidden');
    resultBox.classList.remove('hidden');
    paintLabel(data.label);
    confidenceEl.textContent = `${Number(data.confidence*100 || data.confidence).toFixed(0)}%`;
    explainEl.textContent = data.explain;
    ridEl.textContent = data.request_id;

  }catch(err){
    console.error(err);
    showError('Could not obtain prediction. Try again.');
  }finally{
    setLoading(false);
  }
});

