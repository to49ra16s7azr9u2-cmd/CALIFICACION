'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Stats = require('../js/stats.js');
const Excel = require('../js/excel.js');

test('lee encabezado de dos niveles con celdas combinadas y columnas calculadas', () => {
  const grid = [
    ['Escuela Secundaria', '', '', ''],
    ['No.', 'Nombre', 'Matemáticas', '', 'Prom.', 'Español', '', 'General', ''],
    ['', '', 'Parcial 1 (40%)', 'Examen (60%)', 'Promedio', 'T1', 'T2', 'Promedio', 'Puntaje T'],
    [1, 'García Ana', 9, '8,5', 8.7, 10, '', 9.3, 55],
    [2, 'López Luis', 6, 7, 6.6, 8, 9, 7.5, 45],
    ['', '', '', '', '', '', '', '', ''],
  ];
  const d = Excel.parseGrid(grid);
  assert.equal(d.twoLevel, true);
  assert.deepEqual(d.materias.map((m) => m.nombre), ['Matemáticas', 'Español']);
  assert.deepEqual(d.materias[0].evaluaciones.map((e) => [e.nombre, e.peso]), [['Parcial 1', 40], ['Examen', 60]]);
  assert.deepEqual(d.materias[1].evaluaciones.map((e) => e.nombre), ['T1', 'T2']);
  assert.equal(d.alumnos.length, 2);
  assert.equal(d.alumnos[0].nombre, 'García Ana');
  const [p1, ex] = d.materias[0].evaluaciones;
  const t2 = d.materias[1].evaluaciones[1];
  assert.equal(d.calificaciones[d.alumnos[0].id][ex.id], 8.5);
  assert.equal(d.calificaciones[d.alumnos[0].id][t2.id], undefined);
  assert.equal(d.calificaciones[d.alumnos[1].id][p1.id], 6);
});

test('lee encabezado de un solo nivel', () => {
  const grid = [
    ['Nombre', 'Matemáticas', 'Español', 'Promedio'],
    ['Ana', 9, 8, 8.5],
    ['Luis', 7, 6, 6.5],
  ];
  const d = Excel.parseGrid(grid);
  assert.equal(d.twoLevel, false);
  assert.deepEqual(d.materias.map((m) => m.nombre), ['Matemáticas', 'Español']);
  assert.equal(d.alumnos[1].numero, '2');
});

test('error si no hay columna Nombre', () => {
  assert.throws(() => Excel.parseGrid([['a', 'b'], [1, 2]]), /Nombre/);
});

test('exportar y volver a importar conserva los datos (ida y vuelta)', () => {
  const state = {
    config: { aprobatoria: 6 },
    materias: [
      { id: 'm1', nombre: 'Matemáticas', evaluaciones: [{ id: 'e1', nombre: 'P1', peso: 1 }, { id: 'e2', nombre: 'Examen', peso: 3 }] },
      { id: 'm2', nombre: 'Historia', evaluaciones: [{ id: 'e3', nombre: 'T1', peso: 1 }] },
    ],
    alumnos: [
      { id: 'a', numero: '1', nombre: 'Ana' },
      { id: 'b', numero: '2', nombre: 'Luis' },
    ],
    calificaciones: { a: { e1: 9, e2: 8, e3: 10 }, b: { e1: 5, e3: 7 } },
  };
  const res = Stats.computeResults(state);
  const sheets = Excel.buildSheets(state, res);
  assert.deepEqual(sheets.map((s) => s.name), ['Calificaciones', 'Tabla completa', 'Resultados', 'Estadísticas']);
  const full = sheets[1].aoa;
  assert.deepEqual(full[1].slice(2, 8), ['P1 (25%)', 'Examen (75%)', 'Promedio', 'Puntaje T', 'Posición', 'Top %']);
  assert.equal(full.length, 2 + state.alumnos.length);
  const back = Excel.parseGrid(sheets[0].aoa);
  assert.deepEqual(back.materias.map((m) => m.nombre), ['Matemáticas', 'Historia']);
  assert.deepEqual(back.materias[0].evaluaciones.map((e) => [e.nombre, e.peso]), [['P1', 25], ['Examen', 75]]);
  const res2 = Stats.computeResults(Object.assign({ config: { aprobatoria: 6 } }, back));
  res.porAlumno.forEach((pa, i) => {
    assert.ok(Math.abs(pa.general - res2.porAlumno[i].general) < 1e-9);
    assert.equal(pa.rank, res2.porAlumno[i].rank);
  });
});

test('datos adicionales (Otros datos): exportar e importar', () => {
  const state = {
    config: { aprobatoria: 6 },
    materias: [{ id: 'm1', nombre: 'Matemáticas', evaluaciones: [{ id: 'e1', nombre: 'P1', peso: 1 }] }],
    alumnos: [
      { id: 'a', numero: '1', nombre: 'Ana' },
      { id: 'b', numero: '2', nombre: 'Luis' },
    ],
    calificaciones: { a: { e1: 9 }, b: { e1: 7 } },
    campos: [
      { id: 'c1', nombre: 'Asistencia %', tipo: 'numero', opciones: [] },
      { id: 'c2', nombre: 'Conducta', tipo: 'lista', opciones: ['Buena', 'Regular'] },
    ],
    extras: { a: { c1: 95, c2: 'Buena' }, b: { c2: 'Regular' } },
  };
  const sheets = Excel.buildSheets(state, Stats.computeResults(state));
  const aoa = sheets[0].aoa;
  assert.deepEqual(aoa[0].slice(-2), ['Otros datos', '']);
  assert.deepEqual(aoa[1].slice(-2), ['Asistencia %', 'Conducta']);
  assert.deepEqual(sheets[1].aoa[2].slice(-2), [95, 'Buena']);
  const back = Excel.parseGrid(aoa);
  assert.deepEqual(back.materias.map((m) => m.nombre), ['Matemáticas']);
  assert.deepEqual(back.campos.map((c) => [c.nombre, c.tipo]), [['Asistencia %', 'numero'], ['Conducta', 'texto']]);
  const [c1, c2] = back.campos;
  assert.equal(back.extras[back.alumnos[0].id][c1.id], 95);
  assert.equal(back.extras[back.alumnos[1].id][c2.id], 'Regular');
  assert.equal(back.extras[back.alumnos[1].id][c1.id], undefined);
});
