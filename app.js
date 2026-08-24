(() => {
  'use strict';

  const HISTORY_KEY = 'numa-calculator-history-v1';
  const MAX_DIGITS = 15;
  const operatorSymbols = { '+': '+', '-': '−', '*': '×', '/': '÷' };

  const resultEl = document.querySelector('#result');
  const expressionEl = document.querySelector('#expression');
  const calculatorEl = document.querySelector('#calculator');
  const memoryIndicator = document.querySelector('#memoryIndicator');
  const minusIndicator = document.querySelector('#minusIndicator');
  const fractionIndicator = document.querySelector('#fractionIndicator');
  const fractionButton = document.querySelector('[data-action="fraction"]');
  const historyDrawer = document.querySelector('#historyDrawer');
  const drawerBackdrop = document.querySelector('#drawerBackdrop');
  const historyList = document.querySelector('#historyList');
  const clearHistoryButton = document.querySelector('#clearHistory');
  const historyBadge = document.querySelector('#historyBadge');
  const historyCountIntro = document.querySelector('#historyCountIntro');
  const toast = document.querySelector('#toast');

  let displayValue = '0';
  let displayMode = 'decimal';
  let firstOperand = null;
  let pendingOperator = null;
  let waitingForOperand = false;
  let justCalculated = false;
  let lastExpression = '';
  let history = loadHistory();
  let memoryValue = 0;
  let isPoweredOn = true;
  let lastMemoryRecallAt = 0;
  let lastFocusedElement = null;
  let toastTimer;

  function loadHistory() {
    try {
      const saved = JSON.parse(localStorage.getItem(HISTORY_KEY));
      return Array.isArray(saved) ? saved.slice(0, 50) : [];
    } catch {
      return [];
    }
  }

  function saveHistory() {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch {
      // The calculator still works when storage is disabled.
    }
  }

  function countDigits(value) {
    return value.replace(/[-.]/g, '').length;
  }

  function inputDigit(digit) {
    displayMode = 'decimal';
    if (displayValue === 'Error' || waitingForOperand || justCalculated) {
      displayValue = digit;
      waitingForOperand = false;
      justCalculated = false;
      if (firstOperand === null) lastExpression = '';
    } else if (displayValue === '0') {
      displayValue = digit;
    } else if (countDigits(displayValue) < MAX_DIGITS) {
      displayValue += digit;
    }
    updateDisplay();
  }

  function inputDecimal() {
    displayMode = 'decimal';
    if (displayValue === 'Error' || waitingForOperand || justCalculated) {
      displayValue = '0.';
      waitingForOperand = false;
      justCalculated = false;
      if (firstOperand === null) lastExpression = '';
    } else if (!displayValue.includes('.')) {
      displayValue += '.';
    }
    updateDisplay();
  }

  function clearCalculator() {
    displayValue = '0';
    displayMode = 'decimal';
    firstOperand = null;
    pendingOperator = null;
    waitingForOperand = false;
    justCalculated = false;
    lastExpression = '';
    updateDisplay();
    updateActiveOperator();
  }

  function toggleSign() {
    if (displayValue === 'Error' || displayValue === '0') return;
    displayValue = displayValue.startsWith('-') ? displayValue.slice(1) : `-${displayValue}`;
    justCalculated = false;
    updateDisplay();
  }

  function inputPercent() {
    if (displayValue === 'Error') return;
    const value = Number(displayValue);
    const percentage = pendingOperator && firstOperand !== null
      ? (firstOperand * value) / 100
      : value / 100;
    displayValue = normalizeResult(percentage);
    displayMode = 'decimal';
    justCalculated = false;
    updateDisplay();
  }

  function clearEntry() {
    displayValue = '0';
    displayMode = 'decimal';
    waitingForOperand = false;
    justCalculated = false;
    lastExpression = pendingOperator && firstOperand !== null
      ? `${formatDisplay(firstOperand)} ${operatorSymbols[pendingOperator]}`
      : '';
    updateDisplay();
  }

  function calculateSquareRoot() {
    if (displayValue === 'Error') return;
    const value = Number(displayValue);
    if (value < 0) {
      showError('No existe raíz real de un número negativo');
      return;
    }
    const rootExpression = `√(${formatDisplay(value)})`;
    displayValue = normalizeResult(Math.sqrt(value));
    displayMode = 'decimal';
    lastExpression = `${rootExpression} =`;
    addHistory(rootExpression, displayValue);
    waitingForOperand = false;
    justCalculated = pendingOperator === null;
    if (pendingOperator === null) firstOperand = null;
    updateDisplay();
  }

  function updateMemory(operation) {
    if (displayValue === 'Error') return;
    const value = Number(displayValue);
    memoryValue = operation === 'add' ? memoryValue + value : memoryValue - value;
    memoryValue = Number.parseFloat(memoryValue.toPrecision(12));
    lastMemoryRecallAt = 0;
    updateDisplay();
    showToast(operation === 'add' ? 'Valor sumado a memoria' : 'Valor restado de memoria');
  }

  function recallMemory() {
    const now = Date.now();
    if (now - lastMemoryRecallAt < 800) {
      memoryValue = 0;
      lastMemoryRecallAt = 0;
      updateDisplay();
      showToast('Memoria borrada');
      return;
    }
    displayValue = normalizeResult(memoryValue);
    displayMode = 'decimal';
    waitingForOperand = false;
    justCalculated = false;
    lastMemoryRecallAt = now;
    updateDisplay();
    showToast('Memoria recuperada · pulsa MRC otra vez para borrarla');
  }

  function turnOff() {
    isPoweredOn = false;
    calculatorEl.classList.add('is-off');
    updateDisplay();
  }

  function turnOn() {
    if (isPoweredOn) return;
    isPoweredOn = true;
    calculatorEl.classList.remove('is-off');
    clearCalculator();
  }

  function performCalculation(first, second, operator) {
    if (operator === '+') return first + second;
    if (operator === '-') return first - second;
    if (operator === '*') return first * second;
    if (operator === '/') return second === 0 ? NaN : first / second;
    return second;
  }

  function chooseOperator(nextOperator) {
    if (displayValue === 'Error') clearCalculator();
    displayMode = 'decimal';

    const inputValue = Number(displayValue);

    if (pendingOperator && waitingForOperand) {
      pendingOperator = nextOperator;
      lastExpression = `${formatDisplay(firstOperand)} ${operatorSymbols[nextOperator]}`;
      updateDisplay();
      updateActiveOperator();
      return;
    }

    if (firstOperand === null || justCalculated) {
      firstOperand = inputValue;
    } else if (pendingOperator) {
      const calculatedValue = performCalculation(firstOperand, inputValue, pendingOperator);
      if (!Number.isFinite(calculatedValue)) {
        showError();
        return;
      }
      displayValue = normalizeResult(calculatedValue);
      firstOperand = calculatedValue;
    }

    pendingOperator = nextOperator;
    waitingForOperand = true;
    justCalculated = false;
    lastExpression = `${formatDisplay(firstOperand)} ${operatorSymbols[nextOperator]}`;
    updateDisplay();
    updateActiveOperator();
  }

  function calculateResult() {
    if (!pendingOperator || firstOperand === null || displayValue === 'Error') return;

    const secondOperand = waitingForOperand ? firstOperand : Number(displayValue);
    const operator = pendingOperator;
    const fullExpression = `${formatDisplay(firstOperand)} ${operatorSymbols[operator]} ${formatDisplay(secondOperand)}`;
    const calculatedValue = performCalculation(firstOperand, secondOperand, operator);

    if (!Number.isFinite(calculatedValue)) {
      showError('No es posible dividir entre cero');
      return;
    }

    displayValue = normalizeResult(calculatedValue);
    displayMode = 'decimal';
    lastExpression = `${fullExpression} =`;
    addHistory(fullExpression, displayValue);
    firstOperand = null;
    pendingOperator = null;
    waitingForOperand = false;
    justCalculated = true;
    updateDisplay();
    updateActiveOperator();
  }

  function showError(message = 'La operación no es válida') {
    displayValue = 'Error';
    displayMode = 'decimal';
    firstOperand = null;
    pendingOperator = null;
    waitingForOperand = false;
    justCalculated = true;
    lastExpression = message;
    updateDisplay();
    updateActiveOperator();
  }

  function normalizeResult(number) {
    if (!Number.isFinite(number)) return 'Error';
    if (Object.is(number, -0)) return '0';

    const rounded = Number.parseFloat(number.toPrecision(12));
    const text = String(rounded);
    return text.length > 16 ? rounded.toExponential(8) : text;
  }

  function decimalToFraction(value) {
    const target = Math.abs(Number(value));
    if (!Number.isFinite(target)) return String(value);
    if (Number.isInteger(target)) return String(Number(value));

    const sign = Number(value) < 0 ? -1 : 1;
    const maxDenominator = 100000;
    const tolerance = 1e-10;
    let continuedValue = target;
    let numeratorPrevious = 0;
    let numerator = 1;
    let denominatorPrevious = 1;
    let denominator = 0;

    for (let iteration = 0; iteration < 32; iteration += 1) {
      const integerPart = Math.floor(continuedValue);
      const nextNumerator = integerPart * numerator + numeratorPrevious;
      const nextDenominator = integerPart * denominator + denominatorPrevious;
      if (nextDenominator > maxDenominator) break;

      numeratorPrevious = numerator;
      numerator = nextNumerator;
      denominatorPrevious = denominator;
      denominator = nextDenominator;

      if (Math.abs(numerator / denominator - target) <= tolerance) break;
      const remainder = continuedValue - integerPart;
      if (remainder < Number.EPSILON) break;
      continuedValue = 1 / remainder;
    }

    if (denominator === 0) return String(value);
    return `${sign * numerator}/${denominator}`;
  }

  function toggleFractionMode() {
    if (displayValue === 'Error') return;
    displayMode = displayMode === 'decimal' ? 'fraction' : 'decimal';
    updateDisplay();
    showToast(displayMode === 'fraction' ? 'Mostrando como fracción' : 'Mostrando como decimal');
  }

  function formatDisplay(value) {
    if (value === null || value === undefined || value === 'Error') return String(value ?? '');
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return String(value);

    const raw = String(value);
    if (/e/i.test(raw)) return raw.replace('e+', 'e');

    const [integer, decimal] = raw.split('.');
    const sign = integer.startsWith('-') ? '-' : '';
    const absoluteInteger = sign ? integer.slice(1) : integer;
    const grouped = absoluteInteger.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${sign}${grouped}${decimal !== undefined ? `,${decimal}` : ''}`;
  }

  function updateDisplay() {
    if (!isPoweredOn) {
      resultEl.textContent = '';
      expressionEl.textContent = '\u00a0';
      minusIndicator.textContent = '\u00a0';
      memoryIndicator.textContent = '\u00a0';
      fractionIndicator.textContent = '\u00a0';
      fractionButton.classList.remove('is-active');
      fractionButton.setAttribute('aria-pressed', 'false');
      return;
    }
    resultEl.textContent = displayValue === 'Error'
      ? 'Error'
      : displayMode === 'fraction'
        ? decimalToFraction(displayValue)
        : formatDisplay(displayValue);
    fractionButton.classList.toggle('is-active', displayMode === 'fraction');
    fractionButton.setAttribute('aria-pressed', String(displayMode === 'fraction'));
    expressionEl.textContent = lastExpression || '\u00a0';
    minusIndicator.textContent = displayValue.startsWith('-') ? '− MINUS' : '\u00a0';
    memoryIndicator.textContent = memoryValue !== 0 ? 'MEMORY' : '\u00a0';
    fractionIndicator.textContent = displayMode === 'fraction' ? 'FRAC' : '\u00a0';
    const length = resultEl.textContent.length;
    resultEl.classList.toggle('small', length > 10 && length <= 13);
    resultEl.classList.toggle('tiny', length > 13);
  }

  function updateActiveOperator() {
    document.querySelectorAll('[data-operator]').forEach((button) => {
      button.classList.toggle(
        'is-active',
        button.dataset.operator === pendingOperator && waitingForOperand
      );
    });
  }

  function addHistory(expression, result) {
    const item = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      expression,
      result,
      createdAt: new Date().toISOString(),
    };
    history.unshift(item);
    history = history.slice(0, 50);
    saveHistory();
    renderHistory();
  }

  function deleteHistoryItem(id) {
    history = history.filter((item) => item.id !== id);
    saveHistory();
    renderHistory();
    showToast('Resultado eliminado');
  }

  function getDayLabel(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    const dateKey = date.toDateString();
    if (dateKey === now.toDateString()) return 'Hoy';
    if (dateKey === yesterday.toDateString()) return 'Ayer';
    return new Intl.DateTimeFormat('es', {
      day: 'numeric',
      month: 'long',
      year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
    }).format(date);
  }

  function formatTime(dateString) {
    return new Intl.DateTimeFormat('es', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateString));
  }

  function renderHistory() {
    historyBadge.hidden = history.length === 0;
    historyBadge.textContent = history.length > 99 ? '99+' : String(history.length);
    historyCountIntro.textContent = history.length
      ? `${history.length} ${history.length === 1 ? 'operación guardada' : 'operaciones guardadas'}`
      : 'Aún no hay operaciones';
    clearHistoryButton.disabled = history.length === 0;

    if (history.length === 0) {
      historyList.innerHTML = `
        <div class="empty-history">
          <div class="empty-illustration" aria-hidden="true"></div>
          <strong>Todo empieza con un cálculo</strong>
          <p>Tus resultados aparecerán aquí automáticamente cuando pulses igual.</p>
        </div>`;
      return;
    }

    let previousDay = '';
    historyList.innerHTML = history.map((item) => {
      const day = getDayLabel(item.createdAt);
      const dayHeader = day !== previousDay
        ? `<p class="history-group-label">${escapeHTML(day)}</p>`
        : '';
      previousDay = day;
      return `${dayHeader}
        <div class="history-row">
          <button class="history-item" type="button" data-history-id="${escapeHTML(item.id)}" aria-label="Usar resultado ${escapeHTML(item.result)}">
            <span class="history-number">
              <span class="history-expression">${escapeHTML(item.expression)}</span>
              <strong class="history-result">${escapeHTML(formatDisplay(item.result))}</strong>
            </span>
            <span class="history-time">${escapeHTML(formatTime(item.createdAt))}</span>
            <span class="use-result" aria-hidden="true">↗</span>
          </button>
          <button class="history-delete" type="button" data-delete-history-id="${escapeHTML(item.id)}" aria-label="Eliminar resultado ${escapeHTML(item.result)}" title="Eliminar resultado">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" />
            </svg>
          </button>
        </div>`;
    }).join('');
  }

  function escapeHTML(value) {
    const div = document.createElement('div');
    div.textContent = String(value);
    return div.innerHTML;
  }

  function useHistoryResult(item) {
    if (!isPoweredOn) turnOn();
    displayValue = item.result;
    displayMode = 'decimal';
    firstOperand = null;
    pendingOperator = null;
    waitingForOperand = false;
    justCalculated = true;
    lastExpression = `${item.expression} =`;
    updateDisplay();
    updateActiveOperator();
    closeHistory();
    showToast('Resultado recuperado');
  }

  function openHistory() {
    lastFocusedElement = document.activeElement;
    drawerBackdrop.hidden = false;
    requestAnimationFrame(() => {
      drawerBackdrop.classList.add('is-visible');
      historyDrawer.classList.add('is-open');
    });
    historyDrawer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    setTimeout(() => document.querySelector('#closeHistory').focus(), 80);
  }

  function closeHistory() {
    historyDrawer.classList.remove('is-open');
    drawerBackdrop.classList.remove('is-visible');
    historyDrawer.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    setTimeout(() => {
      drawerBackdrop.hidden = true;
      if (lastFocusedElement) lastFocusedElement.focus();
    }, 320);
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('is-visible');
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2200);
  }

  function pressButton(selector) {
    const button = document.querySelector(selector);
    if (!button) return;
    button.classList.add('is-pressed');
    setTimeout(() => button.classList.remove('is-pressed'), 100);
  }

  calculatorEl.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button || button.classList.contains('history-button')) return;
    const action = button.dataset.action;

    if (!isPoweredOn) {
      if (action === 'clear' || action === 'power') turnOn();
      return;
    }

    if (button.dataset.number !== undefined) inputDigit(button.dataset.number);
    if (button.dataset.operator) chooseOperator(button.dataset.operator);
    if (action === 'decimal') inputDecimal();
    if (action === 'clear') clearCalculator();
    if (action === 'clear-entry') clearEntry();
    if (action === 'sign') toggleSign();
    if (action === 'percent') inputPercent();
    if (action === 'equals') calculateResult();
    if (action === 'sqrt') calculateSquareRoot();
    if (action === 'fraction') toggleFractionMode();
    if (action === 'memory-add') updateMemory('add');
    if (action === 'memory-subtract') updateMemory('subtract');
    if (action === 'memory-recall') recallMemory();
    if (action === 'power') turnOff();
  });

  document.querySelector('#openHistoryIntro').addEventListener('click', openHistory);
  document.querySelector('#openHistoryCalculator').addEventListener('click', openHistory);
  document.querySelector('#closeHistory').addEventListener('click', closeHistory);
  drawerBackdrop.addEventListener('click', closeHistory);

  clearHistoryButton.addEventListener('click', () => {
    history = [];
    saveHistory();
    renderHistory();
    showToast('Historial eliminado');
  });

  historyList.addEventListener('click', (event) => {
    const deleteButton = event.target.closest('[data-delete-history-id]');
    if (deleteButton) {
      deleteHistoryItem(deleteButton.dataset.deleteHistoryId);
      return;
    }

    const resultButton = event.target.closest('[data-history-id]');
    if (!resultButton) return;
    const item = history.find((entry) => entry.id === resultButton.dataset.historyId);
    if (item) useHistoryResult(item);
  });

  document.addEventListener('keydown', (event) => {
    if (historyDrawer.classList.contains('is-open')) {
      if (event.key === 'Escape') closeHistory();

      if (event.key === 'Tab') {
        const focusable = [...historyDrawer.querySelectorAll('button:not(:disabled)')];
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
      return;
    }

    if (!isPoweredOn) {
      const canWake = /^\d$/.test(event.key) || ['.', ',', '+', '-', '*', '/', 'Enter', '=', 'Escape', 'Delete'].includes(event.key);
      if (!canWake) return;
      turnOn();
    }

    if (/^\d$/.test(event.key)) {
      event.preventDefault();
      inputDigit(event.key);
      pressButton(`[data-number="${event.key}"]`);
      return;
    }

    const operatorKey = event.key === 'x' || event.key === 'X' ? '*' : event.key;
    if (['+', '-', '*', '/'].includes(operatorKey)) {
      event.preventDefault();
      chooseOperator(operatorKey);
      pressButton(`[data-operator="${operatorKey}"]`);
      return;
    }

    if (event.key === '.' || event.key === ',') {
      event.preventDefault();
      inputDecimal();
      pressButton('[data-action="decimal"]');
    } else if (event.key === 'Enter' || event.key === '=') {
      event.preventDefault();
      calculateResult();
      pressButton('[data-action="equals"]');
    } else if (event.key === 'Escape' || event.key === 'Delete') {
      event.preventDefault();
      clearCalculator();
      pressButton('[data-action="clear"]');
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      toggleFractionMode();
      pressButton('[data-action="fraction"]');
    } else if (event.key === '%') {
      event.preventDefault();
      inputPercent();
      pressButton('[data-action="percent"]');
    } else if (event.key === 'Backspace') {
      event.preventDefault();
      if (!waitingForOperand && displayValue !== 'Error') {
        displayMode = 'decimal';
        displayValue = displayValue.length > 1 ? displayValue.slice(0, -1) : '0';
        if (displayValue === '-') displayValue = '0';
        updateDisplay();
      }
    }
  });

  renderHistory();
  updateDisplay();
})();
