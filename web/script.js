const form        = document.getElementById('predict-form');
const submitBtn   = document.getElementById('submit-btn');
const formError   = document.getElementById('form-error');

const resultCard  = document.getElementById('result-card');
const resultEmpty = document.getElementById('result-empty');
const resultBox   = document.getElementById('result');       // texto (pill + kv)
const labelPill   = document.getElementById('label-pill');
const confidenceEl= document.getElementById('confidence');
const explainEl   = document.getElementById('explain');
const ridEl       = document.getElementById('rid');

const resultVisual = document.getElementById('result-visual'); // figure
const resultGifImg = document.getElementById('result-gif');

const debugBox    = document.getElementById('debug');
const debugLines  = document.getElementById('debug-lines');

const MODEL_URL = './model.onnx';
const META_URL  = './meta.json';

const PRED_GIFS = {
  "Planet": "assets/planet.gif",
  "Candidate": "assets/candidate.gif",
  "Not planetary": "assets/not_planetary.gif",
};

let ortSession = null;
let modelInputName = null;
let modelOutputName = null;
let meta = { features: [], classes: [] };

function showError(msg){ formError.hidden = false; formError.textContent = msg; }
function clearError(){ formError.hidden = true; formError.textContent=''; }

function resetResults(){
  resultCard.hidden  = true;
  resultEmpty.hidden = false;
  resultBox.hidden   = true;

  labelPill.textContent    = '';
  confidenceEl.textContent = '';
  explainEl.textContent    = '';
  ridEl.textContent        = '';

  if (resultGifImg) resultGifImg.src = '';
  resultVisual.hidden = true;

  if (debugBox) debugBox.hidden = true;
  if (debugLines) debugLines.textContent = '';
}

function applyPredictionUI(labelRaw, confidence, explain, rid, probs=null, classes=null){
  const MAP = { "CONFIRMED":"Planet", "FALSE POSITIVE":"Not planetary", "CANDIDATE":"Candidate" };
  const uiLabel = MAP[labelRaw] || labelRaw || '—';

  labelPill.textContent = uiLabel;
  labelPill.className = 'pill ' + (
    uiLabel === 'Planet' ? 'pill--success' :
    uiLabel === 'Candidate' ? 'pill--warning' :
    'pill--danger'
  );
  confidenceEl.textContent = (confidence!=null) ? `${Math.round(confidence*100)}%` : '—';
  explainEl.textContent    = explain || '';
  ridEl.textContent        = rid || '';

  const gifSrc = PRED_GIFS[uiLabel] || PRED_GIFS["Not planetary"];
  if (resultGifImg) resultGifImg.src = gifSrc;
  resultVisual.hidden = false;

  resultEmpty.hidden = true;
  resultBox.hidden   = false;
  resultCard.hidden  = false;

  if (probs && classes && debugBox && debugLines) {
    const lines = classes.map((c,i)=>`${c}: ${(probs[i]*100).toFixed(1)}%`).join('\n');
    debugLines.textContent = lines;
    debugBox.hidden = false;
  }
}

function getNumber(id, fallback=null){
  const el = document.getElementById(id);
  const v = Number(el?.value);
  return Number.isFinite(v) ? v : fallback;
}
function getUIValues(){
  return {
    kepid:            document.getElementById('kepid')?.value?.trim() || '',
    orbital_period:   getNumber('orbital_period'),
    transit_duration: getNumber('transit_duration'),
    rp_over_rs:       getNumber('rp_over_rs'),
    planet_radius:    getNumber('planet_radius'),
    impact:           getNumber('impact'),
    snr:              getNumber('snr'),
    teff:             getNumber('teff'),
  };
}

function deriveTransitDepthPPM(rp_over_rs){
  if (!Number.isFinite(rp_over_rs)) return null;
  return (rp_over_rs*rp_over_rs)*1e6;
}

function buildModelInput(featureOrder, ui){
  const out = [];
  for (const f of featureOrder){
    switch (f){
      case 'orbital_period':    out.push(ui.orbital_period); break;
      case 'transit_duration':  out.push(ui.transit_duration); break;
      case 'transit_depth':
      case 'transit_depth_ppm': out.push(deriveTransitDepthPPM(ui.rp_over_rs)); break;
      case 'planet_radius':
      case 'planet_radius_r_earth':
      case 'planet_radius_earth': out.push(ui.planet_radius); break;
      default:
        throw new Error(`Feature del modelo no soportada en UI: "${f}"`);
    }
  }
  if (out.some(v => v==null || !Number.isFinite(v))) {
    throw new Error('Faltan valores numéricos para alguna feature del modelo.');
  }
  return new Float32Array(out);
}

function softmax(arr){
  const m = Math.max(...arr);
  const exps = arr.map(v=>Math.exp(v-m));
  const s = exps.reduce((a,b)=>a+b,0);
  return exps.map(v=>v/s);
}

async function runOnnx(ui){
  if (!ortSession) throw new Error('Sesión ONNX no inicializada.');

  const inputArr = buildModelInput(meta.features, ui);
  const feeds = { [modelInputName]: new ort.Tensor('float32', inputArr, [1, inputArr.length]) };
  const outMap = await ortSession.run(feeds);
  const labelFromModel = outMap.label?.data ? outMap.label.data[0] : null;
  const vec = Array.from(outMap[modelOutputName].data);
  const probs = (Math.abs(vec.reduce((a,b)=>a+b,0)-1) < 1e-3 && vec.every(p=>p>=0&&p<=1)) ? vec : softmax(vec);

  const classes = (Array.isArray(meta.classes) && meta.classes.length === probs.length)
    ? meta.classes
    : probs.map((_,i)=>`Class_${i}`);

  let bestIdx = 0; let best = probs[0];
  for (let i=1; i<probs.length; i++){ if (probs[i] > best){ best = probs[i]; bestIdx = i; } }

  return {
    label: labelFromModel || classes[bestIdx],
    confidence: best,
    explain: `Features order: ${meta.features.join(', ')}`,
    probs, classes
  };
}

async function initOnnx(){
  try{
    const r = await fetch(META_URL, { cache:'no-store' });
    if (!r.ok) throw new Error('No se pudo cargar meta.json');
    meta = await r.json();
    if (!Array.isArray(meta.features) || !meta.features.length) {
      throw new Error("meta.json: 'features' vacío o ausente.");
    }
    
    ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/';
    ortSession = await ort.InferenceSession.create(MODEL_URL, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all'
    });
    modelInputName  = ortSession.inputNames[0];
    modelOutputName = 'probabilities';
    console.log('Trained model ready', { modelInputName, modelOutputName, meta });
  }catch(err){
    console.error(err);
    showError(`Error initiating model: ${err.message}`);
  }
}

window.addEventListener('error', e => showError(e?.error?.message || e?.message || 'Unexpected error.'));

document.addEventListener('DOMContentLoaded', ()=>{ resetResults(); initOnnx(); });

form?.addEventListener('submit', async (ev)=>{
  ev.preventDefault(); clearError();
  try{
    submitBtn.disabled = true;
    const ui = getUIValues();

    for (const k of ['orbital_period','transit_duration','planet_radius','rp_over_rs']) {
      if (!Number.isFinite(ui[k])) throw new Error(`The field "${k.replace('_',' ')}" is required.`);
    }

    const out = await runOnnx(ui);
    applyPredictionUI(out.label, out.confidence, out.explain, ui.kepid, out.probs, out.classes);
  }catch(err){
    console.error(err);
    showError(err.message || 'Prediction error.');
  }finally{
    submitBtn.disabled = false;
  }
});

form?.addEventListener('reset', ()=>{ clearError(); resetResults(); });
