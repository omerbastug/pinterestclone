import axios from 'axios';
import sharp from 'sharp';
import Queue from '../public/queue.js';
import {google} from "googleapis";
import {Router} from "express";
import fetch from "node-fetch";
import mongoose from "mongoose";
async function getImageMetadata(url) {
    try { //* gets the image from url in the arraybuffer
		const response = await axios.get(url, {
			responseType: "arraybuffer",
		});
		// converts the arraybuffer to base64
		const buffer = Buffer.from(response.data, "base64");

		const metadata = await sharp(buffer).metadata();

		return metadata;
	} catch (err) {
		//console.log(err);
		return null;
	}
};

export const imagesRouter = Router(); 

let querySchema = new mongoose.Schema({
	q: String,
	user_id: String,
	date : Date,
	response : {type: Array}
}, {"collection" : "queries"});

let Query = new mongoose.model("Query", querySchema)

let recents = new Queue();
async function addToRecents(item){
	if(recents.size > 14){
		recents.dequeue();
	} 
	recents.enqueue(item);
}
async function deletefromRecents(post_id,user_id){
	for(let i = recents.front;i<recents.rear; i++){
		if(recents.items[i].post._id === post_id){
			if(recents.items[i].user_id === user_id){
				recents.delete(i);
			} else {
				console.log("unauthorized");
			}
		}
	}
}
async function likeRecentsPost(post_id,like){
	for(let i = recents.front;i<recents.rear; i++){
		if(recents.items[i].post._id === post_id){
			let index = recents.items[i].post.likes.findIndex(el => el.user_id === like.user_id);
			if(index === -1){
				recents.items[i].post.likes.push(like)
			} else {
				console.log("Post liked, at index "+index);
			}
			console.log(recents);
		}
		return;
	}
	console.log("post not found");
}
async function deletelikeRecentsPost(post_id,like){
	for(let i = recents.front;i<recents.rear; i++){
		if(recents.items[i].post._id === post_id){
			let index = recents.items[i].post.likes.findIndex(el => el.user_id === like.user_id);
			if(index === -1){
				console.log("Post not liked");
			} else {
				recents.items[i].post.likes.splice(index, 1)
			}
		}
		return;
	}
	console.log("post not found");
}
imagesRouter.get("/homepage",(req,res)=>{
	res.json(recents.items)
})

imagesRouter.post("/homepage/post",(req,res)=>{
	//console.log(req.body);
	addToRecents(req.body.item);
	res.send("recieved");
})
imagesRouter.delete("/homepage/post",(req,res)=>{
	deletefromRecents(req.body.post_id,res.get("_id"))
	res.send("recieved");
})
imagesRouter.post("/homepage/like",(req,res)=>{
	req.body.like.user_id = res.get("_id")
	likeRecentsPost(req.body.post_id,req.body.like);
	res.send("recieved")
})
imagesRouter.delete("/homepage/like",(req,res)=>{
	deletelikeRecentsPost(req.body.post_id,req.body.like);
	res.send("recieved")
})
// GOOGLE APIS
const customsearch = google.customsearch("v1");

// imagesRouter.get("/query/random/:q",async (req,res)=>{
// 	let response = await fetch("http://localhost:4001/images/v1/query/"+req.params.q,{
// 		method: 'GET',
// 		headers: {token: req.headers.token},
// 	});
// 	let items = await response.json();
	
// 	let i = Math.floor(Math.random() * 10);
// 	res.json({image: items.images[i]})
// })

imagesRouter.get("/query/:q", (req,res)=>{
	const q = req.params.q;
	const start = (req.query.page-1) * 10 || 0;
	const num = 10; // anything more throws bad request >:|
	console.log(q, start, num);

	customsearch.cse.list({
		auth: process.env.MY_GOOGLE_CS_API_KEY,
		cx: process.env.MY_SEARCH_ENGINE_ID,
		q, 
		start, 
		num
	})
		.then(async result => result.data)
		.then(async (result) => {
			let {items} = result;
			let resp = new Array();
			for(let i = 0; i<items.length; i++) {
				let url = (((items[i].pagemap || {}).cse_image || {})[0] || {}).src;
				if(!url) continue;
				let img = items[i];
				let itemToPush = {
					"description" : img.title,
					"parent_page" : img.link,
					"url": url
				}
				try {
					itemToPush.thumbnail =  img.pagemap.cse_thumbnail.map(o => ({
						"url" : o.src,
						"height": parseInt(o.height),
						"width" : parseInt(o.width)
					}))[0];
				} catch{}
				resp.push(itemToPush);
			}
			const data = {
				images: resp
			}
			let query = new Query({
				"q": q,
				date: new Date(),
				response: resp,
				user_id: res.get("_id")
			})
			query.save((err,data)=>{
				if(err) console.log(err);
				else console.log("success " + data);
			})
			res.status(200).json(data);
		})
		.catch((err) => {
			console.log(err);
			res.status(500).send(err);
		});
})

// freecodecamp image search api project main endpoint
imagesRouter.get("/query/metadata/:q", async (req,res)=>{
	let response = await fetch("http://localhost:4001/images/query/"+req.params.q,{
		method: 'GET',
		headers: {token: req.headers.token},
		query: req.query
	});
	let items = await response.json();
	await Promise.all(items.images.map(async (item) =>{
		let metadata = await getImageMetadata(item.url);
		if(metadata) {
			item.height = metadata.height;
			item.width = metadata.width;
			item.size = metadata.size;
			item.type = "image/" + metadata.format;	
		}	
	}))
	res.status(200).json(items);
})
