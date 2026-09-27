# CALIFICACION — Sistema de calificaciones para docentes

Aplicación web para que los docentes administren calificaciones: no requiere instalación ni servidor, **basta con abrir `index.html` en el navegador**.
（日本語の説明は下にあります）

---

## Español

### Funciones

| Pestaña | Contenido |
|---|---|
| **1. Vista general** | **Toda la información en una sola tabla**: por cada alumno, las calificaciones de cada evaluación y, por materia y en general, promedio, puntaje T, posición y Top %. Filas de estadísticas del grupo (media, desviación, máximo, mínimo), búsqueda, orden y columnas que se pueden ocultar. |
| **2. Configuración** | Datos del grupo (escuela, grupo, ciclo, docente), escala (0–10 o 0–100), calificación mínima aprobatoria, alumnos (se pueden pegar listas) y materias con sus evaluaciones y pesos. |
| **3. Calificaciones** | Tabla de captura con **encabezado de dos niveles** (Materia → Trimestre/Parcial/Examen…). Calcula al instante el promedio por materia, promedio general, **puntaje T**, **posición** y **Top %**. Marca en rojo las reprobatorias y en naranja las fuera de rango. Enter/flechas para moverse; se puede pegar un bloque copiado de Excel o Google Sheets. |
| **4. Resultados** | Ranking general o por materia (ordenable), puntaje T con gráfica, porcentaje superior, estadísticas por materia (media, desviación, mínimo, máximo, mediana, reprobados). |
| **5. Reportes y boletas** | Páginas generadas automáticamente: reporte del grupo (con histograma) y boletas individuales. Se pueden **imprimir / guardar como PDF** o **descargar como página HTML** independiente. |

### Excel / Google Sheets

- **Importar**: `.xlsx`, `.xls`, `.ods`, `.csv`. Se busca la columna «Nombre»; el encabezado puede ser de dos niveles (con celdas combinadas) o de un solo nivel (una columna por materia). Las columnas calculadas (Promedio, Puntaje T, Posición, Top %) se ignoran. El peso puede escribirse en el nombre: `Examen (60%)`.
- **Exportar Excel**: libro con 4 hojas — *Calificaciones* (dos niveles, celdas combinadas), *Tabla completa* (toda la información), *Resultados* (ranking) y *Estadísticas*. El archivo exportado se puede volver a importar sin perder datos.
- **Plantilla**: descarga un archivo vacío con el formato correcto.
- **Google Sheets**: *Archivo → Descargar → Microsoft Excel (.xlsx)* y luego importar aquí; para subir, *Archivo → Importar* el `.xlsx` exportado.

Formato de ejemplo:

|No.|Nombre|Matemáticas|||Español||
|---|---|---|---|---|---|---|
| | |Trimestre 1|Trimestre 2|Trimestre 3|Trimestre 1|Trimestre 2|
|1|García López Ana|9|8.5|9.2|10|9|

### Fórmulas

- **Promedio de materia** = promedio ponderado de las evaluaciones capturadas (las vacías no cuentan).
- **Promedio general** = promedio de los promedios de materia.
- **Puntaje T** = 50 + 10 × (calificación − media del grupo) ÷ desviación estándar (poblacional).
- **Posición**: los empates comparten lugar (1, 2, 2, 4…).
- **Top %** = posición ÷ número de alumnos evaluados × 100.

### Datos

Los datos se guardan automáticamente **sólo en el navegador** de esa computadora (localStorage). Use **Respaldo (JSON)** o **Exportar Excel** con regularidad para no perderlos, y para pasar la información a otra computadora.

---

## 日本語

メキシコの学校の先生向けの成績管理システムです。インストール不要、**`index.html` をブラウザで開くだけ**で動きます（インターネット接続も不要）。画面はスペイン語です。

### 主な機能

- **全情報一覧表（Vista general・最初のタブ）**：生徒ごとの全評価の点数と、教科別・総合の平均・偏差値・順位・上位％を1つの表で表示。クラス統計（平均・標準偏差・最高・最低）行、検索、並べ替え、列の表示切替付き。

- **二段階構成の成績表**：1段目＝教科（Matemáticas など）、2段目＝評価項目（Trimestre 1・2・3、Parcial、Examen など）。評価ごとに重み（peso）を設定可能。
- **自動計算**：教科別平均・総合平均・**学内偏差値（Puntaje T）**・**順位**・**上位何％（Top %）**を入力と同時に計算。赤点（aprobatoria 未満）は赤で表示。
- **結果ページの自動生成**：クラス全体レポート（分布ヒストグラム・教科別統計・順位表）と生徒ごとの成績表（Boleta）を自動作成。印刷／PDF保存、単体HTMLとしてダウンロード可能。
- **Excel・スプレッドシート連携**：`.xlsx / .xls / .ods / .csv` の読み込み（結合セルの2段見出しにも対応）と、Excel（4シート：成績・全情報一覧・順位・統計）／CSV の書き出し。書き出したファイルはそのまま再読み込み可能。Google スプレッドシートとは xlsx 経由でやり取りできます。
- Excel からコピーした範囲を成績表に貼り付け可能。
- データはブラウザに自動保存。JSON バックアップ／復元にも対応。

### 計算式

- 偏差値（Puntaje T）＝ 50 + 10 ×（得点 − 平均）÷ 標準偏差（母標準偏差）
- 順位：同点は同順位（1, 2, 2, 4…）
- 上位％ ＝ 順位 ÷ 人数 × 100

---

## Estructura / 構成

```
index.html          Interfaz
css/styles.css      Estilos
js/stats.js         Cálculos (promedios, puntaje T, posiciones, Top %)
js/excel.js         Importar / exportar Excel y CSV
js/report.js        Generador de reportes y boletas
js/sample.js        Datos de ejemplo
js/app.js           Lógica de la interfaz
vendor/             SheetJS (xlsx) — Apache-2.0
tests/              Pruebas (Node.js)
```

Pruebas: `npm test` (Node.js 18+). Servidor local opcional: `npm start` → http://localhost:8080
También se puede publicar tal cual con GitHub Pages.
