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

// ⬇️ Cambia esto si ya tienes endpoint (mismo dominio o CORS habilitado)
const PREDICT_URL = './predict.json'; // placeholder. Ej.: 'https://tu-api.onrender.com/predict'

function toPayload(fd){
  const o = {};
  for (const [k,v] of fd.entries()){
    if (v === '') continue;
    // convierte numéricos cuando aplique
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
  if (L.includes('planeta') && !L.includes('candidato')) labelPill.classList.add('ok');
  else if (L.includes('candidato')) labelPill.classList.add('warn');
  else labelPill.classList.add('bad');
  labelPill.textContent = String(label);
}

form.addEventListener('submit', async (e)=>{
  e.preventDefault();
  clearError();

  if (!form.checkValidity()){
    showError('Revisa los campos requeridos y rangos numéricos.');
    return;
  }

  const payload = toPayload(new FormData(form));
  setLoading(true);

  try{
    // Si usas API real:
    // const res = await fetch(PREDICT_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    // if (!res.ok) throw new Error('Error de predicción');
    // const data = await res.json();

    // Mock para entorno estático (borra cuando conectes backend)
    await new Promise(r => setTimeout(r, 800));
    const score = Math.random();
    const data = {
      label: score > 0.7 ? 'Planeta' : (score > 0.4 ? 'Candidato' : 'No planetario'),
      confidence: (0.65 + Math.random()*0.35).toFixed(2),
      explain: 'Modelo basado en parámetros de tránsito/estrella.',
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
    showError('No se pudo obtener la predicción. Intenta de nuevo.');
  }finally{
    setLoading(false);
  }
});

