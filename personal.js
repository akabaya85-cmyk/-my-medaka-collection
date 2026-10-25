'use strict';
/* Personal medaka journal and multi-fish photo albums.
 * Offline-only: records & images live in this browser's IndexedDB.
 * "Find similar" is an explainable color + human-selected traits comparison,
 * not a trained species classifier. No images leave the device.
 */
(()=>{
const pd=document.getElementById('personalDialog');
const body=document.getElementById('personalContent');
const personalStores=['personalFish','personalFishPhotos','personalEvents','personalEventPhotos','personalAlbums','personalAlbumPhotos'];
let pdb=null,view='home',urls=[],candidateFile=null,focus={x:.5,y:.5},pickedColor='',pickedTraits=[],candidateResults=[];
const fesc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&#39;'}[c]));
const newid=()=> 'p-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);
const today=()=>{const t=new Date();return [t.getFullYear(),String(t.getMonth()+1).padStart(2,'0'),String(t.getDate()).padStart(2,'0')].join('-')};
const dateSafe=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||''))?v:'';
const sorted=a=>a.slice().sort((x,y)=>String(y.date||y.updated||'').localeCompare(String(x.date||x.updated||'')));
const traits=['ラメ','体外光','体内光','ヒレ長','リアルロングフィン','ロングフィン','ダルマ','ヒカリ','出目','目前','パンダ','透明鱗','半透明鱗','ブラックリム','三色','斑','アルビノ','スワロー','モルフォ','腹膜青'];
const colors=['黒','白','青','緑','黄','黄金','オレンジ','朱赤','ピンク','三色'];
function cleanup(){urls.forEach(u=>URL.revokeObjectURL(u));urls=[]}
function makeUrl(blob){if(!(blob instanceof Blob))return '';const url=URL.createObjectURL(blob);urls.push(url);return url}
function change(html){cleanup();body.innerHTML=html;pd.scrollTop=0}
async function connect(){if(!pdb)pdb=await openDB();return pdb}
function pTx(store,mode,operation,key,value){return new Promise((resolve,reject)=>{
 const t=pdb.transaction(store,mode==='get'||mode==='all'||mode==='keys'?'readonly':'readwrite'),s=t.objectStore(store);
 const req=mode==='get'?s.get(key):mode==='set'?s.put(value,key):mode==='delete'?s.delete(key):mode==='keys'?s.getAllKeys():s.getAll();
 req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('保存領域の読み書きに失敗しました'));
})}
const get=(s,id)=>pTx(s,'get','get',id),all=s=>pTx(s,'all'),keys=s=>pTx(s,'keys'),set=(s,id,obj)=>pTx(s,'set','set',id,obj),del=(s,id)=>pTx(s,'delete','delete',id);
async function filesToBlobs(files,limit){const arr=[...files].slice(0,limit),out=[];for(const f of arr)out.push(await optimize(f));return out}
function photoMarkup(blob,alt='',klass=''){let url=makeUrl(blob);return url?'<img class="'+klass+'" src="'+url+'" alt="'+fesc(alt)+'">':''}
function catalogName(name){let n=String(name||'').trim();if(!n)return null;return entries.find(e=>foldName(e.name)===foldName(n)||String(e.aliases||'').split(/[、,，]/).some(a=>foldName(a)===foldName(n)))||null}
function datalist(){return '<datalist id="personVarieties">'+entries.filter(e=>e.name).map(e=>'<option value="'+fesc(e.name)+'"></option>').join('')+'</datalist>'}
function nav(title,home=true){return '<div class="personalTop"><button type="button" id="pBack">'+(home?'← メニュー':'← 戻る')+'</button><strong>'+fesc(title)+'</strong><button type="button" id="pClose">閉じる</button></div>'}
function navEvents(back=()=>home()){document.getElementById('pClose').onclick=()=>pd.close();document.getElementById('pBack').onclick=back}
async function openPersonal(dest='home'){await connect();if(!pd.open)pd.showModal();if(dest==='albums')return showAlbums();if(dest==='fish')return showFish();if(dest==='find')return showFinder();return home()}
function home(){view='home';change(nav('My Medaka')+'<div class="personalWelcome"><h2>🐟 私のメダカ手帳</h2><p>出会った子たちも、一緒に写った写真も。全部このiPhoneに。</p></div><div class="personalMenu"><button id="pHomeFind"><b>🔍 写真から品種候補</b><small>魚をタップして色を分析。特徴を選んで似た品種を探す</small></button><button id="pHomeFish"><b>📓 個体・飼育履歴</b><small>名前、迎えた日、水槽、成長、産卵、お別れ</small></button><button id="pHomeAlbums"><b>🖼️ 私のメダカアルバム</b><small>一枚に複数匹でもOK。複数の品種や個体をタグ付け</small></button></div><p class="personalFootNote">🔒 写真・記録はこの端末だけで保存されます。機種変更前は必ず「⬇ バックアップ」をしてください。Safariとホーム画面アプリは保存先が異なる場合があります。</p>');
navEvents();document.getElementById('pHomeFind').onclick=showFinder;document.getElementById('pHomeFish').onclick=showFish;document.getElementById('pHomeAlbums').onclick=showAlbums}

/* ---------- Fish records & event timeline ---------- */
async function showFish(){view='fish';await connect();const fish=sorted(await all('personalFish'));const events=await all('personalEvents');const owned=entries.filter(x=>x.ever);change(nav('飼育履歴')+'<div class="personalIntro"><h2>📓 個体・飼育履歴</h2><p>図鑑の「飼育経験あり」はそのまま保持。ここでは1匹ずつ、日付や思い出を残せます。</p><div class="personalCount">図鑑で飼育経験あり <strong>'+owned.length+'品種</strong> · 詳細記録 <strong>'+fish.length+'件</strong> · 日誌 '+events.length+'件</div></div><button class="primary personalFull" id="pFishAdd">＋ 個体・グループを記録</button><div class="personalCards" id="pFishCards"></div><details class="personalOwned"><summary>これまでに飼った品種名（'+owned.length+'）</summary><div class="personalTags">'+owned.slice().sort((a,b)=>a.name.localeCompare(b.name,'ja')).map(x=>'<button type="button" data-owned="'+fesc(x.id)+'">'+fesc(x.name)+'</button>').join('')+'</div></details>');
navEvents();document.getElementById('pFishAdd').onclick=()=>fishForm();const list=document.getElementById('pFishCards');if(!fish.length)list.innerHTML='<p class="personalEmpty">まだ個体別の記録はありません。まずは1匹か、同じ水槽のグループを登録してみてね。</p>';
for(const f of fish){const blobs=await get('personalFishPhotos',f.id)||[];const card=document.createElement('article');card.className='personalCard';let status=f.status==='current'?'飼育中':f.status==='past'?'過去に飼育':'記録中';card.innerHTML='<div class="personalCover">'+(blobs[0]?photoMarkup(blobs[0],f.name):'<div class="personalPlaceholder">🐟</div>')+'</div><div><strong>'+fesc(f.name||f.varietyName||'名前未設定')+'</strong><span>'+fesc(f.varietyName||'品種未特定')+' · '+status+'</span><small>'+(f.acquiredAt?'お迎え '+fesc(f.acquiredAt):'お迎え日未設定')+(f.tank?' · '+fesc(f.tank):'')+'</small><button type="button" data-fish="'+fesc(f.id)+'">記録を見る</button></div>';list.appendChild(card)}
list.querySelectorAll('[data-fish]').forEach(b=>b.onclick=()=>fishDetail(b.dataset.fish));
document.querySelectorAll('[data-owned]').forEach(b=>b.onclick=()=>{const e=entries.find(x=>x.id===b.dataset.owned);fishForm(null,e?.name||'')})}
async function fishForm(id=null,prefill=''){await connect();const old=id?await get('personalFish',id):null;let images=id?(await get('personalFishPhotos',id)||[]):[];change(nav(old?'個体を編集':'新しい飼育記録',false)+'<h2>🐟 個体・グループを記録</h2><label>名前・グループ名</label><input id="pfName" value="'+fesc(old?.name||'')+'" placeholder="例：泰造、孝蔵、初恋の2匹"><label>品種名</label><input id="pfVariety" list="personVarieties" value="'+fesc(old?.varietyName||prefill)+'" placeholder="図鑑から選ぶ／未特定でもOK">'+datalist()+'<div class="personalFields2"><div><label>飼育状況</label><select id="pfStatus"><option value="unknown">未設定</option><option value="current">飼育中</option><option value="past">過去に飼育</option></select></div><div><label>性別（分かれば）</label><select id="pfSex"><option value="">不明・複数</option><option value="male">オス</option><option value="female">メス</option></select></div></div><div class="personalFields2"><div><label>お迎えした日</label><input id="pfAcquired" type="date" value="'+fesc(old?.acquiredAt||'')+'"></div><div><label>飼育終了日</label><input id="pfEnded" type="date" value="'+fesc(old?.endedAt||'')+'"></div></div><label>水槽・容器</label><input id="pfTank" value="'+fesc(old?.tank||'')+'" placeholder="例：60cm水槽、屋内ビオトープ"><label>メモ・特徴</label><textarea id="pfNote" placeholder="お気に入りの特徴、性格、お迎えしたお店など">'+fesc(old?.note||'')+'</textarea><label>この子の写真（複数OK）</label><input type="file" id="pfFiles" accept="image/*" multiple><div class="personalPhotoGrid" id="pfPhotoGrid"></div><p class="hint">写真はこの端末内のみに保存。図鑑の既存写真は変更しません。</p><button class="primary personalFull" id="pfSave">保存する</button>'+(old?'<button class="personalFull" id="pfDelete">この詳細記録を削除</button>':''));
navEvents(()=>showFish());document.getElementById('pfStatus').value=old?.status||'unknown';document.getElementById('pfSex').value=old?.sex||'';
const redraw=()=>{cleanup();document.getElementById('pfPhotoGrid').innerHTML=images.map((blob,i)=>'<div class="personalThumb">'+photoMarkup(blob,'個体写真')+'<button type="button" data-remove="'+i+'">×</button></div>').join('');document.querySelectorAll('#pfPhotoGrid [data-remove]').forEach(b=>b.onclick=()=>{images.splice(Number(b.dataset.remove),1);redraw()})};
redraw();document.getElementById('pfFiles').onchange=async e=>{try{images.push(...await filesToBlobs(e.target.files,12));images=images.slice(0,16);redraw()}catch(err){alert('写真の読み込みに失敗：'+err.message)}};
document.getElementById('pfSave').onclick=async()=>{const name=document.getElementById('pfName').value.trim(),variety=document.getElementById('pfVariety').value.trim();if(!name&&!variety){alert('名前か品種名のどちらかを入力してね');return}const obj={id:old?.id||newid(),name:name||variety,varietyName:variety,status:document.getElementById('pfStatus').value,sex:document.getElementById('pfSex').value,acquiredAt:dateSafe(document.getElementById('pfAcquired').value),endedAt:dateSafe(document.getElementById('pfEnded').value),tank:document.getElementById('pfTank').value.trim(),note:document.getElementById('pfNote').value.trim(),updated:new Date().toISOString()};try{await set('personalFish',obj.id,obj);await set('personalFishPhotos',obj.id,images);if(!old&&obj.acquiredAt){const event={id:newid(),fishId:obj.id,date:obj.acquiredAt,type:'お迎え',note:'お迎えした日として登録',created:new Date().toISOString()};await set('personalEvents',event.id,event)}const c=catalogName(variety);if(c&&!c.ever){c.ever=true;save();render()}await fishDetail(obj.id)}catch(err){alert('保存に失敗：'+err.message)}};
if(old)document.getElementById('pfDelete').onclick=async()=>{if(!confirm('この個体と日誌を削除しますか？ アルバム写真は残ります。'))return;const ev=(await all('personalEvents')).filter(x=>x.fishId===old.id);for(const e of ev){await del('personalEvents',e.id);await del('personalEventPhotos',e.id)}await del('personalFishPhotos',old.id);await del('personalFish',old.id);await showFish()};
}
async function fishDetail(id){await connect();const f=await get('personalFish',id);if(!f)return showFish();const img=await get('personalFishPhotos',id)||[],events=sorted((await all('personalEvents')).filter(x=>x.fishId===id));change(nav('飼育記録',false)+'<h2>🐟 '+fesc(f.name)+'</h2><p>'+fesc(f.varietyName||'品種未特定')+' · '+(f.status==='current'?'飼育中':f.status==='past'?'過去に飼育':'状況未設定')+'</p><div class="personalPhotoGrid personalPhotoBig">'+img.map(b=>photoMarkup(b,'個体の写真')).join('')+'</div><div class="personalFields2"><div>お迎え：<strong>'+fesc(f.acquiredAt||'未設定')+'</strong></div><div>水槽：<strong>'+fesc(f.tank||'未設定')+'</strong></div></div>'+(f.note?'<p class="personalNote">'+fesc(f.note)+'</p>':'')+'<div class="personalBar"><button id="pfEdit">編集</button><button id="peAdd" class="primary">＋ 日誌を書く</button></div><h3>📅 この子の記録</h3><div id="peTimeline"></div>');
navEvents(()=>showFish());document.getElementById('pfEdit').onclick=()=>fishForm(id);document.getElementById('peAdd').onclick=()=>eventForm(id);
const area=document.getElementById('peTimeline');area.innerHTML=events.length?'':'<p class="hint">まだ日誌はありません。成長、産卵、水槽の引っ越しなどを残せます。</p>';
for(const e of events){const p=await get('personalEventPhotos',e.id);const div=document.createElement('section');div.className='personalTimeline';div.innerHTML='<div><small>'+fesc(e.date)+'</small><strong>'+fesc(e.type)+'</strong></div>'+(e.note?'<p>'+fesc(e.note)+'</p>':'')+(p?photoMarkup(p,'日誌の写真','personalEventImage'):'')+'<div class="personalBar"><button type="button" data-edit="'+fesc(e.id)+'">編集</button><button type="button" data-delete="'+fesc(e.id)+'">削除</button></div>';area.appendChild(div)}
area.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>eventForm(id,b.dataset.edit));
area.querySelectorAll('[data-delete]').forEach(b=>b.onclick=async()=>{if(!confirm('この日誌を削除しますか？'))return;await del('personalEvents',b.dataset.delete);await del('personalEventPhotos',b.dataset.delete);fishDetail(id)})}
async function eventForm(fishId,eventId=null){await connect();const f=await get('personalFish',fishId),old=eventId?await get('personalEvents',eventId):null;let photo=eventId?await get('personalEventPhotos',eventId):null;change(nav(old?'日誌を編集':'日誌を追加',false)+'<h2>📅 '+fesc(f?.name||'飼育記録')+'</h2><label>日付</label><input id="peDate" type="date" value="'+fesc(old?.date||today())+'"><label>できごと</label><select id="peType">'+['お迎え','成長','産卵','孵化','体調','水槽移動','お別れ','メモ'].map(x=>'<option>'+x+'</option>').join('')+'</select><label>日誌・メモ</label><textarea id="peNote" placeholder="今日あったことを自由に">'+fesc(old?.note||'')+'</textarea><label>写真（1枚・任意）</label><input type="file" accept="image/*" id="pePhoto"><div id="pePhotoPreview"></div><button class="primary personalFull" id="peSave">日誌を保存</button>');
navEvents(()=>fishDetail(fishId));document.getElementById('peType').value=old?.type||'メモ';
const redraw=()=>{cleanup();document.getElementById('pePhotoPreview').innerHTML=photo?photoMarkup(photo,'日誌写真','personalEventImage')+'<button id="pePhotoClear">写真を外す</button>':'';const rm=document.getElementById('pePhotoClear');if(rm)rm.onclick=()=>{photo=null;redraw()}};
redraw();document.getElementById('pePhoto').onchange=async e=>{try{photo=(await filesToBlobs(e.target.files,1))[0]||photo;redraw()}catch(err){alert(err.message)}};
document.getElementById('peSave').onclick=async()=>{const obj={id:old?.id||newid(),fishId,date:dateSafe(document.getElementById('peDate').value)||today(),type:document.getElementById('peType').value,note:document.getElementById('peNote').value.trim(),created:old?.created||new Date().toISOString()};try{await set('personalEvents',obj.id,obj);if(photo)await set('personalEventPhotos',obj.id,photo);else if(old)await del('personalEventPhotos',obj.id);fishDetail(fishId)}catch(err){alert('日誌の保存に失敗：'+err.message)}};
}

/* ---------- Albums: one photo can show many fish; link multiple varieties. ---------- */
async function showAlbums(){view='albums';await connect();const albums=sorted(await all('personalAlbums'));change(nav('私のアルバム')+'<div class="personalIntro"><h2>🖼️ 私のメダカアルバム</h2><p>一枚にいろんなメダカが写っていても、そのままでOK。写真に複数の品種名・個体名を付けて残せます。</p><div class="personalCount">アルバム '+albums.length+'件</div></div><button class="primary personalFull" id="paAdd">＋ 写真をアルバムに保存</button><div id="paCards" class="personalAlbumGrid"></div>');navEvents();document.getElementById('paAdd').onclick=()=>albumForm();
const area=document.getElementById('paCards');if(!albums.length)area.innerHTML='<p class="personalEmpty">お気に入りの写真を1枚から追加できるよ。複数匹が写っていても切り抜かなくて大丈夫。</p>';
for(const a of albums){const images=await get('personalAlbumPhotos',a.id)||[];const card=document.createElement('article');card.className='personalAlbumCard';card.innerHTML=(images[0]?photoMarkup(images[0],a.title,'personalAlbumCover'):'<div class="personalAlbumCover personalPlaceholder">📷</div>')+'<div class="personalAlbumInfo"><strong>'+fesc(a.title||'タイトルなし')+'</strong><small>'+fesc(a.date||'')+' · '+images.length+'枚</small><p>'+fesc((a.tags||[]).join(' ・ '))+'</p><button type="button" data-album="'+fesc(a.id)+'">アルバムを見る</button></div>';area.appendChild(card)}
area.querySelectorAll('[data-album]').forEach(b=>b.onclick=()=>albumDetail(b.dataset.album))}
async function albumForm(id=null,fromFiles=[]){await connect();const old=id?await get('personalAlbums',id):null;let photos=id?(await get('personalAlbumPhotos',id)||[]):[];photos=[...photos,...fromFiles].slice(0,18);const fish=await all('personalFish');
change(nav(old?'アルバムを編集':'新しいアルバム',false)+'<h2>🖼️ アルバムを作る</h2><label>写真（1回に複数枚・最大18枚）</label><input type="file" id="paFiles" accept="image/*" multiple><div class="personalPhotoGrid" id="paPhotoGrid"></div><label>タイトル</label><input id="paTitle" value="'+fesc(old?.title||'')+'" placeholder="例：新しい水槽の仲間たち"><label>撮影日</label><input type="date" id="paDate" value="'+fesc(old?.date||today())+'"><label>写っている品種名（複数OK・「、」区切り）</label><input id="paTags" value="'+fesc((old?.tags||[]).join('、'))+'" placeholder="初恋、スズラン、青蝶"><p class="hint">品種が分からない子は「不明」でもOK。複数匹を1枚ずつ切り分ける必要はありません。</p><label>写っている個体（分かれば選択）</label><div class="personalChecks">'+(fish.length?fish.map(x=>'<label><input type="checkbox" data-album-fish="'+fesc(x.id)+'" '+((old?.fishIds||[]).includes(x.id)?'checked':'')+'> '+fesc(x.name)+'</label>').join(''):'<p class="hint">個体の登録がなくても保存できます。あとから編集可能。</p>')+'</div><label>思い出・撮影メモ</label><textarea id="paNote" placeholder="一緒に泳いでいた子、季節、場所など">'+fesc(old?.note||'')+'</textarea><button class="primary personalFull" id="paSave">アルバムを保存</button>'+(old?'<button class="personalFull" id="paDelete">このアルバムを削除</button>':''));
navEvents(()=>showAlbums());const draw=()=>{cleanup();document.getElementById('paPhotoGrid').innerHTML=photos.map((blob,i)=>'<div class="personalThumb">'+photoMarkup(blob,'アルバム写真')+'<button type="button" data-remove="'+i+'">×</button></div>').join('');document.querySelectorAll('#paPhotoGrid [data-remove]').forEach(b=>b.onclick=()=>{photos.splice(Number(b.dataset.remove),1);draw()})};draw();
document.getElementById('paFiles').onchange=async e=>{try{const remaining=18-photos.length;if(remaining<=0){alert('写真は1アルバム18枚までです');return}photos.push(...await filesToBlobs(e.target.files,remaining));draw()}catch(err){alert('写真を開けません：'+err.message)}};
document.getElementById('paSave').onclick=async()=>{const title=document.getElementById('paTitle').value.trim()||'メダカとの思い出',tags=[...new Set(document.getElementById('paTags').value.split(/[、,，\n]/).map(x=>x.trim()).filter(Boolean))];if(!photos.length){alert('最低1枚、写真を選んでね');return}const fishIds=[...document.querySelectorAll('[data-album-fish]:checked')].map(x=>x.dataset.albumFish);const obj={id:old?.id||newid(),title,date:dateSafe(document.getElementById('paDate').value),tags,fishIds,note:document.getElementById('paNote').value.trim(),updated:new Date().toISOString()};try{await set('personalAlbums',obj.id,obj);await set('personalAlbumPhotos',obj.id,photos);albumDetail(obj.id)}catch(err){alert('アルバム保存に失敗：'+err.message)}};
if(old)document.getElementById('paDelete').onclick=async()=>{if(!confirm('このアルバムと写真を削除しますか？'))return;await del('personalAlbums',old.id);await del('personalAlbumPhotos',old.id);showAlbums()};
}
async function albumDetail(id){await connect();const a=await get('personalAlbums',id);if(!a)return showAlbums();const images=await get('personalAlbumPhotos',id)||[],fish=await all('personalFish');const names=[...(a.tags||[]),...fish.filter(x=>(a.fishIds||[]).includes(x.id)).map(x=>x.name)];change(nav('アルバム',false)+'<h2>🖼️ '+fesc(a.title)+'</h2><p class="hint">'+fesc(a.date||'撮影日未設定')+' · '+images.length+'枚</p><div class="personalAlbumPhotos">'+images.map(b=>photoMarkup(b,a.title)).join('')+'</div><div class="personalTags">'+[...new Set(names)].map(name=>{const match=catalogName(name),individual=fish.find(f=>f.name===name);return match?'<button type="button" data-variety="'+fesc(match.id)+'">'+fesc(name)+'</button>':individual?'<button type="button" data-individual="'+fesc(individual.id)+'">'+fesc(name)+'</button>':'<span>'+fesc(name)+'</span>'}).join('')+'</div>'+(a.note?'<p class="personalNote">'+fesc(a.note)+'</p>':'')+'<button class="primary personalFull" id="paEdit">写真・タグを編集</button><p class="hint">撮影したままの構図で保存。複数匹の写真も切り分けません。</p>');navEvents(()=>showAlbums());document.getElementById('paEdit').onclick=()=>albumForm(id);body.querySelectorAll('[data-variety]').forEach(b=>b.onclick=async()=>{pd.close();await edit(b.dataset.variety)});body.querySelectorAll('[data-individual]').forEach(b=>b.onclick=()=>fishDetail(b.dataset.individual))}

/* ---------- Offline similar-breed search: NO ML inference ---------- */
async function showFinder(){view='find';await connect();cleanup();candidateFile=null;focus={x:.5,y:.5};pickedColor='';pickedTraits=[];candidateResults=[];change(nav('写真から品種候補')+'<div class="personalIntro"><h2>🔍 写真から似た品種を探す</h2><p>写真を選んで、魚の位置をタップ。色の傾向と自分で選んだ特徴から、図鑑の似た候補を表示します。</p></div><input type="file" id="pcFile" accept="image/*"><div class="personalFinderImage" id="pcPreview"></div><p class="hint">魚が何匹も写っている場合は、調べたい1匹を写真上でタップしてね。背景の色も混ざるため、判定には限界があります。</p><div class="personalFields2"><div><label>体色（自動か手動）</label><select id="pcColor"><option value="">写真から色を推定</option>'+colors.map(c=>'<option>'+c+'</option>').join('')+'</select></div><div><label>特徴（当てはまるものを選択）</label><small>選ばなくても検索できます</small></div></div><div class="personalChecks personalTraitChecks">'+traits.map(t=>'<label><input type="checkbox" value="'+t+'" data-trait> '+t+'</label>').join('')+'</div><button class="primary personalFull" id="pcRun" disabled>写真から候補を探す</button><div id="pcResults"></div>');navEvents();const f=document.getElementById('pcFile');f.onchange=e=>{const picked=e.target.files[0];if(!picked)return;if(!picked.type.startsWith('image/')){alert('画像ファイルを選んでね');return}candidateFile=picked;focus={x:.5,y:.5};renderFinderPhoto();document.getElementById('pcRun').disabled=false};
document.getElementById('pcRun').onclick=runFinder;
}
function renderFinderPhoto(){const el=document.getElementById('pcPreview');if(!el)return;cleanup();if(!candidateFile){el.innerHTML='';return}const url=makeUrl(candidateFile);el.innerHTML='<img id="pcImg" src="'+url+'" alt="選んだメダカの写真"><div id="pcFocus" class="personalFocus"></div><small>魚の位置をタップして選択</small>';const img=document.getElementById('pcImg');const box=document.getElementById('pcFocus');const draw=()=>{box.style.left=(focus.x*100)+'%';box.style.top=(focus.y*100)+'%'};draw();img.onclick=e=>{const rect=img.getBoundingClientRect();focus={x:Math.max(.05,Math.min(.95,(e.clientX-rect.left)/rect.width)),y:Math.max(.05,Math.min(.95,(e.clientY-rect.top)/rect.height))};draw()};}
function pickColorFromCanvas(file,point){return new Promise(async(resolve,reject)=>{
let img;
try{
  img=await createImageBitmap(file);
  const w=img.width,h=img.height,sw=Math.max(12,Math.floor(w*.24)),sh=Math.max(12,Math.floor(h*.18));
  const sx=Math.max(0,Math.min(w-sw,Math.floor(point.x*w-sw/2))),sy=Math.max(0,Math.min(h-sh,Math.floor(point.y*h-sh/2)));
  const canvas=document.createElement('canvas');canvas.width=90;canvas.height=64;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,sx,sy,sw,sh,0,0,90,64);if(img.close)img.close();
  const px=ctx.getImageData(0,0,90,64).data, bins={黒:0,白:0,青:0,緑:0,黄:0,黄金:0,オレンジ:0,朱赤:0,ピンク:0};
  for(let i=0;i<px.length;i+=16){
    const [r,g,b]=[px[i],px[i+1],px[i+2]].map(x=>x/255),max=Math.max(r,g,b),min=Math.min(r,g,b),dif=max-min,s=max===0?0:dif/max;
    if(max<.28){bins.黒+=2;continue}
    if(s<.13&&max>.72){bins.白+=1.6;continue}
    if(s<.10){bins.黒+=.5;continue}
    let hue=0;
    if(dif>0){if(max===r)hue=((g-b)/dif)%6;else if(max===g)hue=(b-r)/dif+2;else hue=(r-g)/dif+4;hue=(hue*60+360)%360}
    if(hue>190&&hue<270)bins.青+=1.4;
    else if(hue>=75&&hue<=190)bins.緑+=1.4;
    else if(hue>=40&&hue<75)bins.黄+=1;
    else if(hue>=20&&hue<40)bins.オレンジ+=1.2;
    else if(hue>270&&hue<355&&max>.55)bins.ピンク+=1.2;
    else if(hue<=20||hue>=355)bins.朱赤+=1.3;
  }
  resolve(Object.entries(bins).sort((a,b)=>b[1]-a[1]).slice(0,3));
}catch(err){if(img?.close)img.close();reject(err)}
})}
function findSimilar(color,checks){const pairs=[],empty=!color&&!checks.length;for(const e of entries){const searchable=[e.name,e.traits,e.profile].join(' '),hits=[];let score=0;
if(color){
 let match=color==='青'?/青|ブルー|マリン|サファイア|深海/.test(searchable):color==='黒'?/黒|ブラック|オロチ/.test(searchable):color==='白'?/白|プラチナ|シルバー/.test(searchable):color==='オレンジ'?/オレンジ|朱赤|橙|楊貴妃/.test(searchable):color==='朱赤'?/朱赤|赤|紅|楊貴妃/.test(searchable):color==='ピンク'?/ピンク|桃/.test(searchable):color==='緑'?/緑|グリーン|エメラルド/.test(searchable):color==='黄'?/黄|黄金|琥珀/.test(searchable):color==='黄金'?/黄金|琥珀|金/.test(searchable):color==='三色'?/三色|錦/.test(searchable):false;
 if(match){score+=3;hits.push('色の表記')}else score-=1;
}
for(const t of checks){if(searchable.includes(t)){score+=5;hits.push(t)}}
if(!empty&&score>0)pairs.push({e,score,hits});
}
pairs.sort((a,b)=>b.score-a.score||a.e.name.localeCompare(b.e.name,'ja'));return pairs.slice(0,14)}
async function runFinder(){if(!candidateFile)return;const button=document.getElementById('pcRun');button.disabled=true;let detected=[],selected=document.getElementById('pcColor').value;
try{if(!selected){detected=await pickColorFromCanvas(candidateFile,focus);selected=detected[0]?.[0]||''}}catch(err){document.getElementById('pcResults').innerHTML='<p class="hint">写真の色解析に失敗しました。体色を手動選択すると探せます。</p>';button.disabled=false;return}
const selectedTraits=[...document.querySelectorAll('[data-trait]:checked')].map(x=>x.value);
candidateResults=findSimilar(selected,selectedTraits);const target=document.getElementById('pcResults');
const rows=candidateResults.length?candidateResults.map(({e,hits},i)=>'<div class="personalCandidate"><div><b>'+fesc(e.name)+'</b><small>一致項目：'+fesc(hits.join('、')||'外見の色')+'</small></div><button type="button" data-candidate="'+fesc(e.id)+'">図鑑で見る</button></div>').join(''):'<p class="hint">該当候補が少ないみたい。体色を手動で変えるか、特徴を選び直してみてね。</p>';
target.innerHTML='<h3>候補一覧（'+candidateResults.length+'件）</h3><p class="hint">'+(detected.length?'写真の選択位置で多く見えた色：'+detected.map(x=>x[0]).join('・')+'。':'手動で選んだ体色：'+fesc(selected)+'。')+'これはAIによる品種判定ではありません。画像の小さな範囲の色と、選択した形質を図鑑の説明文に照合した参考候補です。色は水草・底床・照明に大きく影響されます。<strong>正解率や確率を意味しません。</strong></p>'+rows+'<button class="primary personalFull" id="pcToAlbum">この写真を私のアルバムに保存</button>';
target.querySelectorAll('[data-candidate]').forEach(b=>b.onclick=async()=>{pd.close();await edit(b.dataset.candidate)});
document.getElementById('pcToAlbum').onclick=async()=>{try{await albumForm(null,[await optimize(candidateFile)])}catch(err){alert(err.message)}};
button.disabled=false}

/* ---------- Backup hooks ---------- */
async function exportData(){await connect();const out={version:1};for(const s of personalStores){const ids=await keys(s),items=[];for(const id of ids){const val=await get(s,id);if(s.endsWith('Photos')){const arr=Array.isArray(val)?val:val?[val]:[];items.push({id,data:await Promise.all(arr.map(fileData))})}else items.push({id,data:val})}out[s]=items}return out}
async function importData(payload){if(!payload||payload.version!==1)throw Error('個人アルバム・日誌のバックアップ形式が正しくありません');await connect();
const validated={};for(const s of personalStores){const items=payload[s];if(!Array.isArray(items)||items.length>10000)throw Error('個人記録のバックアップが不完全です: '+s);
validated[s]=items.map(x=>{if(!x||typeof x.id!=='string'||x.id.length>100)throw Error('不正な個人記録です');if(s.endsWith('Photos')){if(!Array.isArray(x.data)||x.data.length>30||x.data.some(v=>typeof v!=='string'||!v.startsWith('data:image/')))throw Error('画像バックアップが不正です');return {id:x.id,data:x.data.map(toBlob)}}return {id:x.id,data:x.data}})}
for(const s of personalStores){const existing=await keys(s);for(const id of existing)await del(s,id);for(const x of validated[s])await set(s,x.id,x.data)}
}
window.medakaPersonal={open:openPersonal,exportData,importData};
for(const [id,dest] of [['personalFind','find'],['personalHistory','fish'],['personalAlbums','albums']]){
const button=document.getElementById(id);if(button)button.onclick=()=>openPersonal(dest).catch(e=>alert('個人アルバムを開けません：'+e.message));
}
pd.addEventListener('close',cleanup);
})();