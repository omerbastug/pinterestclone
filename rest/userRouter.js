import {Router} from "express";
import mongoose from "mongoose";
export const userRouter = Router();
import jwt from "jsonwebtoken";
import multer from "multer";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fileUpload from "express-fileupload"


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export const authenticationMDW = (req,res,next) =>{
	let path = req.path;
	console.log(req.method +" "+ path);
	let token = req.headers["authorization"];
	if((path.startsWith("/images/query/") && token===undefined) || 
	path === "/images/homepage" || 
	path === "/user/register" || 
	path === "/user/login" ||
	path === "/login" ||
	path === "/google/auth/getdata/" ||
	path === "/google/auth/geturl" ||
	path.startsWith("/static/") ||
	path.startsWith("/user/profilepicture/")) {
		return next();} 
	else {
		
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
		date : Date
	}],
	googleUser : Boolean,
	profilePicture : {
		_id : mongoose.Types.ObjectId, 
		image : {
			path  : String,
			mimetype: String,
			size : Number,
			name : String
		}
	}
}, {"collection" : "users"});

export let User = new mongoose.model("User", userSchema)

const myStorage = multer.diskStorage({
	destination: "./profilePictures",
	filename: (req,file,cb) =>{
		cb(null,file.originalname)
	}
})

const upload = multer({
	storage: myStorage
}).single("testImage")
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
		res.status(200).json({"Authorization":token})
	} else {
		res.status(401).json({"err": "Wrong password"})
	}
})

// create user
userRouter.post("/register", (req,res) => {
	let {email,password,fullname,age} = req.body;
	let user = new User({email,password,fullname,age,googleUser:false});
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
			res.status(200).json({"Authorization":token})
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
					fetch('http://localhost:4001/images/homepage/post',{
						method : "POST",
						headers : {token:req.headers.token, "Content-Type": "application/json"},
						body : JSON.stringify({item: {post,user_id: res.get("_id")} })
					})			
					console.log(post);
					res.json({"success":"post made"})
				}
		})
		}
	});
});
userRouter.delete("/deletepost",(req,res)=>{
	User.findById(res.get("_id"),(err,doc)=>{
		if(!err){
			doc.toObject();
			// if(!doc.posts){
			// 	doc.posts = new Array();
			// }
			let found = false;
			for(let i = 0;i< doc.posts.length; i++){// iterate over posts
				if(doc.posts[i]._id == req.body.post_id){ // find post with id
					found = true;
					doc.posts.splice(i,1)
					doc.save((err) => {
						if(err){ 
							console.log(err)
							res.status(500).json({"err" : "DB error"})
						}
						else {
							fetch('http://localhost:4001/images/homepage/post',{
								method : "DELETE",
								headers : {token:req.headers.token, "Content-Type": "application/json"},
								body : JSON.stringify({post_id: req.body.post_id})
							})			
							res.json({"success":"post deleted"})
						}
					})
					break;
				}
			}
			if(!found) res.json({"err":"Post not found"})			
		} else {
			res.status(400).json({"err":"user not found"})
		}
	});
});

userRouter.post("/likepost",(req,res)=>{
	User
	.find( { "posts": { $elemMatch: { _id: req.body.post_id} } }).exec()
	.then(doc =>{
			for(let i = 0;i< doc[0].posts.length; i++){// iterate over posts
				if(doc[0].posts[i]._id == req.body.post_id){ // find post with id
					let like = doc[0].posts[i].likes.findIndex(el => el.user_id === res.get("_id"));// check if already liked
					if(like === -1){
						let like = {user_id: res.get("_id"), date: new Date()};
						doc[0].posts[i].likes.push(like)
						doc[0].save((err) => {
							if(err){ 
								console.log(err)
								res.status(500).json({"err" : "DB failure"})
							}
							else {
								fetch('http://localhost:4001/images/homepage/like',{
									method : "POST",
									headers : {token:req.headers.token, "Content-Type": "application/json"},
									body : JSON.stringify({post_id : req.body.post_id,like})
								})
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
	User
	.find( { "posts": { $elemMatch: { _id: req.body.post_id} } }).exec()
	.then(doc =>{
		let i  = doc[0].posts.findIndex(element => {
			return element._id == req.body.post_id;
		})
		console.log(doc[0].posts[i].likes);
		let likei = doc[0].posts[i].likes.findIndex(el => el.user_id === res.get("_id"))
		console.log(likei);
		if (likei !== -1) {
			doc[0].posts[i].likes.splice(likei, 1);
			doc[0].save((err) => {
				if(err){ 
					console.log(err)
					res.status(500).json({"err" : "DB failure"})
				}
				else {
					fetch('http://localhost:4001/images/homepage/like',{
						method : "DELETE",
						headers : {token:req.headers.token, "Content-Type": "application/json"},
						body : JSON.stringify({post_id : req.body.post_id,like:{user_id:res.get("_id")}})
					})
					res.json({"success":"like deleted"})
				}
			})	
		} else {
			res.status(400).json({"err":"Post not liked"})
		}	
	})
	.catch(err => {
		console.log(err);
		res.status(400).json({"err":"Post not found, wrong url"})
	})
})

userRouter.post('/upload/pp', fileUpload()  , (req, res) => {
    // Get the file that was set to our field named "image"
    const image  = req.files.testImage;
	
	console.log(req.files);
    // If no image submitted, exit
    if (!image) return res.sendStatus(400);
	if(image.mimetype !== "image/jpeg" && image.mimetype !== "image/png") return res.sendStatus(400)
	let mimetypepath = "."+image.mimetype.split("/")[1]
	User.findById(res.get("_id")).exec().then(doc => {
		console.log(doc);
		doc.profilePicture = {
			_id : mongoose.Types.ObjectId(),
			image : {
				path : __dirname + '/profilePictures/' + res.get("_id")+ mimetypepath,
				mimetype: image.mimetype,
				size: image.size,
				name: image.name
			}
		};
		doc.save((err)=>{
			if(err) {
				console.log(err);
				res.json({err})
			} else { 
				// Move the uploaded image to our upload folder
				image.mv(__dirname + '/profilePictures/' + res.get("_id")+ mimetypepath);

				res.sendStatus(200);
			}
		})
	}).catch((err)=>{
		console.log(err);
		res.json({"err":"user not found"})
	})

});

userRouter.get("/profilepicture/:id",async (req,res)=>{
	let user = await User.findOne(({_id: req.params.id})).exec();
	let path = user.profilePicture.image.path
	console.log(path);
	if(!path){
		res.status(400).json({"err":"Picture not found"})
	} else {
		 return res.sendFile(path)
	}
	console.log(user);
	res.send(null)
})
