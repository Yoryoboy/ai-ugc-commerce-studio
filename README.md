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

- La **app de escritorio de Claude** en Mac, con la pestaña **Code** (o Claude Code en la
  terminal, en Mac o Linux).
- Una cuenta de **Higgsfield** con créditos.
- Acceso a **BI-MCP**. Pedíselo a quien administra los clientes.
- **Google Chrome** instalado, para los creativos con texto en plantilla (Claude lo usa por
  detrás, sin abrir ventanas).

El setup también instala **Engram**, la memoria persistente: así Claude se acuerda de lo que
decidiste y de qué funcionó con cada producto entre una conversación y otra. Se instala solo
durante el paso 4.

## Instalación (una sola vez)

### 1. Conectar Higgsfield y BI-MCP

1. En Claude, abrí **Configuración › Conectores**.
2. Buscá **Higgsfield**, tocá **Conectar** e iniciá sesión con tu cuenta de Higgsfield.
3. Agregá **BI-MCP** con el enlace que te pasaron y conectalo.

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
> solo te va a pedir que conectes Higgsfield y BI-MCP y que abras una sesión nueva.

## Uso diario

Abrí siempre la pestaña **Code** sobre la carpeta del estudio y pedile a Claude, con tus
palabras:

| Querés… | Escribí, por ejemplo |
|---|---|
| Crear una persona virtual para los videos | "Quiero crear un actor" |
| Elegir qué producto conviene | "¿A qué producto de este cliente le conviene un video?" |
| Hacer un video | "Quiero un video para las patas de sommier" |
| Hacer creativos para Meta Ads | "Haceme creativos para Meta de las patas de sommier" |
| Ver todo lo creado | Doble clic en `galeria.html`, o "Abrí la galería" |
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
├── galeria.html    la galería: abrila con doble clic
├── actores/        un actor por carpeta: retrato, ángulos, ficha
├── clientes/       por cliente: kit de marca, y por producto: fotos, ficha, videos y creativos
├── exportaciones/  los paquetes .zip que exportás para otra compu
├── importaciones/  dejá acá los paquetes que te pasan (opcional)
├── studio.json     configuración del estudio (no lo borres)
└── .galeria/       índice de la galería, se arma solo (carpeta oculta)
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

1. **Requisitos.** Claude Code (la app de escritorio con la pestaña Code en Mac, o la terminal).
   Mac: no hace falta nada más. Linux: `node`, `ffmpeg` y Chrome o Chromium (para validar los
   `.json`, las miniaturas y los creativos). Revisá Google Chrome (en Mac,
   `/Applications/Google Chrome.app`): sin él no salen los creativos con plantilla; avisá si
   falta, no frena el resto.
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
5. **Conectores.** La sesión tiene que tener las herramientas de Higgsfield (`balance`) y de
   BI-MCP (`config_list_profiles`). Si falta alguno, pedile al usuario que lo conecte
   (Configuración › Conectores en la app; en la terminal, `/mcp`) y esperá. BI-MCP se agrega con
   el enlace que le pasaron al usuario.
6. **Sesión nueva.** El plugin y la memoria cargan al abrir una sesión. Pedile al usuario que
   abra una sesión nueva en la misma carpeta (en Mac, que además cierre Claude Desktop con Cmd+Q
   y lo vuelva a abrir) y que escriba "Configurá el estudio". No podés reiniciarte solo.
7. **Estudio.** En la sesión nueva, la skill `ugc-studio:setup` revisa conectores y memoria y
   crea el estudio. Al terminar tienen que existir `studio.json`, `actores/`, `clientes/`,
   `galeria.html` y `.galeria/datos.js`.
8. **Contrato.** Dónde va cada archivo y qué tiene cada `.json` está en
   `plugins/ugc-studio/references/workspace.md`. Las skills y la galería dependen de que se
   respete.

## Cómo funciona

```txt
references/workspace.md   el contrato: carpetas, nombres de archivo y campos de cada .json
skills/                   los flujos (setup, configurar-memoria, crear-actor, crear-video,
                          crear-creativos, transferir); guardan según el contrato
references/engram.md      cómo instalar la memoria persistente (Engram); lo sigue el setup
references/plantillas/    la plantilla HTML de los creativos con texto puesto encima
hooks/hooks.json          al abrir la sesión y después de cada archivo que escribe Claude,
                          corre scripts/sincronizar.sh
scripts/sincronizar.sh    copia la galería al estudio, valida los .json y arma .galeria/datos.js
                          leyendo las carpetas; avisa a Claude si un .json está roto
scripts/miniatura.sh      miniatura de un video (ffmpeg, o qlmanage + sips en Mac)
scripts/componer.sh       pasa una plantilla de creativo a PNG con Google Chrome sin ventana
scripts/exportar.sh       arma el paquete .zip de exportación con su manifest.json
scripts/importar.sh       revisa un paquete, muestra qué trae y lo importa sin pisar nada
galeria/galeria.html      la galería: lee datos.js y se recarga sola cada 3 segundos
```

Los hooks se instalan con el plugin y no hacen nada en carpetas que no son un estudio (sin
`studio.json`). Los scripts usan solo herramientas que trae macOS; la única excepción es
`componer.sh`, que necesita Google Chrome (o Chromium, Edge o Brave).

## Para desarrolladores

```txt
.claude-plugin/marketplace.json   marketplace que publica el plugin
plugins/ugc-studio/               el plugin: skills, referencias, hooks, scripts y galería
```

Tests (necesitan Node; los de transferir, también unzip y zip o python3; los de componer, Chrome
o Chromium): `sh tests/sincronizar.test.sh`, `sh tests/transferir.test.sh` y
`sh tests/componer.test.sh`. Para
probarlo contra un estudio real: `CLAUDE_PROJECT_DIR=<estudio> sh
plugins/ugc-studio/scripts/sincronizar.sh --resumen`.

Antes de publicar un cambio:

1. Validar: `claude plugin validate .` y `claude plugin validate plugins/ugc-studio`.
2. Subir la versión en `plugins/ugc-studio/.claude-plugin/plugin.json` y en
   `.claude-plugin/marketplace.json` (las dos iguales). Sin eso, las instalaciones no ven la
   actualización.
