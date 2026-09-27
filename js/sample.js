/* Datos de ejemplo para probar el sistema. */
(function (root) {
  'use strict';

  const NOMBRES = [
    'Aguilar Ramírez Sofía', 'Álvarez Torres Diego', 'Castillo Mendoza Valeria', 'Cruz Hernández Emiliano',
    'Delgado Ruiz Ximena', 'Díaz Morales Santiago', 'Flores Gutiérrez Regina', 'García López Mateo',
    'Gómez Vargas Camila', 'González Reyes Leonardo', 'Hernández Castro Renata', 'Jiménez Ortiz Sebastián',
    'López Martínez Valentina', 'Martínez Sánchez Iker', 'Medina Rojas Fernanda', 'Morales Chávez Daniel',
    'Navarro Salazar Andrea', 'Ortega Domínguez Emilio', 'Pérez Romero Mariana', 'Ramírez Silva Luis Ángel',
    'Reyes Guerrero Natalia', 'Rodríguez Flores Diego Alejandro', 'Ruiz Herrera Paula', 'Sánchez Juárez José Manuel',
    'Torres Vázquez Ana Paula', 'Vargas Estrada Rodrigo', 'Vázquez Núñez Isabella', 'Zamora Luna Miguel',
  ];
  const MATERIAS = ['Español', 'Matemáticas', 'Ciencias', 'Historia', 'Geografía', 'Inglés', 'Formación Cívica y Ética'];

  function make() {
    let seed = 20260927;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const materias = MATERIAS.map((nombre, i) => ({
      id: 'm' + i,
      nombre,
      evaluaciones: ['Trimestre 1', 'Trimestre 2', 'Trimestre 3'].map((n, k) => ({
        id: 'm' + i + 'e' + k,
        nombre: n,
        peso: 1,
      })),
    }));
    const alumnos = NOMBRES.map((nombre, i) => ({ id: 'a' + i, numero: String(i + 1), nombre }));
    const calificaciones = {};
    alumnos.forEach((a) => {
      const base = 5.5 + rnd() * 4.3;
      const cal = {};
      materias.forEach((m) => {
        const bias = (rnd() - 0.5) * 2;
        m.evaluaciones.forEach((e) => {
          const v = base + bias + (rnd() - 0.5) * 1.6;
          cal[e.id] = Math.max(5, Math.min(10, Math.round(v * 10) / 10));
        });
      });
      calificaciones[a.id] = cal;
    });
    const campos = [
      { id: 'c0', nombre: 'Asistencia %', tipo: 'numero', opciones: [] },
      { id: 'c1', nombre: 'Conducta', tipo: 'lista', opciones: ['Excelente', 'Buena', 'Regular', 'Necesita mejorar'] },
      { id: 'c2', nombre: 'Tareas entregadas', tipo: 'numero', opciones: [] },
      { id: 'c3', nombre: 'Observaciones', tipo: 'texto', opciones: [] },
    ];
    const OBS = ['', '', '', 'Participa mucho en clase', 'Debe entregar tareas a tiempo', 'Mejoró este trimestre', ''];
    const extras = {};
    alumnos.forEach((a) => {
      const ex = {
        c0: Math.round(80 + rnd() * 20),
        c1: campos[1].opciones[Math.min(3, Math.floor(rnd() * 4.2))],
        c2: Math.round(12 + rnd() * 8),
      };
      const o = OBS[Math.floor(rnd() * OBS.length)];
      if (o) ex.c3 = o;
      extras[a.id] = ex;
    });
    return {
      campos,
      extras,
      config: {
        escuela: 'Escuela Secundaria General "Benito Juárez"',
        grupo: '2° A',
        ciclo: '2026-2027',
        maestro: 'Mtra. Laura Méndez',
        escalaMax: 10,
        aprobatoria: 6,
        decimales: 1,
      },
      materias,
      alumnos,
      calificaciones,
    };
  }

  root.Sample = { make };
})(typeof window !== 'undefined' ? window : globalThis);
