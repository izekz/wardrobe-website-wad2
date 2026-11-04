// Person 4: stock per size.
//
// A product stores one stock number per size in `sizeStock`, e.g.
//   sizeStock: [{ size: 'S', stock: 2 }, { size: 'M', stock: 0 }, { size: 'L', stock: 5 }]
// `stock` is still saved as the TOTAL of all sizes, so every older check such as
// "status is active and stock > 0" keeps working without changes.
//
// Older listings made before this change have no `sizeStock`. For those, `stock`
// is one shared pool for every size, exactly like before.

function hasSizeStock(product) {
  return Array.isArray(product?.sizeStock) && product.sizeStock.length > 0;
}

// How many of this size can still be bought.
function stockForSize(product, size) {
  if (!hasSizeStock(product)) return Number(product?.stock || 0);
  const row = product.sizeStock.find(entry => entry.size === size);
  return row ? row.stock : 0;
}

// { S: 2, M: 0, L: 5 } for the API, or null for older listings.
function sizeStockMap(product) {
  if (!hasSizeStock(product)) return null;
  return Object.fromEntries(product.sizeStock.map(entry => [entry.size, entry.stock]));
}

// The filter and update that take `quantity` units of one size in a single
// atomic findOneAndUpdate. The size is addressed by its position in the array,
// and the filter also checks the size name at that position, so the update
// fails safely (returns null) if the business changed its sizes meanwhile.
function takeStock(product, size, quantity) {
  if (!hasSizeStock(product)) {
    return { filter: { stock: { $gte: quantity } }, update: { $inc: { stock: -quantity } } };
  }
  const index = product.sizeStock.findIndex(entry => entry.size === size);
  if (index < 0) return null;
  return {
    filter: { stock: { $gte: quantity }, [`sizeStock.${index}.size`]: size, [`sizeStock.${index}.stock`]: { $gte: quantity } },
    update: { $inc: { stock: -quantity, [`sizeStock.${index}.stock`]: -quantity } },
  };
}

// The opposite of takeStock, used to put units back when a checkout fails.
function returnStock(product, size, quantity) {
  if (!hasSizeStock(product)) return { filter: {}, update: { $inc: { stock: quantity } } };
  const index = product.sizeStock.findIndex(entry => entry.size === size);
  if (index < 0) return { filter: {}, update: { $inc: { stock: quantity } } };
  return {
    filter: { [`sizeStock.${index}.size`]: size },
    update: { $inc: { stock: quantity, [`sizeStock.${index}.stock`]: quantity } },
  };
}

// One-time upgrade of older listings: every size gets the old stock number.
// Example: stock 40 with sizes S, M, L, XL becomes S 40, M 40, L 40, XL 40 (total 160).
// Runs once per server start, the first time the business portal or store is used.
// The update re-checks that the product is still un-upgraded with the same stock,
// so it never overwrites a purchase or an edit that happened at the same moment.
async function upgradeOldListings(Product) {
  const old = await Product.find({ sizeStock: { $exists: false } });
  let upgraded = 0;
  for (const product of old) {
    const sizes = (product.sizes || []).filter(Boolean);
    if (!sizes.length) continue;
    const each = Number(product.stock) || 0;
    const result = await Product.updateOne({ _id: product._id, sizeStock: { $exists: false }, stock: product.stock }, {
      $set: { sizeStock: sizes.map(size => ({ size, stock: each })), stock: each * sizes.length },
    });
    if (result.modifiedCount) upgraded++;
  }
  if (upgraded) console.log(`Stock per size: gave ${upgraded} older product(s) their stock in every size.`);
  return upgraded;
}
const upgrades = new WeakMap();
function ensureSizeStock(Product) {
  if (!upgrades.has(Product)) {
    upgrades.set(Product, upgradeOldListings(Product).catch(error => {
      upgrades.delete(Product); // try again on the next request
      throw error;
    }));
  }
  return upgrades.get(Product);
}

module.exports = { hasSizeStock, stockForSize, sizeStockMap, takeStock, returnStock, upgradeOldListings, ensureSizeStock };
