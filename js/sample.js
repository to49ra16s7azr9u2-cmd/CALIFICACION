/* Datos de ejemplo para probar el sistema: 3 grados × 2 grupos. */
(function (root) {
  'use strict';

  const APELLIDOS = [
    'Aguilar', 'Álvarez', 'Castillo', 'Cruz', 'Delgado', 'Díaz', 'Flores', 'García', 'Gómez', 'González',
    'Hernández', 'Jiménez', 'López', 'Martínez', 'Medina', 'Morales', 'Navarro', 'Ortega', 'Pérez', 'Ramírez',
    'Reyes', 'Rodríguez', 'Ruiz', 'Sánchez', 'Torres', 'Vargas', 'Vázquez', 'Zamora', 'Mendoza', 'Rojas',
  ];
  const NOMBRES = [
    'Sofía', 'Diego', 'Valeria', 'Emiliano', 'Ximena', 'Santiago', 'Regina', 'Mateo', 'Camila', 'Leonardo',
    'Renata', 'Sebastián', 'Valentina', 'Iker', 'Fernanda', 'Daniel', 'Andrea', 'Emilio', 'Mariana', 'Luis Ángel',
    'Natalia', 'José Manuel', 'Paula', 'Rodrigo', 'Isabella', 'Miguel', 'Ana Paula', 'Diego Alejandro',
  ];
  // Materias; `grados` limita una materia a ciertos grados (vacío = todos).
  const MATERIAS = [
    ['Español', []],
    ['Matemáticas', []],
    ['Biología', ['1°']],
    ['Física', ['2°']],
    ['Química', ['3°']],
    ['Historia', []],
    ['Inglés', []],
    ['Formación Cívica y Ética', []],
  ];
  const CLASES = [
    ['1°', 'A'], ['1°', 'B'],
    ['2°', 'A'], ['2°', 'B'],
    ['3°', 'A'], ['3°', 'B'],
  ];
  const POR_GRUPO = 20;

  function make() {
    let seed = 20260927;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const materias = MATERIAS.map(([nombre, grados], i) => ({
      id: 'm' + i,
      nombre,
      grados,
      evaluaciones: ['Trimestre 1', 'Trimestre 2', 'Trimestre 3'].map((n, k) => ({
        id: 'm' + i + 'e' + k,
        nombre: n,
        peso: 1,
      })),
    }));
    const aplica = (m, grado) => !m.grados.length || m.grados.includes(grado);

    const alumnos = [];
    let k = 0;
    CLASES.forEach(([grado, grupo], ci) => {
      const lista = [];
      for (let i = 0; i < POR_GRUPO; i++) {
        const a1 = APELLIDOS[(k * 7 + ci) % APELLIDOS.length];
        const a2 = APELLIDOS[(k * 11 + 3) % APELLIDOS.length];
        const n = NOMBRES[(k * 5 + ci * 3) % NOMBRES.length];
        lista.push(a1 + ' ' + a2 + ' ' + n);
        k += 1;
      }
      lista.sort((x, y) => x.localeCompare(y, 'es'));
      lista.forEach((nombre, i) => alumnos.push({ id: 'a' + alumnos.length, numero: String(i + 1), nombre, grado, grupo }));
    });

    // Cada grupo tiene un nivel un poco distinto para que la comparación sea visible.
    const nivelGrupo = { '1°A': 0.2, '1°B': -0.3, '2°A': 0.4, '2°B': 0, '3°A': -0.2, '3°B': 0.3 };
    const calificaciones = {};
    alumnos.forEach((a) => {
      const base = 5.5 + rnd() * 4.3 + nivelGrupo[a.grado + a.grupo];
      const cal = {};
      materias.forEach((m) => {
        if (!aplica(m, a.grado)) return;
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
      config: {
        escuela: 'Escuela Secundaria General "Benito Juárez"',
        ciclo: '2026-2027',
        maestro: 'Mtra. Laura Méndez',
        escalaMax: 10,
        aprobatoria: 6,
        decimales: 1,
      },
      materias,
      alumnos,
      calificaciones,
      campos,
      extras,
      vista: 'all',
    };
  }

  root.Sample = { make };
})(typeof window !== 'undefined' ? window : globalThis);
