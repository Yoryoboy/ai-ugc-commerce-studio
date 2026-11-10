# UGC Studio

Plugin de Claude para crear videos estilo UGC (contenido de creadores) con IA para productos de
e-commerce, sin salir de la app de escritorio de Claude.

- **Generación:** conector de [Higgsfield](https://higgsfield.ai). Usa GPT Image 2.6 para las
  imágenes y Seedance 2.5 para el video con voz.
- **Datos de los productos:** conector BI-MCP. Trae el catálogo y las ventas de Mercado Libre,
  Tiendanube y VTEX.
- **Tablero:** una página de Claude con todos los videos por cliente y producto, sus versiones y
  los créditos usados y disponibles.

## Qué necesitás

- La **app de escritorio de Claude** (Mac o Windows), con la pestaña **Code**.
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

Claude revisa los conectores, crea las carpetas y publica tu tablero. Al final te da el enlace
del tablero; conviene fijarlo en la barra lateral de Claude.

## Uso diario

Abrí siempre la pestaña **Code** sobre la carpeta del estudio y pedile a Claude, con tus
palabras:

| Querés… | Escribí, por ejemplo |
|---|---|
| Crear una persona virtual para los videos | "Quiero crear un actor" |
| Elegir qué producto conviene | "¿A qué producto de este cliente le conviene un video?" |
| Hacer un video | "Quiero un video para las patas de sommier" |
| Ver todo lo creado | Abrí el tablero |

Claude te recomienda opciones y vos elegís. **Nunca gasta créditos sin decirte antes cuánto
cuesta.**

Para cada video, Claude:

1. Propone 3 ideas con guion.
2. Dibuja una imagen por escena (el storyboard) para que la apruebes.
3. Genera el video a partir de esas imágenes.

Un video de 15 s en borrador cuesta unos 56 créditos. Si te gusta, se pasa a 1080p sin volver a
generarlo.

## Dónde queda cada cosa

```txt
UGC Studio/
├── actores/        un actor por carpeta: retrato, ángulos, ficha
├── clientes/       por cliente y producto: fotos, ficha y videos
└── studio.json     configuración del estudio (no lo borres)
```

Los videos finales en alta calidad se ven y se descargan desde Higgsfield. El tablero tiene las
miniaturas, los borradores y el enlace a cada video.

## Actualizar el plugin

En **Personalizar › Plugins**, actualizá **ugc-studio**. También podés escribir en el chat de
Code:

```txt
/plugin marketplace update ugc-studio
/plugin update ugc-studio@ugc-studio
```

Después cerrá y volvé a abrir la sesión de Code para que tome los cambios.

## Para desarrolladores

```txt
.claude-plugin/marketplace.json   marketplace que publica el plugin
plugins/ugc-studio/               el plugin: skills, referencias y plantilla del tablero
```

Antes de publicar un cambio:

1. Validar: `claude plugin validate .` y `claude plugin validate plugins/ugc-studio`.
2. Subir la versión en `plugins/ugc-studio/.claude-plugin/plugin.json` y en
   `.claude-plugin/marketplace.json` (las dos iguales). Sin eso, las instalaciones no ven la
   actualización.
