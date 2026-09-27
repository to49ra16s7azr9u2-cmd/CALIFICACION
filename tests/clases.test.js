'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Stats = require('../js/stats.js');
const Clases = require('../js/clases.js');

const state = {
  config: { aprobatoria: 6 },
  materias: [
    { id: 'm1', nombre: 'Matemáticas', evaluaciones: [{ id: 'e1', nombre: 'T1', peso: 1 }] },
    { id: 'm2', nombre: 'Física', grados: ['2°'], evaluaciones: [{ id: 'e2', nombre: 'T1', peso: 1 }] },
  ],
  alumnos: [
    { id: 'a', numero: '1', nombre: 'Ana', grado: '1°', grupo: 'A' },
    { id: 'b', numero: '2', nombre: 'Beto', grado: '1°', grupo: 'A' },
    { id: 'c', numero: '1', nombre: 'Carla', grado: '1', grupo: 'b' },
    { id: 'd', numero: '1', nombre: 'Dani', grado: '2°', grupo: 'A' },
  ],
  calificaciones: { a: { e1: 10, e2: 5 }, b: { e1: 8 }, c: { e1: 6 }, d: { e1: 7, e2: 9 } },
};

test('claves y etiquetas de grado/grupo', () => {
  assert.equal(Clases.gradoKey('2°'), '2');
  assert.equal(Clases.gradoKey(' 2do '), '2');
  assert.equal(Clases.claseLabel({ grado: '1', grupo: 'b' }), '1° B');
  assert.equal(Clases.claseLabel({}), 'Sin grupo');
  const l = Clases.listClases(state.alumnos);
  assert.deepEqual(l.map((g) => [g.label, g.n, g.grupos.map((c) => c.label + ':' + c.n).join(',')]), [
    ['1°', 3, '1° A:2,1° B:1'],
    ['2°', 1, '2° A:1'],
  ]);
});

test('la vista filtra alumnos y materias por grado', () => {
  const g1 = Clases.buildView(state, 'g:1');
  assert.deepEqual(g1.alumnos.map((a) => a.id), ['a', 'b', 'c']);
  assert.deepEqual(g1.materias.map((m) => m.nombre), ['Matemáticas']);
  assert.equal(g1.multiClase, true);
  const c1a = Clases.buildView(state, 'c:1|A');
  assert.deepEqual(c1a.alumnos.map((a) => a.id), ['a', 'b']);
  assert.equal(c1a.multiClase, false);
  assert.equal(c1a.scopeLabel, '1° A');
  const all = Clases.buildView(state, 'all');
  assert.deepEqual(all.materias.map((m) => m.nombre), ['Matemáticas', 'Física']);
});

test('posiciones dentro del grupo, del grado y de la escuela', () => {
  const rank = (scope) => {
    const v = Clases.buildView(state, scope);
    const r = Stats.computeResults(Object.assign({}, v, { calificaciones: Clases.calificacionesAplicables(v) }));
    const o = {};
    r.porAlumno.forEach((pa) => (o[pa.alumno.id] = pa.rank + '/' + r.general.n));
    return o;
  };
  assert.deepEqual(rank('c:1|A'), { a: '1/2', b: '2/2' });
  assert.deepEqual(rank('g:1'), { a: '1/3', b: '2/3', c: '3/3' });
  // Física no aplica a 1°: la calificación de Ana en Física no cuenta.
  assert.deepEqual(rank('all'), { a: '1/4', b: '2/4', c: '4/4', d: '2/4' }); // Beto y Dani empatan con 8
});

test('resumen por grupo', () => {
  const v = Clases.buildView(state, 'g:1');
  const r = Stats.computeResults(Object.assign({}, v, { calificaciones: Clases.calificacionesAplicables(v) }));
  const res = Clases.resumenPorClase(v, r);
  assert.deepEqual(res.map((x) => [x.label, x.n, x.stats.mean]), [['1° A', 2, 9], ['1° B', 1, 6]]);
});
