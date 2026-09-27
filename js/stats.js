/*
 * Cálculos estadísticos: promedios ponderados, desviación estándar,
 * puntaje T (偏差値), posición (ranking) y porcentaje superior.
 * Funciona en el navegador (window.Stats) y en Node (module.exports).
 */
(function (root) {
  'use strict';

  function isNum(v) {
    return typeof v === 'number' && Number.isFinite(v);
  }

  function mean(values) {
    const xs = values.filter(isNum);
    if (xs.length === 0) return null;
    return xs.reduce((a, b) => a + b, 0) / xs.length;
  }

  // Desviación estándar poblacional (la que se usa para el puntaje T).
  function stdDev(values) {
    const xs = values.filter(isNum);
    if (xs.length === 0) return null;
    const m = mean(xs);
    return Math.sqrt(xs.reduce((a, x) => a + (x - m) * (x - m), 0) / xs.length);
  }

  // Puntaje T (偏差値) = 50 + 10 * (x - media) / desviación.
  function tScore(x, m, sd) {
    if (!isNum(x) || !isNum(m)) return null;
    if (!isNum(sd) || sd === 0) return 50;
    return 50 + (10 * (x - m)) / sd;
  }

  // Posición tipo competencia: 1, 2, 2, 4 ... (mayor calificación = mejor).
  // Devuelve un arreglo paralelo a `values`; null si no hay calificación.
  function ranks(values) {
    const sorted = values.filter(isNum).sort((a, b) => b - a);
    const EPS = 1e-9;
    return values.map((v) => {
      if (!isNum(v)) return null;
      return sorted.findIndex((s) => s <= v + EPS) + 1;
    });
  }

  // Porcentaje superior: el alumno está dentro del "top X%".
  function topPercent(rank, n) {
    if (!isNum(rank) || !n) return null;
    return (rank / n) * 100;
  }

  // Promedio ponderado de una materia. Las evaluaciones vacías se omiten
  // y los pesos restantes se re-normalizan.
  function weightedAverage(scores, weights) {
    let sum = 0;
    let wsum = 0;
    scores.forEach((s, i) => {
      const w = isNum(weights[i]) && weights[i] > 0 ? weights[i] : 0;
      if (isNum(s) && w > 0) {
        sum += s * w;
        wsum += w;
      }
    });
    return wsum > 0 ? sum / wsum : null;
  }

  // Estadística completa de un conjunto de calificaciones.
  function describe(values) {
    const xs = values.filter(isNum);
    if (xs.length === 0) {
      return { n: 0, mean: null, sd: null, min: null, max: null, median: null };
    }
    const s = xs.slice().sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return {
      n: xs.length,
      mean: mean(xs),
      sd: stdDev(xs),
      min: s[0],
      max: s[s.length - 1],
      median: s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2,
    };
  }

  /*
   * Calcula todos los resultados a partir del estado de la aplicación.
   * state = { config, materias:[{id,nombre,evaluaciones:[{id,nombre,peso}]}],
   *           alumnos:[{id,numero,nombre}], calificaciones:{alumnoId:{evalId:num}} }
   */
  function computeResults(state) {
    const alumnos = state.alumnos || [];
    const materias = state.materias || [];
    const cal = state.calificaciones || {};
    const aprobatoria = isNum(state.config && state.config.aprobatoria)
      ? state.config.aprobatoria
      : 6;

    const perMateria = materias.map((m) => {
      const weights = m.evaluaciones.map((e) => (isNum(e.peso) ? e.peso : 1));
      const promedios = alumnos.map((a) => {
        const row = cal[a.id] || {};
        return weightedAverage(
          m.evaluaciones.map((e) => row[e.id]),
          weights
        );
      });
      const d = describe(promedios);
      const rk = ranks(promedios);
      return {
        materia: m,
        promedios,
        stats: d,
        ranks: rk,
        tscores: promedios.map((p) => tScore(p, d.mean, d.sd)),
        evalStats: m.evaluaciones.map((e) =>
          describe(alumnos.map((a) => (cal[a.id] || {})[e.id]))
        ),
        reprobados: promedios.filter((p) => isNum(p) && p < aprobatoria).length,
      };
    });

    const generales = alumnos.map((_, i) =>
      mean(perMateria.map((pm) => pm.promedios[i]))
    );
    const gStats = describe(generales);
    const gRanks = ranks(generales);

    const porAlumno = alumnos.map((a, i) => ({
      alumno: a,
      general: generales[i],
      tscore: tScore(generales[i], gStats.mean, gStats.sd),
      rank: gRanks[i],
      top: topPercent(gRanks[i], gStats.n),
      materias: perMateria.map((pm) => ({
        materia: pm.materia,
        promedio: pm.promedios[i],
        tscore: pm.tscores[i],
        rank: pm.ranks[i],
        top: topPercent(pm.ranks[i], pm.stats.n),
      })),
      reprobadas: perMateria.filter(
        (pm) => isNum(pm.promedios[i]) && pm.promedios[i] < aprobatoria
      ).length,
    }));

    return { perMateria, porAlumno, general: gStats };
  }

  const Stats = {
    isNum,
    mean,
    stdDev,
    tScore,
    ranks,
    topPercent,
    weightedAverage,
    describe,
    computeResults,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Stats;
  else root.Stats = Stats;
})(typeof window !== 'undefined' ? window : globalThis);
