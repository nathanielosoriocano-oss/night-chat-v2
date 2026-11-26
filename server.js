const express=require("express"),http=require("http"),crypto=require("crypto"),path=require("path"),fs=require("fs");
const {Server}=require("socket.io");
const app=express(),server=http.createServer(app),io=new Server(server);
const PORT=process.env.PORT||3000,DATA=path.join(__dirname,"data.json");
const OWNER="natosorio8";
let db={users:{},groups:{},sessions:{}};
try{db=JSON.parse(fs.readFileSync(DATA,"utf8"))}catch{}
function save(){fs.writeFileSync(DATA,JSON.stringify(db,null,2))}
app.use(express.json({limit:"12mb"}));app.use(express.static(path.join(__dirname,"public")));
const clean=(v,n=120)=>String(v??"").trim().slice(0,n),hash=(p,s)=>crypto.scryptSync(p,s,64).toString("hex");
function token(){return crypto.randomBytes(32).toString("hex")}
function auth(req,res,next){const t=(req.headers.authorization||"").replace(/^Bearer /,"");const s=db.sessions[t];if(!s||s.expires<Date.now()){return res.status(401).json({error:"Please sign in again."})}req.user=db.users[s.username];req.token=t;next()}
function publicUser(u){return {username:u.username,nickname:u.nickname||u.username,bio:u.bio||"",avatar:u.avatar||"",profileColor:u.profileColor||"#8ab4ff",role:u.role}}
function groupList(){return Object.values(db.groups).map(g=>({id:g.id,name:g.name,memberCount:g.members.length}))}
function findGroupByName(name){const wanted=clean(name,40).toLocaleLowerCase();return Object.values(db.groups).find(g=>g.name.toLocaleLowerCase()===wanted)}
app.get("/api/health",(_,r)=>r.json({ok:true,service:"night-chat-v2"}));
app.get("/api/setup-status",(_,r)=>r.json({ownerCreated:!!db.users[OWNER],groups:groupList()}));
app.post("/api/register", (req,res)=>{
 const username=clean(req.body.username,24).toLowerCase(),password=String(req.body.password||""),groupName=clean(req.body.groupName,40),groupPassword=String(req.body.groupPassword||"");
 if(!/^[a-z0-9_]{3,24}$/.test(username)||password.length<10)return res.status(400).json({error:"Use a 3–24 character username and a password of at least 10 characters."});
 if(db.users[username])return res.status(409).json({error:"That username is already taken."});
 const g=findGroupByName(groupName);if(!g||hash(groupPassword,g.salt)!==g.passwordHash)return res.status(403).json({error:"Group not found or group password is incorrect."});
 if(username===OWNER)return res.status(403).json({error:"The owner account can only be created during private first-time setup."});
 const salt=crypto.randomBytes(16).toString("hex");db.users[username]={username,salt,passwordHash:hash(password,salt),role:"member",groups:[g.id],nickname:username,bio:"",avatar:"",profileColor:"#8ab4ff",theme:"dark"};
 g.members.push(username);save();res.json({ok:true});
});
app.post("/api/setup-owner",(req,res)=>{
 if(!process.env.OWNER_SETUP_KEY||req.body.setupKey!==process.env.OWNER_SETUP_KEY)return res.status(403).json({error:"Owner setup is locked. Set OWNER_SETUP_KEY in the server environment first."});
 if(db.users[OWNER])return res.status(409).json({error:"Owner setup has already been completed."});
 const password=String(req.body.password||"");if(password.length<12)return res.status(400).json({error:"Choose an owner password with at least 12 characters."});
 const salt=crypto.randomBytes(16).toString("hex");db.users[OWNER]={username:OWNER,salt,passwordHash:hash(password,salt),role:"owner",groups:[],nickname:OWNER,bio:"",avatar:"",profileColor:"#8ab4ff",theme:"dark"};save();res.json({ok:true});
});
app.post("/api/login",(req,res)=>{
 const u=clean(req.body.username,24).toLowerCase(),p=String(req.body.password||""),user=db.users[u];
 if(!user||hash(p,user.salt)!==user.passwordHash)return res.status(401).json({error:"Username or password is incorrect."});
 const t=token();db.sessions[t]={username:u,expires:Date.now()+30*86400000};save();res.json({token:t,user:publicUser(user),groups:user.role==="owner"?groupList():user.groups.map(id=>db.groups[id]).filter(Boolean).map(g=>({id:g.id,name:g.name}))});
});
app.get("/api/me",auth,(req,res)=>res.json({user:publicUser(req.user),groups:req.user.role==="owner"?groupList():req.user.groups.map(id=>db.groups[id]).filter(Boolean).map(g=>({id:g.id,name:g.name}))}));
app.post("/api/logout",auth,(req,res)=>{delete db.sessions[req.token];save();res.json({ok:true})});
app.post("/api/groups",auth,(req,res)=>{
 if(req.user.role!=="owner")return res.status(403).json({error:"Only the owner can create groups."});
 const name=clean(req.body.name,40),password=String(req.body.password||"");if(name.length<2||password.length<8)return res.status(400).json({error:"Group name must be 2+ characters and group password 8+ characters."});
 if(findGroupByName(name))return res.status(409).json({error:"A group with that name already exists. Choose a different name."});const id=crypto.randomBytes(8).toString("hex"),salt=crypto.randomBytes(16).toString("hex");db.groups[id]={id,name,salt,passwordHash:hash(password,salt),members:[OWNER],messages:[],createdAt:Date.now()};req.user.groups.push(id);save();res.json({ok:true,group:{id,name}});
});
app.post("/api/groups/join",auth,(req,res)=>{
 const g=findGroupByName(req.body.groupName),p=String(req.body.password||"");if(!g||hash(p,g.salt)!==g.passwordHash)return res.status(403).json({error:"Group name or group password is incorrect."});
 if(!g.members.includes(req.user.username))g.members.push(req.user.username);if(!req.user.groups.includes(g.id))req.user.groups.push(g.id);save();res.json({ok:true});
});
app.get("/api/groups/:id",auth,(req,res)=>{
 const g=db.groups[req.params.id];if(!g||!g.members.includes(req.user.username))return res.status(403).json({error:"You are not a member of this group."});
 res.json({group:{id:g.id,name:g.name},messages:g.messages,users:g.members.map(x=>db.users[x]).filter(Boolean).map(publicUser)});
});
app.post("/api/profile",auth,(req,res)=>{
 req.user.nickname=clean(req.body.nickname,40)||req.user.username;req.user.bio=clean(req.body.bio,160);req.user.avatar=clean(req.body.avatar,2500000);req.user.profileColor=/^#[0-9a-f]{6}$/i.test(req.body.profileColor)?req.body.profileColor:"#8ab4ff";req.user.theme=req.body.theme==="light"?"light":"dark";save();res.json({user:publicUser(req.user),theme:req.user.theme});
});
io.use((socket,next)=>{const t=socket.handshake.auth?.token,s=db.sessions[t];if(!s||s.expires<Date.now())return next(new Error("Sign in required"));socket.data.username=s.username;next()});
io.on("connection",socket=>{
 socket.on("room:join",id=>{
  const g=db.groups[clean(id,40)],u=db.users[socket.data.username];if(!g||!u||!g.members.includes(u.username))return socket.emit("error:message","You are not a member of that group.");
  if(socket.data.groupId)socket.leave(socket.data.groupId);socket.data.groupId=g.id;socket.join(g.id);
  socket.emit("room:state",{group:{id:g.id,name:g.name},messages:g.messages,users:g.members.map(x=>db.users[x]).filter(Boolean).map(publicUser)});
  io.to(g.id).emit("presence:update",g.members.map(x=>db.users[x]).filter(Boolean).map(publicUser));
 });
 socket.on("message:send",p=>{
  const g=db.groups[socket.data.groupId],u=db.users[socket.data.username];if(!g||!u)return;
  const text=clean(p?.text,3000),media=p?.media&&typeof p.media==="string"&&p.media.length<8_000_000?p.media:"",kind=media?"image":"text";if(!text&&!media)return;
  const m={id:crypto.randomUUID(),kind,text,media,sender:publicUser(u),timestamp:Date.now()};g.messages.push(m);if(g.messages.length>500)g.messages.shift();save();io.to(g.id).emit("message:new",m);
 });
 socket.on("profile:refresh",()=>{const g=db.groups[socket.data.groupId];if(g)io.to(g.id).emit("presence:update",g.members.map(x=>db.users[x]).filter(Boolean).map(publicUser))});
 socket.on("call:signal",p=>{if(!socket.data.groupId||!p?.to)return;const packet={from:socket.id,data:p.data};if(p.to==="broadcast")socket.to(socket.data.groupId).emit("call:signal",packet);else io.to(p.to).emit("call:signal",packet)});
 socket.on("disconnect",()=>{const g=db.groups[socket.data.groupId];if(g)io.to(g.id).emit("presence:update",g.members.map(x=>db.users[x]).filter(Boolean).map(publicUser))});
});
server.listen(PORT,()=>console.log(`Night Chat listening on ${PORT}`));
