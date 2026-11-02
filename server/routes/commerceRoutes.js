const express=require('express');
const { checkout }=require('../controllers/commerceController');
const router=express.Router();
router.post('/checkout',(req,res,next)=>checkout(req,res).catch(next));
router.use((error,req,res,next)=>{ if(res.headersSent)return next(error); res.status(error.status||500).json({message:error.status?error.message:'Checkout could not be completed.'}); });
module.exports=router;
