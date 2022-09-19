import e, {Router} from "express";
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
	posts : [{url : {type:String,unique:true}, likes : [String]}]
}, {"collection" : "users"});

let User = new mongoose.model("User", userSchema)
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
})

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

userRouter.get('/',(req,res)=>{
	User.findById(res.get("_id"),
	(err,doc)=>{
		if(err) {
			console.log(err);
			res.status(500).json({"err":"user not found"})
		} else {
			res.status(200).json(doc)
		}
	});
})

userRouter.post("/makepost",(req,res)=>{
	User.findById(res.get("_id"),(err,doc)=>{
		if(!err){
			doc.toObject();
			// if(!doc.posts){
			// 	doc.posts = new Array();
			// }
			doc.posts.push({
				url : req.body.url,
				likes : new Array()
			})
			doc.save((err) => {
				if(err){ 
					console.log(err)
					res.status(500).json({"err" : "image already posted"})
				}
				else {
					res.json({"success":"post made"})
				}
		})
		}
	});
});

userRouter.post("/likepost",(req,res)=>{
	User.findById(req.body._id,
		(err,doc)=>{
			if(err){
				console.log(err);
				res.status(400).json({"err":"user not found"})
			} else {
				let i  = doc.posts.findIndex(element => {
					return element.url === req.body.url;
				})
				if(i!==-1){
					doc.posts[i].likes.push(res.get("_id"))
					doc.save((err) => {
						if(err){ 
							console.log(err)
							res.status(500).json({"err" : "DB failure"})
						}
						else {
							res.json({"success":"post made"})
						}
					})	
				} else {
					res.status(400).json({"err":"Post not found, wrong url"})
				}
						
			}
		})
})

userRouter.delete("/likepost",(req,res)=>{
	User.findById(req.body._id,
		(err,doc)=>{
			if(err){
				console.log(err);
				res.status(400).json({"err":"user not found"})
			} else {
				let i  = doc.posts.findIndex(element => {
					return element.url === req.body.url;
				})
				if(i!==-1){
					let likei = doc.posts[i].likes.indexOf(res.get("_id"))
					if (likei !== -1) {
						doc.posts[i].likes.splice(likei, 1);
						doc.save((err) => {
							if(err){ 
								console.log(err)
								res.status(500).json({"err" : "DB failure"})
							}
							else {
								res.json({"success":"like deleted"})
							}
						})	
					} else {
						res.status(400).json({"err":"Post not liked"})
					}	
				} else {
					res.status(400).json({"err":"Post not found, wrong url"})
				}	
			}
		})
})


// module.exports = router;
// module.exports = authenticationMDW;