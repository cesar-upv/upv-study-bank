# Banco de Estudio

Organiza tu material por materias y unidades, estudia a tu ritmo y guarda tu progreso en el navegador. Sin cuentas ni backend.

## Qué puedes hacer

- Leer guías con fórmulas, código y diagramas.
- Practicar con pistas, explicaciones y 11 tipos de ejercicios.
- Hacer simulacros con temporizador y retomar intentos pendientes.
- Repasar errores y consultar tu rendimiento por tema.
- Buscar, ocultar y restaurar unidades en lista o cuadrícula.
- Elegir entre cuatro paletas con modo claro, oscuro o automático.
- Importar y compartir materias en JSON; respaldar tus datos por separado.

## Instalación

Necesitas **Node.js 22.12 o posterior** y **pnpm** (la versión del proyecto está fijada en `package.json`). Tras clonar el repositorio, entra en su carpeta y ejecuta:

```sh
pnpm install
pnpm dev
```

Abre la dirección que muestra la terminal. En **Gestionar materias**, pulsa **Añadir ejemplo de matemáticas** o importa tu archivo `.unit-package.json`. Una instalación nueva empieza con la biblioteca vacía.

Para generar una versión estática: `pnpm build`. Puedes probarla con `pnpm preview` y publicar el contenido de `dist/` en un servidor estático.

## Tu material y tus datos

Las materias importadas y el progreso se guardan en este navegador. En **Mis datos** puedes descargar y restaurar un respaldo. Borrar los datos del navegador también borra tu progreso: guarda copias periódicas.

**Compartir material** exporta una unidad sin historial ni notas personales. El contenido de `content/` se incluye al compilar para uso local y está ignorado por Git: no añadas materias personales al repositorio. Si publicas una compilación, sus contenidos y soluciones serán accesibles a quien visite el sitio.

La aplicación no garantiza recargas sin conexión; para usarla sin internet, sirve una compilación en tu equipo.

Para crear materias, usa el [prompt de autoría](docs/AUTHORING-PROMPT.md), el [formato de contenido](docs/CONTENT.md) y los ejemplos de `templates/`.

## Desarrollo

```sh
pnpm test
pnpm content:validate
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

Las pruebas utilizan datos sintéticos y no necesitan tus materias personales. La interfaz usa React y TypeScript; la persistencia local, IndexedDB.
