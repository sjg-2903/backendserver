const mongoose=require('mongoose');
const bcrypt=require("bcrypt");
const userSchema =new mongoose.Schema({
    name:{
        type:String,
    },
    email:{
        type:String,
        unique:true
    },
    password:{
        type:String
    },
    image:{
        type:String
    },
    resetToken: {
        type:String
    },
    resetTokenExpiration: {
        type:Date,
    },
    adminname:{
        type:String,
    },
    adminpassword:{
        type:String
    },
})

userSchema.pre('save', async function (next) {
    const user = this;
    // console.log("Just before saving & before ashing", user)
    if(!user.isModified('password')){
        return next();
    }
    user.password = await bcrypt.hash(user.password, 8);
    console.log("Just before saving & after saving",user);
    next();
})

userSchema.pre('save', async function (next) {
    const user = this;
    // console.log("Just before saving & before ashing", user)
    if(!user.isModified('adminpassword')){
        return next();
    }
    user.adminpassword = await bcrypt.hash(user.adminpassword, 8);
    console.log("Just before saving & after saving",user);
    next();
})

mongoose.model('User',userSchema);