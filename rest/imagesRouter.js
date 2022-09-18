import axios from 'axios';
import sharp from 'sharp';
import Queue from '../public/queue.js';
import {google} from "googleapis";
import {Router} from "express";
import fetch from "node-fetch";
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

let recents = new Queue();
async function addToRecents(item){
	if(recents.size > 14){
		recents.dequeue();
	} 
	recents.enqueue(item);

}
// GOOGLE APIS
const customsearch = google.customsearch("v1");
async function searchImages(q,start,num){
	console.log("calls");
	/*let items  = */await customsearch.cse.list({
		auth: process.env.MY_GOOGLE_CS_API_KEY,
		cx: process.env.MY_SEARCH_ENGINE_ID,
		q, 
		start, 
		num
	})
		.then( result => result.data)
		.then(data => {
			let {items} = data;
			console.log(items);
		})
	//console.log(items);
}
imagesRouter.get("/v1/query/random/:q",async (req,res)=>{
	let response = await fetch("http://localhost:4001/images/v1/query/"+req.params.q,{
		method: 'GET',
		headers: {token: req.headers.token},
	});
	let items = await response.json();
	
	let i = Math.floor(Math.random() * 10);
	res.json({image: items.images[i]})
})
imagesRouter.get("/v1/query/:q", (req,res)=>{
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
			res.status(200).json(data);
		})
		.catch((err) => {
			console.log(err);
			res.status(500).send(err);
		});
})

// freecodecamp image search api project main endpoint
imagesRouter.get("/v1/query/metadata/:q", async (req,res)=>{
	const q = req.params.q;
	const start = (req.query.page -1)* 10 || 0;
	const num = 10;
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

			await Promise.all(resp.map(async (item) =>{
				let metadata = await getImageMetadata(item.url);
				if(metadata) {
					item.height = metadata.height;
					item.width = metadata.width;
					item.size = metadata.size;
					item.type = "image/" + metadata.format;	
				}	
			}))
			const data = {
				images: resp
			}
			console.log(data);
			res.status(200).send(data);
		})
		.catch((err) => {
			console.log(err);
			res.status(500).send(err);
		});
})
