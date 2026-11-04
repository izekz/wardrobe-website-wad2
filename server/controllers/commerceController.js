const mongoose = require('mongoose');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { takeStock, returnStock, stockForSize } = require('../services/sizeStock');
function fail(status,message){const e=new Error(message);e.status=status;throw e}
async function checkout(req,res){
  if(req.user.role!=='consumer') fail(403,'Only customer accounts can checkout.');
  const items=Array.isArray(req.body?.items)?req.body.items:[];
  if(!items.length||items.length>30) fail(400,'Your cart is empty or too large.');
  const delivery=req.body?.delivery||{}; const payment=req.body?.payment||{};
  if(!delivery.name||!delivery.email||!delivery.address||!delivery.postal) fail(400,'Complete your delivery details.');
  if(payment.method!=='demo-card'||!/^\d{4}$/.test(String(payment.last4||''))) fail(400,'Payment confirmation is incomplete.');
  const reserved=[]; const orderItems=[];
  try{
    for(const line of items){
      if(!mongoose.isObjectIdOrHexString(line.productId)) fail(400,'One cart item is invalid.');
      const qty=Number(line.quantity); if(!Number.isInteger(qty)||qty<1||qty>10) fail(400,'Choose a valid quantity.');
      // Person 4: take stock from the chosen size only (older listings share one stock).
      const size=String(line.size||'');
      const current=await Product.findOne({_id:line.productId,status:'active'});
      if(!current) fail(409,'One of your items is no longer available. Refresh your cart and try again.');
      if(current.sizes?.length&&!current.sizes.includes(size)) fail(400,`Choose a size for ${current.name}.`);
      const take=takeStock(current,size,qty);
      const product=take&&await Product.findOneAndUpdate({_id:current._id,status:'active',...take.filter},take.update,{new:true});
      if(!product) fail(409,`${current.name}${size?` in size ${size}`:''} is no longer available in that quantity. Refresh your cart and try again.`);
      reserved.push({id:product._id,qty,back:returnStock(product,size,qty)});
      orderItems.push({productId:String(product._id),businessId:product.businessId,name:product.name,price:product.price,quantity:qty,size:String(line.size||''),colour:String(line.colour||'')});
    }
    const subtotal=orderItems.reduce((s,i)=>s+i.price*i.quantity,0);
    let orderNumber = ''; do { orderNumber = `DR${Math.floor(100000 + Math.random() * 900000)}`; } while (await Order.exists({ orderNumber }));
    const order=await Order.create({userId:req.user.id,orderNumber,items:orderItems,subtotal,delivery:{name:String(delivery.name).slice(0,100),email:String(delivery.email).slice(0,120),address:String(delivery.address).slice(0,240),postal:String(delivery.postal).slice(0,12)},payment:{method:'demo-card',last4:String(payment.last4),cardholder:String(payment.cardholder||'').slice(0,100)}});
    res.status(201).json({order:{orderId:String(order._id),orderNumber:order.orderNumber,subtotal:order.subtotal,status:order.status}});
  }catch(error){
    if(reserved.length) await Promise.all(reserved.map(r=>Product.updateOne({_id:r.id,...r.back.filter},r.back.update)));
    throw error;
  }
}

// Account shopping state is private and stored separately from public profile data.
const User = require('../models/User');
const { listedColours } = require('../services/listedColours');
const lineKey = line => `${line.productId}:${line.size || ''}:${line.colour || ''}`;

function createShoppingController(models = { User, Product }) {
  async function account(req) {
    const user = await models.User.findOne({ _id: req.user.id, role: 'consumer', suspended: { $ne: true } })
      .select('+likedProducts +cartItems');
    if (!user) fail(401, 'Please log in to continue.');
    return user;
  }
  async function productsFor(ids) {
    const rows = ids.length ? await models.Product.find({ _id: { $in: [...new Set(ids)] } })
      .select('_id businessName name price stock sizeStock status sizes colour colours colourPhotos.colour colourPhotos.contentType description') : [];
    return new Map(rows.map(product => [String(product._id), product]));
  }
  function validVariant(product, line) {
    const colours = listedColours(product);
    return (!product.sizes?.length ? !line.size : product.sizes.includes(line.size)) &&
      (!colours.length ? !line.colour : colours.includes(line.colour));
  }
  function cartJson(lines, products) {
    return lines.map(line => {
      const productId = String(line.productId), product = products.get(productId);
      return { key: lineKey({ ...line, productId }), productId, size: line.size || '', colour: line.colour || '', quantity: line.quantity,
        name: product?.name || 'Unavailable product', price: product?.price ?? 0,
        businessName: product?.businessName || '', imageURL: product?.colourPhotos?.some(row => row.colour === line.colour) ? `/api/catalog/products/${productId}/colour-image/${encodeURIComponent(line.colour)}` : `/api/catalog/products/${productId}/image`, stock: product ? stockForSize(product, line.size) : 0,
        available: !!product && product.status === 'active' && stockForSize(product, line.size) >= line.quantity && validVariant(product, line) };
    });
  }
  async function getShop(req, res) {
    const user = await account(req);
    const liked = (user.likedProducts || []).map(String), lines = (user.cartItems || []).map(line => ({
      productId: String(line.productId), size: line.size || '', colour: line.colour || '', quantity: line.quantity,
    }));
    const products = await productsFor([...liked, ...lines.map(line => line.productId)]);
    res.set('Cache-Control', 'private, no-store');
    res.json({ userId: req.user.id, liked: liked.filter(id => products.get(id)?.status === 'active'), cart: cartJson(lines, products) });
  }
  async function setLike(req, res) {
    const productId = req.params.productId, liked = req.body?.liked;
    if (!mongoose.isObjectIdOrHexString(productId) || typeof liked !== 'boolean') fail(400, 'Choose a valid product and liked state.');
    if (liked && !await models.Product.findOne({ _id: productId, status: 'active' })) fail(404, 'This product is unavailable.');
    const update = liked ? { $addToSet: { likedProducts: productId } } : { $pull: { likedProducts: productId } };
    const user = await models.User.findOneAndUpdate({ _id: req.user.id, role: 'consumer', suspended: { $ne: true } }, update, { new: true, runValidators: true });
    if (!user) fail(401, 'Please log in to continue.');
    res.json({ userId: req.user.id, productId, liked });
  }
  async function setCart(req, res) {
    if (!Array.isArray(req.body?.cart) || req.body.cart.length > 30) fail(400, 'Choose up to 30 cart items.');
    let lines = req.body.cart.map(line => {
      if (!line || !mongoose.isObjectIdOrHexString(line.productId) || !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 10 ||
          typeof line.size !== 'string' || line.size.length > 20 || typeof line.colour !== 'string' || line.colour.length > 20)
        fail(400, 'Choose valid products, quantities, sizes and colours.');
      return { productId: String(line.productId), size: line.size, colour: line.colour, quantity: line.quantity };
    });
    if (new Set(lines.map(lineKey)).size !== lines.length) fail(400, 'Combine duplicate cart items first.');
    const user = await account(req), newProductId = req.body.newProductId;
    if (newProductId !== undefined) {
      if (!mongoose.isObjectIdOrHexString(newProductId) || lines.length !== 1 || lines[0].productId !== String(newProductId))
        fail(400, 'Choose one new product to add.');
      if ((user.cartItems || []).some(line => String(line.productId) === String(newProductId)))
        fail(409, 'This product is already in your cart. Refresh its details and update the existing item.');
      // Merge into the server's current cart, so a stale tab cannot drop other items.
      lines = [...(user.cartItems || []).map(line => ({ productId: String(line.productId), size: line.size || '', colour: line.colour || '', quantity: line.quantity })), ...lines];
      if (lines.length > 30) fail(400, 'Choose up to 30 cart items.');
    }
    const products = await productsFor(lines.map(line => line.productId));
    const previous = new Map((user.cartItems || []).map(line => [lineKey(line), line]));
    for (const line of lines) {
      const product = products.get(line.productId), old = previous.get(lineKey(line));
      // Keep an existing unavailable item removable without blocking changes to other lines.
      const retained = old && line.quantity <= old.quantity;
      if ((!product || product.status !== 'active' || !validVariant(product, line) || stockForSize(product, line.size) < line.quantity) && !retained)
        fail(409, 'A cart item is unavailable in that size, colour or quantity. Refresh your cart.');
    }
    const updated = await models.User.findOneAndUpdate({ _id: req.user.id, role: 'consumer', suspended: { $ne: true }, ...(newProductId !== undefined ? { cartItems: user.cartItems } : {}) },
      { $set: { cartItems: lines } }, { new: true, runValidators: true });
    if (!updated && newProductId !== undefined) fail(409, 'Your cart changed in another tab. Refresh before adding this product.');
    if (!updated) fail(401, 'Please log in to continue.');
    res.json({ userId: req.user.id, cart: cartJson(lines, products) });
  }
  async function updateCartItem(req, res) {
    const body = req.body;
    if (!body || !mongoose.isObjectIdOrHexString(body.productId) || typeof body.size !== 'string' || body.size.length > 20 ||
        typeof body.colour !== 'string' || body.colour.length > 20 || !Number.isInteger(body.quantity) || body.quantity < 1 || body.quantity > 10)
      fail(400, 'Choose a valid product, colour, size and quantity.');
    const user = await account(req);
    const previous = (user.cartItems || []).map(line => ({ productId: String(line.productId), size: line.size || '', colour: line.colour || '', quantity: line.quantity }));
    const source = previous.find(line => lineKey(line) === req.params.key);
    if (!source) fail(409, 'This cart item changed or was removed. Reopen it from your cart.');
    if (source.productId !== String(body.productId)) fail(400, 'Update the same product already in your cart.');
    const target = { productId: source.productId, colour: body.colour, size: body.size, quantity: body.quantity };
    const collision = previous.find(line => line !== source && lineKey(line) === lineKey(target));
    if (collision) target.quantity += collision.quantity;
    const products = await productsFor(previous.map(line => line.productId)), product = products.get(target.productId);
    if (target.quantity > 10) fail(409, 'Combining these options would exceed 10 items. Reduce the quantity first.');
    if (!product || product.status !== 'active' || !validVariant(product, target) || stockForSize(product, target.size) < target.quantity)
      fail(409, 'These options or the combined quantity are unavailable. Choose an available size, colour and quantity.');
    const lines = previous.filter(line => line !== source && line !== collision);
    lines.splice(Math.min(previous.indexOf(source), lines.length), 0, target);
    const updated = await models.User.findOneAndUpdate({ _id: req.user.id, role: 'consumer', suspended: { $ne: true }, cartItems: user.cartItems },
      { $set: { cartItems: lines } }, { new: true, runValidators: true });
    if (!updated) fail(409, 'Your cart changed in another tab. Refresh and try again.');
    res.json({ userId: req.user.id, cart: cartJson(lines, products), key: lineKey(target) });
  }
  return { getShop, setLike, setCart, updateCartItem };
}
module.exports = { checkout, createShoppingController, ...createShoppingController() };
