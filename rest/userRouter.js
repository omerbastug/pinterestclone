import e, {Router} from "express";
import mongoose from "mongoose";
export const userRouter = Router();
import jwt from "jsonwebtoken";
import fetch from "node-fetch";


export const authenticationMDW = (req,res,next) =>{
	let path = req.path;
	console.log(req.method +" "+ path);
	if(path === "/images/homepage" || path === "/user/register" || path === "/user/login") {
		return next();} 
	else {
		let token = req.headers.token;
		jwt.verify(token, process.env.JWT_SECRET, function(err, decoded) {
			if(err) {
				res.status(403).json({"err": "authentication failed"})
                throw new Error("Unauthorized request")
    		}
			console.log("JWT valid , "+ decoded.data) 
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
	posts : [{
		url : {type:String},
		likes : [{user_id : String, date: Date}],
		date : Date}]
}, {"collection" : "users"});

let User = new mongoose.model("User", userSchema)

// login
userRouter.post("/login" , async (req,res)=> {
	let user = await User.findOne(({email: req.body.email})).exec();
	if(!user){
		res.status(403).json({"err":"Wrong email"})
	}
	if(user.password === req.body.password){
		let token = jwt.sign({ data: user._id },
			process.env.JWT_SECRET/*,
			{ expiresIn: 60 * 5  - 5 minute expiration time }*/);
		res.status(200).json({token})
	} else {
		res.status(401).json({"err": "Wrong password"})
	}
})

// create user
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
			let token = jwt.sign({ data: data._id }, 
				process.env.JWT_SECRET/*,
				{ expiresIn: 60 * 5 - 5 minute expiration time }*/);
			res.status(200).json({token})
			//done(null,data)
		}
	})
})

// get user
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

// get user info by any identifier
userRouter.get('/param',(req,res)=>{
	User.findOne(req.body.param,
	(err,doc)=>{
		if(err) {
			console.log(err);
			res.status(500).json({"err":"user not found"})
		} else {
			let {_id,posts,email} =doc
			res.status(200).json({_id,posts,email})
		}
	});
})
// make post to user by id
userRouter.post("/makepost",(req,res)=>{
	User.findById(res.get("_id"),(err,doc)=>{
		if(!err){
			doc.toObject();
			// if(!doc.posts){
			// 	doc.posts = new Array();
			// }
			doc.posts.push({
				url : req.body.url,
				likes : new Array(),
				date : new Date()
			})
			let post = doc.posts.slice(-1)[0] 
			doc.save((err) => {
				if(err){ 
					console.log(err)
					res.status(500).json({"err" : "image already posted"})
				}
				else {
					fetch('http://localhost:4001/images/addhomepage',{
						method : "POST",
						headers : {token:req.headers.token, "Content-Type": "application/json"},
						body : JSON.stringify({item: {post,userid: res.get("_id")} })
					})			
					console.log(post);
					res.json({"success":"post made"})
				}
		})
		}
	});
});

userRouter.post("/likepost",(req,res)=>{
	console.log(req.body);
	User
	.find( { "posts": { $elemMatch: { _id: req.body.post_id} } }).exec()
	.then(doc =>{
			for(let i = 0;i< doc[0].posts.length; i++){// iterate over posts
				if(doc[0].posts[i]._id == req.body.post_id){ // find post with id
					let like = doc[0].posts[i].likes.findIndex(el => el.user_id === res.get("_id"));// check if already liked
					if(like === -1){
						doc[0].posts[i].likes.push({user_id: res.get("_id"), date: new Date()})
						doc[0].save((err) => {
							if(err){ 
								console.log(err)
								res.status(500).json({"err" : "DB failure"})
							}
							else {
								res.json({"success":"post made"})
							}
						})	
					} else {
						res.json({"err": "Post already liked"})
					}
					return;
				}
			}			
	})
	.catch(err => {
		console.log(err);
		res.status(400).json({"err":"post not found"})
	})
})

// remove like from post
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
