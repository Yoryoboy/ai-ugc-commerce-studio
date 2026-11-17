# Product step (shared by `crear-video` and `crear-creativos`)

Talk to the user in Spanish (Rioplatense, warm, short). Save files where `workspace.md` says.

## 1. Choose client and product

If the product is not clear, ask which client (BI-MCP profile) and product, or offer to
recommend one with real sales data (`meli_get_sales_by_item`, or the platform's equivalent).

If `clientes/<profileId>/<productId>/ficha.md` and `producto.json` already exist, reuse them:
re-load the listing only to check status and stock, or when the user says it changed.

## 2. Load the product

Load it from its platform through BI-MCP (Mercado Libre: `meli_get_item_details` with
`includePictures: true` and `meli_get_item_description`; VTEX and Tiendanube: their product
tools). Then:

1. Check status and stock. If paused or without stock, warn before continuing (`claims-rules.md`).
2. Download the photos to `clientes/<profileId>/<productId>/fotos/` and look at them.
3. Write `clientes/<profileId>/<productId>/ficha.md`: title, price, key attributes, and the
   **allowed** and **forbidden** claims with their sources (`claims-rules.md`). Photo text counts
   as a source, but health or medical promises are always forbidden.
4. Write `clientes/<profileId>/<productId>/producto.json` if it does not exist (`workspace.md`),
   with the best photo as `cover`.
