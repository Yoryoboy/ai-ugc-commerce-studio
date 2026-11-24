# UGC Studio

Plugin de Claude para crear videos estilo UGC (contenido de creadores) y creativos para Meta Ads
(estáticas y carruseles) con IA para productos de e-commerce, sin salir de la app de escritorio de
Claude.

- **Generación:** conector de [Higgsfield](https://higgsfield.ai). Usa GPT Image 2.6 para las
  imágenes y Seedance 2.5 para el video con voz.
- **Datos de los productos:** conector BI-MCP. Trae el catálogo y las ventas de Mercado Libre,
  Tiendanube y VTEX.
- **Galería:** una página en tu computadora con todos los actores, productos, videos y creativos, sus
  versiones, el storyboard y los créditos. Se arma sola a partir de la carpeta del estudio y se
  actualiza mientras Claude trabaja.

## Qué necesitás

- **Claude Code**: la app de escritorio de Claude en Mac, con la pestaña **Code**, o Claude Code
  en la terminal (Mac o Linux). Es lo único que tenés que instalar vos.
- Una cuenta de **Higgsfield** con créditos.
- Acceso a **BI-MCP**. Pedíselo a quien administra los clientes.

Todo lo demás lo revisa e instala Claude durante el setup, solo si falta:

| Qué | Para qué |
|---|---|
| [Higgsfield](https://higgsfield.ai) (MCP oficial, `https://mcp.higgsfield.ai/mcp`) | Generar imágenes y videos |
| BI-MCP (`https://bi-mcp-290271124805.us-east4.run.app/mcp`) | Catálogo y ventas de cada cliente |
| Engram | La memoria persistente: Claude se acuerda de lo que decidiste y de qué funcionó |
| Google Chrome | Los creativos con texto en plantilla (Claude lo usa por detrás, sin abrir ventanas) |
| Node.js 18 o más | El servidor local de la galería (si falta, Claude instala una copia portátil en tu carpeta de usuario, sin permisos de administrador) |
| ffmpeg (solo Linux) | Las miniaturas de videos e imágenes de la galería |

El detalle de cómo se revisa e instala cada uno está en
[`references/dependencias.md`](plugins/ugc-studio/references/dependencias.md).

## Instalación (una sola vez)

### 1. Conectar Higgsfield y BI-MCP

El setup los agrega solo si faltan; después iniciás sesión una vez en cada uno (con `/mcp` en
Claude Code, o desde **Configuración › Conectores** en la app). Si preferís agregarlos vos en la
app: **Configuración › Conectores › Agregar conector personalizado**, con estas direcciones:

- Higgsfield: `https://mcp.higgsfield.ai/mcp`
- BI-MCP: `https://bi-mcp-290271124805.us-east4.run.app/mcp`

### 2. Crear la carpeta del estudio

Creá una carpeta en tu computadora solo para esto, por ejemplo `Documentos/UGC Studio`. Ahí van
a quedar todos los actores, fotos de productos, imágenes y videos que crees.

> Usá **siempre la misma carpeta**. Si abrís otra, Claude no va a encontrar tus actores ni tus
> videos.

### 3. Instalar el plugin

1. Abrí la pestaña **Code** y elegí la carpeta del estudio.
2. Andá a **Personalizar › Plugins › Agregar marketplace** y escribí:

   ```txt
   Yoryoboy/ai-ugc-commerce-studio
   ```

3. Instalá **ugc-studio**.

Si preferís escribirlo en el chat de Code, es lo mismo:

```txt
/plugin marketplace add Yoryoboy/ai-ugc-commerce-studio
/plugin install ugc-studio@ugc-studio
```

### 4. Configurar el estudio

En la pestaña **Code**, con la carpeta del estudio abierta, escribí:

```txt
Configurá el estudio
```

Claude revisa los conectores, instala la memoria, crea las carpetas y te abre la galería en el
navegador. Si instaló la memoria, al final te pide abrir una sesión nueva (y, en Mac, cerrar
Claude Desktop con Cmd+Q y volver a abrirlo).

> **Atajo:** abrí Claude en la carpeta vacía del estudio y pegale "Seteá UGC Studio siguiendo el
> README de https://github.com/Yoryoboy/ai-ugc-commerce-studio". Hace los pasos 3 y 4 por vos;
> solo te va a pedir que abras una sesión nueva e inicies sesión en Higgsfield y BI-MCP.

## Uso diario

Abrí siempre la pestaña **Code** sobre la carpeta del estudio y pedile a Claude, con tus
palabras:

| Querés… | Escribí, por ejemplo |
|---|---|
| Crear una persona virtual para los videos | "Quiero crear un actor" |
| Elegir qué producto conviene | "¿A qué producto de este cliente le conviene un video?" |
| Hacer un video | "Quiero un video para las patas de sommier" |
| Hacer creativos para Meta Ads | "Haceme creativos para Meta de las patas de sommier" |
| Ver todo lo creado | "Abrí la galería" (Claude la abre en tu navegador) |
| Activar o revisar la memoria | "Activá la memoria" |
| Pasar trabajo a otra compu | "Exportá el video de las patas", "Exportá el cliente Acme", "Exportá todo el studio" |
| Traer trabajo de otra compu | Arrastrá el `.zip` al chat, o dejalo en `importaciones/` y escribí "Importá lo que dejé" |

Claude te recomienda opciones y vos elegís. **Nunca gasta créditos sin decirte antes cuánto
cuesta.**

Para cada video, Claude:

1. Propone 3 ideas con guion.
2. Dibuja una imagen por escena (el storyboard) para que la apruebes.
3. Genera el video a partir de esas imágenes.

Un video de 15 s en borrador cuesta unos 56 créditos. Si te gusta, se pasa a 1080p sin volver a
generarlo. Podés dejar la galería abierta: las escenas y los videos aparecen ahí a medida que se
crean.

Para los creativos de Meta Ads, Claude:

1. Arma (una sola vez por cliente) el kit de marca: colores, tipografías y logo.
2. Propone una tabla de conceptos bien distintos entre sí (8 por defecto, podés pedir más o
   menos): ángulo, a quién le habla, quién aparece, estilo de imagen y si es estática o carrusel.
   Meta agrupa los anuncios que se parecen, así que cada concepto tiene que ser distinto de verdad.
3. Genera cada creativo en 4:5 (feed) y 9:16 (stories y reels), o las tarjetas del carrusel. El
   texto va dibujado por la IA o puesto con la plantilla de la marca, según el concepto.
4. Te deja en la galería cada creativo con su texto del anuncio y el nombre para Meta, listos
   para que los suba el otro conector.

Cada imagen cuesta unos 2,75 créditos: una tanda de 8 conceptos ronda los 55 créditos. Cambiar
solo el texto de una plantilla no cuesta nada.

## Dónde queda cada cosa

```txt
UGC Studio/
├── galeria.html    la página de la galería (se abre con "Abrí la galería", no con doble clic)
├── actores/        un actor por carpeta: retrato, ángulos, ficha
├── clientes/       por cliente: kit de marca, y por producto: fotos, ficha, videos y creativos
├── exportaciones/  los paquetes .zip que exportás para otra compu
├── importaciones/  dejá acá los paquetes que te pasan (opcional)
├── studio.json     configuración del estudio (no lo borres)
├── .galeria/       datos internos de la galería y del servidor, se arman solos (carpeta oculta)
└── .papelera/      lo que borrás desde la galería, se puede restaurar (carpeta oculta)
```

Todo queda en tu computadora: borradores, finales en 1080p e imágenes. La galería solo muestra lo
que está en esta carpeta, así que no muevas ni renombres archivos a mano.

## Pasar trabajo entre compus

Claude arma un paquete `.zip` con lo que pidas (un actor, un video, un producto, un cliente o todo
el estudio) y te dice dónde quedó para que lo mandes por AirDrop, WhatsApp o Drive. Del otro lado,
Claude muestra qué trae antes de tocar nada, y si algo ya existe con otro contenido te avisa y te
propone qué hacer: nunca pisa lo que ya tenés.

- Por defecto el paquete es **liviano**: sin los borradores, que quedan como link a Higgsfield y
  se pueden bajar de nuevo. Pedí "completo" si querés todo.
- **Las dos compus tienen que usar la misma cuenta de Higgsfield.** Si no, los actores no sirven
  para videos nuevos y los links pueden no abrir.

## Actualizar el plugin

En **Personalizar › Plugins**, actualizá **ugc-studio**. También podés escribir en el chat de
Code:

```txt
/plugin marketplace update ugc-studio
/plugin update ugc-studio@ugc-studio
```

Después cerrá y volvé a abrir la sesión de Code para que tome los cambios.

## Si sos un agente configurando el estudio

Seguí estos pasos en orden y verificá cada uno antes de pasar al siguiente. El usuario
normalmente no programa: hablale en castellano, simple, y decile en una línea qué hace cada paso.

1. **Requisitos.** Solo Claude Code tiene que estar instalado (la app de escritorio con la
   pestaña Code en Mac, o la terminal). El resto lo revisás e instalás vos en el paso 5.
2. **Carpeta.** Trabajá en la carpeta que el usuario eligió para el estudio (vacía la primera
   vez). Todas las sesiones tienen que abrirse en esa misma carpeta.
3. **Plugin.** Instalalo desde la terminal (los comandos `/plugin` del chat los escribe una
   persona, no vos):

   ```sh
   claude plugin marketplace add Yoryoboy/ai-ugc-commerce-studio
   claude plugin install ugc-studio@ugc-studio
   ```

   Verificá con `claude plugin list` que `ugc-studio` está habilitado.
4. **Memoria.** Instalá Engram siguiendo
   [`plugins/ugc-studio/references/engram.md`](plugins/ugc-studio/references/engram.md) (leelo
   desde GitHub: el plugin todavía no está cargado en esta sesión). Si ya está instalado, solo
   verificá.
5. **Dependencias.** Seguí
   [`plugins/ugc-studio/references/dependencias.md`](plugins/ugc-studio/references/dependencias.md):
   para cada una (Higgsfield, BI-MCP, Google Chrome, Node.js y, en Linux, ffmpeg) revisá si ya está
   y agregala solo si falta. Higgsfield y BI-MCP se agregan con `claude mcp add` y el usuario
   inicia sesión con `/mcp` en la sesión nueva.
6. **Sesión nueva.** El plugin y la memoria cargan al abrir una sesión. Pedile al usuario que
   abra una sesión nueva en la misma carpeta (en Mac, que además cierre Claude Desktop con Cmd+Q
   y lo vuelva a abrir), que inicie sesión en Higgsfield y BI-MCP con `/mcp` si los agregaste, y
   que escriba "Configurá el estudio". No podés reiniciarte solo.
7. **Estudio.** En la sesión nueva, la skill `ugc-studio:setup` revisa conectores y memoria y
   crea el estudio. Al terminar tienen que existir `studio.json`, `actores/`, `clientes/`,
   `galeria.html` y que `galeria.sh open` abra la galería.
8. **Contrato.** Dónde va cada archivo y qué tiene cada `.json` está en
   `plugins/ugc-studio/references/workspace.md`. Las skills y la galería dependen de que se
   respete.

## Cómo funciona

```txt
references/workspace.md   el contrato: carpetas, nombres de archivo y campos de cada .json
skills/                   los flujos (setup, configurar-memoria, crear-actor, crear-video,
                          crear-creativos, transferir); guardan según el contrato
references/dependencias.md qué necesita el estudio y cómo revisarlo e instalarlo si falta
references/engram.md      cómo instalar la memoria persistente (Engram); lo sigue el setup
references/plantillas/    la plantilla HTML de los creativos con texto puesto encima
hooks/hooks.json          al abrir la sesión y después de cada archivo que escribe Claude,
                          corre scripts/sincronizar.sh (enciende la galería o usa la que ya
                          corre); al cerrar la sesión apaga la galería (galeria.sh stop)
scripts/sincronizar.sh    copia la página de la galería al estudio, valida los .json que cambiaron,
                          enciende el servidor si hace falta; avisa a Claude si un .json está roto
scripts/galeria.sh        enciende, apaga y abre el servidor local de la galería (start, stop,
                          status, url, open); usa Node 18+, del sistema o el portátil de
                          ~/.ugc-studio/node
servidor/servidor.mjs     el servidor de la galería (solo módulos de Node): indexa las carpetas en
                          memoria, sirve archivos y miniaturas, y aplica acciones (estado,
                          archivar, papelera, restaurar); solo escucha en 127.0.0.1 con token
scripts/miniatura.sh      miniatura de un video (ffmpeg, o qlmanage + sips en Mac)
scripts/componer.sh       pasa una plantilla de creativo a PNG con Google Chrome sin ventana
scripts/exportar.sh       arma el paquete .zip de exportación con su manifest.json
scripts/importar.sh       revisa un paquete, muestra qué trae y lo importa sin pisar nada
galeria/galeria.html      la galería: la sirve el servidor, lee /datos.js y se recarga sola cada 3 segundos
```

Los hooks se instalan con el plugin y no hacen nada en carpetas que no son un estudio (sin
`studio.json`). Los scripts usan solo herramientas que trae macOS; las excepciones son
`componer.sh`, que necesita Google Chrome (o Chromium, Edge o Brave), y la galería, que necesita
Node.js 18 o más (`servidor/servidor.mjs` no usa paquetes externos).

## Para desarrolladores

```txt
.claude-plugin/marketplace.json   marketplace que publica el plugin
plugins/ugc-studio/               el plugin: skills, referencias, hooks, scripts y galería
```

Tests (necesitan Node 18+ y curl; los de transferir, también unzip y zip o python3; los de componer,
Chrome o Chromium): `node --test tests/*.test.mjs` (servidor), `sh tests/sincronizar.test.sh`,
`sh tests/galeria.test.sh`, `sh tests/transferir.test.sh` y `sh tests/componer.test.sh`.
`sh tests/bench-galeria.sh` mide la galería con 2.000 creativos. Para
probarlo contra un estudio real: `CLAUDE_PROJECT_DIR=<estudio> sh
plugins/ugc-studio/scripts/sincronizar.sh --resumen`.

Antes de publicar un cambio:

1. Validar: `claude plugin validate .` y `claude plugin validate plugins/ugc-studio`.
2. Subir la versión en `plugins/ugc-studio/.claude-plugin/plugin.json` y en
   `.claude-plugin/marketplace.json` (las dos iguales). Sin eso, las instalaciones no ven la
   actualización.
