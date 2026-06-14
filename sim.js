/* ============================================================
   SampleSim — Simulation Engine + Visualization
   ============================================================ */

// ── Survey Question Presets ───────────────────────────────────
const QUESTIONS = {
  support: {
    text: '"Do you support the proposed school budget increase?"',
    trueRateA: 70,   // Group A (urban/higher income) YES rate
    trueRateB: 30,   // Group B (rural/lower income) YES rate
    groupA: 'Urban residents',
    groupB: 'Rural residents',
    convenienceBias: 'high',   // convenience sampling skews toward group A
    voluntaryBias: 'high',     // strong-opinion respondents over-represent YES
  },
  health: {
    text: '"Do you exercise at least 3 times per week?"',
    trueRateA: 65,
    trueRateB: 35,
    groupA: 'Under 40',
    groupB: 'Over 40',
    convenienceBias: 'high',
    voluntaryBias: 'high',
  },
  income: {
    text: '"Is your household income above $75,000/year?"',
    trueRateA: 70,
    trueRateB: 20,
    groupA: 'College-educated',
    groupB: 'Non-college',
    convenienceBias: 'high',
    voluntaryBias: 'low',
  },
  custom: {
    text: '"Custom question"',
    trueRateA: 50,
    trueRateB: 50,
    groupA: 'Group A',
    groupB: 'Group B',
    convenienceBias: 'med',
    voluntaryBias: 'med',
  }
};

const METHOD_INFO = {
  srs: {
    name: 'Simple Random Sample',
    desc: 'Every member of the population has an equal probability of being chosen. The gold standard for avoiding bias.',
    biasType: 'none',
    color: '#4ECCA3',
  },
  stratified: {
    name: 'Stratified Random Sample',
    desc: 'Divide the population into subgroups (strata), then take an SRS within each stratum. Ensures proportional representation.',
    biasType: 'none',
    color: '#6B8EFF',
  },
  cluster: {
    name: 'Cluster Sampling',
    desc: 'Randomly select entire clusters (e.g. neighborhoods, classrooms). Practical but can miss variation between clusters.',
    biasType: 'mild',
    color: '#FFD93D',
  },
  convenience: {
    name: 'Convenience Sampling',
    desc: 'Sample whoever is easiest to reach. Almost always introduces bias because accessible people differ from the population.',
    biasType: 'high',
    color: '#FF6B6B',
  },
  voluntary: {
    name: 'Voluntary Response Sampling',
    desc: 'People choose whether to respond. Creates strong bias toward those with extreme opinions.',
    biasType: 'high',
    color: '#FF9999',
  }
};

// ── State ─────────────────────────────────────────────────────
let state = {
  question: 'support',
  popSize: 500,
  strataRatio: 0.40,
  strataARateVal: 70,
  strataBRateVal: 30,
  sampleSize: 50,
  method: 'srs',
  population: [],
  lastSample: [],
  manyRunResults: [],
  animating: false,
};

// ── Canvas Setup ──────────────────────────────────────────────
const mainCanvas = document.getElementById('mainCanvas');
const ctx = mainCanvas.getContext('2d');
const distCanvas = document.getElementById('distCanvas');
const dctx = distCanvas.getContext('2d');
const heroCanvas = document.getElementById('heroCanvas');
const hctx = heroCanvas.getContext('2d');

function resizeMainCanvas() {
  const rect = mainCanvas.parentElement.getBoundingClientRect();
  mainCanvas.width = rect.width;
  mainCanvas.height = 320;
}
window.addEventListener('resize', () => { resizeMainCanvas(); drawPopulation(); });
resizeMainCanvas();

function resizeDistCanvas() {
  const rect = distCanvas.parentElement.getBoundingClientRect();
  distCanvas.width = rect.width;
}

// ── Population Generation ─────────────────────────────────────
function generatePopulation() {
  const q = getQuestion();
  const pop = [];
  const nA = Math.round(state.popSize * state.strataRatio);
  const nB = state.popSize - nA;
  const rateA = state.strataARateVal / 100;
  const rateB = state.strataBRateVal / 100;

  for (let i = 0; i < nA; i++) {
    pop.push({ id: i, group: 'A', yes: Math.random() < rateA, sampled: false, cluster: Math.floor(i / 30) });
  }
  for (let i = 0; i < nB; i++) {
    pop.push({ id: nA + i, group: 'B', yes: Math.random() < rateB, sampled: false, cluster: Math.floor(i / 30) + Math.ceil(nA / 30) });
  }

  // Assign visual positions using a grid layout
  layoutPopulation(pop);
  state.population = pop;
  return pop;
}

function layoutPopulation(pop) {
  const W = mainCanvas.width, H = mainCanvas.height;
  const margin = 24;
  const cols = Math.ceil(Math.sqrt(pop.length * (W / H)));
  const rows = Math.ceil(pop.length / cols);
  const cellW = (W - margin * 2) / cols;
  const cellH = (H - margin * 2) / rows;
  const dotR = Math.max(2.5, Math.min(6, cellW * 0.35));

  pop.forEach((p, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    p.x = margin + cellW * col + cellW / 2 + (Math.random() - 0.5) * cellW * 0.4;
    p.y = margin + cellH * row + cellH / 2 + (Math.random() - 0.5) * cellH * 0.4;
    p.r = dotR;
  });
}

function getTrueRate() {
  const nA = Math.round(state.popSize * state.strataRatio);
  const nB = state.popSize - nA;
  const rateA = state.strataARateVal / 100;
  const rateB = state.strataBRateVal / 100;
  const trueYes = state.population.filter(p => p.yes).length;
  return trueYes / state.population.length;
}

function getQuestion() {
  return state.question === 'custom'
    ? { ...QUESTIONS.custom, text: `"${document.getElementById('customQuestion').value || 'Custom question'}"` }
    : QUESTIONS[state.question];
}

// ── Drawing ───────────────────────────────────────────────────
function drawPopulation(highlightSample = false) {
  const W = mainCanvas.width, H = mainCanvas.height;
  ctx.clearRect(0, 0, W, H);

  const pop = state.population;
  if (!pop.length) return;

  const mi = METHOD_INFO[state.method];

  pop.forEach(p => {
    const isSampled = p.sampled;
    let fill, alpha;

    if (isSampled && highlightSample) {
      fill = mi.color;
      alpha = 1;
    } else if (!isSampled && highlightSample) {
      fill = p.group === 'A' ? '#4ECCA3' : '#FF6B6B';
      alpha = 0.15;
    } else {
      fill = p.group === 'A' ? '#4ECCA3' : '#FF6B6B';
      alpha = 0.45;
    }

    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();

    if (isSampled && highlightSample) {
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r + 3, 0, Math.PI * 2);
      ctx.strokeStyle = mi.color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  });

  ctx.globalAlpha = 1;

  // Draw cluster outlines if cluster method
  if (state.method === 'cluster' && highlightSample && state.lastSample.length) {
    const selectedClusters = [...new Set(state.lastSample.map(p => p.cluster))];
    selectedClusters.forEach(cid => {
      const members = state.population.filter(p => p.cluster === cid);
      if (!members.length) return;
      const xs = members.map(p => p.x), ys = members.map(p => p.y);
      const minX = Math.min(...xs) - 10, maxX = Math.max(...xs) + 10;
      const minY = Math.min(...ys) - 10, maxY = Math.max(...ys) + 10;
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = '#FFD93D';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    });
  }
}

// ── Sampling Methods ──────────────────────────────────────────
function runSRS() {
  const pop = state.population;
  const n = Math.min(state.sampleSize, pop.length);
  const shuffled = [...pop].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function runStratified() {
  const groupA = state.population.filter(p => p.group === 'A');
  const groupB = state.population.filter(p => p.group === 'B');
  const n = state.sampleSize;
  const nA = Math.round(n * state.strataRatio);
  const nB = n - nA;
  const sA = [...groupA].sort(() => Math.random() - 0.5).slice(0, nA);
  const sB = [...groupB].sort(() => Math.random() - 0.5).slice(0, nB);
  return [...sA, ...sB];
}

function runCluster() {
  const clusters = {};
  state.population.forEach(p => {
    if (!clusters[p.cluster]) clusters[p.cluster] = [];
    clusters[p.cluster].push(p);
  });
  const clusterIds = Object.keys(clusters);
  const numClusters = Math.max(1, Math.round(state.sampleSize / 25));
  const selectedIds = [...clusterIds].sort(() => Math.random() - 0.5).slice(0, numClusters);
  let sample = [];
  selectedIds.forEach(id => { sample = sample.concat(clusters[id]); });
  // Limit to sample size
  return sample.slice(0, state.sampleSize * 2); // clusters may be big
}

function runConvenience() {
  // Convenience: heavily biased toward Group A (urban/accessible)
  const pop = state.population;
  const q = getQuestion();
  const biasStrength = q.convenienceBias === 'high' ? 8 : q.convenienceBias === 'med' ? 3 : 1.5;
  const weighted = pop.map(p => ({
    p,
    w: p.group === 'A' ? biasStrength : 1
  }));
  const sample = weightedSample(weighted, state.sampleSize);
  return sample;
}

function runVoluntary() {
  // Voluntary: strong-opinion people (YES or NO extremes) more likely to respond
  const pop = state.population;
  const q = getQuestion();
  // People who say YES are more opinionated — higher response rate
  const biasStrength = q.voluntaryBias === 'high' ? 5 : q.voluntaryBias === 'med' ? 2.5 : 1.5;
  const weighted = pop.map(p => ({
    p,
    w: p.yes ? biasStrength : 1
  }));
  const sample = weightedSample(weighted, state.sampleSize);
  return sample;
}

function weightedSample(weightedItems, n) {
  const result = [];
  const items = [...weightedItems];
  const totalWeight = items.reduce((s, i) => s + i.w, 0);
  const used = new Set();

  for (let k = 0; k < Math.min(n, items.length); k++) {
    let rand = Math.random() * items.reduce((s, i, idx) => used.has(idx) ? s : s + i.w, 0);
    for (let idx = 0; idx < items.length; idx++) {
      if (used.has(idx)) continue;
      rand -= items[idx].w;
      if (rand <= 0) { result.push(items[idx].p); used.add(idx); break; }
    }
  }
  return result;
}

function getSample() {
  switch (state.method) {
    case 'srs':         return runSRS();
    case 'stratified':  return runStratified();
    case 'cluster':     return runCluster();
    case 'convenience': return runConvenience();
    case 'voluntary':   return runVoluntary();
  }
}

// ── Animation ─────────────────────────────────────────────────
async function animateSample(sample) {
  // Reset
  state.population.forEach(p => p.sampled = false);
  drawPopulation(false);

  const delay = ms => new Promise(r => setTimeout(r, ms));
  const batchSize = Math.max(1, Math.floor(sample.length / 12));

  for (let i = 0; i < sample.length; i += batchSize) {
    const batch = sample.slice(i, i + batchSize);
    batch.forEach(p => p.sampled = true);
    drawPopulation(true);
    await delay(40);
  }
  drawPopulation(true);
}

// ── Results ───────────────────────────────────────────────────
function computeResults(sample) {
  const yesCount = sample.filter(p => p.yes).length;
  const sampleRate = yesCount / sample.length;
  const trueRate = getTrueRate();
  const bias = sampleRate - trueRate;
  return { sampleRate, trueRate, bias, n: sample.length };
}

function showResults(results, sample) {
  const { sampleRate, trueRate, bias, n } = results;
  const mi = METHOD_INFO[state.method];

  // Update cards
  document.getElementById('valPopTruth').textContent = pct(trueRate);
  document.getElementById('valSampleResult').textContent = pct(sampleRate);
  document.getElementById('barPopTruth').style.width = pct(trueRate);
  document.getElementById('barSampleResult').style.width = pct(sampleRate);

  // Bias card
  const biasEl = document.getElementById('valBias');
  const biasCard = document.getElementById('cardBias');
  const biasInd = document.getElementById('biasIndicator');
  biasEl.textContent = (bias >= 0 ? '+' : '') + pct(bias);
  biasEl.style.color = Math.abs(bias) < 0.03 ? '#4ECCA3' : Math.abs(bias) < 0.08 ? '#FFD93D' : '#FF6B6B';
  biasCard.className = 'result-card bias-card ' + (Math.abs(bias) < 0.03 ? 'neutral' : bias > 0 ? 'positive' : 'negative');
  biasInd.textContent = Math.abs(bias) < 0.03 ? '✓ Near unbiased' : bias > 0 ? '▲ Overestimates truth' : '▼ Underestimates truth';
  biasInd.style.color = Math.abs(bias) < 0.03 ? '#4ECCA3' : '#FF6B6B';

  // Bias explanation
  const biasExp = document.getElementById('biasExplanation');
  const biasIcon = document.getElementById('biasIcon');
  const biasTitle = document.getElementById('biasTitle');
  const biasDesc = document.getElementById('biasDesc');
  biasExp.classList.remove('hidden', 'good');

  if (mi.biasType === 'none') {
    biasExp.classList.add('good');
    biasIcon.textContent = '✅';
    biasTitle.textContent = mi.name + ' — Low Bias Risk';
    biasDesc.textContent = Math.abs(bias) < 0.05
      ? `This sample is close to the population truth (${pct(trueRate)}). Any difference is sampling variability — what we'd expect from chance alone.`
      : `There's some difference this run, but with ${mi.name}, it's due to random chance, not a systematic flaw in the method. Repeat the simulation to see it vary!`;
  } else if (mi.biasType === 'mild') {
    biasIcon.textContent = '⚡';
    biasTitle.textContent = mi.name + ' — Possible Cluster Bias';
    biasDesc.textContent = `Cluster sampling can introduce bias if the selected clusters aren't representative of the whole population. The yellow outlines show which clusters were chosen this run.`;
  } else {
    biasIcon.textContent = '⚠️';
    biasTitle.textContent = mi.name + ' — High Bias Risk';
    if (state.method === 'convenience') {
      biasDesc.textContent = `Convenience sampling over-selected Group A (${QUESTIONS[state.question]?.groupA || 'accessible group'}), who tend to answer "${Math.round(state.strataARateVal)}% YES." The sample result is skewed away from the true population answer.`;
    } else {
      biasDesc.textContent = `Voluntary response sampling attracts people with strong opinions — in this case, people who say YES were more likely to respond. This inflates the YES rate beyond the true population value.`;
    }
  }

  // Confidence Interval
  const se = Math.sqrt((sampleRate * (1 - sampleRate)) / n);
  const moe = 1.96 * se;
  const lower = Math.max(0, sampleRate - moe);
  const upper = Math.min(1, sampleRate + moe);
  const infPanel = document.getElementById('inferencePanel');
  infPanel.classList.remove('hidden');
  document.getElementById('ciText').textContent = `${pct(sampleRate)} ± ${pct(moe)}  →  (${pct(lower)}, ${pct(upper)})`;
  drawCI(lower, upper, sampleRate, trueRate);
  const infWarn = document.getElementById('inferenceWarning');
  if (mi.biasType !== 'none') {
    infWarn.textContent = '⚠️ This CI is misleading — confidence intervals assume an unbiased sampling method. Bias cannot be fixed with a larger sample.';
  } else {
    infWarn.textContent = trueRate >= lower && trueRate <= upper
      ? `✓ The CI (${pct(lower)}, ${pct(upper)}) successfully captures the true parameter (${pct(trueRate)}).`
      : `This run's CI missed the true parameter — that happens ~5% of the time with 95% CIs.`;
    infWarn.style.color = trueRate >= lower && trueRate <= upper ? '#4ECCA3' : '#FFD93D';
  }

  // Legend
  updateLegend(sample);
}

function drawCI(lower, upper, estimate, truth) {
  const vis = document.getElementById('ciVisual');
  vis.innerHTML = '';
  const W = vis.offsetWidth || 400;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '100%'); svg.setAttribute('height', '36');
  svg.setAttribute('viewBox', `0 0 ${W} 36`);

  const toX = v => 16 + v * (W - 32);
  const cy = 18;

  // CI bar
  const rect = document.createElementNS(svg.namespaceURI, 'rect');
  rect.setAttribute('x', toX(lower)); rect.setAttribute('y', cy - 5);
  rect.setAttribute('width', toX(upper) - toX(lower)); rect.setAttribute('height', 10);
  rect.setAttribute('fill', 'rgba(107,142,255,0.3)'); rect.setAttribute('rx', '4');
  svg.appendChild(rect);

  // Truth line
  const tl = document.createElementNS(svg.namespaceURI, 'line');
  tl.setAttribute('x1', toX(truth)); tl.setAttribute('y1', 2);
  tl.setAttribute('x2', toX(truth)); tl.setAttribute('y2', 34);
  tl.setAttribute('stroke', '#4ECCA3'); tl.setAttribute('stroke-width', '2');
  svg.appendChild(tl);

  // Estimate marker
  const em = document.createElementNS(svg.namespaceURI, 'circle');
  em.setAttribute('cx', toX(estimate)); em.setAttribute('cy', cy);
  em.setAttribute('r', '6'); em.setAttribute('fill', '#6B8EFF');
  svg.appendChild(em);

  // Labels
  [{ v: lower, label: pct(lower) }, { v: upper, label: pct(upper) }].forEach(({ v, label }) => {
    const t = document.createElementNS(svg.namespaceURI, 'text');
    t.setAttribute('x', toX(v)); t.setAttribute('y', 13);
    t.setAttribute('text-anchor', 'middle'); t.setAttribute('fill', '#6B8EFF');
    t.setAttribute('font-size', '9'); t.setAttribute('font-family', 'JetBrains Mono, monospace');
    t.textContent = label;
    svg.appendChild(t);
  });

  vis.appendChild(svg);
}

function updateLegend(sample) {
  const leg = document.getElementById('canvasLegend');
  const mi = METHOD_INFO[state.method];
  const trueRate = getTrueRate();
  const sampleRate = sample.filter(p => p.yes).length / sample.length;
  leg.innerHTML = `
    <span class="legend-item"><span class="legend-dot" style="background:#4ECCA3"></span>Group A (${pct(state.strataRatio)})</span>
    <span class="legend-item"><span class="legend-dot" style="background:#FF6B6B"></span>Group B</span>
    <span class="legend-item"><span class="legend-dot" style="background:${mi.color}; box-shadow: 0 0 5px ${mi.color}"></span>Sampled (n=${sample.length})</span>
  `;
}

// ── Many Runs ─────────────────────────────────────────────────
function runMany(times = 100) {
  const results = [];
  const originalPop = state.population.map(p => ({ ...p }));

  for (let i = 0; i < times; i++) {
    // Re-randomize population for each run (same parameters)
    generatePopulation();
    const sample = getSample();
    const yesRate = sample.filter(p => p.yes).length / sample.length;
    results.push(yesRate);
  }

  // Restore original layout positions with fresh population
  generatePopulation();
  state.population.forEach(p => p.sampled = false);
  drawPopulation(false);

  state.manyRunResults = results;

  const mean = results.reduce((a, b) => a + b, 0) / results.length;
  const variance = results.reduce((s, r) => s + (r - mean) ** 2, 0) / results.length;
  const stdDev = Math.sqrt(variance);
  const trueRate = state.population.filter(p => p.yes).length / state.population.length;

  document.getElementById('valVariability').textContent = pct(stdDev);

  drawDistribution(results, trueRate, mean);
  document.getElementById('distContainer').classList.remove('hidden');

  // Update cards
  document.getElementById('valPopTruth').textContent = pct(trueRate);
  document.getElementById('barPopTruth').style.width = pct(trueRate);
  document.getElementById('valSampleResult').textContent = pct(mean) + ' (avg)';
  document.getElementById('barSampleResult').style.width = pct(mean);

  const bias = mean - trueRate;
  const biasEl = document.getElementById('valBias');
  biasEl.textContent = (bias >= 0 ? '+' : '') + pct(bias) + ' (avg)';
  biasEl.style.color = Math.abs(bias) < 0.03 ? '#4ECCA3' : Math.abs(bias) < 0.08 ? '#FFD93D' : '#FF6B6B';

  // Show bias explanation
  const biasExp = document.getElementById('biasExplanation');
  const biasTitle = document.getElementById('biasTitle');
  const biasDesc = document.getElementById('biasDesc');
  const biasIcon = document.getElementById('biasIcon');
  biasExp.classList.remove('hidden', 'good');
  const mi = METHOD_INFO[state.method];

  if (mi.biasType === 'none') {
    biasExp.classList.add('good');
    biasIcon.textContent = '✅';
    biasTitle.textContent = `${mi.name} — Sampling Distribution`;
    biasDesc.textContent = `Across 100 simulations, the average sample result was ${pct(mean)}, and the true population value is ${pct(trueRate)}. The difference (${pct(Math.abs(bias))}) is within expected sampling variability. Standard deviation of sample proportions: ${pct(stdDev)}`;
  } else {
    biasIcon.textContent = '⚠️';
    biasTitle.textContent = `${mi.name} — Persistent Bias Detected`;
    biasDesc.textContent = `Even after 100 simulations, the center of the distribution sits at ${pct(mean)}, not at the true value (${pct(trueRate)}). The bias of ${(bias >= 0 ? '+' : '')}${pct(bias)} is systematic — it won't go away with a larger sample or more repetitions.`;
  }

  document.getElementById('biasExplanation').classList.remove('hidden');
}

function drawDistribution(results, trueRate, mean) {
  resizeDistCanvas();
  const W = distCanvas.width, H = distCanvas.height;
  dctx.clearRect(0, 0, W, H);

  const bins = 20;
  const minV = 0, maxV = 1;
  const binW = (maxV - minV) / bins;
  const counts = Array(bins).fill(0);
  results.forEach(r => {
    const b = Math.min(bins - 1, Math.floor((r - minV) / binW));
    counts[b]++;
  });
  const maxCount = Math.max(...counts);

  const pad = { l: 40, r: 20, t: 16, b: 30 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;
  const barW = plotW / bins - 1;
  const mi = METHOD_INFO[state.method];

  counts.forEach((c, i) => {
    const x = pad.l + i * (plotW / bins);
    const barH = (c / maxCount) * plotH;
    const y = pad.t + plotH - barH;
    dctx.fillStyle = mi.color + '99';
    dctx.fillRect(x, y, barW, barH);
  });

  // True rate line
  const trueX = pad.l + (trueRate - minV) / (maxV - minV) * plotW;
  dctx.strokeStyle = '#4ECCA3';
  dctx.lineWidth = 2;
  dctx.setLineDash([5, 4]);
  dctx.beginPath(); dctx.moveTo(trueX, pad.t); dctx.lineTo(trueX, pad.t + plotH);
  dctx.stroke();

  // Mean line
  const meanX = pad.l + (mean - minV) / (maxV - minV) * plotW;
  dctx.strokeStyle = mi.color;
  dctx.setLineDash([]);
  dctx.lineWidth = 2.5;
  dctx.beginPath(); dctx.moveTo(meanX, pad.t); dctx.lineTo(meanX, pad.t + plotH);
  dctx.stroke();

  // X axis labels
  dctx.fillStyle = '#8AA0B8';
  dctx.font = '10px JetBrains Mono, monospace';
  dctx.textAlign = 'center';
  [0, 0.25, 0.5, 0.75, 1].forEach(v => {
    const x = pad.l + v * plotW;
    dctx.fillText(`${Math.round(v * 100)}%`, x, H - 8);
  });

  // Annotations
  const annotDiv = document.getElementById('distAnnotations');
  annotDiv.innerHTML = `
    <span class="dist-annot"><span class="annot-line" style="background:#4ECCA3;display:inline-block;border-top:2px dashed #4ECCA3"></span> True rate (${pct(trueRate)})</span>
    <span class="dist-annot"><span class="annot-line" style="background:${mi.color};display:inline-block;border-top:2.5px solid ${mi.color}"></span> Avg sample result (${pct(mean)})</span>
    <span class="dist-annot">Bias: <strong style="color:${Math.abs(mean - trueRate) < 0.03 ? '#4ECCA3' : '#FF6B6B'}">${mean >= trueRate ? '+' : ''}${pct(mean - trueRate)}</strong></span>
  `;
}

// ── UI Bindings ───────────────────────────────────────────────
function pct(v) {
  return (v * 100).toFixed(1) + '%';
}

function getMethodExplainerText(method) {
  const m = METHOD_INFO[method];
  const extras = {
    srs: 'In this simulation, each dot has an equal chance of being selected — like drawing names from a hat.',
    stratified: 'This simulation samples proportionally from Group A and Group B, ensuring both are represented.',
    cluster: 'Random clusters (groups) are selected, and every member of that cluster is included.',
    convenience: 'Group A (more accessible) members are much more likely to be chosen.',
    voluntary: 'People with strong YES opinions are more likely to self-select into this sample.',
  };
  return m.desc + ' ' + extras[method];
}

function updateMethodExplainer() {
  document.getElementById('methodExplainer').textContent = getMethodExplainerText(state.method);
}

function updateSamplePct() {
  const pctVal = ((state.sampleSize / state.popSize) * 100).toFixed(1);
  document.getElementById('samplePct').textContent = `= ${pctVal}% of population`;
}

function bindSlider(id, valId, stateKey, transform, callback) {
  const el = document.getElementById(id);
  const val = document.getElementById(valId);
  el.addEventListener('input', () => {
    const v = transform ? transform(+el.value) : +el.value;
    state[stateKey] = v;
    val.textContent = transform ? val.textContent : el.value + (stateKey === 'popSize' || stateKey === 'sampleSize' ? '' : '%');
    if (callback) callback(v, el.value);
  });
}

// Sliders
document.getElementById('popSize').addEventListener('input', function() {
  state.popSize = +this.value;
  document.getElementById('popSizeVal').textContent = this.value;
  updateSamplePct();
  // clamp sample
  if (state.sampleSize > state.popSize) {
    state.sampleSize = Math.min(300, state.popSize);
    document.getElementById('sampleSize').value = state.sampleSize;
    document.getElementById('sampleSizeVal').textContent = state.sampleSize;
  }
});
document.getElementById('sampleSize').addEventListener('input', function() {
  state.sampleSize = +this.value;
  document.getElementById('sampleSizeVal').textContent = this.value;
  updateSamplePct();
});
document.getElementById('strataRatio').addEventListener('input', function() {
  state.strataRatio = +this.value / 100;
  document.getElementById('strataRatioVal').textContent = this.value + '%';
  document.getElementById('strataComplement').textContent = (100 - +this.value) + '%';
});
document.getElementById('strataARate').addEventListener('input', function() {
  state.strataARateVal = +this.value;
  document.getElementById('strataARateVal').textContent = this.value + '%';
});
document.getElementById('strataBRate').addEventListener('input', function() {
  state.strataBRateVal = +this.value;
  document.getElementById('strataBRateVal').textContent = this.value + '%';
});

// Question presets
document.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    const q = this.dataset.q;
    state.question = q;
    if (q === 'custom') {
      document.getElementById('customQuestionWrap').classList.remove('hidden');
      document.getElementById('questionDisplay').classList.add('hidden');
    } else {
      document.getElementById('customQuestionWrap').classList.add('hidden');
      document.getElementById('questionDisplay').classList.remove('hidden');
      const preset = QUESTIONS[q];
      document.getElementById('questionDisplay').textContent = preset.text;
      state.strataARateVal = preset.trueRateA;
      state.strataBRateVal = preset.trueRateB;
      document.getElementById('strataARate').value = preset.trueRateA;
      document.getElementById('strataARateVal').textContent = preset.trueRateA + '%';
      document.getElementById('strataBRate').value = preset.trueRateB;
      document.getElementById('strataBRateVal').textContent = preset.trueRateB + '%';
    }
  });
});

// Method cards
document.querySelectorAll('.method-card').forEach(card => {
  card.addEventListener('click', function() {
    document.querySelectorAll('.method-card').forEach(c => c.classList.remove('active'));
    this.classList.add('active');
    state.method = this.dataset.method;
    updateMethodExplainer();
  });
});

// Run button
document.getElementById('runBtn').addEventListener('click', async function() {
  if (state.animating) return;
  state.animating = true;
  this.textContent = '⏳ Sampling...';
  this.disabled = true;
  document.getElementById('canvasOverlay').classList.add('hidden');

  generatePopulation();
  const sample = getSample();
  state.lastSample = sample;

  await animateSample(sample);

  const results = computeResults(sample);
  showResults(results, sample);

  // Reset variability
  document.getElementById('valVariability').textContent = '—';
  document.getElementById('distContainer').classList.add('hidden');

  this.textContent = '▶ Run Again';
  this.disabled = false;
  state.animating = false;
});

// Run many button
document.getElementById('runManyBtn').addEventListener('click', function() {
  if (state.animating) return;
  if (!state.population.length) generatePopulation();
  document.getElementById('canvasOverlay').classList.add('hidden');
  runMany(100);
  resizeDistCanvas();
});

// Reset button
document.getElementById('resetBtn').addEventListener('click', function() {
  state.population = [];
  state.lastSample = [];
  state.manyRunResults = [];

  ctx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
  document.getElementById('canvasOverlay').classList.remove('hidden');
  document.getElementById('distContainer').classList.add('hidden');
  document.getElementById('biasExplanation').classList.add('hidden');
  document.getElementById('inferencePanel').classList.add('hidden');

  ['valPopTruth','valSampleResult','valBias','valVariability'].forEach(id => {
    document.getElementById(id).textContent = '—';
  });
  document.getElementById('barPopTruth').style.width = '0%';
  document.getElementById('barSampleResult').style.width = '0%';
  document.getElementById('canvasLegend').innerHTML = '';
  document.getElementById('runBtn').textContent = '▶ Run Simulation';
});

// ── Hero Animation ────────────────────────────────────────────
let heroDots = [];
let heroFrame = 0;

function initHero() {
  const W = heroCanvas.width, H = heroCanvas.height;
  heroDots = [];
  for (let i = 0; i < 80; i++) {
    heroDots.push({
      x: 12 + Math.random() * (W - 24),
      y: 12 + Math.random() * (H - 24),
      r: 3 + Math.random() * 2,
      group: Math.random() < 0.4 ? 'A' : 'B',
      sampled: false,
      phase: Math.random() * Math.PI * 2,
      speed: 0.02 + Math.random() * 0.02,
    });
  }
}

function animateHero() {
  const W = heroCanvas.width, H = heroCanvas.height;
  hctx.clearRect(0, 0, W, H);
  heroFrame++;

  // Cycle: every 120 frames, "sample" some dots
  if (heroFrame % 120 === 0) {
    heroDots.forEach(d => d.sampled = false);
    const n = Math.floor(heroDots.length * 0.3);
    [...heroDots].sort(() => Math.random() - 0.5).slice(0, n).forEach(d => d.sampled = true);
  }

  heroDots.forEach(d => {
    const pulse = 1 + 0.15 * Math.sin(d.phase + heroFrame * d.speed);
    const alpha = d.sampled ? 1 : 0.35;
    const color = d.sampled ? '#4ECCA3' : (d.group === 'A' ? '#4ECCA3' : '#FF6B6B');

    hctx.globalAlpha = alpha;
    hctx.beginPath();
    hctx.arc(d.x, d.y, d.r * pulse, 0, Math.PI * 2);
    hctx.fillStyle = color;
    hctx.fill();

    if (d.sampled) {
      hctx.globalAlpha = 0.3;
      hctx.beginPath();
      hctx.arc(d.x, d.y, d.r * pulse + 4, 0, Math.PI * 2);
      hctx.strokeStyle = '#4ECCA3';
      hctx.lineWidth = 1;
      hctx.stroke();
    }
  });
  hctx.globalAlpha = 1;
  requestAnimationFrame(animateHero);
}

// ── Init ──────────────────────────────────────────────────────
updateMethodExplainer();
updateSamplePct();
initHero();
animateHero();

// Initial population draw (without sampling)
generatePopulation();
drawPopulation(false);
document.getElementById('canvasOverlay').classList.remove('hidden');

// ── Info Card Dropdowns ───────────────────────────────────────
document.querySelectorAll('.info-card').forEach(card => {
  function toggle(e) {
    if (e.target.closest('.card-dropdown')) return;
    const isOpen = card.getAttribute('aria-expanded') === 'true';
    document.querySelectorAll('.info-card').forEach(c => c.setAttribute('aria-expanded', 'false'));
    card.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
  }
  card.addEventListener('click', toggle);
  card.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(e); }
  });
});

window.addEventListener('resize', () => {
  resizeMainCanvas();
  layoutPopulation(state.population);
  drawPopulation(state.lastSample.length > 0);
  if (state.manyRunResults.length) {
    const trueRate = getTrueRate();
    const mean = state.manyRunResults.reduce((a,b)=>a+b,0)/state.manyRunResults.length;
    drawDistribution(state.manyRunResults, trueRate, mean);
  }
});
