# Prompt para un agente autor de contenido

Copia el siguiente bloque e indica la materia, temario y fuentes al final.

---

Trabaja en este repositorio de Banco de Estudio. Tu tarea es crear o actualizar una unidad didáctica, no reimplementar la aplicación.

1. Lee `README.md`, `docs/CONTENT.md`, `templates/matematicas.unit-package.json` y `src/domain/content/question-registry.ts`. El contrato ejecutable prevalece sobre cualquier ejemplo desactualizado.
2. Revisa los materiales suministrados. Identifica objetivos y temas; no inventes temario oficial, citas, páginas, ponderaciones o resultados. Separa contenido ilustrativo de contenido respaldado por fuentes.
3. Produce un `.unit-package.json` v1 completo: `subject`, `unit`, `lessons`, `questions`, `answers`, `sources`. Usa IDs estables, `unit.revision` creciente y referencias consistentes. No incluyas datos personales ni historial.
4. Tipos admitidos: `single_choice`, `multiple_choice`, `matching`, `ordering`, `proposition_check`, `translation`, `truth_table`, `equivalence`, `sat`, `entailment`, `short_answer`. Usa la tabla de `docs/CONTENT.md` para los payloads y soluciones exactos. No inventes tipos adicionales. `proposition_check` no es un verdadero/falso genérico. Para cuestiones abiertas usa rúbrica de autoevaluación, nunca prometas corrección semántica automática.
5. Escribe lecciones claras en Markdown con frontmatter del formato soportado, ejemplos y LaTeX correctamente escapado. Incluye una lección por tema. En selección única/múltiple, redacta distractores plausibles. En relaciones, cada concepto tiene una respuesta distinta; en ordenamiento, mezcla el orden inicial y entrega todos los IDs en la solución.
   - Sigue la sección “Markdown académico y seguridad” de `docs/CONTENT.md`: GFM, código con lenguaje y fórmulas `$…$`, `$$…$$`, `\(…\)`, `\[…\]`. Duplica cada barra en strings JSON y escapa los dólares monetarios ambiguos. Nunca pongas fórmulas que deban renderizarse dentro de código.
   - Para procesos, secuencias y estados puedes usar bloques `mermaid`, con explicación textual. Solo estructura y etiquetas: sin directivas, frontmatter de Mermaid, estilos personalizados, enlaces, HTML ni recursos externos; máximo 20.000 caracteres y 200 conexiones. No uses imágenes remotas para contenido esencial.
6. Cada pregunta necesita `hints`, `source_ids`, dificultad y alcance. Cada respuesta necesita explicación, no solo clave. Para lógica, verifica las soluciones por cálculo: variables declaradas, vectores en orden falso primero, modelos y contraejemplos válidos. No confundas equivalencia sintáctica con semántica.
7. Configura opcionalmente `unit.exam` con cantidad, minutos y cuotas por tema. Marca `required` las preguntas que pueden aparecer en simulacros. Sin configuración se usan hasta 30 preguntas y 45 minutos.
8. Ejecuta `pnpm content:validate ruta/al/paquete.json`. Corrige todos los errores. Añade pruebas si modificas el motor o el contrato; no cambies esquemas para encubrir contenido inválido.
9. Entrega el paquete y un resumen del alcance, distribución de tipos, fuentes y limitaciones. Guarda el material personal en `content/` (ignorado por Git) o impórtalo desde la aplicación. No añadas materias personales, notas, fuentes privadas ni capturas al repositorio. `templates/` se reserva para ejemplos genéricos. No hagas push ni publiques recursos.

Materia / unidad: [completar]
Temario y objetivos: [completar]
Fuentes disponibles: [completar]
Cantidad y dificultad: [completar]

---
