/* Aplicación principal: estado, captura, resultados y reportes. */
(function () {
  'use strict';

  const STORAGE_KEY = 'calificacion.v1';
  const { isNum } = Stats;
  const esc = Report.esc;
  const $ = (sel) => document.querySelector(sel);

  const DEFAULT_CONFIG = {
    escuela: '',
    grupo: '',
    ciclo: '',
    maestro: '',
    escalaMax: 10,
    aprobatoria: 6,
    decimales: 1,
  };

  let state = load();
  let results = null;
  let activeTab = 'config';
  const sortState = { key: 'rank', dir: 1 };

  // ---------------- Estado ----------------

  function emptyState() {
    return { config: Object.assign({}, DEFAULT_CONFIG), materias: [], alumnos: [], calificaciones: {} };
  }

  function normalize(s) {
    const base = emptyState();
    if (!s || typeof s !== 'object') return base;
    return {
      config: Object.assign(base.config, s.config || {}),
      materias: Array.isArray(s.materias) ? s.materias : [],
      alumnos: Array.isArray(s.alumnos) ? s.alumnos : [],
      calificaciones: s.calificaciones && typeof s.calificaciones === 'object' ? s.calificaciones : {},
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return normalize(JSON.parse(raw));
    } catch (e) {
      /* almacenamiento no disponible */
    }
    return emptyState();
  }

  let saveTimer = null;
  function saveNow() {
    clearTimeout(saveTimer);
    saveTimer = null;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      toast('No se pudo guardar en el navegador. Use «Respaldo (JSON)».', true);
    }
  }
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 250);
  }
  // Guarda lo pendiente si se cierra o recarga la página.
  window.addEventListener('pagehide', () => {
    if (saveTimer) saveNow();
  });

  let uid = 0;
  function newId(p) {
    uid += 1;
    return p + Date.now().toString(36) + uid.toString(36);
  }

  function compute() {
    results = Stats.computeResults(state);
    return results;
  }

  function dec() {
    const d = Number(state.config.decimales);
    return Number.isInteger(d) && d >= 0 && d <= 3 ? d : 1;
  }

  function fmt(v, d) {
    return isNum(v) ? v.toFixed(d == null ? dec() : d) : '—';
  }

  function isBad(v) {
    return isNum(v) && v < Number(state.config.aprobatoria);
  }

  // ---------------- Utilidades de interfaz ----------------

  let toastTimer = null;
  function toast(msg, error) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'show' + (error ? ' error' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.className = ''), 3500);
  }

  function slug(s) {
    return (
      String(s || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'grupo'
    );
  }

  function fileBase() {
    const d = new Date();
    const ymd = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    return 'calificaciones_' + slug(state.config.grupo) + '_' + ymd;
  }

  function downloadBlob(content, filename, type) {
    const blob = new Blob([content], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 500);
  }

  function renderHeader() {
    const c = state.config;
    $('#hdr-sub').textContent = [c.escuela, c.grupo, c.ciclo].filter(Boolean).join(' · ');
  }

  // ---------------- Pestañas ----------------

  function showTab(name) {
    activeTab = name;
    document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
    document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('active', p.id === 'tab-' + name));
    renderActive();
  }

  function renderActive() {
    renderHeader();
    compute();
    if (activeTab === 'overview') renderOverview();
    if (activeTab === 'config') renderConfig();
    if (activeTab === 'grades') renderGrades();
    if (activeTab === 'results') renderResults();
    if (activeTab === 'report') renderReport();
  }

  // ---------------- Vista general (toda la información en una tabla) ----------------

  function renderOverview() {
    const c = state.config;
    $('#ov-meta').textContent = [c.escuela, c.grupo && 'Grupo ' + c.grupo, c.ciclo, c.maestro]
      .filter(Boolean)
      .join(' · ') +
      (results.general.n ? ' · ' + state.alumnos.length + ' alumnos · Promedio del grupo ' + fmt(results.general.mean) : '');
    const table = $('#ov-table');
    if (!state.materias.length || !state.alumnos.length) {
      table.innerHTML =
        '<tbody><tr><td class="empty">Aún no hay datos. Agregue alumnos y materias en «Configuración», importe un archivo de Excel o cargue los datos de ejemplo.</td></tr></tbody>';
      return;
    }
    const show = {
      evals: $('#ov-evals').checked,
      prom: $('#ov-prom').checked,
      t: $('#ov-t').checked,
      rank: $('#ov-rank').checked,
      top: $('#ov-top').checked,
      foot: $('#ov-foot').checked,
    };

    // Definición de columnas: [{group, label, get(pa, i), stat:boolean, kind}]
    const groups = [];
    state.materias.forEach((m, mi) => {
      const cols = [];
      if (show.evals) {
        m.evaluaciones.forEach((e) =>
          cols.push({ label: e.nombre, kind: 'grade', get: (pa) => (state.calificaciones[pa.alumno.id] || {})[e.id] })
        );
      }
      if (show.prom) cols.push({ label: 'Prom.', kind: 'prom', get: (pa) => pa.materias[mi].promedio });
      if (show.t) cols.push({ label: 'T', kind: 't', get: (pa) => pa.materias[mi].tscore });
      if (show.rank) cols.push({ label: 'Pos.', kind: 'rank', n: results.perMateria[mi].stats.n, get: (pa) => pa.materias[mi].rank });
      if (show.top) cols.push({ label: 'Top %', kind: 'top', get: (pa) => pa.materias[mi].top });
      if (cols.length) groups.push({ name: m.nombre, cols, cls: 'materia-th' });
    });
    groups.push({
      name: 'General',
      cls: 'general-th',
      cols: [
        { label: 'Promedio', kind: 'prom', get: (pa) => pa.general },
        { label: 'Puntaje T', kind: 't', get: (pa) => pa.tscore },
        { label: 'Posición', kind: 'rank', n: results.general.n, get: (pa) => pa.rank },
        { label: 'Top %', kind: 'top', get: (pa) => pa.top },
        { label: 'Reprobadas', kind: 'count', get: (pa) => pa.reprobadas },
      ],
    });

    const cellText = (col, v) => {
      if (col.kind === 'rank') return v == null ? '—' : v + '/' + col.n;
      if (col.kind === 'top') return v == null ? '—' : fmt(v, 1) + '%';
      if (col.kind === 't') return fmt(v, 1);
      if (col.kind === 'count') return v;
      return fmt(v);
    };

    let h1 = '<tr><th class="sticky c0" rowspan="2">No.</th><th class="sticky c1" rowspan="2">Nombre</th>';
    let h2 = '<tr>';
    groups.forEach((g) => {
      h1 += '<th class="' + g.cls + ' sep-l" colspan="' + g.cols.length + '">' + esc(g.name) + '</th>';
      g.cols.forEach((col, k) => {
        const cls = [k === 0 ? 'sep-l' : '', col.kind === 'grade' ? '' : 'sub'].join(' ').trim();
        h2 += '<th' + (cls ? ' class="' + cls + '"' : '') + '>' + esc(col.label) + '</th>';
      });
    });
    h1 += '</tr>';
    h2 += '</tr>';

    const q = $('#ov-search').value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    let rows = results.porAlumno.slice();
    if (q) {
      rows = rows.filter((pa) =>
        pa.alumno.nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q)
      );
    }
    const order = $('#ov-order').value;
    if (order === 'rank') rows.sort((a, b) => (a.rank == null ? 1e9 : a.rank) - (b.rank == null ? 1e9 : b.rank));
    if (order === 'nombre') rows.sort((a, b) => a.alumno.nombre.localeCompare(b.alumno.nombre, 'es'));

    let body = '';
    rows.forEach((pa) => {
      body += '<tr' + (pa.rank != null && pa.rank <= 3 ? ' class="top3"' : '') + '>';
      body += '<td class="sticky c0">' + esc(pa.alumno.numero) + '</td><td class="sticky c1">' + esc(pa.alumno.nombre) + '</td>';
      groups.forEach((g) =>
        g.cols.forEach((col, k) => {
          const v = col.get(pa);
          const bad = (col.kind === 'grade' || col.kind === 'prom') && isBad(v);
          const cls = [k === 0 ? 'sep-l' : '', col.kind === 'prom' ? 'pr' : '', bad ? 'bad' : '', col.kind === 'count' && v > 0 ? 'bad' : '']
            .join(' ')
            .trim();
          body += '<td' + (cls ? ' class="' + cls + '"' : '') + '>' + cellText(col, v) + '</td>';
        })
      );
      body += '</tr>';
    });
    if (!rows.length) {
      body = '<tr><td class="empty" colspan="99">Ningún alumno coincide con «' + esc($('#ov-search').value) + '».</td></tr>';
    }

    let foot = '';
    if (show.foot) {
      const statRows = [
        ['Media del grupo', 'mean'],
        ['Desv. estándar', 'sd'],
        ['Máximo', 'max'],
        ['Mínimo', 'min'],
      ];
      const descs = groups.map((g) =>
        g.cols.map((col) =>
          col.kind === 'grade' || col.kind === 'prom' ? Stats.describe(results.porAlumno.map((pa) => col.get(pa))) : null
        )
      );
      statRows.forEach(([label, key]) => {
        foot += '<tr><td class="sticky c0"></td><td class="sticky c1">' + label + '</td>';
        groups.forEach((g, gi) =>
          g.cols.forEach((col, k) => {
            const d = descs[gi][k];
            const text = d ? fmt(d[key], key === 'sd' ? 2 : undefined) : '';
            foot += '<td' + (k === 0 ? ' class="sep-l"' : '') + '>' + text + '</td>';
          })
        );
        foot += '</tr>';
      });
    }

    table.innerHTML = '<thead>' + h1 + h2 + '</thead><tbody>' + body + '</tbody>' + (foot ? '<tfoot>' + foot + '</tfoot>' : '');
    setHeaderOffset(table);
  }

  function bindOverview() {
    ['#ov-evals', '#ov-prom', '#ov-t', '#ov-rank', '#ov-top', '#ov-foot', '#ov-order'].forEach((sel) =>
      $(sel).addEventListener('change', renderOverview)
    );
    $('#ov-search').addEventListener('input', renderOverview);
  }

  // ---------------- Configuración ----------------

  function renderConfig() {
    document.querySelectorAll('[data-cfg]').forEach((inp) => {
      const v = state.config[inp.dataset.cfg];
      if (document.activeElement !== inp) inp.value = v == null ? '' : v;
    });
    renderAlumnos();
    renderMaterias();
  }

  function renderAlumnos() {
    $('#alumnos-count').textContent = state.alumnos.length;
    const tb = $('#alumnos-table tbody');
    if (state.alumnos.length === 0) {
      tb.innerHTML = '<tr><td colspan="3" class="empty">Aún no hay alumnos.</td></tr>';
      return;
    }
    tb.innerHTML = state.alumnos
      .map(
        (a, i) =>
          '<tr><td><input data-al="' + i + '" data-f="numero" value="' + esc(a.numero) + '"></td>' +
          '<td><input data-al="' + i + '" data-f="nombre" value="' + esc(a.nombre) + '"></td>' +
          '<td><button class="btn icon" data-del-al="' + i + '" title="Eliminar">✕</button></td></tr>'
      )
      .join('');
  }

  function renderMaterias() {
    const box = $('#materias-editor');
    if (state.materias.length === 0) {
      box.innerHTML = '<div class="empty">Aún no hay materias. Agregue una abajo o importe un archivo de Excel.</div>';
      return;
    }
    box.innerHTML = state.materias
      .map((m, mi) => {
        const evals = m.evaluaciones
          .map(
            (e, ei) =>
              '<div class="eval"><input type="text" data-m="' + mi + '" data-e="' + ei + '" data-f="nombre" value="' + esc(e.nombre) + '" title="Nombre de la evaluación">' +
              '<span class="small">peso</span><input type="number" min="0" step="any" data-m="' + mi + '" data-e="' + ei + '" data-f="peso" value="' + esc(e.peso) + '">' +
              '<button class="btn icon" data-del-eval="' + mi + ':' + ei + '" title="Eliminar evaluación">✕</button></div>'
          )
          .join('');
        return (
          '<div class="materia"><div class="materia-head">' +
          '<input type="text" data-m="' + mi + '" data-f="materia" value="' + esc(m.nombre) + '">' +
          '<button class="btn ghost" data-mv="' + mi + ':-1" title="Subir">▲</button>' +
          '<button class="btn ghost" data-mv="' + mi + ':1" title="Bajar">▼</button>' +
          '<button class="btn ghost" data-add-eval="' + mi + '">➕ Evaluación</button>' +
          '<button class="btn ghost danger" data-del-m="' + mi + '">Eliminar materia</button>' +
          '</div><div class="evals">' + evals + '</div></div>'
        );
      })
      .join('');
  }

  function bindConfig() {
    document.querySelectorAll('[data-cfg]').forEach((inp) => {
      inp.addEventListener('input', () => {
        const k = inp.dataset.cfg;
        state.config[k] = inp.type === 'number' ? (inp.value === '' ? null : Number(inp.value)) : inp.value;
        renderHeader();
        save();
      });
    });

    $('#btn-add-alumnos').addEventListener('click', () => {
      const lines = $('#bulk-alumnos').value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      if (!lines.length) return toast('Escriba o pegue al menos un nombre.', true);
      lines.forEach((nombre) => {
        const parts = nombre.split('\t');
        const a = parts.length > 1 && /^\d+$/.test(parts[0].trim())
          ? { id: newId('a'), numero: parts[0].trim(), nombre: parts.slice(1).join(' ').trim() }
          : { id: newId('a'), numero: String(state.alumnos.length + 1), nombre };
        state.alumnos.push(a);
        state.calificaciones[a.id] = {};
      });
      $('#bulk-alumnos').value = '';
      save();
      renderAlumnos();
      toast(lines.length + ' alumno(s) agregado(s).');
    });

    $('#btn-sort-alumnos').addEventListener('click', () => {
      state.alumnos.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
      state.alumnos.forEach((a, i) => (a.numero = String(i + 1)));
      save();
      renderAlumnos();
      toast('Lista ordenada y renumerada.');
    });

    const alTable = $('#alumnos-table');
    alTable.addEventListener('input', (ev) => {
      const t = ev.target;
      if (t.dataset.al == null) return;
      state.alumnos[Number(t.dataset.al)][t.dataset.f] = t.value;
      save();
    });
    alTable.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-del-al]');
      if (!b) return;
      const a = state.alumnos[Number(b.dataset.delAl)];
      if (!confirm('¿Eliminar a «' + a.nombre + '» y sus calificaciones?')) return;
      state.alumnos.splice(Number(b.dataset.delAl), 1);
      delete state.calificaciones[a.id];
      save();
      renderAlumnos();
    });

    $('#btn-add-materia').addEventListener('click', () => {
      const nombre = $('#new-materia').value.trim();
      if (!nombre) return toast('Escriba el nombre de la materia.', true);
      const evals = $('#new-evals').value.split(',').map((s) => s.trim()).filter(Boolean);
      state.materias.push({
        id: newId('m'),
        nombre,
        evaluaciones: (evals.length ? evals : ['Calificación']).map((n) => {
          const p = Excel.splitPeso(n);
          return { id: newId('e'), nombre: p.nombre, peso: p.peso };
        }),
      });
      $('#new-materia').value = '';
      save();
      renderMaterias();
    });

    const mBox = $('#materias-editor');
    mBox.addEventListener('input', (ev) => {
      const t = ev.target;
      if (t.dataset.m == null) return;
      const m = state.materias[Number(t.dataset.m)];
      if (t.dataset.f === 'materia') m.nombre = t.value;
      else {
        const e = m.evaluaciones[Number(t.dataset.e)];
        if (t.dataset.f === 'peso') e.peso = t.value === '' ? 0 : Number(t.value);
        else e.nombre = t.value;
      }
      save();
    });
    mBox.addEventListener('click', (ev) => {
      const t = ev.target.closest('button');
      if (!t) return;
      if (t.dataset.addEval != null) {
        const m = state.materias[Number(t.dataset.addEval)];
        m.evaluaciones.push({ id: newId('e'), nombre: 'Evaluación ' + (m.evaluaciones.length + 1), peso: 1 });
      } else if (t.dataset.delEval != null) {
        const [mi, ei] = t.dataset.delEval.split(':').map(Number);
        const m = state.materias[mi];
        if (m.evaluaciones.length === 1) return toast('Una materia necesita al menos una evaluación.', true);
        if (!confirm('¿Eliminar la evaluación «' + m.evaluaciones[ei].nombre + '» y sus calificaciones?')) return;
        const [e] = m.evaluaciones.splice(ei, 1);
        Object.values(state.calificaciones).forEach((c) => delete c[e.id]);
      } else if (t.dataset.delM != null) {
        const mi = Number(t.dataset.delM);
        const m = state.materias[mi];
        if (!confirm('¿Eliminar la materia «' + m.nombre + '» y todas sus calificaciones?')) return;
        state.materias.splice(mi, 1);
        Object.values(state.calificaciones).forEach((c) => m.evaluaciones.forEach((e) => delete c[e.id]));
      } else if (t.dataset.mv != null) {
        const [mi, dir] = t.dataset.mv.split(':').map(Number);
        const j = mi + dir;
        if (j < 0 || j >= state.materias.length) return;
        [state.materias[mi], state.materias[j]] = [state.materias[j], state.materias[mi]];
      } else return;
      save();
      renderMaterias();
    });
  }

  // ---------------- Captura de calificaciones (tabla de dos niveles) ----------------

  function evalList() {
    const list = [];
    state.materias.forEach((m, mi) => m.evaluaciones.forEach((e) => list.push({ mi, e })));
    return list;
  }

  function renderGrades() {
    const table = $('#grades-table');
    if (!state.materias.length || !state.alumnos.length) {
      table.innerHTML =
        '<tbody><tr><td class="empty">Primero agregue alumnos y materias en «Configuración», o importe un archivo de Excel.</td></tr></tbody>';
      return;
    }
    let h1 = '<tr><th class="sticky c0" rowspan="2">No.</th><th class="sticky c1" rowspan="2">Nombre</th>';
    let h2 = '<tr>';
    state.materias.forEach((m) => {
      h1 += '<th class="materia-th sep-l" colspan="' + (m.evaluaciones.length + 1) + '">' + esc(m.nombre) + '</th>';
      m.evaluaciones.forEach((e, k) => {
        h2 += '<th' + (k === 0 ? ' class="sep-l"' : '') + ' title="Peso: ' + esc(e.peso) + '">' + esc(e.nombre) + '</th>';
      });
      h2 += '<th>Prom.</th>';
    });
    h1 += '<th class="general-th sep-l" colspan="4">General</th></tr>';
    h2 += '<th class="sep-l">Promedio</th><th>Puntaje T</th><th>Posición</th><th>Top %</th></tr>';

    const flat = evalList();
    let body = '';
    state.alumnos.forEach((a, r) => {
      const cal = state.calificaciones[a.id] || {};
      body += '<tr><td class="sticky c0">' + esc(a.numero) + '</td><td class="sticky c1">' + esc(a.nombre) + '</td>';
      let c = 0;
      state.materias.forEach((m, mi) => {
        m.evaluaciones.forEach((e, k) => {
          const v = cal[e.id];
          body +=
            '<td class="' + (k === 0 ? 'sep-l ' : '') + (isBad(v) ? 'bad' : '') + '"><input inputmode="decimal" data-r="' + r + '" data-c="' + c + '" value="' +
            (isNum(v) ? v : '') + '" aria-label="' + esc(a.nombre + ' – ' + m.nombre + ' – ' + e.nombre) + '"></td>';
          c += 1;
        });
        body += '<td class="calc" data-pm="' + r + ':' + mi + '"></td>';
      });
      body +=
        '<td class="calc sep-l" data-g="' + r + ':prom"></td><td class="calc" data-g="' + r + ':t"></td>' +
        '<td class="calc" data-g="' + r + ':rank"></td><td class="calc" data-g="' + r + ':top"></td></tr>';
    });
    table.innerHTML = '<thead>' + h1 + h2 + '</thead><tbody>' + body + '</tbody>';
    table.dataset.cols = flat.length;
    setHeaderOffset(table);
    updateComputed();
  }

  function setHeaderOffset(table) {
    const first = table.querySelector('thead tr:first-child th.materia-th');
    if (first) table.style.setProperty('--h1', first.offsetHeight + 'px');
  }

  function updateComputed() {
    compute();
    const table = $('#grades-table');
    results.porAlumno.forEach((pa, r) => {
      pa.materias.forEach((m, mi) => {
        const td = table.querySelector('[data-pm="' + r + ':' + mi + '"]');
        if (!td) return;
        td.textContent = fmt(m.promedio);
        td.classList.toggle('bad', isBad(m.promedio));
      });
      const set = (k, text, bad) => {
        const td = table.querySelector('[data-g="' + r + ':' + k + '"]');
        if (!td) return;
        td.textContent = text;
        td.classList.toggle('bad', !!bad);
      };
      set('prom', fmt(pa.general), isBad(pa.general));
      set('t', fmt(pa.tscore, 1));
      set('rank', pa.rank == null ? '—' : pa.rank + ' / ' + results.general.n);
      set('top', pa.top == null ? '—' : fmt(pa.top, 1) + '%');
    });
  }

  function setGrade(r, c, raw) {
    const flat = evalList();
    const a = state.alumnos[r];
    const item = flat[c];
    if (!a || !item) return null;
    const cal = state.calificaciones[a.id] || (state.calificaciones[a.id] = {});
    const n = Excel.parseNumber(raw);
    const max = Number(state.config.escalaMax) || 10;
    let status = 'ok';
    if (String(raw).trim() === '') delete cal[item.e.id];
    else if (n === null || n < 0 || n > max) {
      delete cal[item.e.id];
      status = 'err';
    } else cal[item.e.id] = n;
    return status;
  }

  function styleInput(inp, status) {
    const td = inp.parentElement;
    td.classList.toggle('err', status === 'err');
    const n = Excel.parseNumber(inp.value);
    td.classList.toggle('bad', status !== 'err' && isBad(n));
  }

  let computeTimer = null;
  function scheduleCompute() {
    clearTimeout(computeTimer);
    computeTimer = setTimeout(updateComputed, 120);
  }

  function focusCell(r, c) {
    const inp = document.querySelector('#grades-table input[data-r="' + r + '"][data-c="' + c + '"]');
    if (inp) {
      inp.focus();
      inp.select();
    }
  }

  function bindGrades() {
    const table = $('#grades-table');
    table.addEventListener('input', (ev) => {
      const t = ev.target;
      if (t.dataset.r == null) return;
      const status = setGrade(Number(t.dataset.r), Number(t.dataset.c), t.value);
      styleInput(t, status);
      if (status === 'err') toast('Calificación fuera de rango (0 a ' + state.config.escalaMax + ').', true);
      save();
      scheduleCompute();
    });
    table.addEventListener('keydown', (ev) => {
      const t = ev.target;
      if (t.dataset.r == null) return;
      const r = Number(t.dataset.r);
      const c = Number(t.dataset.c);
      const moves = { Enter: [ev.shiftKey ? -1 : 1, 0], ArrowDown: [1, 0], ArrowUp: [-1, 0] };
      if (moves[ev.key]) {
        ev.preventDefault();
        focusCell(r + moves[ev.key][0], c + moves[ev.key][1]);
      } else if (ev.key === 'ArrowRight' && t.selectionStart === t.value.length) {
        ev.preventDefault();
        focusCell(r, c + 1);
      } else if (ev.key === 'ArrowLeft' && t.selectionStart === 0) {
        ev.preventDefault();
        focusCell(r, c - 1);
      }
    });
    // Pegar un bloque copiado de Excel / Google Sheets.
    table.addEventListener('paste', (ev) => {
      const t = ev.target;
      if (t.dataset.r == null) return;
      const text = (ev.clipboardData || window.clipboardData).getData('text');
      if (!/[\t\n]/.test(text.trim())) return;
      ev.preventDefault();
      const rows = text.replace(/\r/g, '').replace(/\n$/, '').split('\n').map((l) => l.split('\t'));
      const r0 = Number(t.dataset.r);
      const c0 = Number(t.dataset.c);
      const cols = Number(table.dataset.cols);
      let n = 0;
      let errs = 0;
      rows.forEach((row, i) =>
        row.forEach((val, j) => {
          const r = r0 + i;
          const c = c0 + j;
          if (r >= state.alumnos.length || c >= cols) return;
          const st = setGrade(r, c, val);
          const inp = table.querySelector('input[data-r="' + r + '"][data-c="' + c + '"]');
          if (inp) {
            inp.value = val.trim();
            styleInput(inp, st);
          }
          n += 1;
          if (st === 'err') errs += 1;
        })
      );
      save();
      updateComputed();
      toast(n + ' celda(s) pegada(s)' + (errs ? ' · ' + errs + ' fuera de rango' : '') + '.', errs > 0);
    });
    window.addEventListener('resize', () => setHeaderOffset(table));
  }

  // ---------------- Resultados ----------------

  function renderResults() {
    const scopeSel = $('#results-scope');
    const prev = scopeSel.value || 'general';
    scopeSel.innerHTML =
      '<option value="general">Promedio general</option>' +
      state.materias.map((m, i) => '<option value="' + i + '">' + esc(m.nombre) + '</option>').join('');
    scopeSel.value = [...scopeSel.options].some((o) => o.value === prev) ? prev : 'general';

    const g = results.general;
    const reprob = results.porAlumno.filter((pa) => pa.reprobadas > 0).length;
    $('#kpis').innerHTML = [
      ['Alumnos', state.alumnos.length],
      ['Promedio del grupo', fmt(g.mean)],
      ['Desviación estándar', fmt(g.sd, 2)],
      ['Máximo / Mínimo', fmt(g.max) + ' / ' + fmt(g.min)],
      ['Mediana', fmt(g.median)],
      ['Alumnos con reprobadas', reprob],
    ]
      .map((k) => '<div class="kpi"><div class="l">' + k[0] + '</div><div class="v">' + k[1] + '</div></div>')
      .join('');

    renderResultsTable();
    renderStatsTable();
  }

  function tBar(t) {
    if (!isNum(t)) return '';
    const pos = Math.min(100, Math.max(0, ((t - 20) / 60) * 100));
    return '<div class="tbar"><div class="mid"></div><div class="dot" style="left:' + pos.toFixed(1) + '%"></div></div>';
  }

  function renderResultsTable() {
    const table = $('#results-table');
    if (!state.alumnos.length) {
      table.innerHTML = '<tbody><tr><td class="empty">No hay datos.</td></tr></tbody>';
      return;
    }
    const scope = $('#results-scope').value;
    const n = scope === 'general' ? results.general.n : results.perMateria[Number(scope)].stats.n;
    const cols = [
      { key: 'rank', label: 'Posición' },
      { key: 'numero', label: 'No.', cls: 'sticky c0' },
      { key: 'nombre', label: 'Nombre', cls: 'sticky c1' },
    ];
    let rows;
    if (scope === 'general') {
      cols.push(
        { key: 'prom', label: 'Promedio' },
        { key: 't', label: 'Puntaje T', cls: 'tcell' },
        { key: 'top', label: 'Top %' },
        { key: 'rep', label: 'Reprobadas' }
      );
      state.materias.forEach((m, i) => cols.push({ key: 'm' + i, label: m.nombre }));
      rows = results.porAlumno.map((pa) => {
        const row = {
          rank: pa.rank,
          numero: pa.alumno.numero,
          nombre: pa.alumno.nombre,
          prom: pa.general,
          t: pa.tscore,
          top: pa.top,
          rep: pa.reprobadas,
        };
        pa.materias.forEach((m, i) => (row['m' + i] = m.promedio));
        return row;
      });
    } else {
      const mi = Number(scope);
      const mat = state.materias[mi];
      mat.evaluaciones.forEach((e, k) => cols.push({ key: 'e' + k, label: e.nombre }));
      cols.push(
        { key: 'prom', label: 'Promedio' },
        { key: 't', label: 'Puntaje T', cls: 'tcell' },
        { key: 'top', label: 'Top %' }
      );
      rows = results.porAlumno.map((pa) => {
        const m = pa.materias[mi];
        const cal = state.calificaciones[pa.alumno.id] || {};
        const row = {
          rank: m.rank,
          numero: pa.alumno.numero,
          nombre: pa.alumno.nombre,
          prom: m.promedio,
          t: m.tscore,
          top: m.top,
        };
        mat.evaluaciones.forEach((e, k) => (row['e' + k] = cal[e.id]));
        return row;
      });
    }

    const { key, dir } = sortState;
    const valid = cols.some((c) => c.key === key);
    const k = valid ? key : 'rank';
    rows.sort((a, b) => {
      const x = a[k];
      const y = b[k];
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      if (k === 'numero') return (Number(x) - Number(y) || String(x).localeCompare(String(y))) * dir;
      if (typeof x === 'string') return x.localeCompare(y, 'es') * dir;
      return (x - y) * dir;
    });

    const cell = (c, row) => {
      const v = row[c.key];
      switch (c.key) {
        case 'rank':
          return v == null ? '—' : v + ' / ' + n;
        case 'numero':
        case 'nombre':
          return esc(v);
        case 't':
          return fmt(v, 1) + tBar(v);
        case 'top':
          return v == null ? '—' : fmt(v, 1) + '%';
        case 'rep':
          return v;
        default:
          return fmt(v);
      }
    };
    const badKey = (c) => c.key === 'prom' || /^[me]\d+$/.test(c.key);

    let html = '<thead><tr>';
    cols.forEach((c) => {
      const cls = [c.cls || ''];
      if (c.key === k) cls.push('sorted', dir > 0 ? 'asc' : '');
      html += '<th data-sort="' + c.key + '" class="' + cls.join(' ').trim() + '">' + esc(c.label) + '</th>';
    });
    html += '</tr></thead><tbody>';
    rows.forEach((row) => {
      html += '<tr' + (row.rank != null && row.rank <= 3 ? ' class="top3"' : '') + '>';
      cols.forEach((c) => {
        const cls = [c.cls || '', badKey(c) && isBad(row[c.key]) ? 'bad' : ''].join(' ').trim();
        html += '<td' + (cls ? ' class="' + cls + '"' : '') + '>' + cell(c, row) + '</td>';
      });
      html += '</tr>';
    });
    table.innerHTML = html + '</tbody>';
  }

  function renderStatsTable() {
    const table = $('#stats-table');
    if (!state.materias.length) {
      table.innerHTML = '<tbody><tr><td class="empty">No hay materias.</td></tr></tbody>';
      return;
    }
    let html =
      '<thead><tr><th class="sticky c1" style="left:0">Materia</th><th>Evaluados</th><th>Media</th><th>Desv. est.</th>' +
      '<th>Mín.</th><th>Máx.</th><th>Mediana</th><th>Reprobados</th></tr></thead><tbody>';
    results.perMateria.forEach((pm) => {
      const s = pm.stats;
      html +=
        '<tr><td class="sticky c1" style="left:0">' + esc(pm.materia.nombre) + '</td><td>' + s.n + '</td><td>' + fmt(s.mean) +
        '</td><td>' + fmt(s.sd, 2) + '</td><td>' + fmt(s.min) + '</td><td>' + fmt(s.max) + '</td><td>' + fmt(s.median) +
        '</td><td' + (pm.reprobados ? ' class="bad"' : '') + '>' + pm.reprobados + '</td></tr>';
    });
    table.innerHTML = html + '</tbody>';
  }

  function bindResults() {
    $('#results-scope').addEventListener('change', () => {
      sortState.key = 'rank';
      sortState.dir = 1;
      renderResultsTable();
    });
    $('#results-table').addEventListener('click', (ev) => {
      const th = ev.target.closest('th[data-sort]');
      if (!th) return;
      const key = th.dataset.sort;
      if (sortState.key === key) sortState.dir *= -1;
      else {
        sortState.key = key;
        // Posición, No. y Nombre ascendente; calificaciones descendente.
        sortState.dir = ['rank', 'numero', 'nombre', 'top'].includes(key) ? 1 : -1;
      }
      renderResultsTable();
    });
  }

  // ---------------- Reportes ----------------

  function renderReport() {
    const sel = $('#report-mode');
    const prev = sel.value || 'grupo';
    sel.innerHTML =
      '<option value="grupo">Reporte del grupo (ranking y estadísticas)</option>' +
      '<option value="boletas">Boletas de todos los alumnos</option>' +
      '<option value="completo">Reporte completo (grupo + boletas)</option>' +
      '<optgroup label="Boleta individual">' +
      state.alumnos.map((a) => '<option value="alumno:' + esc(a.id) + '">' + esc(a.numero + '. ' + a.nombre) + '</option>').join('') +
      '</optgroup>';
    sel.value = [...sel.options].some((o) => o.value === prev) ? prev : 'grupo';
    $('#report-frame').srcdoc = Report.generate(state, results, sel.value);
  }

  function bindReport() {
    $('#report-mode').addEventListener('change', () => {
      $('#report-frame').srcdoc = Report.generate(state, compute(), $('#report-mode').value);
    });
    $('#btn-print').addEventListener('click', () => {
      const w = $('#report-frame').contentWindow;
      w.focus();
      w.print();
    });
    $('#btn-download-html').addEventListener('click', () => {
      const mode = $('#report-mode').value;
      const html = Report.generate(state, compute(), mode);
      const suffix = mode.indexOf('alumno:') === 0
        ? 'boleta_' + slug((state.alumnos.find((a) => 'alumno:' + a.id === mode) || {}).nombre)
        : mode;
      downloadBlob(html, fileBase() + '_' + suffix + '.html', 'text/html;charset=utf-8');
    });
  }

  // ---------------- Barra de herramientas: importar / exportar ----------------

  function bindToolbar() {
    document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));

    $('#file-import').addEventListener('change', async (ev) => {
      const file = ev.target.files[0];
      ev.target.value = '';
      if (!file) return;
      try {
        const data = await Excel.readFile(file);
        const hasData = state.alumnos.length || state.materias.length;
        if (hasData && !confirm(
          'Se encontraron ' + data.alumnos.length + ' alumnos y ' + data.materias.length +
          ' materias.\n¿Reemplazar los alumnos, materias y calificaciones actuales? (Los datos del grupo se conservan.)'
        )) return;
        state.materias = data.materias;
        state.alumnos = data.alumnos;
        state.calificaciones = data.calificaciones;
        save();
        toast('Importado: ' + data.alumnos.length + ' alumnos, ' + data.materias.length + ' materias.');
        showTab('grades');
      } catch (err) {
        toast('Error al importar: ' + err.message, true);
      }
    });

    $('#btn-export-xlsx').addEventListener('click', () => {
      if (!state.alumnos.length) return toast('No hay datos para exportar.', true);
      Excel.downloadWorkbook(Excel.buildSheets(state, compute(), { decimals: 2 }), fileBase() + '.xlsx', 'xlsx');
    });
    $('#btn-export-csv').addEventListener('click', () => {
      if (!state.alumnos.length) return toast('No hay datos para exportar.', true);
      Excel.downloadWorkbook(Excel.buildSheets(state, compute(), { decimals: 2 }), fileBase() + '.csv', 'csv');
    });
    $('#btn-template').addEventListener('click', () => {
      const tpl = state.materias.length
        ? { materias: state.materias, alumnos: state.alumnos.length ? state.alumnos : [{ id: 'x', numero: '1', nombre: '' }], calificaciones: {} }
        : {
            materias: ['Español', 'Matemáticas', 'Ciencias'].map((n, i) => ({
              id: 'm' + i,
              nombre: n,
              evaluaciones: ['Trimestre 1', 'Trimestre 2', 'Trimestre 3'].map((e, k) => ({ id: 'm' + i + 'e' + k, nombre: e, peso: 1 })),
            })),
            alumnos: [{ id: 'x1', numero: '1', nombre: 'Apellido Apellido Nombre' }],
            calificaciones: {},
          };
      Excel.downloadWorkbook(Excel.buildSheets(tpl, null, { withResults: false }), 'plantilla_calificaciones.xlsx', 'xlsx');
    });

    $('#btn-backup').addEventListener('click', () => {
      downloadBlob(JSON.stringify(state, null, 2), fileBase() + '_respaldo.json', 'application/json');
    });
    $('#file-backup').addEventListener('change', (ev) => {
      const file = ev.target.files[0];
      ev.target.value = '';
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = normalize(JSON.parse(reader.result));
          if (!confirm('¿Reemplazar todos los datos actuales con el respaldo?')) return;
          state = data;
          save();
          toast('Respaldo restaurado.');
          renderActive();
        } catch (e) {
          toast('El archivo de respaldo no es válido.', true);
        }
      };
      reader.readAsText(file);
    });

    $('#btn-sample').addEventListener('click', () => {
      if ((state.alumnos.length || state.materias.length) && !confirm('¿Reemplazar los datos actuales con datos de ejemplo?')) return;
      state = normalize(Sample.make());
      save();
      toast('Datos de ejemplo cargados.');
      showTab('grades');
    });
    $('#btn-reset').addEventListener('click', () => {
      if (!confirm('¿Borrar TODOS los datos? Se recomienda descargar un respaldo antes.')) return;
      state = emptyState();
      save();
      renderActive();
    });
  }

  // ---------------- Inicio ----------------

  bindToolbar();
  bindOverview();
  bindConfig();
  bindGrades();
  bindResults();
  bindReport();
  showTab(state.alumnos.length && state.materias.length ? 'overview' : 'config');
})();
