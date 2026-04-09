// State
let expression = '';
let angleMode = 'deg'; // 'deg' or 'rad'
let history = [];

const exprEl = document.getElementById('expression');
const resultEl = document.getElementById('result');
const historyPanel = document.getElementById('historyPanel');
const historyList = document.getElementById('historyList');

// Load history from localStorage
try {
  const saved = localStorage.getItem('calcHistory');
  if (saved) history = JSON.parse(saved);
} catch (_) {}

function updateDisplay() {
  exprEl.textContent = formatForDisplay(expression);
  if (expression === '') {
    resultEl.textContent = '0';
  }
}

function formatForDisplay(expr) {
  return expr
    .replace(/\*/g, '\u00D7')
    .replace(/\//g, '\u00F7')
    .replace(/pi/g, '\u03C0')
    .replace(/sqrt\(/g, '\u221A(');
}

function inputText(val) {
  expression += val;
  updateDisplay();
  liveEvaluate();
}

function inputFn(fn) {
  expression += fn;
  updateDisplay();
}

function clearAll() {
  expression = '';
  resultEl.textContent = '0';
  exprEl.textContent = '';
}

function backspace() {
  // Remove last token intelligently
  const fns = ['sin(', 'cos(', 'tan(', 'log(', 'sqrt(', 'abs(', 'fact(', 'ln('];
  for (const fn of fns) {
    if (expression.endsWith(fn)) {
      expression = expression.slice(0, -fn.length);
      updateDisplay();
      liveEvaluate();
      return;
    }
  }
  if (expression.endsWith('pi')) {
    expression = expression.slice(0, -2);
  } else {
    expression = expression.slice(0, -1);
  }
  updateDisplay();
  liveEvaluate();
}

function toggleSign() {
  if (expression === '') return;
  // Try to negate the last number
  const match = expression.match(/(.*?)(-?\d+\.?\d*)$/);
  if (match) {
    const prefix = match[1];
    const num = match[2];
    if (num.startsWith('-')) {
      expression = prefix + num.slice(1);
    } else {
      expression = prefix + '(-' + num + ')';
    }
    updateDisplay();
    liveEvaluate();
  }
}

function setAngleMode(mode) {
  angleMode = mode;
  document.getElementById('degBtn').classList.toggle('active', mode === 'deg');
  document.getElementById('radBtn').classList.toggle('active', mode === 'rad');
}

function toRadians(val) {
  return angleMode === 'deg' ? (val * Math.PI / 180) : val;
}

function factorial(n) {
  if (n < 0) return NaN;
  if (n === 0 || n === 1) return 1;
  if (n > 170) return Infinity;
  if (!Number.isInteger(n)) return gamma(n + 1);
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

// Stirling-based gamma approximation for non-integers
function gamma(z) {
  if (z < 0.5) {
    return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
  }
  z -= 1;
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7
  ];
  let x = c[0];
  for (let i = 1; i < g + 2; i++) {
    x += c[i] / (z + i);
  }
  const t = z + g + 0.5;
  return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
}

function evaluate(expr) {
  // Replace display-friendly tokens with evaluable ones
  let e = expr
    .replace(/pi/g, '(' + Math.PI + ')')
    .replace(/(?<![a-z])e(?![a-z(])/g, '(' + Math.E + ')');

  // Handle implicit multiplication: 2pi, 3(, )(, 2sin(, etc.
  e = e.replace(/(\d)([a-z(])/gi, '$1*$2');
  e = e.replace(/\)(\d)/g, ')*$1');
  e = e.replace(/\)\(/g, ')*(');

  // Handle percentage: treat as /100
  e = e.replace(/(\d+\.?\d*)%/g, '($1/100)');

  // Replace functions with safe math
  e = e.replace(/sin\(([^)]+)\)/g, (_, a) => 'Math.sin(toRad(' + a + '))');
  e = e.replace(/cos\(([^)]+)\)/g, (_, a) => 'Math.cos(toRad(' + a + '))');
  e = e.replace(/tan\(([^)]+)\)/g, (_, a) => 'Math.tan(toRad(' + a + '))');
  e = e.replace(/log\(([^)]+)\)/g, 'Math.log10($1)');
  e = e.replace(/ln\(([^)]+)\)/g, 'Math.log($1)');
  e = e.replace(/sqrt\(([^)]+)\)/g, 'Math.sqrt($1)');
  e = e.replace(/abs\(([^)]+)\)/g, 'Math.abs($1)');
  e = e.replace(/fact\(([^)]+)\)/g, 'factorial($1)');
  e = e.replace(/\^/g, '**');

  // Handle 1/x pattern
  e = e.replace(/1\/([^+\-*/^()]+)/g, '(1/($1))');

  // Security: only allow safe characters
  if (/[^0-9+\-*/().eE,Mathlgsincortaqbf \t]/.test(e.replace(/toRad/g, '').replace(/factorial/g, ''))) {
    throw new Error('Invalid expression');
  }

  // Create safe evaluation context
  const toRad = toRadians;
  const fn = new Function('Math', 'toRad', 'factorial', 'return (' + e + ')');
  return fn(Math, toRad, factorial);
}

function liveEvaluate() {
  if (!expression) return;
  try {
    const val = evaluate(expression);
    if (val !== undefined && !isNaN(val) && isFinite(val)) {
      resultEl.textContent = formatResult(val);
    }
  } catch (_) {
    // Silent - expression is incomplete
  }
}

function calculate() {
  if (!expression) return;
  try {
    const val = evaluate(expression);
    if (val === undefined || isNaN(val)) {
      resultEl.textContent = 'Error';
      return;
    }
    const formatted = formatResult(val);
    resultEl.textContent = val === Infinity ? '\u221E' : val === -Infinity ? '-\u221E' : formatted;

    // Add to history
    history.unshift({ expr: expression, result: formatted });
    if (history.length > 50) history.pop();
    try { localStorage.setItem('calcHistory', JSON.stringify(history)); } catch (_) {}

    exprEl.textContent = formatForDisplay(expression) + ' =';
    expression = formatted;
  } catch (err) {
    resultEl.textContent = 'Error';
  }
}

function formatResult(val) {
  if (Number.isInteger(val) && Math.abs(val) < 1e15) {
    return val.toString();
  }
  // Avoid floating point noise
  const rounded = parseFloat(val.toPrecision(12));
  if (Math.abs(rounded) < 1e-10 && rounded !== 0) {
    return rounded.toExponential(6);
  }
  if (Math.abs(rounded) >= 1e15) {
    return rounded.toExponential(6);
  }
  return rounded.toString();
}

// History
function toggleHistory() {
  historyPanel.classList.toggle('open');
  if (historyPanel.classList.contains('open')) {
    renderHistory();
  }
}

function renderHistory() {
  if (history.length === 0) {
    historyList.innerHTML = '<div class="history-empty">No calculations yet</div>';
    return;
  }
  historyList.innerHTML = history.map((h, i) =>
    '<div class="history-item" onclick="recallHistory(' + i + ')">' +
    '<div class="hist-expr">' + escapeHtml(formatForDisplay(h.expr)) + '</div>' +
    '<div class="hist-result">= ' + escapeHtml(h.result) + '</div>' +
    '</div>'
  ).join('');
}

function recallHistory(idx) {
  expression = history[idx].result;
  updateDisplay();
  resultEl.textContent = expression;
  historyPanel.classList.remove('open');
}

function clearHistory() {
  history = [];
  try { localStorage.removeItem('calcHistory'); } catch (_) {}
  renderHistory();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Keyboard support
document.addEventListener('keydown', function(e) {
  const key = e.key;

  if (key >= '0' && key <= '9') { inputText(key); return; }
  if (key === '.') { inputText('.'); return; }
  if (key === '+') { inputText('+'); return; }
  if (key === '-') { inputText('-'); return; }
  if (key === '*') { inputText('*'); return; }
  if (key === '/') { e.preventDefault(); inputText('/'); return; }
  if (key === '%') { inputText('%'); return; }
  if (key === '(') { inputText('('); return; }
  if (key === ')') { inputText(')'); return; }
  if (key === '^') { inputText('^'); return; }
  if (key === 'Enter' || key === '=') { e.preventDefault(); calculate(); return; }
  if (key === 'Backspace') { backspace(); return; }
  if (key === 'Escape') {
    if (historyPanel.classList.contains('open')) {
      historyPanel.classList.remove('open');
    } else {
      clearAll();
    }
    return;
  }
  if (key === 'p') { inputText('pi'); return; }
  if (key === 's') { inputFn('sin('); return; }
  if (key === 'c') { inputFn('cos('); return; }
  if (key === 't') { inputFn('tan('); return; }
  if (key === 'l') { inputFn('log('); return; }
  if (key === 'n') { inputFn('ln('); return; }
  if (key === 'r') { inputFn('sqrt('); return; }
  if (key === 'h') { toggleHistory(); return; }
});

// Init
updateDisplay();
