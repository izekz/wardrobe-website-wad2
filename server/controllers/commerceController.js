const mongoose = require('mongoose');
const Product = require('../models/Product');
const Order = require('../models/Order');
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
      const product=await Product.findOneAndUpdate({_id:line.productId,status:'active',stock:{$gte:qty}},{$inc:{stock:-qty}},{new:true});
      if(!product) fail(409,'One of your items is no longer available in that quantity. Refresh your cart and try again.');
      reserved.push({id:product._id,qty});
      orderItems.push({productId:String(product._id),businessId:product.businessId,name:product.name,price:product.price,quantity:qty,size:String(line.size||''),colour:String(line.colour||'')});
    }
    const subtotal=orderItems.reduce((s,i)=>s+i.price*i.quantity,0);
    let orderNumber = ''; do { orderNumber = `DR${Math.floor(100000 + Math.random() * 900000)}`; } while (await Order.exists({ orderNumber }));
    const order=await Order.create({userId:req.user.id,orderNumber,items:orderItems,subtotal,delivery:{name:String(delivery.name).slice(0,100),email:String(delivery.email).slice(0,120),address:String(delivery.address).slice(0,240),postal:String(delivery.postal).slice(0,12)},payment:{method:'demo-card',last4:String(payment.last4),cardholder:String(payment.cardholder||'').slice(0,100)}});
    res.status(201).json({order:{orderId:String(order._id),orderNumber:order.orderNumber,subtotal:order.subtotal,status:order.status}});
  }catch(error){
    if(reserved.length) await Promise.all(reserved.map(r=>Product.updateOne({_id:r.id},{$inc:{stock:r.qty}})));
    throw error;
  }
}
module.exports={checkout};
