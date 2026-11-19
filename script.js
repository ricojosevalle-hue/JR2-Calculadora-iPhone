"use strict";
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);
const STORAGE = "JR2_CALCULADORA_V1";
const defaultData = {
  theme: "pokemon",
  history: [],
  favorites: []
};
let data = loadData();
let currentPage = "calculadora";
let expression = "";
let finished = false;
let scientificExpression = "";
let scientificFinished = false;
let angleMode = "DEG";
let memoryValue = 0;
let lastAnswer = 0;
let toastTimer = null;
function loadData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE));
    if (!saved || typeof saved !== "object") {
      return { ...defaultData };
    }
    return {
      theme: ["pokemon", "galaxias", "kawaii"].includes(saved.theme)
        ? saved.theme
        : (saved.theme === "rosado" ? "kawaii" : "pokemon"),
      history: Array.isArray(saved.history) ? saved.history : [],
      favorites: Array.isArray(saved.favorites) ? saved.favorites : []
    };
  } catch (error) {
    return { ...defaultData };
  }
}
function saveData() {
  try {
    localStorage.setItem(STORAGE, JSON.stringify(data));
  } catch (error) {
    console.error("No se pudieron guardar los datos:", error);
    notify("No se pudieron guardar los datos");
  }
}
function notify(message) {
  const toast = $("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
}
function openMenu() {
  $("#sidebar")?.classList.add("open");
  const overlay = $("#overlay");
  if (overlay) overlay.hidden = false;
}
function closeMenu() {
  $("#sidebar")?.classList.remove("open");
  const overlay = $("#overlay");
  if (overlay) overlay.hidden = true;
}
function showPage(page) {
  const target = document.getElementById(page);
  if (!target || !target.classList.contains("page")) return;
  currentPage = page;
  $$(".page").forEach((section) => {
    section.classList.toggle("active", section.id === page);
  });
  $$(".navigation [data-page]").forEach((button) => {
    button.classList.toggle("active", button.dataset.page === page);
  });
  closeMenu();
  if (page === "historial") renderHistory();
  if (page === "favoritos") renderFavorites();
  if (page === "conversor") updateConversion();
  if (page === "monedas") updateCurrencyConversion();
  if (page === "porcentajes") updatePercentages();
  if (page === "ajustes") updateSettings();
  window.scrollTo({ top: 0, behavior: "instant" });
}
function formatNumber(number) {
  if (typeof number !== "number") return String(number);
  if (!Number.isFinite(number)) return "Error";
  if (Object.is(number, -0) || number === 0) return "0";

  const rounded = Number(number.toPrecision(12));

  return new Intl.NumberFormat("en-US", {
    useGrouping: true,
    maximumFractionDigits: 12
  }).format(rounded);
}
function formatDisplay(number) {
  return formatNumber(number);
}
function parseInput(value) {
  const text = String(value).trim().replace(",", ".");
  if (!text) return NaN;
  const number = Number(text);
  return Number.isFinite(number) ? number : NaN;
}
function factorial(number) {
  if (!Number.isInteger(number) || number < 0 || number > 170) {
    throw new Error("Factorial no válido");
  }
  let result = 1;
  for (let i = 2; i <= number; i++) result *= i;
  return result;
}
function toRadians(value) {
  return angleMode === "DEG" ? value * Math.PI / 180 : value;
}
function fromRadians(value) {
  return angleMode === "DEG" ? value * 180 / Math.PI : value;
}
function nthRoot(index, value) {
  if (index === 0) throw new Error("Índice de raíz no válido");
  if (value < 0) {
    if (!Number.isInteger(index) || index % 2 === 0) {
      throw new Error("Raíz no real");
    }
    return -Math.pow(-value, 1 / index);
  }
  return Math.pow(value, 1 / index);
}
function applyFunction(name, value) {
  switch (name) {
    case "sin": return Math.sin(toRadians(value));
    case "cos": return Math.cos(toRadians(value));
    case "tan": {
      const radians = toRadians(value);
      if (Math.abs(Math.cos(radians)) < 1e-12) {
        throw new Error("Tangente indefinida");
      }
      return Math.tan(radians);
    }
    case "asin": return fromRadians(Math.asin(value));
    case "acos": return fromRadians(Math.acos(value));
    case "atan": return fromRadians(Math.atan(value));
    case "log": return Math.log10(value);
    case "ln": return Math.log(value);
    case "sqrt": return Math.sqrt(value);
    case "cbrt": return Math.cbrt(value);
    case "abs": return Math.abs(value);
    case "pow10": return Math.pow(10, value);
    case "powe": return Math.exp(value);
    default: throw new Error("Función desconocida");
  }
}
function tokenize(input) {
  const source = String(input)
    .replace(/\s+/g, "")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/−/g, "-")
    .replace(/π/g, "pi");
  const tokens = [];
  let index = 0;
  while (index < source.length) {
    const remaining = source.slice(index);
    const numberMatch = remaining.match(
      /^(?:\d+(?:\.\d*)?|\.\d+)(?:E[+-]?\d+)?/
    );
    if (numberMatch) {
      tokens.push({
        type: "number",
        value: Number(numberMatch[0])
      });
      index += numberMatch[0].length;
      continue;
    }
    const nameMatch = remaining.match(/^[a-zA-Z]+/);
    if (nameMatch) {
      tokens.push({
        type: "name",
        value: nameMatch[0]
      });
      index += nameMatch[0].length;
      continue;
    }
    const char = source[index];
    if ("+-*/^()%!√".includes(char)) {
      tokens.push({ type: "symbol", value: char });
      index++;
      continue;
    }
    throw new Error("Carácter no válido");
  }
  return tokens;
}
function calculate(input) {
  if (!String(input).trim()) return 0;
  const tokens = tokenize(input);
  let position = 0;
  function peek() {
    return tokens[position]?.value;
  }
  function consume(value) {
    if (peek() === value) {
      position++;
      return true;
    }
    return false;
  }
  function requireSymbol(value) {
    if (!consume(value)) throw new Error("Falta " + value);
  }
  function parseExpression() {
    let value = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const operator = peek();
      position++;
      const right = parseTerm();
      value = operator === "+" ? value + right : value - right;
    }
    return value;
  }
  function parseTerm() {
    let value = parseUnary();
    while (true) {
      const operator = peek();
      if (operator === "*" || operator === "/") {
        position++;
        const right = parseUnary();
        if (operator === "*") {
          value *= right;
        } else {
          if (right === 0) throw new Error("División entre cero");
          value /= right;
        }
        continue;
      }
      const next = tokens[position];
      if (
        next &&
        (next.type === "number" ||
         next.type === "name" ||
         next.value === "(")
      ) {
        value *= parseUnary();
        continue;
      }
      break;
    }
    return value;
  }
  function parseUnary() {
    if (consume("+")) return parseUnary();
    if (consume("-")) return -parseUnary();
    return parsePower();
  }
  function parsePower() {
    let value = parsePostfix();
    if (consume("^")) {
      const exponent = parseUnary();
      value = Math.pow(value, exponent);
    }
    if (consume("√")) {
      const radicand = parseUnary();
      value = nthRoot(value, radicand);
    }
    return value;
  }
  function parsePostfix() {
    let value = parsePrimary();
    while (true) {
      if (consume("!")) {
        value = factorial(value);
        continue;
      }
      if (consume("%")) {
        value /= 100;
        continue;
      }
      break;
    }
    return value;
  }
  function parsePrimary() {
    const token = tokens[position];
    if (!token) throw new Error("Operación incompleta");
    if (consume("(")) {
      const value = parseExpression();
      requireSymbol(")");
      return value;
    }
    if (consume("√")) return Math.sqrt(parseUnary());
    if (token.type === "number") {
      position++;
      return token.value;
    }
    if (token.type === "name") {
      position++;
      const name = token.value;
      if (name === "pi") return Math.PI;
      if (name === "e") return Math.E;
      if (name === "Ans") return lastAnswer;
      requireSymbol("(");
      const value = parseExpression();
      requireSymbol(")");
      return applyFunction(name, value);
    }
    throw new Error("Expresión no válida");
  }
  const answer = parseExpression();
  if (position !== tokens.length) {
    throw new Error("Operación incompleta");
  }
  if (!Number.isFinite(answer)) {
    throw new Error("Resultado no válido");
  }
  return Math.abs(answer) < 1e-12 ? 0 : answer;
}
function calculateNormal(input) {
  const source = String(input).trim();
  const match = source.match(/^(.+?)([+−-])(\d+(?:\.\d+)?)%$/);
  if (match && match[1]) {
    const base = calculate(match[1]);
    const percentage = Number(match[3]);
    const amount = base * percentage / 100;
    return match[2] === "+" ? base + amount : base - amount;
  }
  return calculate(source);
}
let normalSelection = { start: 0, end: 0 };
let scientificSelection = { start: 0, end: 0 };
function getExpressionSelection(element, savedSelection) {
  const selection = window.getSelection();
  if (selection && selection.rangeCount) {
    const range = selection.getRangeAt(0);
    if (element.contains(range.startContainer) && element.contains(range.endContainer)) {
      const beforeStart = range.cloneRange();
      beforeStart.selectNodeContents(element);
      beforeStart.setEnd(range.startContainer, range.startOffset);
      const beforeEnd = range.cloneRange();
      beforeEnd.selectNodeContents(element);
      beforeEnd.setEnd(range.endContainer, range.endOffset);
      return { start: beforeStart.toString().length, end: beforeEnd.toString().length };
    }
  }
  const length = (element.textContent || '').length;
  return {
    start: Math.max(0, Math.min(savedSelection.start, length)),
    end: Math.max(0, Math.min(savedSelection.end, length))
  };
}
function rememberExpressionSelection(element, mode) {
  const saved = mode === 'normal' ? normalSelection : scientificSelection;
  const position = getExpressionSelection(element, saved);
  if (mode === 'normal') normalSelection = position;
  else scientificSelection = position;
}
function restoreExpressionSelection(element, position, mode) {
  const selection = window.getSelection();
  if (!selection) return;
  const textNode = element.firstChild;
  if (!textNode) {
    element.textContent = '';
    if (mode === 'normal') normalSelection = { start: 0, end: 0 };
    else scientificSelection = { start: 0, end: 0 };
    return;
  }
  const start = Math.max(0, Math.min(position.start, textNode.length));
  const end = Math.max(start, Math.min(position.end, textNode.length));
  const range = document.createRange();
  range.setStart(textNode, start);
  range.setEnd(textNode, end);
  selection.removeAllRanges();
  selection.addRange(range);
  const saved = { start, end };
  if (mode === 'normal') normalSelection = saved;
  else scientificSelection = saved;
}
function insertExpressionAtCursor(element, current, value, mode) {
  const saved = mode === 'normal' ? normalSelection : scientificSelection;
  const position = getExpressionSelection(element, saved);
  const result = current.slice(0, position.start) + value + current.slice(position.end);
  const cursor = position.start + value.length;
  element.textContent = result;
  restoreExpressionSelection(element, { start: cursor, end: cursor }, mode);
  return result;
}
function deleteExpressionAtCursor(element, current, mode) {
  const saved = mode === 'normal' ? normalSelection : scientificSelection;
  let position = getExpressionSelection(element, saved);
  if (position.start === position.end && position.start > 0) {
    position = { start: position.start - 1, end: position.end };
  }
  const result = current.slice(0, position.start) + current.slice(position.end);
  element.textContent = result;
  restoreExpressionSelection(element, { start: position.start, end: position.start }, mode);
  return result;
}
function makeExpressionEditable(selector, mode) {
  const element = $(selector);
  if (!element) return;

  // La expresión ya no acepta escritura directa.
  // Esto evita que Android abra el teclado Gboard.
  element.contentEditable = "false";
  element.removeAttribute("role");
  element.setAttribute(
    "aria-label",
    mode === "normal"
      ? "Expresión de la calculadora"
      : "Expresión de la calculadora científica"
  );

  element.spellcheck = false;
  element.style.userSelect = "text";
  element.style.webkitUserSelect = "text";
  element.style.cursor = "text";

  // Conserva la posición donde se toca la expresión
  // para que los botones inserten caracteres en ese lugar.
  const savePositionFromPoint = (event) => {
    let range = null;

    if (document.caretPositionFromPoint) {
      const position = document.caretPositionFromPoint(
        event.clientX,
        event.clientY
      );

      if (position) {
        range = document.createRange();
        range.setStart(position.offsetNode, position.offset);
        range.collapse(true);
      }
    } else if (document.caretRangeFromPoint) {
      range = document.caretRangeFromPoint(
        event.clientX,
        event.clientY
      );
    }

    if (
      range &&
      element.contains(range.startContainer)
    ) {
      const before = range.cloneRange();
      before.selectNodeContents(element);
      before.setEnd(
        range.startContainer,
        range.startOffset
      );

      const cursor = before.toString().length;
      const saved = {
        start: cursor,
        end: cursor
      };

      if (mode === "normal") {
        normalSelection = saved;
      } else {
        scientificSelection = saved;
      }
    } else {
      const length = (element.textContent || "").length;
      const saved = {
        start: length,
        end: length
      };

      if (mode === "normal") {
        normalSelection = saved;
      } else {
        scientificSelection = saved;
      }
    }
  };

  element.addEventListener("pointerup", (event) => {
    savePositionFromPoint(event);
  });

  element.addEventListener("mouseup", (event) => {
    savePositionFromPoint(event);
  });

  element.addEventListener("keyup", () => {
    rememberExpressionSelection(element, mode);
  });
}
function updateDisplay() {
  const expressionElement = $("#expression");
  const resultElement = $("#result");
  if (!expressionElement || !resultElement) return;
  if (expressionElement.textContent !== (expression || "0")) {
    expressionElement.textContent = expression || "0";
  }
  document.body.classList.toggle("calculo-terminado", finished);
  if (finished) return;
  if (!expression) {
    resultElement.textContent = "0";
    return;
  }
  try {
    const value = calculateNormal(expression);
    resultElement.textContent = formatDisplay(value);
  } catch (error) {
    resultElement.textContent = "…";
  }
}
function addNormal(value) {
  const element = $("#expression");
  if (finished) {
    const position = element ? getExpressionSelection(element, normalSelection) : { start: expression.length, end: expression.length };
    const editingMiddle = position.start !== position.end || position.start < expression.length;
    if (!editingMiddle && "0123456789.(".includes(value)) {
      expression = "";
      normalSelection = { start: 0, end: 0 };
    }
    finished = false;
  }
  if (element) expression = insertExpressionAtCursor(element, expression, value, "normal");
  else expression += value;
  updateDisplay();
}
function toggleNormalSign() {
  if (!expression) {
    expression = "-";
  } else if (expression.startsWith("-(") && expression.endsWith(")")) {
    expression = expression.slice(2, -1);
  } else {
    expression = "-(" + expression + ")";
  }
  finished = false;
  updateDisplay();
}
function pressKey(key) {
  switch (key) {
    case "C":
      expression = "";
      finished = false;
      $("#result").textContent = "0";
      updateDisplay();
      return;
    case "⌫": {
      const element = $("#expression");
      if (element) expression = deleteExpressionAtCursor(element, expression, "normal");
      else expression = expression.slice(0, -1);
      finished = false;
      updateDisplay();
      return;
    }
    case "()": {
      const opened = (expression.match(/\(/g) || []).length;
      const closed = (expression.match(/\)/g) || []).length;
      if (opened > closed && /[\d)%]$/.test(expression)) {
        addNormal(")");
      } else {
        addNormal("(");
      }
      return;
    }
    case "±":
      toggleNormalSign();
      return;
    case "=":
      solveNormal();
      return;
    default:
      addNormal(key);
  }
}
function solveNormal() {
  if (!expression) return;
  try {
    const original = expression;
    const answer = calculateNormal(original);
    const formatted = formatNumber(answer);
    $("#expression").textContent = original;
    $("#result").textContent = formatted;
    finished = true;
    lastAnswer = answer;
    saveOperation(original, formatted, "normal");
    document.body.classList.add("calculo-terminado");
  } catch (error) {
    notify("Revisa la operación");
  }
}
function updateScientificDisplay() {
  const expressionElement = $("#scientificExpression");
  const resultElement = $("#scientificResult");
  if (!expressionElement || !resultElement) return;
  if (expressionElement.textContent !== (scientificExpression || "0")) {
    expressionElement.textContent = scientificExpression || "0";
  }
  if (!scientificExpression) {
    resultElement.textContent = "0";
    return;
  }
  if (scientificFinished) return;
  try {
    const answer = calculate(scientificExpression);
    resultElement.textContent = formatNumber(answer);
  } catch (error) {
    resultElement.textContent = "…";
  }
}
function addScientific(value) {
  const element = $("#scientificExpression");
  if (scientificFinished) {
    const position = element ? getExpressionSelection(element, scientificSelection) : { start: scientificExpression.length, end: scientificExpression.length };
    const editingMiddle = position.start !== position.end || position.start < scientificExpression.length;
    if (!editingMiddle && (/^[0-9.(]/.test(value) || value === "π" || value === "e" || value === "Ans" || /^[a-z]/.test(value))) {
      scientificExpression = "";
      scientificSelection = { start: 0, end: 0 };
    }
    scientificFinished = false;
  }
  if (element) scientificExpression = insertExpressionAtCursor(element, scientificExpression, value, "scientific");
  else scientificExpression += value;
  updateScientificDisplay();
}
function toggleScientificSign() {
  if (!scientificExpression) {
    scientificExpression = "-";
  } else if (
    scientificExpression.startsWith("-(") &&
    scientificExpression.endsWith(")")
  ) {
    scientificExpression = scientificExpression.slice(2, -1);
  } else {
    scientificExpression = "-(" + scientificExpression + ")";
  }
  scientificFinished = false;
  updateScientificDisplay();
}
function scientificMemory(action) {
  if (action === "MC") {
    memoryValue = 0;
    notify("Memoria borrada");
    return;
  }
  if (action === "MR") {
    addScientific("(" + formatNumber(memoryValue) + ")");
    return;
  }
  let value;
  try {
    value = scientificExpression
      ? calculate(scientificExpression)
      : lastAnswer;
  } catch (error) {
    notify("No hay un número válido");
    return;
  }
  if (action === "M+") {
    memoryValue += value;
    notify("Número sumado a memoria");
  }
  if (action === "M−") {
    memoryValue -= value;
    notify("Número restado de memoria");
  }
}
function pressScientific(key) {
  const functions = {
    sin: "sin(",
    cos: "cos(",
    tan: "tan(",
    asin: "asin(",
    acos: "acos(",
    atan: "atan(",
    log: "log(",
    ln: "ln(",
    sqrt: "sqrt(",
    cbrt: "cbrt(",
    abs: "abs(",
    pow10: "pow10(",
    powe: "powe("
  };
  if (key in functions) {
    addScientific(functions[key]);
    return;
  }
  switch (key) {
    case "AC":
      scientificExpression = "";
      scientificFinished = false;
      $("#scientificResult").textContent = "0";
      updateScientificDisplay();
      return;
    case "DEL": {
      const element = $("#scientificExpression");
      if (element) scientificExpression = deleteExpressionAtCursor(element, scientificExpression, "scientific");
      else scientificExpression = scientificExpression.slice(0, -1);
      scientificFinished = false;
      updateScientificDisplay();
      return;
    }
    case "square":
      addScientific("^2");
      return;
    case "cube":
      addScientific("^3");
      return;
    case "power":
      addScientific("^");
      return;
    case "root":
      addScientific("√");
      return;
    case "inverse":
      addScientific("^(-1)");
      return;
    case "factorial":
      addScientific("!");
      return;
    case "exp":
      addScientific("E");
      return;
    case "±":
      toggleScientificSign();
      return;
    case "MC":
    case "MR":
    case "M+":
    case "M−":
      scientificMemory(key);
      return;
    case "=":
      solveScientific();
      return;
    default:
      addScientific(key);
  }
}
function solveScientific() {
  if (!scientificExpression) return;
  try {
    const original = scientificExpression;
    const answer = calculate(original);
    const formatted = formatNumber(answer);
    $("#scientificExpression").textContent = original;
    $("#scientificResult").textContent = formatted;
    scientificFinished = true;
    lastAnswer = answer;
    saveOperation(original, formatted, "cientifica");
  } catch (error) {
    notify(error.message || "Operación no válida");
  }
}
function toggleAngleMode() {
  angleMode = angleMode === "DEG" ? "RAD" : "DEG";
  const button = $("#angleModeButton");
  const label = $("#angleModeLabel");
  if (button) button.textContent = angleMode;
  if (label) label.textContent = angleMode;
  scientificFinished = false;
  updateScientificDisplay();
  notify(angleMode === "DEG" ? "Modo grados" : "Modo radianes");
}
function createId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}
function saveOperation(operation, answer, mode = "normal") {
  const record = {
    id: createId(),
    expression: operation,
    result: answer,
    date: new Date().toISOString(),
    mode
  };
  data.history.unshift(record);
  data.history = data.history.slice(0, 200);
  saveData();
}
function isFavorite(record) {
  return data.favorites.some(
    (item) =>
      item.expression === record.expression &&
      String(item.result) === String(record.result)
  );
}
function toggleFavorite(record) {
  if (isFavorite(record)) {
    data.favorites = data.favorites.filter(
      (item) =>
        !(
          item.expression === record.expression &&
          String(item.result) === String(record.result)
        )
    );
    notify("Eliminado de favoritos");
  } else {
    data.favorites.unshift({ ...record, id: createId() });
    notify("Agregado a favoritos");
  }
  saveData();
  renderHistory();
  renderFavorites();
}
function useRecord(record) {
  if (record.mode === "cientifica") {
    scientificExpression = String(record.expression);
    scientificFinished = false;
    showPage("cientifica");
    updateScientificDisplay();
  } else {
    expression = String(record.expression);
    finished = false;
    showPage("calculadora");
    updateDisplay();
  }
}
function createRecord(record, source) {
  const element = document.createElement("article");
  element.className = "record";
  const date = document.createElement("div");
  date.className = "record-date";
  try {
    date.textContent = new Date(record.date).toLocaleString("es-MX");
  } catch (error) {
    date.textContent = "";
  }
  const operation = document.createElement("div");
  operation.className = "record-expression";
  operation.textContent = String(record.expression);
  const result = document.createElement("div");
  result.className = "record-result";
  result.textContent = "= " + String(record.result);
  const actions = document.createElement("div");
  actions.className = "record-actions";
  const useButton = document.createElement("button");
  useButton.textContent = "🧮 Usar";
  useButton.addEventListener("click", () => useRecord(record));
  const favoriteButton = document.createElement("button");
  favoriteButton.textContent = isFavorite(record)
    ? "⭐ Quitar favorito"
    : "☆ Favorito";
  favoriteButton.addEventListener("click", () => toggleFavorite(record));
  actions.appendChild(useButton);
  actions.appendChild(favoriteButton);
  if (source === "favoritos") {
    const deleteButton = document.createElement("button");
    deleteButton.textContent = "🗑 Eliminar";
    deleteButton.addEventListener("click", () => {
      data.favorites = data.favorites.filter((item) => item.id !== record.id);
      saveData();
      renderFavorites();
      notify("Favorito eliminado");
    });
    actions.appendChild(deleteButton);
  }
  element.appendChild(date);
  element.appendChild(operation);
  element.appendChild(result);
  element.appendChild(actions);
  return element;
}
function renderRecords(containerId, records, source) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.replaceChildren();
  if (!records.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = source === "historial"
      ? "Todavía no tienes operaciones guardadas."
      : "Todavía no tienes favoritos.";
    container.appendChild(empty);
    return;
  }
  records.forEach((record) => {
    container.appendChild(createRecord(record, source));
  });
}
function renderHistory() {
  renderRecords("historyList", data.history, "historial");
}
function renderFavorites() {
  renderRecords("favoritesList", data.favorites, "favoritos");
}
const UNITS = {
  Longitud: {
    metro: 1,
    kilometro: 1000,
    centimetro: 0.01,
    milimetro: 0.001,
    milla: 1609.344,
    yarda: 0.9144,
    pie: 0.3048,
    pulgada: 0.0254
  },
  Peso: {
    kilogramo: 1,
    gramo: 0.001,
    miligramo: 0.000001,
    tonelada: 1000,
    libra: 0.45359237,
    onza: 0.028349523125
  },
  Capacidad: {
    litro: 1,
    mililitro: 0.001,
    metro_cubico: 1000,
    galon: 3.785411784,
    taza: 0.2365882365
  },
  Tiempo: {
    segundo: 1,
    minuto: 60,
    hora: 3600,
    dia: 86400,
    semana: 604800
  },
  "Área": {
    metro_cuadrado: 1,
    kilometro_cuadrado: 1000000,
    centimetro_cuadrado: 0.0001,
    hectarea: 10000,
    acre: 4046.8564224
  },
  Temperatura: {
    Celsius: 1,
    Fahrenheit: 1,
    Kelvin: 1
  }
};
function unitLabel(key) {
  return key.replaceAll("_", " ");
}
function fillSelect(select, values) {
  if (!select) return;
  select.replaceChildren();
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = unitLabel(value);
    select.appendChild(option);
  });
}
function initializeConverter() {
  const category = $("#category");
  if (!category) return;
  fillSelect(category, Object.keys(UNITS));
  updateUnits();
}
function updateUnits() {
  const category = $("#category")?.value;
  if (!category || !UNITS[category]) return;
  const units = Object.keys(UNITS[category]);
  fillSelect($("#fromUnit"), units);
  fillSelect($("#toUnit"), units);
  if (units.length > 1) $("#toUnit").selectedIndex = 1;
  updateConversion();
}
function convertTemperature(value, from, to) {
  let celsius;
  switch (from) {
    case "Fahrenheit":
      celsius = (value - 32) * 5 / 9;
      break;
    case "Kelvin":
      celsius = value - 273.15;
      break;
    default:
      celsius = value;
  }
  switch (to) {
    case "Fahrenheit":
      return celsius * 9 / 5 + 32;
    case "Kelvin":
      return celsius + 273.15;
    default:
      return celsius;
  }
}
function updateConversion() {
  const category = $("#category")?.value;
  const from = $("#fromUnit")?.value;
  const to = $("#toUnit")?.value;
  const amount = parseInput($("#convertAmount")?.value ?? "");
  const resultElement = $("#conversionResult");
  const unitElement = $("#conversionUnit");
  if (!resultElement || !unitElement) return;
  if (!Number.isFinite(amount) || !category || !from || !to) {
    resultElement.textContent = "Introduce una cantidad";
    unitElement.textContent = "";
    return;
  }
  let answer;
  if (category === "Temperatura") {
    answer = convertTemperature(amount, from, to);
  } else {
    const values = UNITS[category];
    answer = amount * values[from] / values[to];
  }
  resultElement.textContent = formatNumber(answer);
  unitElement.textContent = unitLabel(to);
}
function updatePercentages() {
  const amount = parseInput($("#percentAmount")?.value ?? "");
  const rate = parseInput($("#percentRate")?.value ?? "");
  const result = $("#percentResult");
  const increase = $("#percentIncrease");
  const decrease = $("#percentDecrease");
  if (!result || !increase || !decrease) return;
  if (!Number.isFinite(amount) || !Number.isFinite(rate)) {
    result.textContent = "—";
    increase.textContent = "—";
    decrease.textContent = "—";
    return;
  }
  const percentage = amount * rate / 100;
  result.textContent = formatNumber(percentage);
  increase.textContent = formatNumber(amount + percentage);
  decrease.textContent = formatNumber(amount - percentage);
}
/* ==========================================
   CONVERSOR DE MONEDAS
   Tasas de referencia diarias.
   ========================================== */
const CURRENCIES = {
  MXN: "Peso mexicano (MXN)",
  USD: "Dólar estadounidense (USD)",
  EUR: "Euro (EUR)",
  COP: "Peso colombiano (COP)",
  HNL: "Lempira hondureño (HNL)",
  PEN: "Sol peruano (PEN)"
};
const currencyCache = new Map();
let currencyRequestBusy = false;
function initializeCurrencyConverter() {
  const from = $("#currencyFrom");
  const to = $("#currencyTo");
  if (!from || !to) return;
  [from, to].forEach((select) => {
    select.replaceChildren();
    Object.entries(CURRENCIES).forEach(([code, label]) => {
      const option = document.createElement("option");
      option.value = code;
      option.textContent = label;
      select.appendChild(option);
    });
  });
  from.value = "USD";
  to.value = "MXN";
  updateCurrencyConversion();
}
async function getCurrencyRates(base) {
  const cached = currencyCache.get(base);
  if (cached && Date.now() < cached.expiresAt) return cached.data;
  const url = `https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("No se pudo consultar el servicio de monedas");
  }
  const result = await response.json();
  if (result.result !== "success" || !result.rates) {
    throw new Error("El servicio no devolvió tasas válidas");
  }
  const nextUpdate = Number(result.time_next_update_unix || 0) * 1000;
  const expiresAt = nextUpdate > Date.now()
    ? nextUpdate
    : Date.now() + 60 * 60 * 1000;
  const dataRates = {
    rates: result.rates,
    updated: result.time_last_update_utc || "Fecha no disponible",
    provider: result.provider || "https://www.exchangerate-api.com"
  };
  currencyCache.set(base, { data: dataRates, expiresAt });
  try {
    localStorage.setItem(
      `JR2_FX_${base}`,
      JSON.stringify({ data: dataRates, expiresAt })
    );
  } catch (error) {}
  return dataRates;
}
async function updateCurrencyConversion() {
  const amountElement = $("#currencyAmount");
  const fromElement = $("#currencyFrom");
  const toElement = $("#currencyTo");
  const resultElement = $("#currencyResult");
  const rateElement = $("#currencyRate");
  const updatedElement = $("#currencyUpdated");
  const button = $("#convertCurrency");
  if (!amountElement || !fromElement || !toElement || !resultElement) return;
  const amount = parseInput(amountElement.value);
  const from = fromElement.value;
  const to = toElement.value;
  if (!Number.isFinite(amount) || amount < 0) {
    resultElement.textContent = "Introduce una cantidad válida";
    if (rateElement) rateElement.textContent = "";
    return;
  }
  if (from === to) {
    resultElement.textContent = `${formatNumber(amount)} ${to}`;
    if (rateElement) rateElement.textContent = `1 ${from} = 1 ${to}`;
    if (updatedElement) updatedElement.textContent = "Misma moneda";
    return;
  }
  if (currencyRequestBusy) return;
  currencyRequestBusy = true;
  if (button) button.disabled = true;
  resultElement.textContent = "Consultando tasa de cambio…";
  try {
    let dataRates;
    const stored = localStorage.getItem(`JR2_FX_${from}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.data && parsed.expiresAt > Date.now()) {
          dataRates = parsed.data;
          currencyCache.set(from, parsed);
        }
      } catch (error) {}
    }
    if (!dataRates) dataRates = await getCurrencyRates(from);
    const rate = Number(dataRates.rates[to]);
    if (!Number.isFinite(rate)) throw new Error("Moneda no disponible");
    resultElement.textContent = `${formatNumber(amount * rate)} ${to}`;
    if (rateElement) {
      rateElement.textContent = `1 ${from} = ${formatNumber(rate)} ${to}`;
    }
    if (updatedElement) {
      updatedElement.replaceChildren(
        document.createTextNode(`Tasa actualizada: ${dataRates.updated} · `)
      );
      const attribution = document.createElement("a");
      attribution.href = "https://www.exchangerate-api.com";
      attribution.target = "_blank";
      attribution.rel = "noopener noreferrer";
      attribution.textContent = "Rates By Exchange Rate API";
      updatedElement.appendChild(attribution);
    }
  } catch (error) {
    resultElement.textContent =
      "No se pudo obtener la tasa. Revisa tu conexión e inténtalo de nuevo.";
    if (rateElement) rateElement.textContent = "";
    if (updatedElement) {
      updatedElement.textContent = "Las tasas requieren conexión a internet.";
    }
    console.error("Conversor de monedas:", error);
  } finally {
    currencyRequestBusy = false;
    if (button) button.disabled = false;
  }
}
function swapCurrencies() {
  const from = $("#currencyFrom");
  const to = $("#currencyTo");
  if (!from || !to) return;
  const previous = from.value;
  from.value = to.value;
  to.value = previous;
  updateCurrencyConversion();
}
/* ==========================================
   TEMAS
   ========================================== */
const themeNames = {
  pokemon: "Pokémon",
  galaxias: "Espacio y galaxias",
  kawaii: "Kawaii Purple"
};
function applyTheme(theme) {
  if (!themeNames[theme]) return;
  data.theme = theme;
  document.body.dataset.theme = theme;
  $$("[data-theme-select]").forEach((button) => {
    button.classList.toggle(
      "selected",
      button.dataset.themeSelect === theme
    );
  });
  const currentTheme = $("#currentTheme");
  if (currentTheme) currentTheme.textContent = themeNames[theme];
  saveData();
}
function updateSettings() {
  const historyCount = $("#historyCount");
  const favoritesCount = $("#favoritesCount");
  if (historyCount) historyCount.textContent = data.history.length;
  if (favoritesCount) favoritesCount.textContent = data.favorites.length;
  const currentTheme = $("#currentTheme");
  if (currentTheme) currentTheme.textContent = themeNames[data.theme];
}
function exportData() {
  const backup = {
    version: 2,
    application: "JR² Calculadora",
    exportedAt: new Date().toISOString(),
    theme: data.theme,
    history: data.history,
    favorites: data.favorites
  };
  const content = JSON.stringify(backup, null, 2);
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "JR2_Calculadora_Respaldo.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  notify("Respaldo generado");
}
function importData(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (
        !imported ||
        typeof imported !== "object" ||
        !Array.isArray(imported.history) ||
        !Array.isArray(imported.favorites)
      ) {
        throw new Error("Archivo no válido");
      }
      const confirmed = confirm(
        "¿Quieres importar este respaldo? " +
        "Reemplazará tu historial y favoritos actuales."
      );
      if (!confirmed) return;
      data = {
        theme: themeNames[imported.theme]
          ? imported.theme
          : (imported.theme === "rosado" ? "kawaii" : "pokemon"),
        history: imported.history,
        favorites: imported.favorites
      };
      saveData();
      applyTheme(data.theme);
      renderHistory();
      renderFavorites();
      updateSettings();
      notify("Respaldo importado correctamente");
    } catch (error) {
      notify("No se pudo importar el respaldo");
    } finally {
      event.target.value = "";
    }
  };
  reader.onerror = () => {
    notify("Error al leer el archivo");
    event.target.value = "";
  };
  reader.readAsText(file);
}
function resetData() {
  const confirmed = confirm(
    "¿Seguro que deseas eliminar " +
    "el historial y los favoritos?"
  );
  if (!confirmed) return;
  data.history = [];
  data.favorites = [];
  saveData();
  renderHistory();
  renderFavorites();
  updateSettings();
  notify("Datos eliminados");
}
function initializeEvents() {
  makeExpressionEditable("#expression", "normal");
  makeExpressionEditable("#scientificExpression", "scientific");
  document.addEventListener("selectionchange", () => {
    const normalElement = $("#expression");
    const scientificElement = $("#scientificExpression");
    if (normalElement) rememberExpressionSelection(normalElement, "normal");
    if (scientificElement) rememberExpressionSelection(scientificElement, "scientific");
  });
  $("#openMenu")?.addEventListener("click", openMenu);
  $("#closeMenu")?.addEventListener("click", closeMenu);
  $("#overlay")?.addEventListener("click", closeMenu);
  $$("[data-page]").forEach((button) => {
    button.addEventListener("click", () => {
      showPage(button.dataset.page);
    });
  });
  $$("[data-key]").forEach((button) => {
    button.addEventListener("click", () => {
      pressKey(button.dataset.key);
    });
  });
  $$("[data-sci]").forEach((button) => {
    button.addEventListener("click", () => {
      pressScientific(button.dataset.sci);
    });
  });
  $("#angleModeButton")?.addEventListener("click", toggleAngleMode);
  $("#clearHistory")?.addEventListener("click", () => {
    if (!data.history.length) {
      notify("El historial ya está vacío");
      return;
    }
    if (!confirm("¿Borrar todo el historial?")) return;
    data.history = [];
    saveData();
    renderHistory();
    notify("Historial eliminado");
  });
  $("#clearFavorites")?.addEventListener("click", () => {
    if (!data.favorites.length) {
      notify("No hay favoritos");
      return;
    }
    if (!confirm("¿Borrar todos los favoritos?")) return;
    data.favorites = [];
    saveData();
    renderFavorites();
    notify("Favoritos eliminados");
  });
  $("#category")?.addEventListener("change", updateUnits);
  $("#convertAmount")?.addEventListener("input", updateConversion);
  $("#fromUnit")?.addEventListener("change", updateConversion);
  $("#toUnit")?.addEventListener("change", updateConversion);
  $("#swapUnits")?.addEventListener("click", () => {
    const from = $("#fromUnit");
    const to = $("#toUnit");
    if (!from || !to) return;
    const previous = from.value;
    from.value = to.value;
    to.value = previous;
    updateConversion();
  });
  $("#currencyAmount")?.addEventListener("input", updateCurrencyConversion);
  $("#currencyFrom")?.addEventListener("change", updateCurrencyConversion);
  $("#currencyTo")?.addEventListener("change", updateCurrencyConversion);
  $("#convertCurrency")?.addEventListener("click", updateCurrencyConversion);
  $("#swapCurrencies")?.addEventListener("click", swapCurrencies);
  $("#percentAmount")?.addEventListener("input", updatePercentages);
  $("#percentRate")?.addEventListener("input", updatePercentages);
  $$("[data-theme-select]").forEach((button) => {
    button.addEventListener("click", () => {
      applyTheme(button.dataset.themeSelect);
    });
  });
  $("#exportData")?.addEventListener("click", exportData);
  $("#importData")?.addEventListener("change", importData);
  $("#resetData")?.addEventListener("click", resetData);
  document.addEventListener("keydown", (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.closest("input, textarea, select")) return;
    if (target instanceof HTMLElement && target.isContentEditable) {
      if (event.key === "Enter") {
        event.preventDefault();
        if (currentPage === "calculadora") solveNormal();
        if (currentPage === "cientifica") solveScientific();
      }
      return;
    }
    if (event.key === "Escape") {
      closeMenu();
      return;
    }
    const keyboardMap = {
      "*": "×",
      "/": "÷",
      "-": "−",
      "Enter": "=",
      "Backspace": "⌫",
      "Delete": "C"
    };
    const key = keyboardMap[event.key] || event.key;
    if (currentPage === "calculadora") {
      const allowed = "0123456789.+−×÷()%";
      if (key === "=" || key === "⌫" || key === "C") {
        event.preventDefault();
        pressKey(key);
      } else if (key.length === 1 && allowed.includes(key)) {
        event.preventDefault();
        pressKey(key);
      }
    }
    if (currentPage === "cientifica") {
      const scientificMap = {
        "Backspace": "DEL",
        "Delete": "AC"
      };
      const sciKey = scientificMap[event.key] || key;
      const allowed = "0123456789.+−×÷()%^";
      if (sciKey === "=" || sciKey === "DEL" || sciKey === "AC") {
        event.preventDefault();
        pressScientific(sciKey);
      } else if (sciKey.length === 1 && allowed.includes(sciKey)) {
        event.preventDefault();
        pressScientific(sciKey);
      }
    }
  });
}
function initializeApp() {
  initializeEvents();
  applyTheme(data.theme);
  initializeConverter();
  initializeCurrencyConverter();
  updatePercentages();
  updateDisplay();
  updateScientificDisplay();
  renderHistory();
  renderFavorites();
  updateSettings();
  showPage("calculadora");
  console.log("JR² Calculadora 3.0 iniciada correctamente");
}
initializeApp();