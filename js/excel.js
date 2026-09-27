/*
 * Importación y exportación de Excel / Google Sheets / CSV.
 *
 * Formato de la hoja "Calificaciones" (encabezado de dos niveles):
 *
 *   | No. | Nombre      | Matemáticas                  | Español  ...
 *   |     |             | Parcial 1 | Parcial 2 | Prom. | Parcial 1 ...
 *   | 1   | Ana López   | 9         | 8.5       | 8.8   | 10 ...
 *
 * - Las celdas combinadas del primer nivel se leen correctamente.
 * - Las columnas calculadas (Promedio, Puntaje T, Posición, Top %) se ignoran al importar.
 * - Un peso puede indicarse en el nombre de la evaluación: "Examen (40%)".
 * - También se acepta un encabezado de un solo nivel (una columna por materia).
 *
 * parseGrid/buildSheets son funciones puras (probadas con Node);
 * readFile/downloadWorkbook usan la biblioteca SheetJS (window.XLSX).
 */
(function (root) {
  'use strict';

  const Stats = root.Stats || (typeof require !== 'undefined' ? require('./stats.js') : null);

  function norm(v) {
    return String(v == null ? '' : v)
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .trim()
      .toLowerCase();
  }

  const RE_NOMBRE = /^(nombre|alumno|alumna|estudiante|nombre del alumno|nombre completo)/;
  const RE_NUMERO = /^(no\.?|num\.?|numero|n°|#|lista|no\. lista|no de lista)$/;
  // Columnas calculadas que no se importan.
  const RE_CALC = /^(prom\.?|promedio.*|general|puntaje t|puntaje|t|posicion|lugar|ranking|top.*|% superior|percentil|reprobadas|materias reprobadas|desv.*)$/;
  // Grupo de datos adicionales (campos personalizados, no cuentan en el promedio).
  const RE_EXTRA = /^(otros datos|datos adicionales|datos extra|otros)$/;
  const RE_PESO = /\s*\((\d+(?:[.,]\d+)?)\s*%\)\s*$/;

  let idCounter = 0;
  function newId(prefix) {
    idCounter += 1;
    return prefix + Date.now().toString(36) + '_' + idCounter.toString(36);
  }

  function parseNumber(v) {
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    const s = String(v == null ? '' : v).trim().replace(',', '.');
    if (s === '' || s === '-') return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  function splitPeso(label) {
    const s = String(label).trim();
    const m = s.match(RE_PESO);
    if (!m) return { nombre: s, peso: 1 };
    return { nombre: s.replace(RE_PESO, '').trim(), peso: Number(m[1].replace(',', '.')) };
  }

  function isEmpty(v) {
    return v == null || String(v).trim() === '';
  }

  /*
   * Convierte una matriz (arreglo de filas) en materias, alumnos y calificaciones.
   */
  function parseGrid(grid) {
    const rows = (grid || []).map((r) => (Array.isArray(r) ? r : []));
    let h = -1;
    let nameCol = -1;
    for (let r = 0; r < rows.length && h < 0; r++) {
      for (let c = 0; c < rows[r].length; c++) {
        if (RE_NOMBRE.test(norm(rows[r][c]))) {
          h = r;
          nameCol = c;
          break;
        }
      }
    }
    if (h < 0) {
      throw new Error('No se encontró la columna "Nombre" en la hoja. Revise el formato.');
    }
    const top = rows[h];
    const width = Math.max(...rows.map((r) => r.length), 0);
    let numCol = -1;
    for (let c = 0; c < top.length; c++) {
      if (c !== nameCol && RE_NUMERO.test(norm(top[c]))) {
        numCol = c;
        break;
      }
    }

    // ¿Encabezado de dos niveles?
    const sub = rows[h + 1] || [];
    let twoLevel = false;
    if (isEmpty(sub[nameCol])) {
      for (let c = 0; c < width; c++) {
        if (c === nameCol || c === numCol) continue;
        if (!isEmpty(sub[c]) && parseNumber(sub[c]) === null) {
          twoLevel = true;
          break;
        }
      }
    }

    const materias = [];
    const colMap = []; // { col, evalId } o { col, campoId }
    const campos = [];
    const EXTRA = {};
    if (twoLevel) {
      let current = null; // materia actual (o null si se debe ignorar)
      let currentLabel = null;
      for (let c = 0; c < width; c++) {
        if (c === nameCol || c === numCol) {
          current = null;
          currentLabel = null;
          continue;
        }
        const t = top[c];
        if (!isEmpty(t)) {
          currentLabel = String(t).trim();
          if (RE_EXTRA.test(norm(currentLabel))) {
            current = EXTRA;
          } else if (RE_CALC.test(norm(currentLabel))) {
            current = null;
          } else {
            current = { id: newId('m'), nombre: currentLabel, evaluaciones: [] };
            materias.push(current);
          }
        }
        if (!current) continue;
        const s = sub[c];
        if (current === EXTRA) {
          if (!isEmpty(s)) {
            const cp = { id: newId('c'), nombre: String(s).trim(), tipo: 'texto', opciones: [] };
            campos.push(cp);
            colMap.push({ col: c, campoId: cp.id });
          }
          continue;
        }
        if (isEmpty(s)) {
          // Materia sin subcolumnas: una sola evaluación.
          if (!isEmpty(t)) {
            const e = { id: newId('e'), nombre: 'Calificación', peso: 1 };
            current.evaluaciones.push(e);
            colMap.push({ col: c, evalId: e.id });
          }
          continue;
        }
        if (RE_CALC.test(norm(s))) continue;
        const { nombre, peso } = splitPeso(s);
        const e = { id: newId('e'), nombre, peso };
        current.evaluaciones.push(e);
        colMap.push({ col: c, evalId: e.id });
      }
    } else {
      for (let c = 0; c < width; c++) {
        if (c === nameCol || c === numCol) continue;
        const t = top[c];
        if (isEmpty(t) || RE_CALC.test(norm(t))) continue;
        const e = { id: newId('e'), nombre: 'Calificación', peso: 1 };
        materias.push({ id: newId('m'), nombre: String(t).trim(), evaluaciones: [e] });
        colMap.push({ col: c, evalId: e.id });
      }
    }

    const cleanMaterias = materias.filter((m) => m.evaluaciones.length > 0);
    if (cleanMaterias.length === 0) {
      throw new Error('No se encontraron columnas de materias/evaluaciones.');
    }

    const alumnos = [];
    const calificaciones = {};
    const extras = {};
    const start = h + (twoLevel ? 2 : 1);
    for (let r = start; r < rows.length; r++) {
      const row = rows[r];
      const nombre = String(row[nameCol] == null ? '' : row[nameCol]).trim();
      if (!nombre) continue;
      const a = {
        id: newId('a'),
        numero: numCol >= 0 && !isEmpty(row[numCol]) ? String(row[numCol]).trim() : String(alumnos.length + 1),
        nombre,
      };
      alumnos.push(a);
      const cal = {};
      const ex = {};
      colMap.forEach(({ col, evalId, campoId }) => {
        if (campoId) {
          if (!isEmpty(row[col])) ex[campoId] = typeof row[col] === 'number' ? row[col] : String(row[col]).trim();
          return;
        }
        const n = parseNumber(row[col]);
        if (n !== null) cal[evalId] = n;
      });
      calificaciones[a.id] = cal;
      extras[a.id] = ex;
    }

    // Un dato adicional cuyos valores son todos números se toma como numérico.
    campos.forEach((cp) => {
      const vals = alumnos.map((a) => extras[a.id][cp.id]).filter((v) => v != null);
      if (vals.length && vals.every((v) => parseNumber(v) !== null)) {
        cp.tipo = 'numero';
        alumnos.forEach((a) => {
          if (extras[a.id][cp.id] != null) extras[a.id][cp.id] = parseNumber(extras[a.id][cp.id]);
        });
      }
    });

    return { materias: cleanMaterias, alumnos, calificaciones, campos, extras, twoLevel };
  }

  function round(v, d) {
    if (!Stats.isNum(v)) return '';
    const f = Math.pow(10, d == null ? 2 : d);
    return Math.round(v * f) / f;
  }

  function evalLabel(m, e) {
    const pesos = m.evaluaciones.map((x) => (Stats.isNum(x.peso) ? x.peso : 1));
    const allEqual = pesos.every((p) => p === pesos[0]);
    if (allEqual) return e.nombre;
    const total = pesos.reduce((a, b) => a + b, 0) || 1;
    const pct = Math.round(((Stats.isNum(e.peso) ? e.peso : 1) / total) * 1000) / 10;
    return e.nombre + ' (' + pct + '%)';
  }

  /*
   * Construye las hojas para exportar. Devuelve [{name, aoa, merges, cols}].
   */
  function buildSheets(state, results, opts) {
    const o = Object.assign({ withResults: true, decimals: 2 }, opts || {});
    const d = o.decimals;
    const sheets = [];
    const campos = state.campos || [];
    const extraVals = (a) => campos.map((cp) => {
      const v = ((state.extras || {})[a.id] || {})[cp.id];
      return v == null ? '' : v;
    });

    // --- Hoja 1: Calificaciones (dos niveles) ---
    const top = ['No.', 'Nombre'];
    const sub = ['', ''];
    const merges = [
      { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } },
      { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } },
    ];
    state.materias.forEach((m) => {
      const start = top.length;
      m.evaluaciones.forEach((e, i) => {
        top.push(i === 0 ? m.nombre : '');
        sub.push(evalLabel(m, e));
      });
      if (o.withResults) {
        top.push(m.evaluaciones.length === 0 ? m.nombre : '');
        sub.push('Promedio');
      }
      const end = top.length - 1;
      if (end > start) merges.push({ s: { r: 0, c: start }, e: { r: 0, c: end } });
    });
    if (o.withResults) {
      const start = top.length;
      top.push('General', '', '', '');
      sub.push('Promedio', 'Puntaje T', 'Posición', 'Top %');
      merges.push({ s: { r: 0, c: start }, e: { r: 0, c: start + 3 } });
    }
    if (campos.length) {
      const start = top.length;
      campos.forEach((cp, i) => {
        top.push(i === 0 ? 'Otros datos' : '');
        sub.push(cp.nombre);
      });
      if (campos.length > 1) merges.push({ s: { r: 0, c: start }, e: { r: 0, c: start + campos.length - 1 } });
    }
    const aoa = [top, sub];
    state.alumnos.forEach((a, i) => {
      const row = [a.numero, a.nombre];
      const cal = state.calificaciones[a.id] || {};
      const pa = results && results.porAlumno[i];
      state.materias.forEach((m, mi) => {
        m.evaluaciones.forEach((e) => {
          row.push(Stats.isNum(cal[e.id]) ? cal[e.id] : '');
        });
        if (o.withResults) row.push(round(pa.materias[mi].promedio, d));
      });
      if (o.withResults) {
        row.push(
          round(pa.general, d),
          round(pa.tscore, 1),
          pa.rank == null ? '' : pa.rank,
          pa.top == null ? '' : round(pa.top, 1)
        );
      }
      row.push(...extraVals(a));
      aoa.push(row);
    });
    sheets.push({
      name: 'Calificaciones',
      aoa,
      merges,
      cols: top.map((_, c) => ({ wch: c === 1 ? 32 : c === 0 ? 5 : 11 })),
    });

    if (!o.withResults || !results) return sheets;

    // --- Hoja 2: Tabla completa (toda la información en una hoja) ---
    {
      const fTop = ['No.', 'Nombre'];
      const fSub = ['', ''];
      const fMerges = [
        { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } },
        { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } },
      ];
      const addGroup = (name, labels) => {
        const start = fTop.length;
        labels.forEach((l, i) => {
          fTop.push(i === 0 ? name : '');
          fSub.push(l);
        });
        if (labels.length > 1) fMerges.push({ s: { r: 0, c: start }, e: { r: 0, c: start + labels.length - 1 } });
      };
      state.materias.forEach((m) =>
        addGroup(m.nombre, m.evaluaciones.map((e) => evalLabel(m, e)).concat(['Promedio', 'Puntaje T', 'Posición', 'Top %']))
      );
      addGroup('General', ['Promedio', 'Puntaje T', 'Posición', 'Top %', 'Materias reprobadas']);
      if (campos.length) addGroup('Otros datos', campos.map((cp) => cp.nombre));
      const fRows = results.porAlumno.map((pa) => {
        const cal = state.calificaciones[pa.alumno.id] || {};
        const row = [pa.alumno.numero, pa.alumno.nombre];
        state.materias.forEach((m, mi) => {
          m.evaluaciones.forEach((e) => row.push(Stats.isNum(cal[e.id]) ? cal[e.id] : ''));
          const pm = pa.materias[mi];
          row.push(round(pm.promedio, d), round(pm.tscore, 1), pm.rank == null ? '' : pm.rank, pm.top == null ? '' : round(pm.top, 1));
        });
        row.push(round(pa.general, d), round(pa.tscore, 1), pa.rank == null ? '' : pa.rank, pa.top == null ? '' : round(pa.top, 1), pa.reprobadas);
        row.push(...extraVals(pa.alumno));
        return row;
      });
      sheets.push({
        name: 'Tabla completa',
        aoa: [fTop, fSub].concat(fRows),
        merges: fMerges,
        cols: fTop.map((_, c) => ({ wch: c === 1 ? 32 : c === 0 ? 5 : 10 })),
      });
    }

    // --- Hoja 3: Resultados (ranking) ---
    const rHead = ['Posición', 'No.', 'Nombre', 'Promedio general', 'Puntaje T', 'Top %', 'Materias reprobadas'];
    state.materias.forEach((m) => {
      rHead.push(m.nombre + ' – Prom.', m.nombre + ' – T', m.nombre + ' – Posición');
    });
    const ordered = results.porAlumno.slice().sort((x, y) => {
      if (x.rank == null && y.rank == null) return 0;
      if (x.rank == null) return 1;
      if (y.rank == null) return -1;
      return x.rank - y.rank;
    });
    const rRows = ordered.map((pa) => {
      const row = [
        pa.rank == null ? '' : pa.rank,
        pa.alumno.numero,
        pa.alumno.nombre,
        round(pa.general, d),
        round(pa.tscore, 1),
        pa.top == null ? '' : round(pa.top, 1),
        pa.reprobadas,
      ];
      pa.materias.forEach((pm) => {
        row.push(round(pm.promedio, d), round(pm.tscore, 1), pm.rank == null ? '' : pm.rank);
      });
      return row;
    });
    sheets.push({
      name: 'Resultados',
      aoa: [rHead].concat(rRows),
      merges: [],
      cols: rHead.map((_, c) => ({ wch: c === 2 ? 32 : 12 })),
    });

    // --- Hoja 4: Estadísticas por materia ---
    const sHead = ['Materia', 'Alumnos evaluados', 'Media', 'Desv. estándar', 'Mínimo', 'Máximo', 'Mediana', 'Reprobados'];
    const sRows = results.perMateria.map((pm) => [
      pm.materia.nombre,
      pm.stats.n,
      round(pm.stats.mean, d),
      round(pm.stats.sd, d),
      round(pm.stats.min, d),
      round(pm.stats.max, d),
      round(pm.stats.median, d),
      pm.reprobados,
    ]);
    const g = results.general;
    sRows.push([
      'PROMEDIO GENERAL',
      g.n,
      round(g.mean, d),
      round(g.sd, d),
      round(g.min, d),
      round(g.max, d),
      round(g.median, d),
      results.porAlumno.filter((pa) => pa.reprobadas > 0).length,
    ]);
    sheets.push({
      name: 'Estadísticas',
      aoa: [sHead].concat(sRows),
      merges: [],
      cols: sHead.map((_, c) => ({ wch: c === 0 ? 24 : 14 })),
    });

    return sheets;
  }

  // ---------- Funciones que dependen de SheetJS (navegador) ----------

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const XLSX = root.XLSX;
      if (!XLSX) return reject(new Error('No se cargó la biblioteca de Excel.'));
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
      reader.onload = (ev) => {
        try {
          const wb = XLSX.read(new Uint8Array(ev.target.result), { type: 'array' });
          const name =
            wb.SheetNames.find((n) => norm(n) === 'calificaciones') || wb.SheetNames[0];
          const grid = XLSX.utils.sheet_to_json(wb.Sheets[name], {
            header: 1,
            defval: '',
            raw: true,
            blankrows: false,
          });
          resolve(parseGrid(grid));
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  function toWorkbook(sheets) {
    const XLSX = root.XLSX;
    const wb = XLSX.utils.book_new();
    sheets.forEach((s) => {
      const ws = XLSX.utils.aoa_to_sheet(s.aoa);
      if (s.merges && s.merges.length) ws['!merges'] = s.merges;
      if (s.cols) ws['!cols'] = s.cols;
      XLSX.utils.book_append_sheet(wb, ws, s.name);
    });
    return wb;
  }

  function downloadWorkbook(sheets, filename, bookType) {
    const XLSX = root.XLSX;
    if (!XLSX) throw new Error('No se cargó la biblioteca de Excel.');
    const wb = toWorkbook(bookType === 'csv' ? sheets.slice(0, 1) : sheets);
    XLSX.writeFile(wb, filename, { bookType: bookType || 'xlsx' });
  }

  const Excel = { parseGrid, buildSheets, readFile, downloadWorkbook, parseNumber, splitPeso };
  if (typeof module !== 'undefined' && module.exports) module.exports = Excel;
  else root.Excel = Excel;
})(typeof window !== 'undefined' ? window : globalThis);
