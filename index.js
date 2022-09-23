import * as dotenv from 'dotenv';
dotenv.config();
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// MongoDB connection 
import mongoose from "mongoose";
mongoose.connect(process.env.MONGO_URI,
	 			{
					dbName: "SampleDB", 
					useNewUrlParser: true, 
					useUnifiedTopology: true }
				)
		.then(() => {
			console.log('Database connection successful')
		})
		.catch(err => {
			console.error('Database connection error')
		});
// express 
import express from "express";
const app = express();
import bodyParser from "body-parser";
app.use(bodyParser.json());

import cors from "cors";
app.use(cors())


app.use("/static",express.static('public'))
app.get('/', (req, res) => {
	console.log(req.query);
  	res.sendFile(__dirname + '/views/index.html')
});
app.get('/login', (req, res) => {
	console.log(req.query);
	res.sendFile(__dirname + '/views/login.html')
  });

import {authenticationMDW,userRouter} from "./rest/userRouter.js"
import {imagesRouter} from "./rest/imagesRouter.js"


app.use(authenticationMDW);

app.use("/images",imagesRouter);
app.use("/user",userRouter);


import { googleAuthRouter } from './rest/googleOAuth.js';
app.use("/google/auth",googleAuthRouter);

const port = process.env.PORT || 5000;
app.listen(
    port,
    ()=>{
        console.log(`Server listening on port: ${port}`);
})  