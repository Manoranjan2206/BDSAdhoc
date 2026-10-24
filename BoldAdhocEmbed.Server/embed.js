const express=require('express');
const cors=require('cors');
const fs=require('fs');
const http=require('http');
const https=require('https');

const app=express();
app.use(cors());
app.use(express.json());

const config=JSON.parse(fs.readFileSync('embedConfig.json'));

app.post('/TokenGeneration',(req,res)=>{
 const payload={email:config.UserEmail,serverurl:config.ServerUrl,siteidentifier:config.SiteIdentifier,embedsecret:config.EmbedSecret,dashboard:{id:config.DashboardId}};
 const parsed=new URL(config.ServerUrl);
 const client=parsed.protocol==='https:'?https:http;
 const options={hostname:parsed.hostname,port:parsed.port||80,path:`${parsed.pathname}/api/${config.SiteIdentifier}/embed/authorize`,method:'POST',headers:{'Content-Type':'application/json'}};
 const request=client.request(options,r=>{let data='';r.on('data',c=>data+=c);r.on('end',()=>{try{const json=JSON.parse(data);res.send(json.Data.access_token);}catch(e){res.status(500).send("Invalid response from Bold BI server");}});});
 request.on('error',(err)=>{
  console.error("Bold BI Authorize connection error:", err.message);
  res.status(500).send("Bold BI Server Connection Refused: Ensure your Bold BI server is running on " + config.ServerUrl);
 });
 request.write(JSON.stringify(payload));
 request.end();
});

app.get('/getdetails',(req,res)=>res.send(config));

app.get('/',(req,res)=>{
 res.send('<h1>Backend Server is Running</h1><p>Please open the Vue application in your browser at <a href="http://localhost:8082">http://localhost:8082</a> to view the app UI.</p>');
});

app.listen(8080,()=>console.log('Server running on 8080'));
