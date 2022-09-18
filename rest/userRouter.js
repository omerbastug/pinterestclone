import {Router} from "express";
import mongoose from "mongoose";
export const userRouter = Router();
import jwt from "jsonwebtoken";

export const authenticationMDW = (req,res,next) =>{
	let path = req.path;
	console.log(req.method +" "+ path);
	if(path === "/user/register" || path === "/user/login") {
		return next();} 
	else {
		let token = req.headers.token;
		jwt.verify(token, process.env.JWT_SECRET, function(err, decoded) {
			if(err) {
				res.status(403).json({"err": "authentication failed"})
                throw new Error("Unauthorized request")
    		}
			console.log("JWT valid , "+ decoded.data) // bar
			res.set("_id", decoded.data)
			next();
			});
	}
}

var validateEmail = function(email) {
	var re = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
	return re.test(email)
};
let userSchema = new mongoose.Schema({
	email: {
        type: String,
        trim: true,
        lowercase: true,
        unique: true,
        required: 'Email address is required',
        validate: [validateEmail, 'Please fill a valid email address'],
        match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please fill a valid email address']
    },
	password: String,
	fullname : String,
	age :  Number,
}, {"collection" : "users"});

let User = new mongoose.model("User", userSchema)

userRouter.post("/register", (req,res) => {
	let {email,password,fullname,age} = req.body;
	let user = new User({email,password,fullname,age});
	user.save((err,data)=>{
		if(err) {
			console.log(err)
			res.json(err)
			//done(err)
		} else {
			console.log(data)
			let token = jwt.sign({ data: data._id }, process.env.JWT_SECRET);
			res.status(200).json({token})
			//done(null,data)
		}
	})
})

userRouter.post("/login" , async (req,res)=> {
	let user = await User.findOne(({email: req.body.email})).exec();
	if(!user){
		res.status(403).json({"err":"Wrong email"})
	}
	if(user.password === req.body.password){
		let token = jwt.sign({ data: user._id }, process.env.JWT_SECRET);
		res.status(200).json({token})
	} else {
		res.status(401).json({"err": "Wrong password"})
	}
}
)

// module.exports = router;
// module.exports = authenticationMDW;