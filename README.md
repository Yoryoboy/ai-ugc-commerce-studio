# UGC Studio

Plugin de Claude para crear videos estilo UGC (contenido de creadores) con IA para productos de
e-commerce, sin salir de la app de escritorio de Claude.

- **Generación:** conector de [Higgsfield](https://higgsfield.ai). Usa GPT Image 2.6 para las
  imágenes y Seedance 2.5 para el video con voz.
- **Datos de los productos:** conector BI-MCP. Trae el catálogo y las ventas de Mercado Libre,
  Tiendanube y VTEX.
- **Galería:** una página en tu computadora con todos los actores, productos y videos, sus
  versiones, el storyboard y los créditos. Se arma sola a partir de la carpeta del estudio y se
  actualiza mientras Claude trabaja.

## Qué necesitás

- La **app de escritorio de Claude** en Mac, con la pestaña **Code**.
- Una cuenta de **Higgsfield** con créditos.
- Acceso a **BI-MCP**. Pedíselo a quien administra los clientes.

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

Claude revisa los conectores, crea las carpetas y te abre la galería en el navegador.

## Uso diario

Abrí siempre la pestaña **Code** sobre la carpeta del estudio y pedile a Claude, con tus
palabras:

| Querés… | Escribí, por ejemplo |
|---|---|
| Crear una persona virtual para los videos | "Quiero crear un actor" |
| Elegir qué producto conviene | "¿A qué producto de este cliente le conviene un video?" |
| Hacer un video | "Quiero un video para las patas de sommier" |
| Ver todo lo creado | Doble clic en `galeria.html`, o "Abrí la galería" |

Claude te recomienda opciones y vos elegís. **Nunca gasta créditos sin decirte antes cuánto
cuesta.**

Para cada video, Claude:

1. Propone 3 ideas con guion.
2. Dibuja una imagen por escena (el storyboard) para que la apruebes.
3. Genera el video a partir de esas imágenes.

Un video de 15 s en borrador cuesta unos 56 créditos. Si te gusta, se pasa a 1080p sin volver a
generarlo. Podés dejar la galería abierta: las escenas y los videos aparecen ahí a medida que se
crean.

## Dónde queda cada cosa

```txt
UGC Studio/
├── galeria.html    la galería: abrila con doble clic
├── actores/        un actor por carpeta: retrato, ángulos, ficha
├── clientes/       por cliente y producto: fotos, ficha y videos (con storyboard y versiones)
├── studio.json     configuración del estudio (no lo borres)
└── .galeria/       índice de la galería, se arma solo (carpeta oculta)
```

Todo queda en tu computadora: borradores, finales en 1080p e imágenes. La galería solo muestra lo
que está en esta carpeta, así que no muevas ni renombres archivos a mano.

## Actualizar el plugin

En **Personalizar › Plugins**, actualizá **ugc-studio**. También podés escribir en el chat de
Code:

```txt
/plugin marketplace update ugc-studio
/plugin update ugc-studio@ugc-studio
```

Después cerrá y volvé a abrir la sesión de Code para que tome los cambios.

## Si sos un agente configurando el estudio

Seguí estos pasos en orden y verificá cada uno antes de pasar al siguiente.

1. **Conectores.** La sesión tiene que tener las herramientas de Higgsfield (`balance`) y de
   BI-MCP (`config_list_profiles`). Si falta alguno, pedile al usuario que lo conecte en
   Configuración › Conectores y esperá.
2. **Carpeta.** Trabajá en la carpeta que el usuario eligió para el estudio. Todas las sesiones
   tienen que abrirse en esa misma carpeta.
3. **Plugin.** `/plugin marketplace add Yoryoboy/ai-ugc-commerce-studio` y
   `/plugin install ugc-studio@ugc-studio`. Verificá con `/plugin` que `ugc-studio` está
   habilitado. Si la sesión ya estaba abierta, hay que reiniciarla para que carguen los hooks.
4. **Estudio.** Corré la skill `ugc-studio:setup`. Al terminar tienen que existir `studio.json`,
   `actores/`, `clientes/`, `galeria.html` y `.galeria/datos.js`.
5. **Contrato.** Dónde va cada archivo y qué tiene cada `.json` está en
   `plugins/ugc-studio/references/workspace.md`. Las skills y la galería dependen de que se
   respete.

## Cómo funciona

```txt
references/workspace.md   el contrato: carpetas, nombres de archivo y campos de cada .json
skills/                   los flujos (setup, crear-actor, crear-video); guardan según el contrato
hooks/hooks.json          al abrir la sesión y después de cada archivo que escribe Claude,
                          corre scripts/sincronizar.sh
scripts/sincronizar.sh    copia la galería al estudio, valida los .json y arma .galeria/datos.js
                          leyendo las carpetas; avisa a Claude si un .json está roto
scripts/miniatura.sh      miniatura de un video (ffmpeg, o qlmanage + sips en Mac)
galeria/galeria.html      la galería: lee datos.js y se recarga sola cada 3 segundos
```

Los hooks se instalan con el plugin y no hacen nada en carpetas que no son un estudio (sin
`studio.json`). Los scripts usan solo herramientas que trae macOS: no hay que instalar nada.

## Para desarrolladores

```txt
.claude-plugin/marketplace.json   marketplace que publica el plugin
plugins/ugc-studio/               el plugin: skills, referencias, hooks, scripts y galería
```

Tests del script de sincronización (necesitan Node): `sh tests/sincronizar.test.sh`. Para
probarlo contra un estudio real: `CLAUDE_PROJECT_DIR=<estudio> sh
plugins/ugc-studio/scripts/sincronizar.sh --resumen`.

Antes de publicar un cambio:

1. Validar: `claude plugin validate .` y `claude plugin validate plugins/ugc-studio`.
2. Subir la versión en `plugins/ugc-studio/.claude-plugin/plugin.json` y en
   `.claude-plugin/marketplace.json` (las dos iguales). Sin eso, las instalaciones no ven la
   actualización.
