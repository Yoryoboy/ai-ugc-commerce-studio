<!-- UGC Studio: installation guide for Engram, the persistent memory. Followed by the
configurar-memoria skill and by the setup skill, and readable straight from GitHub by an agent
that sets up a new computer from the README. Keep the CLAUDE.md block in Spanish: it is what the
user's Claude reads. -->

Necesito que instales y configures Engram (memoria persistente vía MCP) en esta compu,
para Claude Code y para Claude Desktop. Seguí los pasos en orden. Funciona en Mac; en Linux
también, salvo el paso 3 (Claude Desktop no existe para Linux: salteálo).

Repositorio: https://github.com/Gentleman-Programming/engram


## Paso 1 — Instalar Engram
1. Leé el README del repositorio y su documentación de instalación para macOS.
2. Fijate si Engram ya está instalado (`which engram` y `engram version` o `engram --version`).
   Si ya está, decime la versión y seguí al paso 2.
3. Si no está, instalalo con el método recomendado por el repositorio para el sistema de esta
   compu (macOS o Linux). Antes de instalar, decile al usuario en una línea qué vas a instalar.
4. Verificá la instalación: mostrame la ruta absoluta del binario (`which engram`)
   y la versión. Esa ruta absoluta la vas a usar en los pasos siguientes.

## Paso 2 — Registrar el MCP en Claude Code
NO uses `engram setup claude-code` ni instales el plugin de Engram para Claude Code.
Registralo como MCP simple, con el proyecto fijo `memory`:

```
claude mcp add --transport stdio --scope user --env ENGRAM_PROJECT=memory engram -- <RUTA_ABSOLUTA_ENGRAM> mcp --tools=agent
```

- Si ya existe un MCP llamado `engram`, mostrame su configuración actual; si no tiene
  `ENGRAM_PROJECT=memory`, eliminalo con `claude mcp remove engram --scope user` y
  volvé a registrarlo con el comando de arriba.
- Verificá con `claude mcp list` que `engram` aparece.

## Paso 3 — Configurar Claude Desktop (solo Mac)
En Linux salteá este paso. Archivo: `~/Library/Application Support/Claude/claude_desktop_config.json`

- Si no existe, crealo.
- Si existe, agregá la entrada `engram` dentro de `mcpServers` sin tocar
  las demás entradas.
- La entrada tiene que quedar así (con la ruta absoluta real del paso 1):

```json
"engram": {
  "command": "<RUTA_ABSOLUTA_ENGRAM>",
  "args": ["mcp", "--tools=agent"],
  "env": { "ENGRAM_PROJECT": "memory" }
}
```

- Antes de modificarlo, respaldalo (copia con la fecha en el nombre).
- Validá que el archivo final sea JSON válido (por ejemplo con `python3 -m json.tool`).
- Recordame al final que tengo que cerrar Claude Desktop por completo (Cmd+Q) y volver
  a abrirlo.

## Paso 4 — Instrucciones de memoria en ~/.claude/CLAUDE.md
- Si `~/.claude/CLAUDE.md` no existe, crealo con el contenido de abajo.
- Si existe, respaldalo y agregá el contenido de abajo al final, sin borrar lo que
  ya tiene. Si ya hay una sección "Memoria persistente (Engram)", mostrámela y
  preguntame antes de reemplazarla.

Contenido a agregar (copialo exactamente):

```markdown
## Memoria persistente (Engram)

Tenés acceso a Engram, una memoria persistente que sobrevive entre conversaciones
(herramientas mem_save, mem_search, mem_context, mem_get_observation,
mem_session_summary, entre otras).

Esta memoria se usa sobre todo para trabajo de análisis y toma de decisiones:
estrategia, negocio, lectura de datos desde otras herramientas y seguimiento de
temas a lo largo del tiempo. Su objetivo es que el usuario no tenga que repetir
contexto y que cada decisión quede registrada con su porqué.

### Cuándo GUARDAR (sin que te lo pidan)
Llamá a mem_save en cuanto pase alguna de estas cosas:
- Se toma una decisión ("vamos con X", "descartamos Y", "el precio queda en Z").
- Aparece un dato o hallazgo relevante al consultar otras herramientas o fuentes
  (una tendencia, una cifra clave, una anomalía). Guardá la conclusión, no el volcado crudo.
- El usuario expresa una preferencia, un criterio o una restricción.
- Se define un objetivo, una prioridad, un plazo o un responsable.
- Se aprende algo sobre un cliente, socio, proveedor o persona que va a importar después.
- Se cierra un plan después de discutir alternativas.
- En UGC Studio: qué conceptos, ángulos, actores o creativos funcionaron (o no) para cada
  producto y cliente, y por qué, para que la próxima tanda arranque de ahí
  (topic_key: "ugc/<cliente>/<producto>").

No guardes charla trivial, borradores intermedios ni información que ya está en memoria sin cambios.

### Formato de mem_save
- title: verbo + qué, corto y buscable (ej: "Define precio del plan anual en USD 990").
- type: decision | discovery | preference | pattern
- scope: project
- topic_key: clave estable cuando el tema evoluciona (ej: "pricing/plan-anual",
  "clientes/<nombre>", "objetivos/2026-q4"), para actualizar en vez de duplicar.
- content:
  **Qué**: una frase con lo decidido o descubierto
  **Por qué**: el razonamiento o los datos que lo justifican
  **Contexto**: personas involucradas, cifras, fuentes
  **A revisar**: condiciones que harían cambiar la decisión

Si una decisión nueva contradice una anterior, guardala con el mismo topic_key
y aclará qué reemplaza y por qué.

### Cuándo BUSCAR
- Al empezar un tema que pudo haberse tratado antes (un cliente, un proyecto,
  una métrica, una decisión pendiente): hacé mem_search ANTES de responder.
- Cuando el usuario diga "acordate", "qué habíamos decidido", "lo de la otra vez":
  empezá con mem_context y seguí con mem_search usando 1 o 2 palabras clave.
- Si no encontrás nada, decilo. Nunca inventes recuerdos.
- Si lo que está en memoria contradice lo que el usuario dice ahora, señalalo:
  "Antes se había decidido X porque Y. ¿Cambió algo?"

### Cómo comunicarlo
- No expliques la mecánica de la memoria. Como mucho, una línea:
  "Lo guardé" o "Según lo decidido el 12/10…".
- Nunca guardes contraseñas, tokens, datos bancarios ni datos personales sensibles.

### Cierre
Al terminar una conversación larga o un tema importante, llamá a
mem_session_summary con: Objetivo, Decisiones, Hallazgos, Pendientes y Próximos pasos.

### Compactación
Si el contexto se compacta, lo primero es guardar el resumen recibido con
mem_session_summary. Llamá a mem_context solo si hace falta más contexto.
```

## Paso 5 — Verificación final
1. Confirmá que existe `~/.engram/` (Engram la crea solo al arrancar; no hace falta
   crearla a mano). Si todavía no existe, ejecutá `ENGRAM_PROJECT=memory <RUTA_ABSOLUTA_ENGRAM> version`
   o el comando de diagnóstico que indique la documentación, y volvé a revisar.
2. Decime que reinicie Claude Code (salir y volver a entrar, o abrir una sesión nueva en la
   misma carpeta) para que cargue el MCP y el CLAUDE.md nuevos.
3. Al final, dame un resumen con:
   - versión y ruta de Engram instalada;
   - archivos creados o modificados y sus respaldos;
   - qué tengo que hacer a mano (reiniciar Claude Code; en Mac, cerrar y abrir Claude Desktop);
   - la prueba a hacer en cada cliente después de reiniciar: pedirle al agente
     "llamá a mem_current_project y decime qué proyecto detecta", y que responda `memory`.
