/*
 * Grados (1°, 2°, 3° …) y grupos (A, B, C …).
 *
 * Cada alumno tiene `grado` y `grupo`. La «vista» (scope) decide qué alumnos
 * se muestran y contra quién se calculan el puntaje T, la posición y el Top %:
 *   'all'                → toda la escuela
 *   'g:<grado>'          → todos los grupos de un grado
 *   'c:<grado>|<grupo>'  → un solo grupo
 * Una materia puede limitarse a ciertos grados (materia.grados = ['2°', '3°']).
 */
(function (root) {
  'use strict';

  // Clave normalizada del grado: "2°", "2", "2do", " 2 º" → "2".
  function gradoKey(g) {
    const s = String(g == null ? '' : g).trim();
    const m = s.match(/\d+/);
    if (m) return String(Number(m[0]));
    return s.toLowerCase();
  }

  function grupoKey(g) {
    return String(g == null ? '' : g).trim().toUpperCase();
  }

  function claseKey(a) {
    return gradoKey(a.grado) + '|' + grupoKey(a.grupo);
  }

  function gradoLabel(g) {
    const s = String(g == null ? '' : g).trim();
    if (!s) return '';
    return /^\d+$/.test(s) ? s + '°' : s;
  }

  function claseLabel(a) {
    const t = [gradoLabel(a.grado), grupoKey(a.grupo)].filter(Boolean).join(' ');
    return t || 'Sin grupo';
  }

  function cmpGrado(a, b) {
    const x = gradoKey(a);
    const y = gradoKey(b);
    const nx = /^\d+$/.test(x);
    const ny = /^\d+$/.test(y);
    if (nx && ny) return Number(x) - Number(y);
    if (nx !== ny) return nx ? -1 : 1;
    return x.localeCompare(y, 'es');
  }

  /*
   * Lista de grados con sus grupos: [{key, label, n, grupos:[{key, label, n}]}]
   */
  function listClases(alumnos) {
    const grados = new Map();
    (alumnos || []).forEach((a) => {
      const gk = gradoKey(a.grado);
      if (!grados.has(gk)) grados.set(gk, { key: gk, label: gradoLabel(a.grado) || 'Sin grado', n: 0, grupos: new Map() });
      const g = grados.get(gk);
      g.n += 1;
      const ck = claseKey(a);
      if (!g.grupos.has(ck)) g.grupos.set(ck, { key: ck, label: claseLabel(a), grupo: grupoKey(a.grupo), n: 0 });
      g.grupos.get(ck).n += 1;
    });
    return [...grados.values()]
      .sort((a, b) => cmpGrado(a.key, b.key))
      .map((g) => ({
        key: g.key,
        label: g.label,
        n: g.n,
        grupos: [...g.grupos.values()].sort((a, b) => a.grupo.localeCompare(b.grupo, 'es')),
      }));
  }

  function inScope(a, scope) {
    if (!scope || scope === 'all') return true;
    if (scope.indexOf('g:') === 0) return gradoKey(a.grado) === scope.slice(2);
    if (scope.indexOf('c:') === 0) return claseKey(a) === scope.slice(2);
    return true;
  }

  function materiaAplica(m, grado) {
    const gs = (m && m.grados) || [];
    if (!gs.length) return true;
    const k = gradoKey(grado);
    return gs.some((g) => gradoKey(g) === k);
  }

  function scopeValid(scope, alumnos) {
    if (!scope || scope === 'all') return true;
    return (alumnos || []).some((a) => inScope(a, scope));
  }

  function scopeLabel(scope, alumnos) {
    if (!scope || scope === 'all') return 'Toda la escuela';
    const a = (alumnos || []).find((x) => inScope(x, scope));
    if (!a) return 'Toda la escuela';
    if (scope.indexOf('g:') === 0) return (gradoLabel(a.grado) || 'Sin grado') + ' (todos los grupos)';
    return claseLabel(a);
  }

  function ordenAlumnos(list) {
    return list
      .map((a, i) => ({ a, i }))
      .sort((x, y) => {
        const g = cmpGrado(x.a.grado, y.a.grado);
        if (g) return g;
        const c = grupoKey(x.a.grupo).localeCompare(grupoKey(y.a.grupo), 'es');
        if (c) return c;
        const nx = Number(x.a.numero);
        const ny = Number(y.a.numero);
        if (Number.isFinite(nx) && Number.isFinite(ny) && nx !== ny) return nx - ny;
        return x.i - y.i;
      })
      .map((x) => x.a);
  }

  /*
   * Estado reducido a la vista: sólo los alumnos del alcance (ordenados por
   * grado, grupo y número de lista) y las materias que aplican a esos grados.
   */
  function buildView(state, scope) {
    const alumnos = ordenAlumnos((state.alumnos || []).filter((a) => inScope(a, scope)));
    const grados = new Set(alumnos.map((a) => a.grado));
    const materias = (state.materias || []).filter(
      (m) => !(m.grados || []).length || [...grados].some((g) => materiaAplica(m, g)) || alumnos.length === 0
    );
    const clases = listClases(alumnos);
    const nClases = clases.reduce((s, g) => s + g.grupos.length, 0);
    return Object.assign({}, state, {
      alumnos,
      materias,
      scope: scope || 'all',
      scopeLabel: scopeLabel(scope, state.alumnos),
      multiClase: nClases > 1,
    });
  }

  /*
   * Calificaciones sin las materias que no aplican al grado de cada alumno,
   * para que no cuenten en sus promedios.
   */
  function calificacionesAplicables(view) {
    const out = {};
    view.alumnos.forEach((a) => {
      const src = view.calificaciones[a.id] || {};
      const row = {};
      view.materias.forEach((m) => {
        if (!materiaAplica(m, a.grado)) return;
        m.evaluaciones.forEach((e) => {
          if (src[e.id] != null) row[e.id] = src[e.id];
        });
      });
      out[a.id] = row;
    });
    return out;
  }

  /*
   * Resumen por grupo a partir de los resultados de la vista:
   * [{key, label, grado, grupo, n, stats, conReprobadas, materias:[media|null]}]
   */
  function resumenPorClase(view, results) {
    const Stats = root.Stats || (typeof require !== 'undefined' ? require('./stats.js') : null);
    const map = new Map();
    results.porAlumno.forEach((pa) => {
      const k = claseKey(pa.alumno);
      if (!map.has(k)) map.set(k, { key: k, alumno: pa.alumno, items: [] });
      map.get(k).items.push(pa);
    });
    return [...map.values()]
      .sort((x, y) => cmpGrado(x.alumno.grado, y.alumno.grado) || grupoKey(x.alumno.grupo).localeCompare(grupoKey(y.alumno.grupo), 'es'))
      .map((g) => ({
        key: g.key,
        label: claseLabel(g.alumno),
        grado: g.alumno.grado || '',
        grupo: g.alumno.grupo || '',
        n: g.items.length,
        stats: Stats.describe(g.items.map((pa) => pa.general)),
        conReprobadas: g.items.filter((pa) => pa.reprobadas > 0).length,
        materias: view.materias.map((_, mi) => Stats.mean(g.items.map((pa) => pa.materias[mi].promedio))),
      }));
  }

  const Clases = {
    resumenPorClase,
    gradoKey,
    grupoKey,
    claseKey,
    gradoLabel,
    claseLabel,
    listClases,
    inScope,
    materiaAplica,
    scopeValid,
    scopeLabel,
    ordenAlumnos,
    buildView,
    calificacionesAplicables,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Clases;
  else root.Clases = Clases;
})(typeof window !== 'undefined' ? window : globalThis);
