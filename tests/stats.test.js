'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Stats = require('../js/stats.js');

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test('media y desviación estándar poblacional', () => {
  close(Stats.mean([2, 4, 4, 4, 5, 5, 7, 9]), 5);
  close(Stats.stdDev([2, 4, 4, 4, 5, 5, 7, 9]), 2);
  assert.equal(Stats.mean([]), null);
  close(Stats.mean([8, null, 10, undefined]), 9);
});

test('puntaje T (偏差値)', () => {
  close(Stats.tScore(7, 5, 2), 60);
  close(Stats.tScore(3, 5, 2), 40);
  assert.equal(Stats.tScore(5, 5, 0), 50);
  assert.equal(Stats.tScore(null, 5, 2), null);
});

test('posiciones con empates (1, 2, 2, 4)', () => {
  assert.deepEqual(Stats.ranks([9, 8, 10, 8, null]), [2, 3, 1, 3, null]);
  assert.deepEqual(Stats.ranks([7, 7, 7]), [1, 1, 1]);
});

test('porcentaje superior', () => {
  close(Stats.topPercent(1, 20), 5);
  close(Stats.topPercent(20, 20), 100);
  assert.equal(Stats.topPercent(null, 20), null);
});

test('promedio ponderado ignora vacíos y re-normaliza', () => {
  close(Stats.weightedAverage([10, 5], [3, 1]), 8.75);
  close(Stats.weightedAverage([10, null, 6], [1, 1, 1]), 8);
  assert.equal(Stats.weightedAverage([null, null], [1, 1]), null);
});

test('computeResults: general, materias, posiciones', () => {
  const state = {
    config: { aprobatoria: 6 },
    materias: [
      { id: 'm1', nombre: 'Mat', evaluaciones: [{ id: 'e1', peso: 1 }, { id: 'e2', peso: 1 }] },
      { id: 'm2', nombre: 'Esp', evaluaciones: [{ id: 'e3', peso: 1 }] },
    ],
    alumnos: [
      { id: 'a', numero: '1', nombre: 'A' },
      { id: 'b', numero: '2', nombre: 'B' },
      { id: 'c', numero: '3', nombre: 'C' },
    ],
    calificaciones: {
      a: { e1: 10, e2: 8, e3: 10 }, // Mat 9, Esp 10 -> 9.5
      b: { e1: 6, e2: 4, e3: 6 }, // Mat 5, Esp 6 -> 5.5
      c: { e1: 8, e2: 8, e3: 7 }, // Mat 8, Esp 7 -> 7.5
    },
  };
  const r = Stats.computeResults(state);
  const g = r.porAlumno.map((p) => p.general);
  close(g[0], 9.5);
  close(g[1], 5.5);
  close(g[2], 7.5);
  assert.deepEqual(r.porAlumno.map((p) => p.rank), [1, 3, 2]);
  close(r.porAlumno[2].tscore, 50);
  assert.ok(r.porAlumno[0].tscore > 60);
  close(r.porAlumno[0].top, 100 / 3);
  assert.equal(r.porAlumno[1].reprobadas, 1);
  assert.equal(r.perMateria[0].reprobados, 1);
});
