/*
 * Generador de páginas de resultados (HTML autónomo, listo para imprimir o
 * descargar): reporte del grupo, ranking y boletas individuales.
 */
(function (root) {
  'use strict';

  const Stats = root.Stats || (typeof require !== 'undefined' ? require('./stats.js') : null);

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fmt(v, d) {
    return Stats.isNum(v) ? v.toFixed(d == null ? 1 : d) : '—';
  }

  const CSS = `
  :root{--ink:#1f2937;--muted:#6b7280;--line:#d1d5db;--soft:#f3f4f6;--accent:#0f766e;--accent-soft:#ccfbf1;--bad:#b91c1c;--bad-soft:#fee2e2;--good:#15803d}
  *{box-sizing:border-box}
  body{margin:0;background:#fff;color:var(--ink);font:14px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
  .page{max-width:1000px;margin:0 auto;padding:24px 20px}
  header.rep{border-bottom:3px solid var(--accent);padding-bottom:10px;margin-bottom:18px}
  header.rep h1{margin:0;font-size:22px}
  header.rep .meta{color:var(--muted);font-size:13px;margin-top:4px}
  h2{font-size:17px;margin:26px 0 10px;color:var(--accent)}
  .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
  .kpi{border:1px solid var(--line);border-radius:8px;padding:10px 12px}
  .kpi .l{font-size:12px;color:var(--muted)}
  .kpi .v{font-size:22px;font-weight:700;font-variant-numeric:tabular-nums}
  .tw{overflow-x:auto}
  table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}
  th,td{border:1px solid var(--line);padding:5px 7px;text-align:center;white-space:nowrap}
  th{background:var(--soft);font-weight:600}
  td.n,th.n{text-align:left;white-space:normal;min-width:160px}
  td.bad{color:var(--bad);background:var(--bad-soft);font-weight:600}
  tr.top3 td{background:var(--accent-soft)}
  .hist{display:flex;align-items:flex-end;gap:6px;height:160px;border-bottom:1px solid var(--line);padding:0 4px}
  .hist .b{flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;height:100%}
  .hist .bar{width:100%;background:var(--accent);border-radius:4px 4px 0 0;min-height:1px}
  .hist .bar.bad{background:var(--bad)}
  .hist .c{font-size:12px;font-weight:600}
  .hist-l{display:flex;gap:6px;padding:0 4px}
  .hist-l span{flex:1;text-align:center;font-size:11px;color:var(--muted)}
  .boleta{page-break-before:always;break-before:page}
  .boleta:first-of-type{page-break-before:auto;break-before:auto}
  .boleta .who{display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:8px}
  .boleta .who h2{margin:0;color:var(--ink);font-size:20px}
  .big{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0}
  .big .kpi .v{color:var(--accent)}
  .t{min-width:110px}.tbar{position:relative;height:8px;background:var(--soft);border-radius:4px;margin:3px 2px 2px}
  .tbar .mid{position:absolute;left:50%;top:-3px;bottom:-3px;width:1px;background:var(--muted)}
  .tbar .dot{position:absolute;top:-3px;width:14px;height:14px;margin-left:-7px;border-radius:50%;background:var(--accent);border:2px solid #fff;box-shadow:0 0 0 1px var(--accent)}
  table.extras{width:auto;min-width:50%}table.extras th{width:1%;white-space:nowrap}table.extras td{white-space:normal}
  .note{font-size:12px;color:var(--muted);margin-top:14px}
  .firmas{display:flex;justify-content:space-around;margin-top:56px;gap:40px}
  .firmas div{flex:1;border-top:1px solid var(--ink);text-align:center;padding-top:4px;font-size:12px;color:var(--muted)}
  @media (max-width:640px){.big{grid-template-columns:repeat(2,1fr)}}
  @media print{.page{padding:0;max-width:none}body{font-size:12px}h2{margin-top:16px}.tw{overflow:visible}@page{margin:14mm}}
  `;

  function headerHTML(cfg, subtitle) {
    const meta = [
      cfg.grupo && 'Grupo: ' + esc(cfg.grupo),
      cfg.ciclo && 'Ciclo escolar: ' + esc(cfg.ciclo),
      cfg.maestro && 'Docente: ' + esc(cfg.maestro),
      'Fecha: ' + new Date().toLocaleDateString('es-MX'),
    ]
      .filter(Boolean)
      .join(' · ');
    return (
      '<header class="rep"><h1>' +
      esc(cfg.escuela || 'Escuela') +
      (subtitle ? ' — ' + esc(subtitle) : '') +
      '</h1><div class="meta">' +
      meta +
      '</div></header>'
    );
  }

  function histogram(values, cfg) {
    const max = cfg.escalaMax || 10;
    const apr = cfg.aprobatoria;
    const bins = 10;
    const w = max / bins;
    const counts = new Array(bins).fill(0);
    values.filter(Stats.isNum).forEach((v) => {
      const i = Math.min(bins - 1, Math.max(0, Math.floor(v / w)));
      counts[i] += 1;
    });
    const top = Math.max(1, ...counts);
    const label = (x) => (Number.isInteger(x) ? String(x) : x.toFixed(1));
    let bars = '';
    let labels = '';
    counts.forEach((c, i) => {
      const lo = i * w;
      const hi = lo + w;
      const bad = Stats.isNum(apr) && hi <= apr;
      bars +=
        '<div class="b"><span class="c">' +
        (c || '') +
        '</span><div class="bar' +
        (bad ? ' bad' : '') +
        '" style="height:' +
        ((c / top) * 85).toFixed(1) +
        '%"></div></div>';
      labels += '<span>' + label(lo) + '–' + label(hi) + '</span>';
    });
    return '<div class="hist">' + bars + '</div><div class="hist-l">' + labels + '</div>';
  }

  function tBar(t) {
    if (!Stats.isNum(t)) return '';
    const pos = Math.min(100, Math.max(0, ((t - 20) / 60) * 100));
    return '<div class="tbar"><div class="mid"></div><div class="dot" style="left:' + pos.toFixed(1) + '%"></div></div>';
  }

  function cellClass(v, cfg) {
    return Stats.isNum(v) && Stats.isNum(cfg.aprobatoria) && v < cfg.aprobatoria ? ' class="bad"' : '';
  }

  function groupSection(state, res) {
    const cfg = state.config;
    const d = cfg.decimales == null ? 1 : cfg.decimales;
    const g = res.general;
    const reprob = res.porAlumno.filter((pa) => pa.reprobadas > 0).length;
    let h = headerHTML(cfg, 'Reporte de resultados del grupo');

    h += '<div class="kpis">';
    h += '<div class="kpi"><div class="l">Alumnos</div><div class="v">' + state.alumnos.length + '</div></div>';
    h += '<div class="kpi"><div class="l">Promedio del grupo</div><div class="v">' + fmt(g.mean, d) + '</div></div>';
    h += '<div class="kpi"><div class="l">Desviación estándar</div><div class="v">' + fmt(g.sd, 2) + '</div></div>';
    h += '<div class="kpi"><div class="l">Máximo / Mínimo</div><div class="v">' + fmt(g.max, d) + ' / ' + fmt(g.min, d) + '</div></div>';
    h += '<div class="kpi"><div class="l">Alumnos con materias reprobadas</div><div class="v">' + reprob + '</div></div>';
    h += '</div>';

    h += '<h2>Distribución del promedio general</h2>' + histogram(res.porAlumno.map((p) => p.general), cfg);

    h += '<h2>Estadísticas por materia</h2><div class="tw"><table><thead><tr>';
    h += '<th class="n">Materia</th><th>Evaluados</th><th>Media</th><th>Desv. est.</th><th>Mín.</th><th>Máx.</th><th>Mediana</th><th>Reprobados</th></tr></thead><tbody>';
    res.perMateria.forEach((pm) => {
      const s = pm.stats;
      h +=
        '<tr><td class="n">' + esc(pm.materia.nombre) + '</td><td>' + s.n + '</td><td>' + fmt(s.mean, d) +
        '</td><td>' + fmt(s.sd, 2) + '</td><td>' + fmt(s.min, d) + '</td><td>' + fmt(s.max, d) +
        '</td><td>' + fmt(s.median, d) + '</td><td>' + pm.reprobados + '</td></tr>';
    });
    h += '</tbody></table></div>';

    h += '<h2>Posiciones del grupo</h2><div class="tw"><table><thead><tr>';
    h += '<th>Posición</th><th>No.</th><th class="n">Nombre</th><th>Promedio</th><th>Puntaje T</th><th>Top %</th>';
    res.perMateria.forEach((pm) => {
      h += '<th>' + esc(pm.materia.nombre) + '</th>';
    });
    h += '</tr></thead><tbody>';
    const ordered = res.porAlumno.slice().sort((a, b) => (a.rank == null ? 1e9 : a.rank) - (b.rank == null ? 1e9 : b.rank));
    ordered.forEach((pa) => {
      h += '<tr' + (pa.rank != null && pa.rank <= 3 ? ' class="top3"' : '') + '>';
      h += '<td>' + (pa.rank == null ? '—' : pa.rank) + '</td><td>' + esc(pa.alumno.numero) + '</td>';
      h += '<td class="n">' + esc(pa.alumno.nombre) + '</td>';
      h += '<td' + cellClass(pa.general, cfg) + '>' + fmt(pa.general, d) + '</td>';
      h += '<td>' + fmt(pa.tscore, 1) + '</td><td>' + (pa.top == null ? '—' : fmt(pa.top, 1) + '%') + '</td>';
      pa.materias.forEach((m) => {
        h += '<td' + cellClass(m.promedio, cfg) + '>' + fmt(m.promedio, d) + '</td>';
      });
      h += '</tr>';
    });
    h += '</tbody></table></div>';
    h += noteHTML(cfg);
    return '<section class="page">' + h + '</section>';
  }

  function noteHTML(cfg) {
    return (
      '<p class="note"><b>Puntaje T</b> (calificación estandarizada): 50 + 10 × (calificación − media del grupo) ÷ desviación estándar. ' +
      '50 corresponde al promedio del grupo; 60 está una desviación por encima y 40 una por debajo. ' +
      '<b>Top %</b>: posición ÷ número de alumnos × 100 (p. ej., 10% significa que está dentro del 10% superior del grupo). ' +
      'Calificación mínima aprobatoria: ' + esc(cfg.aprobatoria) + ' (escala 0–' + esc(cfg.escalaMax) + ').</p>'
    );
  }

  function boletaSection(state, res, i) {
    const cfg = state.config;
    const d = cfg.decimales == null ? 1 : cfg.decimales;
    const pa = res.porAlumno[i];
    const n = res.general.n;
    let h = headerHTML(cfg, 'Boleta de resultados');
    h += '<div class="who"><h2>' + esc(pa.alumno.nombre) + '</h2><div class="meta">No. de lista: ' + esc(pa.alumno.numero) + '</div></div>';
    h += '<div class="big">';
    h += '<div class="kpi"><div class="l">Promedio general</div><div class="v">' + fmt(pa.general, d) + '</div></div>';
    h += '<div class="kpi"><div class="l">Puntaje T</div><div class="v">' + fmt(pa.tscore, 1) + '</div></div>';
    h += '<div class="kpi"><div class="l">Posición en el grupo</div><div class="v">' + (pa.rank == null ? '—' : pa.rank + ' / ' + n) + '</div></div>';
    h += '<div class="kpi"><div class="l">Porcentaje superior</div><div class="v">' + (pa.top == null ? '—' : 'Top ' + fmt(pa.top, 1) + '%') + '</div></div>';
    h += '</div>';

    h += '<div class="tw"><table><thead><tr><th class="n">Materia</th>';
    const maxEvals = Math.max(0, ...state.materias.map((m) => m.evaluaciones.length));
    // Si todas las materias usan las mismas evaluaciones, se usan sus nombres como encabezado.
    const firstNames = (state.materias[0] ? state.materias[0].evaluaciones : []).map((e) => e.nombre).join('|');
    const sameEvals = state.materias.every((m) => m.evaluaciones.map((e) => e.nombre).join('|') === firstNames);
    for (let k = 0; k < maxEvals; k++) {
      h += '<th>' + (sameEvals ? esc(state.materias[0].evaluaciones[k].nombre) : 'Eval. ' + (k + 1)) + '</th>';
    }
    h += '<th>Promedio</th><th>Media grupo</th><th>Puntaje T</th><th>Posición</th><th>Top %</th></tr></thead><tbody>';
    const cal = state.calificaciones[pa.alumno.id] || {};
    pa.materias.forEach((m, mi) => {
      const mat = state.materias[mi];
      const pm = res.perMateria[mi];
      h += '<tr><td class="n">' + esc(m.materia.nombre) + '</td>';
      for (let k = 0; k < maxEvals; k++) {
        const e = mat.evaluaciones[k];
        const v = e ? cal[e.id] : null;
        h += e ? '<td title="' + esc(e.nombre) + '"' + cellClass(v, cfg) + '>' + fmt(v, d) + '</td>' : '<td></td>';
      }
      h += '<td' + cellClass(m.promedio, cfg) + '><b>' + fmt(m.promedio, d) + '</b></td>';
      h += '<td>' + fmt(pm.stats.mean, d) + '</td><td class="t">' + fmt(m.tscore, 1) + tBar(m.tscore) + '</td>';
      h += '<td>' + (m.rank == null ? '—' : m.rank + ' / ' + pm.stats.n) + '</td>';
      h += '<td>' + (m.top == null ? '—' : fmt(m.top, 1) + '%') + '</td></tr>';
    });
    h += '<tr><th class="n">General</th>';
    for (let k = 0; k < maxEvals; k++) h += '<th></th>';
    h += '<th' + cellClass(pa.general, cfg) + '>' + fmt(pa.general, d) + '</th><th>' + fmt(res.general.mean, d) + '</th>';
    h += '<th class="t">' + fmt(pa.tscore, 1) + tBar(pa.tscore) + '</th><th>' + (pa.rank == null ? '—' : pa.rank + ' / ' + n) + '</th>';
    h += '<th>' + (pa.top == null ? '—' : fmt(pa.top, 1) + '%') + '</th></tr>';
    h += '</tbody></table></div>';

    if (!sameEvals) {
      const evalNames = state.materias
        .map((m) => esc(m.nombre) + ': ' + m.evaluaciones.map((e, k) => 'Eval. ' + (k + 1) + ' = ' + esc(e.nombre)).join(', '))
        .join(' · ');
      h += '<p class="note">' + evalNames + '</p>';
    }
    const campos = state.campos || [];
    if (campos.length) {
      const ex = (state.extras || {})[pa.alumno.id] || {};
      h += '<h2>Otros datos</h2><div class="tw"><table class="extras"><tbody>';
      campos.forEach((cp) => {
        const v = ex[cp.id];
        const txt = v == null || v === '' ? '—' : Stats.isNum(v) ? String(Math.round(v * 100) / 100) : esc(v);
        h += '<tr><th class="n">' + esc(cp.nombre) + '</th><td class="n">' + txt + '</td></tr>';
      });
      h += '</tbody></table></div>';
    }
    if (pa.reprobadas > 0) {
      h += '<p class="note" style="color:#b91c1c"><b>Atención:</b> ' + pa.reprobadas + ' materia(s) por debajo de la calificación aprobatoria.</p>';
    }
    h += noteHTML(cfg);
    h += '<div class="firmas"><div>Docente</div><div>Padre, madre o tutor</div></div>';
    return '<section class="page boleta">' + h + '</section>';
  }

  /*
   * mode: 'grupo' | 'boletas' | 'completo' | 'alumno:<id>'
   */
  function generate(state, res, mode) {
    let body = '';
    let title = 'Reporte del grupo';
    if (mode === 'grupo' || mode === 'completo') body += groupSection(state, res);
    if (mode === 'boletas' || mode === 'completo') {
      title = mode === 'boletas' ? 'Boletas' : 'Reporte completo';
      state.alumnos.forEach((_, i) => {
        body += boletaSection(state, res, i);
      });
    }
    if (mode && mode.indexOf('alumno:') === 0) {
      const id = mode.slice(7);
      const i = state.alumnos.findIndex((a) => a.id === id);
      if (i >= 0) {
        title = 'Boleta – ' + state.alumnos[i].nombre;
        body += boletaSection(state, res, i);
      }
    }
    if (!body) body = '<section class="page"><p>No hay datos para mostrar.</p></section>';
    return (
      '<!doctype html><html lang="es-MX"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>' + esc(title) + ' – ' + esc(state.config.escuela || '') + '</title>' +
      '<style>' + CSS + '</style></head><body>' + body + '</body></html>'
    );
  }

  const Report = { generate, esc };
  if (typeof module !== 'undefined' && module.exports) module.exports = Report;
  else root.Report = Report;
})(typeof window !== 'undefined' ? window : globalThis);
