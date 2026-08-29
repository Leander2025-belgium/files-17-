const express = require('express');

const cors = require('cors');

const bcrypt = require('bcryptjs');

const jwt = require('jsonwebtoken');

const { Pool } = require('pg');

const multer = require('multer');

const webpush = require('web-push');

const crypto = require('crypto');

const fs = require('fs');

const path = require('path');

const nodemailer = require('nodemailer');
const { getWeather } = require('./weather-engine');

const app = express();

const PORT = Number(process.env.PORT || 3000);

const DB = new Pool({host:process.env.DB_HOST || 'postgres', port:5432, database:process.env.POSTGRES_DB || 'wheaterflow', user:process.env.POSTGRES_USER || 'wheaterflow', password:process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD});

const JWT_SECRET = process.env.JWT_SECRET;

const PUBLIC_API_URL = (process.env.PUBLIC_API_URL || 'https://api.wheaterflow.be').replace(/\/$/,'');

const PUBLIC_APP_URL = (process.env.PUBLIC_APP_URL || 'https://wheaterflow.be').replace(/\/$/,'');

const UPLOAD_ROOT = process.env.UPLOAD_ROOT || '/app/uploads';

if(!JWT_SECRET) throw new Error('JWT_SECRET ontbreekt');

fs.mkdirSync(path.join(UPLOAD_ROOT,'avatars'), {recursive:true});

fs.mkdirSync(path.join(UPLOAD_ROOT,'community'), {recursive:true});


const allowed = (process.env.CORS_ORIGINS || 'https://wheaterflow.be,https://www.wheaterflow.be').split(',').map(s=>s.trim()).filter(Boolean);

app.use(cors({origin(origin,cb){ if(!origin || allowed.includes(origin)) return cb(null,true); cb(new Error('CORS')); }, methods:['GET','POST','PUT','PATCH','DELETE','OPTIONS'], allowedHeaders:['Content-Type','Authorization']}));

app.use(express.json({limit:'2mb'}));

app.use('/uploads', express.static(UPLOAD_ROOT, {maxAge:'7d', immutable:false}));


function auth(req,res,next){

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i,'');

  if(!token) return res.status(401).json({error:'Niet ingelogd'});

  try{ req.auth = jwt.verify(token, JWT_SECRET, {issuer:'wheaterflow-api', audience:'wheaterflow'}); next(); }

  catch(e){ return res.status(401).json({error:'Ongeldige of verlopen sessie'}); }

}

const maybeAuth=(req,res,next)=>{ const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,''); if(!token){req.auth=null;return next();} try{req.auth=jwt.verify(token,JWT_SECRET,{issuer:'wheaterflow-api',audience:'wheaterflow'});}catch(e){req.auth=null;} next(); };

const n=v=>v===''||v==null?null:Number(v);

const safeId=()=>crypto.randomUUID();

const upload = multer({storage:multer.diskStorage({destination(req,file,cb){const kind=file.fieldname==='avatar'?'avatars':'community';const dir=path.join(UPLOAD_ROOT,kind);fs.mkdirSync(dir,{recursive:true});cb(null,dir);},filename(req,file,cb){const mimeToExt={'image/jpeg':'.jpg','image/jpg':'.jpg','image/png':'.png','image/webp':'.webp','image/heic':'.heic','image/heif':'.heif'};const originalExt=path.extname(file.originalname||'').toLowerCase();const ext=mimeToExt[file.mimetype]||originalExt||'.img';cb(null,`${safeId()}${ext}`);}}),limits:{fileSize:12*1024*1024},fileFilter(req,file,cb){const allowedMimeTypes=['image/jpeg','image/jpg','image/png','image/webp','image/heic','image/heif'];const allowedExtensions=['.jpg','.jpeg','.png','.webp','.heic','.heif'];const ext=path.extname(file.originalname||'').toLowerCase();const allowed=allowedMimeTypes.includes(file.mimetype)||allowedExtensions.includes(ext);if(!allowed)return cb(new Error('Alleen JPG, PNG, WebP, HEIC en HEIF afbeeldingen zijn toegestaan.'));cb(null,true);}});


app.get('/api/health', async(req,res)=>{try{await DB.query('SELECT 1');res.json({status:'ok',database:'connected',service:'wheaterflow-api'});}catch(e){res.status(500).json({status:'error',database:'disconnected'});}});


app.post('/api/auth/register', async(req,res)=>{try{

  let {username,email,password,displayName}=req.body; username=String(username||'').trim(); email=String(email||'').trim().toLowerCase(); displayName=String(displayName||username).trim();

  if(!username||!email||!password) return res.status(400).json({error:'Ontbrekende gegevens'});

  if(password.length<8) return res.status(400).json({error:'Wachtwoord moet minstens 8 tekens bevatten'});

  const hash=await bcrypt.hash(password,12);

  const r=await DB.query(`INSERT INTO users(username,email,password_hash,display_name) VALUES($1,$2,$3,$4) RETURNING id,username,email,display_name,role,created_at`,[username,email,hash,displayName]);

  await DB.query(`INSERT INTO profiles(user_id,display_name) VALUES($1,$2) ON CONFLICT(user_id) DO NOTHING`,[r.rows[0].id,displayName]);

  const u=r.rows[0]; res.status(201).json({message:'Account aangemaakt',user:{id:u.id,username:u.username,email:u.email,displayName:u.display_name,role:u.role||'user'}});

}catch(e){if(e.code==='23505')return res.status(409).json({error:'Gebruikersnaam of e-mailadres bestaat al'});console.error(e);res.status(500).json({error:'Serverfout'});}});


app.post('/api/auth/login', async(req,res)=>{try{

  const email=String(req.body.email||'').trim().toLowerCase(), password=String(req.body.password||'');

  const r=await DB.query(`SELECT id,username,email,password_hash,display_name,role FROM users WHERE lower(email)=lower($1) LIMIT 1`,[email]);

  if(!r.rows.length || !(await bcrypt.compare(password,r.rows[0].password_hash))) return res.status(401).json({error:'Ongeldige login'});

  const u=r.rows[0]; const token=jwt.sign({userId:u.id,username:u.username,role:u.role||'user'},JWT_SECRET,{expiresIn:'30d',issuer:'wheaterflow-api',audience:'wheaterflow'});

  res.json({token,user:{id:u.id,username:u.username,email:u.email,displayName:u.display_name,role:u.role||'user'}});

}catch(e){console.error(e);res.status(500).json({error:'Serverfout'});}});


function mailer(){ if(!process.env.SMTP_HOST) return null; return nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),secure:String(process.env.SMTP_SECURE||'false')==='true',auth:process.env.SMTP_USER?{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}:undefined}); }

app.post('/api/auth/password-reset/request', async(req,res)=>{try{const email=String(req.body.email||'').trim().toLowerCase(); const u=await DB.query('SELECT id FROM users WHERE lower(email)=lower($1)',[email]); if(u.rows.length){const raw=crypto.randomBytes(32).toString('hex'); const hash=crypto.createHash('sha256').update(raw).digest('hex'); await DB.query('DELETE FROM password_reset_tokens WHERE user_id=$1',[u.rows[0].id]); await DB.query(`INSERT INTO password_reset_tokens(user_id,token_hash,expires_at) VALUES($1,$2,now()+interval '1 hour')`,[u.rows[0].id,hash]); const tx=mailer(); if(tx) await tx.sendMail({from:process.env.SMTP_FROM||'Wheaterflow <no-reply@wheaterflow.be>',to:email,subject:'Wheaterflow wachtwoord herstellen',text:`Open deze link om je wachtwoord te wijzigen: ${PUBLIC_APP_URL}/?reset_token=${raw}`}); else console.log('PASSWORD RESET URL:',`${PUBLIC_APP_URL}/?reset_token=${raw}`);} res.json({ok:true});}catch(e){console.error(e);res.status(500).json({error:'Reset kon niet worden gestart'});}});

app.post('/api/auth/password-reset/confirm', async(req,res)=>{try{const raw=String(req.body.token||''), password=String(req.body.password||''); if(password.length<8)return res.status(400).json({error:'Wachtwoord te kort'}); const hash=crypto.createHash('sha256').update(raw).digest('hex'); const r=await DB.query(`SELECT user_id FROM password_reset_tokens WHERE token_hash=$1 AND used_at IS NULL AND expires_at>now()`,[hash]); if(!r.rows.length)return res.status(400).json({error:'Resetlink ongeldig of verlopen'}); const ph=await bcrypt.hash(password,12); await DB.query('UPDATE users SET password_hash=$1,updated_at=now() WHERE id=$2',[ph,r.rows[0].user_id]); await DB.query('UPDATE password_reset_tokens SET used_at=now() WHERE token_hash=$1',[hash]); res.json({ok:true});}catch(e){console.error(e);res.status(500).json({error:'Wachtwoord kon niet worden gewijzigd'});}});


app.get('/api/profile',auth,async(req,res)=>{try{let p=(await DB.query('SELECT * FROM profiles WHERE user_id=$1',[req.auth.userId])).rows[0]; if(!p){const u=(await DB.query('SELECT display_name FROM users WHERE id=$1',[req.auth.userId])).rows[0]; p=(await DB.query('INSERT INTO profiles(user_id,display_name) VALUES($1,$2) RETURNING *',[req.auth.userId,u?.display_name||'Wheaterflow gebruiker'])).rows[0];} const f=(await DB.query('SELECT id,name,latitude,longitude,country,sort_order FROM favorite_locations WHERE user_id=$1 ORDER BY sort_order,created_at',[req.auth.userId])).rows; res.json({profile:p,favorites:f});}catch(e){console.error(e);res.status(500).json({error:'Profiel kon niet worden geladen'});}});

app.put('/api/profile',auth,async(req,res)=>{try{const b=req.body||{}; const r=await DB.query(`INSERT INTO profiles(user_id,display_name,home_location_name,home_latitude,home_longitude,language,temperature_unit,wind_unit,pressure_unit,precipitation_unit,forecast_days,weather_model,notifications_enabled) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT(user_id) DO UPDATE SET display_name=excluded.display_name,home_location_name=excluded.home_location_name,home_latitude=excluded.home_latitude,home_longitude=excluded.home_longitude,language=excluded.language,temperature_unit=excluded.temperature_unit,wind_unit=excluded.wind_unit,pressure_unit=excluded.pressure_unit,precipitation_unit=excluded.precipitation_unit,forecast_days=excluded.forecast_days,weather_model=excluded.weather_model,notifications_enabled=excluded.notifications_enabled,updated_at=now() RETURNING *`,[req.auth.userId,b.display_name,b.home_location_name,n(b.home_latitude),n(b.home_longitude),b.language||'nl',b.temperature_unit,b.wind_unit,b.pressure_unit,b.precipitation_unit,n(b.forecast_days),b.weather_model,b.notifications_enabled===true]); await DB.query('UPDATE users SET display_name=$1,updated_at=now() WHERE id=$2',[b.display_name,req.auth.userId]); res.json({profile:r.rows[0]});}catch(e){console.error(e);res.status(500).json({error:'Profiel kon niet worden opgeslagen'});}});

app.post('/api/profile/avatar',auth,upload.single('avatar'),async(req,res)=>{try{if(!req.file)return res.status(400).json({error:'Geen geldige afbeelding'}); const url=`${PUBLIC_API_URL}/uploads/avatars/${req.file.filename}`; const r=await DB.query(`INSERT INTO profiles(user_id,display_name,avatar_url) SELECT id,display_name,$2 FROM users WHERE id=$1 ON CONFLICT(user_id) DO UPDATE SET avatar_url=$2,updated_at=now() RETURNING *`,[req.auth.userId,url]); res.json({profile:r.rows[0]});}catch(e){console.error(e);res.status(500).json({error:'Avatar kon niet worden opgeslagen'});}});

app.put('/api/favorites',auth,async(req,res)=>{const c=await DB.connect();try{await c.query('BEGIN');await c.query('DELETE FROM favorite_locations WHERE user_id=$1',[req.auth.userId]);for(const f of (req.body.favorites||[])){await c.query(`INSERT INTO favorite_locations(user_id,name,latitude,longitude,country,sort_order) VALUES($1,$2,$3,$4,$5,$6)`,[req.auth.userId,String(f.name||'Favoriet').slice(0,80),n(f.latitude),n(f.longitude),String(f.country||'').slice(0,120),n(f.sort_order)||0]);}await c.query('COMMIT');res.json({ok:true});}catch(e){await c.query('ROLLBACK');console.error(e);res.status(500).json({error:'Favorieten konden niet worden opgeslagen'});}finally{c.release();}});


app.get('/api/climate',auth,async(req,res)=>{try{const r=await DB.query('SELECT * FROM personal_weather_days WHERE user_id=$1 ORDER BY date',[req.auth.userId]);res.json({records:r.rows});}catch(e){res.status(500).json({error:'Klimaatdata kon niet worden geladen'});}});

app.put('/api/climate',auth,async(req,res)=>{const c=await DB.connect();try{await c.query('BEGIN');for(const x of (req.body.records||[])){await c.query(`INSERT INTO personal_weather_days(user_id,date,location_name,latitude_rounded,longitude_rounded,min_temperature,max_temperature,mean_temperature,precipitation_total,max_wind_gust,uv_max,weather_code,warning_count,source_name,data_quality,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,COALESCE($16,now())) ON CONFLICT(user_id,date,location_key) DO UPDATE SET latitude_rounded=excluded.latitude_rounded,longitude_rounded=excluded.longitude_rounded,min_temperature=excluded.min_temperature,max_temperature=excluded.max_temperature,mean_temperature=excluded.mean_temperature,precipitation_total=excluded.precipitation_total,max_wind_gust=excluded.max_wind_gust,uv_max=excluded.uv_max,weather_code=excluded.weather_code,warning_count=excluded.warning_count,source_name=excluded.source_name,data_quality=excluded.data_quality`,[req.auth.userId,x.date,x.location_name,n(x.latitude_rounded),n(x.longitude_rounded),n(x.min_temperature),n(x.max_temperature),n(x.mean_temperature),n(x.precipitation_total),n(x.max_wind_gust),n(x.uv_max),n(x.weather_code),n(x.warning_count),x.source_name,x.data_quality,x.created_at||null]);}await c.query('COMMIT');res.json({ok:true});}catch(e){await c.query('ROLLBACK');console.error(e);res.status(500).json({error:'Klimaatdata kon niet worden opgeslagen'});}finally{c.release();}});

app.delete('/api/climate/location',auth,async(req,res)=>{await DB.query('DELETE FROM personal_weather_days WHERE user_id=$1 AND location_name=$2',[req.auth.userId,req.body.location_name]);res.json({ok:true});});

app.delete('/api/climate',auth,async(req,res)=>{await DB.query('DELETE FROM personal_weather_days WHERE user_id=$1',[req.auth.userId]);res.json({ok:true});});


function communitySelect(userId){return `SELECT p.*, pr.display_name AS profile_display_name, pr.avatar_url AS profile_avatar_url, (SELECT count(*)::int FROM community_likes l WHERE l.post_id=p.id) like_count, (SELECT count(*)::int FROM community_comments c WHERE c.post_id=p.id) comment_count, EXISTS(SELECT 1 FROM community_likes l WHERE l.post_id=p.id AND l.user_id=$1) liked, EXISTS(SELECT 1 FROM community_favorites f WHERE f.post_id=p.id AND f.user_id=$1) saved, COALESCE((SELECT json_agg(json_build_object('id',c.id,'body',c.body,'created_at',c.created_at,'user_id',c.user_id,'profiles',json_build_object('display_name',cp.display_name,'avatar_url',cp.avatar_url)) ORDER BY c.created_at DESC) FROM (SELECT * FROM community_comments WHERE post_id=p.id ORDER BY created_at DESC LIMIT 3) c LEFT JOIN profiles cp ON cp.user_id=c.user_id),'[]'::json) community_comments FROM community_posts p LEFT JOIN profiles pr ON pr.user_id=p.user_id`}

app.get('/api/community/posts',maybeAuth,async(req,res)=>{try{const page=Math.max(0,Number(req.query.page||0)), ps=Math.min(30,Math.max(1,Number(req.query.pageSize||12))); const vals=[req.auth?.userId||null]; let where=` WHERE p.moderation_status='approved' AND p.visibility='public'`; if(req.query.category){vals.push(req.query.category);where+=` AND p.category=$${vals.length}`;} if(req.query.q){vals.push(`%${String(req.query.q).replace(/^#/,'')}%`);where+=` AND (p.caption ILIKE $${vals.length} OR p.location_name ILIKE $${vals.length} OR array_to_string(p.hashtags,',') ILIKE $${vals.length})`;} vals.push(ps+1,page*ps); const q=`${communitySelect(req.auth?.userId||null)}${where} ORDER BY p.created_at DESC LIMIT $${vals.length-1} OFFSET $${vals.length}`; const rows=(await DB.query(q,vals)).rows; const posts=rows.slice(0,ps).map(p=>({...p,profiles:{display_name:p.profile_display_name,avatar_url:p.profile_avatar_url},community_likes:p.liked?[{user_id:req.auth?.userId}]:[],community_favorites:p.saved?[{user_id:req.auth?.userId}]:[]}));res.json({posts,hasMore:rows.length>ps});}catch(e){console.error(e);res.status(500).json({error:'Community kon niet worden geladen'});}});

app.post('/api/community/posts',auth,upload.single('photo'),async(req,res)=>{try{const b=req.body||{};if(!req.file&&!String(b.caption||'').trim())return res.status(400).json({error:'Voeg een foto of tekst toe'});const hashtags=[...new Set((String(b.caption||'').match(/#[a-zA-Z0-9_]+/g)||[]).map(x=>x.slice(1).toLowerCase()))];let category=b.category||'other';if(category==='other'&&String(b.caption||'').toLowerCase().includes('zeevonk'))category='zeevonk';const url=req.file?`${PUBLIC_API_URL}/uploads/community/${req.file.filename}`:null;const photoPath=req.file?req.file.filename:null;const r=await DB.query(`INSERT INTO community_posts(user_id,photo_url,photo_path,caption,category,hashtags,location_privacy,location_name,latitude,longitude,temperature,apparent_temperature,wind_speed,precipitation,humidity,uv_index,pressure,weather_source) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,[req.auth.userId,url,photoPath,String(b.caption||'').slice(0,1000),category,hashtags,b.location_privacy||'municipality',b.location_name||null,n(b.latitude),n(b.longitude),n(b.temperature),n(b.apparent_temperature),n(b.wind_speed),n(b.precipitation),n(b.humidity),n(b.uv_index),n(b.pressure),b.weather_source||null]);res.status(201).json({post:r.rows[0]});}catch(e){console.error(e);res.status(500).json({error:'Post kon niet worden geplaatst'});}});

for(const [route,table] of [['like','community_likes'],['save','community_favorites']]) app.post(`/api/community/posts/:id/${route}`,auth,async(req,res)=>{try{const ex=await DB.query(`SELECT id FROM ${table} WHERE post_id=$1 AND user_id=$2`,[req.params.id,req.auth.userId]);if(ex.rows.length)await DB.query(`DELETE FROM ${table} WHERE id=$1`,[ex.rows[0].id]);else await DB.query(`INSERT INTO ${table}(post_id,user_id) VALUES($1,$2)`,[req.params.id,req.auth.userId]);res.json({active:!ex.rows.length});}catch(e){res.status(500).json({error:'Actie mislukt'});}});

app.post('/api/community/posts/:id/comments',auth,async(req,res)=>{try{const body=String(req.body.body||'').trim().slice(0,240);if(!body)return res.status(400).json({error:'Lege reactie'});await DB.query('INSERT INTO community_comments(post_id,user_id,body) VALUES($1,$2,$3)',[req.params.id,req.auth.userId,body]);res.status(201).json({ok:true});}catch(e){res.status(500).json({error:'Reactie mislukt'});}});

app.post('/api/community/posts/:id/report',auth,async(req,res)=>{try{await DB.query('INSERT INTO community_reports(post_id,reporter_id,reason) VALUES($1,$2,$3)',[req.params.id,req.auth.userId,String(req.body.reason||'').slice(0,300)]);res.status(201).json({ok:true});}catch(e){res.status(500).json({error:'Rapport mislukt'});}});


if(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) webpush.setVapidDetails(process.env.VAPID_SUBJECT||'mailto:admin@wheaterflow.be',process.env.VAPID_PUBLIC_KEY,process.env.VAPID_PRIVATE_KEY);

app.get('/api/push-config',(req,res)=>res.json({configured:Boolean(process.env.VAPID_PUBLIC_KEY&&process.env.VAPID_PRIVATE_KEY),vapidPublicKey:process.env.VAPID_PUBLIC_KEY||null}));

app.post('/api/push-subscribe',maybeAuth,async(req,res)=>{try{const b=req.body;await DB.query(`INSERT INTO push_subscriptions(endpoint,installation_id,user_id,subscription,location,preferences,thresholds) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(endpoint) DO UPDATE SET installation_id=excluded.installation_id,user_id=excluded.user_id,subscription=excluded.subscription,location=excluded.location,preferences=excluded.preferences,thresholds=excluded.thresholds,updated_at=now()`,[b.subscription?.endpoint,b.installationId||null,req.auth?.userId||null,b.subscription,b.location,b.preferences,b.thresholds]);res.json({ok:true});}catch(e){console.error(e);res.status(500).json({error:'Push kon niet worden opgeslagen'});}});

app.delete('/api/push-unsubscribe',async(req,res)=>{await DB.query('DELETE FROM push_subscriptions WHERE endpoint=$1 OR installation_id=$2',[req.body.endpoint||'',req.body.installationId||'']);res.json({ok:true});});

app.post('/api/push-test',async(req,res)=>{try{const r=await DB.query('SELECT subscription FROM push_subscriptions WHERE endpoint=$1 OR installation_id=$2 LIMIT 1',[req.body.endpoint||'',req.body.installationId||'']);if(!r.rows.length)return res.status(404).json({error:'Abonnement niet gevonden'});await webpush.sendNotification(r.rows[0].subscription,JSON.stringify({title:'Wheaterflow test',body:'Meldingen via je eigen server werken.',url:PUBLIC_APP_URL}));res.json({ok:true});}catch(e){console.error(e);res.status(500).json({error:'Testmelding mislukt'});}});

app.post('/api/admin-push',async(req,res)=>{
  try{
    const expected=process.env.ADMIN_TOKEN||'';
    const authHeader=req.headers.authorization||'';

    if(!expected){
      return res.status(503).json({
        ok:false,
        error:'ADMIN_TOKEN ontbreekt op de backend'
      });
    }

    if(authHeader!==`Bearer ${expected}`){
      return res.status(401).json({
        ok:false,
        error:'Unauthorized'
      });
    }

    const title=String(req.body?.title||'').trim();
    const message=String(req.body?.message||req.body?.body||'').trim();
    const type=String(req.body?.type||'info').trim();
    const scope=String(req.body?.scope||'all').trim().toLowerCase();
    const scopeValue=String(req.body?.scopeValue||'').trim();

    if(!title||!message){
      return res.status(400).json({
        ok:false,
        error:'Titel en bericht zijn verplicht'
      });
    }

    if(scope!=='all'&&!scopeValue){
      return res.status(400).json({
        ok:false,
        error:'Doelgebied ontbreekt'
      });
    }

    const r=await DB.query(
      'SELECT endpoint, subscription, location FROM push_subscriptions'
    );

    const norm=v=>String(v||'').trim().toLocaleLowerCase('nl-BE');

    const matched=r.rows.filter(row=>{
      if(scope==='all') return true;

      const loc=row.location||{};

      if(scope==='stad'){
        return norm(loc.name)===norm(scopeValue);
      }

      if(scope==='provincie'){
        return norm(loc.admin)===norm(scopeValue);
      }

      if(scope==='land'){
        return norm(loc.country)===norm(scopeValue);
      }

      return false;
    });

    let sent=0;
    let failed=0;
    let removed=0;

    for(const row of matched){
      try{
        await webpush.sendNotification(
          row.subscription,
          JSON.stringify({
            title,
            body:message,
            tag:`admin-${Date.now()}`,
            renotify:false,
            requireInteraction:type==='danger',
            url:PUBLIC_APP_URL,
            type:`admin-${type}`
          })
        );

        sent++;
      }catch(e){
        failed++;

        if(e?.statusCode===404||e?.statusCode===410){
          try{
            await DB.query(
              'DELETE FROM push_subscriptions WHERE endpoint=$1',
              [row.endpoint]
            );
            removed++;
          }catch{}
        }

        console.error('Admin push mislukt:',e.message);
      }
    }

    res.json({
      ok:true,
      checked:r.rows.length,
      matched:matched.length,
      sent,
      failed,
      removed
    });

  }catch(e){
    console.error('admin-push:',e);
    res.status(500).json({
      ok:false,
      error:'Admin push verzenden mislukt'
    });
  }
});



app.get('/api/xweather-config',(req,res)=>res.json({configured:Boolean(process.env.XWEATHER_CLIENT_ID&&process.env.XWEATHER_CLIENT_SECRET),clientId:process.env.XWEATHER_CLIENT_ID||null,clientSecret:process.env.XWEATHER_CLIENT_SECRET||null}));

// Officiële KMI-waarschuwingen voor België.
const kmiWarningCache={at:0,alerts:[]};
function stripKmiHtml(text=''){return String(text).replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim();}
function inferKmiLevel(type,text){
  const t=String(text||'').toLowerCase();
  if(/code\s*rood|\brood\b/.test(t)) return 'red';
  if(/code\s*oranje|\boranje\b/.test(t)) return 'orange';
  if(/code\s*geel|\bgeel\b/.test(t)) return 'yellow';
  const winds=[...t.matchAll(/(\d{2,3})\s*(?:km\/?h|km\/u)/g)].map(m=>+m[1]);
  const maxWind=Math.max(0,...winds);
  if(/wind|rukwind|storm/i.test(type+' '+t)){
    const now=new Date(),m=now.getMonth()+1,d=now.getDate();
    const leafy=(m>4&&m<11)||(m===4&&d>=15)||(m===11&&d<=15);
    const y=leafy?70:80,o=leafy?91:101,r=leafy?121:131;
    if(maxWind>=r)return 'red'; if(maxWind>=o)return 'orange'; if(maxWind>=y)return 'yellow';
  }
  const rain=[...t.matchAll(/(\d{1,3})\s*(?:l\/m²|l\/m2|mm)/g)].map(m=>+m[1]);
  const maxRain=Math.max(0,...rain);
  if(/regen|onweer|neerslag|bui/i.test(type+' '+t)){
    if(maxRain>60)return 'red'; if(maxRain>=41)return 'orange'; if(maxRain>=20)return 'yellow';
    if(/zware windstoten|hagel|wateroverlast|intens/i.test(t))return 'yellow';
  }
  return 'yellow';
}
function parseKmiWarnings(html){
  const main=String(html||'').split(/Waarschuwingen voor België/i)[1]||'';
  const stop=main.split(/Voor waarschuwingen gelinkt|Download onze app|Meer informatie en uitleg/i)[0]||main;
  const re=/<h3[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3|$)/gi;
  const out=[];let m;
  while((m=re.exec(stop))){
    const type=stripKmiHtml(m[1]),body=stripKmiHtml(m[2]);
    if(!type||!body||/kaart|uitleg/i.test(type))continue;
    const level=inferKmiLevel(type,body);
    const code={yellow:'geel',orange:'oranje',red:'rood'}[level]||level;
    const timing=(body.match(/Van\s+[^:]{3,80}\s*:/i)||[])[0]?.replace(/\s*:\s*$/,'')||null;
    const desc=body.replace(/^.*?\s*:\s*/,'').trim();
    out.push({level,headline:`${type} · Code ${code}`,description:desc.slice(0,520),period:timing,source:'KMI België',official:true,phenomenon:type});
  }
  return out;
}
app.get('/api/kmi/warnings',async(req,res)=>{
  try{
    if(Date.now()-kmiWarningCache.at<5*60*1000)return res.json({alerts:kmiWarningCache.alerts,cached:true});
    const opts={headers:{'user-agent':'Wheaterflow/1.0 (+https://wheaterflow.be)','accept-language':'nl-BE,nl;q=0.9'}};
    if(typeof AbortSignal!=='undefined'&&AbortSignal.timeout)opts.signal=AbortSignal.timeout(8000);
    const r=await fetch('https://www.meteo.be/nl/weer/waarschuwingen/overzichtskaart-belgie',opts);
    if(!r.ok)throw new Error('KMI HTTP '+r.status);
    const alerts=parseKmiWarnings(await r.text());
    kmiWarningCache.at=Date.now();kmiWarningCache.alerts=alerts;
    res.setHeader('Cache-Control','public, max-age=180');
    res.json({alerts,source:'KMI België',updated:new Date().toISOString()});
  }catch(e){console.error('KMI warnings:',e);if(kmiWarningCache.alerts.length)return res.json({alerts:kmiWarningCache.alerts,stale:true});res.status(502).json({alerts:[]});}
});

app.get('/api/knmi/warnings',async(req,res)=>{try{if(!process.env.KNMI_OPEN_DATA_API_KEY)return res.status(503).json({alerts:[]});const base='https://api.dataplatform.knmi.nl/open-data/v1/datasets/waarschuwingen_nederland_48h/versions/1.0/files';const headers={Authorization:process.env.KNMI_OPEN_DATA_API_KEY};let r=await fetch(base,{headers});if(!r.ok)throw new Error('KNMI list '+r.status);let data=await r.json();const file=(data.files||[]).map(x=>x.filename||x.name||x).filter(Boolean).filter(x=>/\.(xml|txt)$/i.test(x)).sort().pop();if(!file)return res.json({alerts:[]});r=await fetch(`${base}/${encodeURIComponent(file)}/url`,{headers});data=await r.json();const u=data.temporaryDownloadUrl||data.url||data.href;if(!u)return res.json({alerts:[]});const text=await (await fetch(u)).text();const t=text.toLowerCase();const level=t.includes('code rood')||/\brood\b/.test(t)?'red':t.includes('code oranje')||/\boranje\b/.test(t)?'orange':t.includes('code geel')||/\bgeel\b/.test(t)?'yellow':'green';const title={green:'Geen bijzonder weer',yellow:'Wees alert',orange:'Grote kans op gevaarlijk weer',red:'Zeer gevaarlijk weer'}[level];res.json({alerts:[{level,headline:title,description:text.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,260)||'Officiële KNMI-waarschuwing geladen.',source:'KNMI Data Platform',official:true}]});}catch(e){console.error(e);res.status(502).json({alerts:[]});}});

app.get('/api/knmi/wms',async(req,res)=>{try{if(!process.env.KNMI_WMS_API_KEY)return res.status(503).end();const u=new URL('https://api.dataplatform.knmi.nl/wms/adaguc-server');for(const [k,v] of Object.entries(req.query))u.searchParams.set(k,v);const r=await fetch(u,{headers:{Authorization:process.env.KNMI_WMS_API_KEY}});res.status(r.status);for(const h of ['content-type','cache-control'])if(r.headers.get(h))res.setHeader(h,r.headers.get(h));const buf=Buffer.from(await r.arrayBuffer());res.end(buf);}catch(e){console.error(e);res.status(502).end();}});


app.delete('/api/account',auth,async(req,res)=>{if(req.body.confirmation!=='VERWIJDEREN')return res.status(400).json({error:'Bevestiging ontbreekt'});try{const files=(await DB.query(`SELECT avatar_url FROM profiles WHERE user_id=$1 UNION ALL SELECT photo_url FROM community_posts WHERE user_id=$1`,[req.auth.userId])).rows;await DB.query('DELETE FROM users WHERE id=$1',[req.auth.userId]);for(const x of files){const u=x.avatar_url||x.photo_url;if(u&&u.startsWith(PUBLIC_API_URL+'/uploads/')){const rel=u.slice((PUBLIC_API_URL+'/uploads/').length);fs.rm(path.join(UPLOAD_ROOT,rel),{force:true},()=>{});}}res.json({ok:true});}catch(e){console.error(e);res.status(500).json({error:'Account kon niet worden verwijderd'});}});


app.use((req,res)=>res.status(404).json({error:'Endpoint niet gevonden'}));

app.use((err,req,res,next)=>{console.error(err);res.status(err.message==='CORS'?403:500).json({error:err.message==='CORS'?'Origin niet toegestaan':'Interne serverfout'});});

app.listen(PORT,'0.0.0.0',()=>console.log(`Wheaterflow API draait op poort ${PORT}`));

