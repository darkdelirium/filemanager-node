const dotenv = require('dotenv')
dotenv.config()
// init Web File System
const wfs = require("wfs-local")

// get config from .env
const root = process.env.ROOTDIR
const port = process.env.PORT || "8002"
const host = process.env.HOST || "localhost"
const corsOptions = { origin: JSON.parse(process.env.CORS) }

const drive = new wfs.LocalFiles(root, null, {
	verbose: true
})

// init REST API
const fs = require("fs")
const cors = require("cors")
const path = require("path")
const Busboy = require("busboy")
const express = require("express")
const bodyParser = require("body-parser")
const { Readable } = require('stream')

const app = express()
app.use(cors(corsOptions))
app.use(bodyParser.urlencoded({ extended: true }))

app.get("/info", async (req, res, next)=>{
	const id = req.query.id
	const { free, used } = await drive.stats(id)
	try {
	res.send({
		stats:{ free, used, total: free+used },
		features:{ preview:{}, meta:{} }
		})
	}
	catch(e) {
		console.log(`/info :: Somthing went wrong... ${e}`)
	}
})

app.get("/files", async (req, res, next)=>{
	const id = req.query.id
	const search = req.query.search

	const config = {
		exclude: a => a.indexOf(".") === 0
	}
	if (search){
		config.subFolders = true
		config.include = a => a.indexOf(search) !== -1
	}
	try {
		res.send( await drive.list(id, config))
	}
	catch(e) {
		console.log(`/file :: Somthing went wrong... ${e}`)
	}
})

app.get("/folders", async (req, res, next)=>{
	try {
		res.send( await drive.list("/", {
			skipFiles: true,
			subFolders: true,
			nested: true,
			exclude: a => a.indexOf(".") === 0
		}))
	}
	catch(e) {
		console.log(`/folders :: Somthing went wrong... ${e}`)
	}
})

app.get("/icons/:size/:type/:name", async (req, res, next)=>{
	url = await getIconURL(req.params.size, req.params.type, req.params.name)
	try {
		res.sendFile(path.join(__dirname, url))
	}
	catch(e) {
		console.log(`/icons :: Somthing went wrong... ${e}`)
	}
})


app.post("/copy", async (req, res, next)=>{
	const source = req.body.id
	const target = req.body.to
	try {
		res.send(await drive.info(await drive.copy(source, target, "", { preventNameCollision: true })))
	}
	catch(e) {
		console.log(`/copy :: Somthing went wrong... ${e}`)
	}
})

app.post("/move", async (req, res, next)=>{
	const source = req.body.id
	const target = req.body.to
	try {
		res.send(await drive.info(await drive.move(source, target, "", { preventNameCollision: true })))
	}
	catch(e) {
		console.log(`/move :: Somthing went wrong... ${e}`)
	}
})

app.post("/rename", async (req, res, next)=>{
	const source = req.body.id
	const target = path.dirname(source)
	const name = req.body.name
	try {
		res.send(await drive.info(await drive.move(source, target, name, { preventNameCollision: true })))
	}
	catch(e) {
		console.log(`/rename :: Somthing went wrong... ${e}`)
	}
})

app.post("/upload", async (req, res, next)=>{
	const busboy = new Busboy({ headers: req.headers })
	try {					
	busboy.on("file", async (field, file, name) => {
		console.log(req.body, name)
		const target = await drive.make(req.query.id,  name, false, { preventNameCollision: true })
		res.send(await drive.info(await drive.write(target, file)))
	})

	req.pipe(busboy)
}
catch(e) {
	console.log(`/upload :: Somthing went wrong... ${e}`)
}
})


app.post("/makedir", async (req, res, next)=>{
	const id = await drive.make(req.body.id, req.body.name, true, { preventNameCollision: true })
	try {
		res.send(await drive.info(id))
	}
	catch(e) {
		console.log(`/makedir :: Somthing went wrong... ${e}`)
	}
})

app.post("/makefile", async (req, res, next)=>{
	const id = await drive.make(req.body.id, req.body.name, false, { preventNameCollision: true })
	try {
		res.send(await drive.info(id))
	}
	catch(e) {
		console.log(`/makefile :: Somthing went wrong... ${e}`)
	}
})

app.post("/delete", async (req, res, next)=>{
	drive.remove(req.body.id)
	try {
		res.send({})
	}
	catch(e) {
		console.log(`/delete :: Somthing went wrong... ${e}`)
	}
})

app.post("/text", async (req, res, next)=>{
	const name = req.body.id
	const content = req.body.content
	const id = await drive.write(name, Readable.from([content]))
	try {
		res.send(await drive.info(id))
	}
	catch(e) {
		console.log(`/text POST :: Somthing went wrong... ${e}`)
	}
})

app.get("/text", async (req, res, next)=>{
	const data = await drive.read(req.query.id)
	data.pipe(res)
})

app.get("/direct", async (req, res, next) => {
	const id = req.query.id
	const data = await drive.read(req.query.id)
	const info = await drive.info(req.query.id)
	const name = encodeURIComponent(info.value)

	let disposition = "inline"
	if (req.query.download){
		disposition = "attachment"
	}

	try {
	res.writeHead(200, {
		"Content-Disposition": `${disposition}; filename=${name}`
	})
	data.pipe(res)
	}
	catch(e) {
		console.log(`/direct :: Somthing went wrong... ${e}`)
	}
})

async function getIconURL(size, type, name){
	size = size.replace(/[^A-Za-z0-9.]/g, "")
	name = name.replace(/[^A-Za-z0-9.]/g, "")
	type - type.replace(/[^A-Za-z0-9.]/g, "")

	name = "icons/" + size + "/" + name

	try {
		stat = await fs.promises.stat(name)
	} catch(e){
		name = "icons/" + size + "/types/" + type + ".svg"
	}

	return name
}



// load other assets
app.use(express.static("./"))

var server = app.listen(port, host, function () {
	console.log("Server is running on port " + port + "...")
})
