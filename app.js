'use strict';
const $=id=>document.getElementById(id),KEY='my-medaka-release-v1',OLD2='my-medaka-v2',OLD1='my-medaka-v1',DB='my-medaka-db',STORE='photos',SOURCE='https://medakazukan.net/varietyofmedaka/';
let entries=[],db,tab='all',page=0,visibleUrls=[],detailUrls=[],fileMode='restore';const PAGE=48;
let photoQueue=[],photoQueueIndex=0,photoQueueTarget='',photoQueueSaved=0,photoQueuePreview='',singlePhotoId='';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const makeId=()=> 'm-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9);
const norm=x=>({id:x.id||makeId(),name:String(x.name||'').trim(),aliases:String(x.aliases||''),traits:String(x.traits||''),kind:String(x.kind||'品種・流通名（要照合）'),description:String(x.description||''),care:String(x.care||''),status:['current','past','none'].includes(x.status)?x.status:'none',ever:!!x.ever||x.status==='past'||x.status==='current',wish:!!x.wish,favorite:!!x.favorite,note:String(x.note||''),profile:String(x.profile||''),profileBasis:String(x.profileBasis||''),licensedPhoto:(x.licensedPhoto&&typeof x.licensedPhoto==='object')?x.licensedPhoto:null,licensedPhotos:Array.isArray(x.licensedPhotos)?x.licensedPhotos:[],webNo:String(x.webNo||''),url:String(x.url||x.source||SOURCE),updated:Number(x.updated)||0});
function openDB(){return new Promise((ok,no)=>{let r=indexedDB.open(DB,2);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE);if(!r.result.objectStoreNames.contains('gallery'))r.result.createObjectStore('gallery')};r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})}
function op(store,mode,key,value){return new Promise((ok,no)=>{let t=db.transaction(store,mode==='get'?'readonly':'readwrite'),s=t.objectStore(store),r=mode==='get'?s.get(key):mode==='put'?s.put(value,key):mode==='delete'?s.delete(key):s.getAllKeys();r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})}
const getPhotos=async id=>{let a=await op('gallery','get',id);if(Array.isArray(a)&&a.length)return a;let old=await op(STORE,'get',id);return old?[old]:[]};
async function putPhotos(id,a){await op('gallery','put',id,a);await op(STORE,'delete',id)}
function save(){localStorage.setItem(KEY,JSON.stringify(entries))}
function fileData(blob){return new Promise((ok,no)=>{let r=new FileReader();r.onload=()=>ok(r.result);r.onerror=()=>no(r.error);r.readAsDataURL(blob)})}
function toBlob(s){let [h,d]=s.split(','),mime=(h.match(/data:(.*?);/)||[])[1]||'image/jpeg',bin=atob(d),a=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)a[i]=bin.charCodeAt(i);return new Blob([a],{type:mime})}
async function optimize(f){if(!f.type.startsWith('image/'))throw Error('画像ファイルではありません');if(f.size>35*1024*1024)throw Error('画像が大きすぎます');try{let img=await createImageBitmap(f),scale=Math.min(1,1400/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale));c.getContext('2d').drawImage(img,0,0,c.width,c.height);img.close();return await new Promise(ok=>c.toBlob(b=>ok(b||f),'image/jpeg',.82))}catch{return f}}
async function init(){try{db=await openDB()}catch(e){alert('端末の写真保存領域を開けません: '+e.message);return}let data;for(let k of [KEY,OLD2,OLD1]){try{let v=JSON.parse(localStorage.getItem(k)||'null');if(Array.isArray(v)){data=v;if(k!==KEY){for(let x of v){if(x.photo?.startsWith('data:'))await putPhotos(x.id||'', [toBlob(x.photo)])} }break}}catch{}}let catalog=[];try{let r=await fetch('./catalog.json');if(r.ok)catalog=await r.json()}catch{}if(data){entries=data.map(norm);let byName=new Map(entries.map(x=>[x.name.trim().toLowerCase(),x]));for(let item of catalog){const key=item.name.trim().toLowerCase(),old=byName.get(key);if(old){if(!old.webNo&&item.webNo)old.webNo=String(item.webNo);if((!old.url||old.url===SOURCE)&&item.url)old.url=item.url;if(!old.traits&&item.traits)old.traits=String(item.traits);if(!old.aliases&&item.aliases)old.aliases=String(item.aliases);if(item.profile)old.profile=String(item.profile);if(item.profileBasis)old.profileBasis=String(item.profileBasis);if(item.licensedPhoto)old.licensedPhoto=item.licensedPhoto;if(Array.isArray(item.licensedPhotos))old.licensedPhotos=item.licensedPhotos}else{let itemEntry=norm(item);entries.push(itemEntry);byName.set(key,itemEntry)}}save()}else{entries=catalog.map(norm);save()}bind();render()}
function bind(){for(let id of ['search','category','sort'])$(id).addEventListener(id==='search'?'input':'change',()=>{page=0;render()});$('add').onclick=()=>edit(null);$('backup').onclick=backup;$('restore').onclick=()=>pick('restore','.json,application/json');$('import').onclick=()=>pick('csv','.csv,text/csv');$('batch').onclick=()=>pick('inbox','image/*',true);$('more').onclick=()=>{page++;render()};$('file').onchange=handleFile}
function pick(mode,accept,multiple=false){fileMode=mode;let f=$('file');f.accept=accept;f.multiple=multiple;f.value='';f.click()}
function matching(){let q=$('search').value.trim().toLocaleLowerCase(),cat=$('category').value;let a=entries.filter(x=>[x.name,x.aliases,x.traits,x.note,x.description,x.webNo,x.webNo?'No.'+x.webNo:''].join(' ').toLocaleLowerCase().includes(q)&&(!cat||[x.traits,x.name,x.aliases].join(' ').includes(cat))&&(tab==='all'||(tab==='current'&&x.status==='current')||(tab==='past'&&x.ever&&x.status!=='current')||(tab==='wish'&&x.wish)||(tab==='favorite'&&x.favorite)));a.sort((x,y)=>$('sort').value==='recent'?(y.updated-x.updated)||x.name.localeCompare(y.name,'ja'):$('sort').value==='number'?(Number(x.webNo)||99999)-(Number(y.webNo)||99999)||x.name.localeCompare(y.name,'ja'):x.name.localeCompare(y.name,'ja'));return a}
async function render(){const counts={current:entries.filter(x=>x.status==='current').length,past:entries.filter(x=>x.ever&&x.status!=='current').length,wish:entries.filter(x=>x.wish).length};$('stats').innerHTML=`<span>収録 ${entries.length}</span><span>WEB図鑑記事 ${entries.filter(x=>x.webNo).length}</span><span>飼育中 ${counts.current}</span><span>飼育経験 ${entries.filter(x=>x.ever).length}</span><span>飼いたい ${counts.wish}</span>`;const tabs=[['all','全図鑑'],['current','飼育中'],['past','過去に飼育'],['wish','飼いたい ♡'],['favorite','お気に入り ☆']];$('tabs').innerHTML=tabs.map(([k,n])=>`<button class="${tab===k?'active':''}" data-tab="${k}">${n}</button>`).join('');document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;page=0;render()});let list=matching(),shown=list.slice(0,(page+1)*PAGE);$('more').hidden=shown.length>=list.length;$('foot').textContent=`${shown.length}件表示 / 該当 ${list.length}件（全 ${entries.length}件）`;let grid=$('grid');grid.innerHTML=shown.map(x=>`<article data-id="${esc(x.id)}"><div class="cover" data-photo="${esc(x.id)}"><div class="photoPlaceholder">🐟<small>登録写真なし</small></div></div><div class="item"><strong>${esc(x.name)}</strong><span class="tag">${x.webNo?'No.'+esc(x.webNo)+' · ':''}${esc(x.traits||x.kind)}</span><p class="cardDescription">${esc(appearance(x))}</p>${trustedPhoto(x)?`<a class="photoCredit" href="${esc(trustedPhoto(x).pageUrl)}" target="_blank" rel="noopener noreferrer">写真：${esc(trustedPhoto(x).author)} · ${esc(trustedPhoto(x).license)}</a>`:''}${sourcePhotoLink(x,'📷 元サイトで写真を見る ↗')}<div class="actions"><button data-detail="${esc(x.id)}">詳細</button><button data-photo-add="${esc(x.id)}" title="このメダカの写真を登録">📷 写真</button><button data-wish="${esc(x.id)}" class="${x.wish?'active':''}">${x.wish?'♥':'♡'}</button><button data-fav="${esc(x.id)}" class="${x.favorite?'active':''}">${x.favorite?'★':'☆'}</button></div></div></article>`).join('')||'<p class="empty">該当するメダカはいません</p>';visibleUrls.forEach(URL.revokeObjectURL);visibleUrls=[];for(let x of shown){let a=await getPhotos(x.id).catch(()=>[]),node=grid.querySelector(`[data-photo="${CSS.escape(x.id)}"]`);if(!node)continue;if(a[0]){let u=URL.createObjectURL(a[0]);visibleUrls.push(u);node.innerHTML=`<img class="cover" src="${u}" alt="登録写真">`}else{let p=trustedPhoto(x);if(p)node.innerHTML=`<img class="cover" loading="lazy" src="${esc(p.imageUrl)}" alt="${esc(p.caption)}" title="写真: ${esc(p.author)}・${esc(p.license)}">`}}grid.querySelectorAll('[data-detail]').forEach(b=>b.onclick=()=>edit(b.dataset.detail));grid.querySelectorAll('[data-photo-add]').forEach(b=>b.onclick=()=>{singlePhotoId=b.dataset.photoAdd;pick('single','image/*',true)});grid.querySelectorAll('[data-wish]').forEach(b=>b.onclick=()=>toggle(b.dataset.wish,'wish'));grid.querySelectorAll('[data-fav]').forEach(b=>b.onclick=()=>toggle(b.dataset.fav,'favorite'))}
function toggle(id,key){let x=entries.find(x=>x.id===id);if(!x)return;x[key]=!x[key];x.updated=Date.now();save();render()}

const FEATURE_GUIDE={
'ラメ':'鱗の一枚一枚に細かな輝きが現れる特徴。光を当てる向きで見え方が変わります。',
'体外光':'背中を中心に金属的な光沢が表れる特徴。上見で観察しやすいタイプがあります。',
'体内光':'体の内側が光って見える特徴。横から観察すると印象が変わります。',
'半透明鱗':'普通鱗と透明鱗の中間的な透け感のある鱗の特徴です。',
'透明鱗':'鱗や体表の色素の表れ方に透明感があり、えら付近の赤みなどが見える場合があります。',
'ブラックリム':'鱗の縁の黒色が目立つ模様の特徴です。',
'ダルマ':'胴が短く、丸みのある体型。泳ぎや水流への適応に個体差があります。',
'ヒカリ':'体型の特徴のひとつ。尾びれや背びれの形などにも注目できます。',
'リアルロングフィン':'ヒレが大きく長く伸びるタイプで、ヒレの美しさが見どころです。',
'ロングフィン':'長く伸びたヒレを楽しむタイプ。ヒレの傷みや水流に気を付けます。',
'スワロー':'ヒレの一部が長く伸びる表現です。',
'アルビノ':'黒色素が少ない特徴。強い光への反応には個体差があります。',
'ルビーアイ':'赤みのある眼が特徴。眼の見え方は照明や角度で変化します。',
'斑':'体表に現れる黒っぽい斑点や模様の特徴です。',
'三色':'一般に白・朱赤・黒などの組み合わせを楽しむ表現です。',
'紅白':'白と朱赤系の色模様を楽しむ表現です。',
'黄金':'金色を思わせる体色の特徴です。',
'琥珀':'琥珀色を思わせる体色の特徴です。',
'サムライ':'背びれ周辺などの特徴的なヒレの形状に用いられる名称です。',
'出目':'眼が突出して見える特徴です。',
'パンダ':'眼の周囲などの色の特徴から呼ばれる表現です。',
'腹膜青':'お腹の内部に青みを感じる見え方の特徴です。'
};
function featureNotes(x){
  const text=[x.profile,x.traits,x.name].join(' '),matches=[];
  for(const [key,desc] of Object.entries(FEATURE_GUIDE)){
    if(key==='ロングフィン'&&text.includes('リアルロングフィン'))continue;
    if(key==='ヒカリ'&&text.includes('ヒカリ体型'))continue;
    if(text.includes(key)){matches.push([key,desc]);if(matches.length>=5)break}
  }
  return matches;
}
function trustedPhotos(x){
  const input=[...(Array.isArray(x.licensedPhotos)?x.licensedPhotos:[]),...(x.licensedPhoto?[x.licensedPhoto]:[])];
  const photos=[],seen=new Set();
  for(const p of input){
    if(!p||typeof p!=='object')continue;
    try{
      const img=new URL(p.imageUrl),page=new URL(p.pageUrl);
      if(img.protocol!=='https:'||img.hostname!=='upload.wikimedia.org'||page.protocol!=='https:'||page.hostname!=='commons.wikimedia.org')continue;
      if(!/^CC (?:BY(?:-SA)?(?: |$)|0(?: |$))|^Public Domain$/i.test(String(p.license||'')))continue;
      if(seen.has(page.href))continue;
      seen.add(page.href);
      photos.push({imageUrl:img.href,pageUrl:page.href,author:String(p.author||''),license:String(p.license||''),licenseUrl:String(p.licenseUrl||''),caption:String(p.caption||'メダカの実物写真')});
    }catch{}
  }
  return photos;
}
function trustedPhoto(x){return trustedPhotos(x)[0]||null}
function appearance(x){
  if(x.profile)return x.profile;
  if(x.traits)return '登録されている特徴：'+x.traits+'。品種固有の詳細は出典の記事をご確認ください。';
  return '固有の体色・系統情報はまだ整理できていません。出典の掲載記事で外観と品種名を確認できます。';
}
function husbandry(x){
  const t=[x.name,x.traits,x.profile].join(' ');
  let tips=['基本は一般的なメダカと同様に、水温・水質の急変を避け、食べ残しを減らして管理します。'];
  if(/ロングフィン|ヒレ長|スワロー/.test(t))tips.push('ヒレが長い個体は、強すぎる水流や尖ったレイアウトでヒレを傷めないように注意します。');
  if(/ダルマ/.test(t))tips.push('短い体型の個体は泳ぎ方に差があるため、餌の届き方や水流を観察します。');
  if(/アルビノ|ルビーアイ|スモールアイ/.test(t))tips.push('眼に特徴のある個体は採餌できているか、照明の強さに問題がないか観察します。');
  return tips.join(' ');
}
function sourcePhotoLink(x,label='📷 出典の写真を見る ↗'){
  if(!x.webNo)return '';
  return `<a class="sourceLink" href="${esc(validUrl(x.url))}" target="_blank" rel="noopener noreferrer">${label}</a>`;
}

function validUrl(u){try{let v=new URL(u);return ['http:','https:'].includes(v.protocol)?v.href:SOURCE}catch{return SOURCE}}
async function edit(id){let x=id?entries.find(x=>x.id===id):norm({name:''}),isNew=!id;if(!x)return;let photos=await getPhotos(x.id),el=$('details');el.innerHTML=`<h2>${isNew?'新しいメダカを追加':esc(x.name)}</h2>${x.webNo?`<p class="hint">改良メダカWEB図鑑 掲載No.${esc(x.webNo)}</p>`:''}<section class="profilePanel"><h3>🔎 品種の特徴</h3><p>${esc(appearance(x))}</p>${x.profileBasis?`<p class="hint">${esc(x.profileBasis)}。出典の写真と併せて確認してください。</p>`:''}${trustedPhoto(x)?`<p class="hint"><a href="${esc(trustedPhoto(x).pageUrl)}" target="_blank" rel="noopener noreferrer">写真：${esc(trustedPhoto(x).author)}／${esc(trustedPhoto(x).license)}（Wikimedia Commons）</a></p>`:''}${sourcePhotoLink(x,'📷 元サイトで実物写真を見る ↗')}<h3>✨ 特徴の見方</h3>${featureNotes(x).length?`<dl class="featureGuide">${featureNotes(x).map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`:'<p class="hint">特徴が確認でき次第追加します。</p>'}<h3>🌱 飼育のヒント</h3><p>${esc(husbandry(x))}</p></section><div class="photoGrid" id="photoGrid"></div>${trustedPhotos(x).length?`<section class="referenceGallery"><h3>📷 掲載許可のある参考写真</h3><div class="referencePhotos">${trustedPhotos(x).map(p=>`<figure><a href="${esc(p.pageUrl)}" target="_blank" rel="noopener noreferrer"><img loading="lazy" src="${esc(p.imageUrl)}" alt="${esc(p.caption)}"></a><figcaption>${esc(p.caption)}<span>撮影：${esc(p.author)} ／ <a href="${esc(p.licenseUrl||p.pageUrl)}" target="_blank" rel="noopener noreferrer">${esc(p.license)}</a></span></figcaption></figure>`).join("")}</div></section>`:""}<label>写真を追加（複数選択可能）</label><input id="photos" type="file" accept="image/*" multiple><p class="hint">写真はこの端末内だけに保存します。出典サイトの写真を無断転載・直リンクしないでください。</p><label>品種名・流通名</label><input id="dn" value="${esc(x.name)}"><label>別名</label><input id="da" value="${esc(x.aliases)}"><label>特徴・分類</label><input id="dt" value="${esc(x.traits)}"><label>名称の区分</label><select id="dk"><option>品種・流通名（要照合）</option><option>品種名（確認済み）</option><option>流通名</option><option>形質・分類</option><option>WEB図鑑掲載名（区分は要確認）</option></select><label>特徴・系統などの解説</label><textarea id="dd">${esc(x.description)}</textarea><label>飼育のポイント</label><textarea id="dc">${esc(x.care)}</textarea><label>飼育状況</label><select id="ds"><option value="none">現在は飼育していない</option><option value="current">現在飼育中</option><option value="past">過去に飼育</option></select><div class="switches"><label><input id="de" type="checkbox" ${x.ever?'checked':''}> 飼ったことがある</label><label><input id="dw" type="checkbox" ${x.wish?'checked':''}> 今後飼いたい ♡</label><label><input id="df" type="checkbox" ${x.favorite?'checked':''}> お気に入り ☆</label></div><label>飼育メモ・個体名</label><textarea id="dm">${esc(x.note)}</textarea><label>参考記事URL</label><input id="du" value="${esc(x.url)}"><p><a id="source" target="_blank" rel="noopener noreferrer" href="${esc(validUrl(x.url))}">出典・参考ページを開く ↗</a></p><div class="toolbar"><button class="primary" id="saveDetail">保存</button><button id="closeDetail">閉じる</button>${isNew?'':`<button id="deleteDetail" class="danger">この品種を削除</button>`}</div>`;$('dk').value=x.kind;$('ds').value=x.status;let currentPhotos=[...photos];function paint(){detailUrls.forEach(URL.revokeObjectURL);detailUrls=[];$('photoGrid').innerHTML=currentPhotos.map((b,i)=>{let u=URL.createObjectURL(b);detailUrls.push(u);return `<div class="photoTile"><img src="${u}" alt="登録写真"><button data-rm="${i}" title="写真削除">×</button></div>`}).join('')}$('photos').onchange=async e=>{try{for(let f of e.target.files)currentPhotos.push(await optimize(f));paint()}catch(err){alert(err.message)}};$('photoGrid').onclick=e=>{let b=e.target.closest('[data-rm]');if(b){currentPhotos.splice(Number(b.dataset.rm),1);paint()}};$('closeDetail').onclick=()=>$('dialog').close();$('saveDetail').onclick=async()=>{let name=$('dn').value.trim();if(!name){alert('名前を入力してね');return}if(isNew&&entries.some(y=>y.name===name)){alert('同じ名前が登録されています');return}Object.assign(x,{name,aliases:$('da').value,traits:$('dt').value,kind:$('dk').value,description:$('dd').value,care:$('dc').value,status:$('ds').value,ever:$('de').checked||$('ds').value!=='none',wish:$('dw').checked,favorite:$('df').checked,note:$('dm').value,url:validUrl($('du').value),updated:Date.now()});try{await putPhotos(x.id,currentPhotos);if(isNew)entries.push(x);save();$('dialog').close();page=0;render()}catch(err){alert('保存に失敗しました: '+err.message)}};if(!isNew)$('deleteDetail').onclick=async()=>{if(!confirm('この品種と登録写真を削除しますか？'))return;await putPhotos(x.id,[]);entries=entries.filter(y=>y.id!==x.id);save();$('dialog').close();render()};$('dialog').onclose=()=>{detailUrls.forEach(URL.revokeObjectURL);detailUrls=[]};paint();$('dialog').showModal()}
function download(name,body,type){let u=URL.createObjectURL(new Blob([body],{type})),a=document.createElement('a');a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),30000)}
async function backup(){try{let photos={};for(let x of entries){let a=await getPhotos(x.id);if(a.length)photos[x.id]=await Promise.all(a.map(fileData))}let d={format:'my-medaka-release-v1',created:new Date().toISOString(),entries,photos};download('my-medaka-backup-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(d),'application/json');alert('バックアップを書き出しました。「ファイル」アプリに保存できたか確認してください。')}catch(e){alert('バックアップに失敗: '+e.message)}}

/* Personal image library: every screenshot is kept in IndexedDB on this device.
 * It is never posted to GitHub. No third-party content is downloaded automatically.
 * The user explicitly identifies each variety to avoid wrong-breed photos.
 */
function photoFileName(f){
  let name=(f?.name||'').replace(/\.[^.]+$/,'').trim();
  return /^(IMG|DSC|Screenshot|スクリーンショット)[_\s-]?\d/i.test(name)?'':name;
}
function photoLabel(x){return x.name+(x.webNo?' · No.'+x.webNo:'')}
function photoOptions(term){
  const needle=String(term||'').trim().toLocaleLowerCase();
  let matches=entries.filter(x=>{
    if(!needle)return true;
    return [x.name,x.aliases,x.traits,x.webNo,x.webNo?'No.'+x.webNo:''].some(v=>String(v||'').toLocaleLowerCase().includes(needle));
  });
  if(needle)matches.sort((a,b)=>{
    const sa=a.name.toLocaleLowerCase(),sb=b.name.toLocaleLowerCase();
    const score=v=>v===needle?0:v.startsWith(needle)?1:v.includes(needle)?2:3;
    return score(sa)-score(sb)||a.name.localeCompare(b.name,'ja');
  });else matches.sort((a,b)=>a.name.localeCompare(b.name,'ja'));
  return matches.slice(0,30);
}
function photoChoices(q){
  const holder=$('inboxMatches');if(!holder)return;
  let match=photoOptions(q);
  holder.innerHTML=match.length?match.map(x=>'<button type="button" class="photoChoice'+(x.id===photoQueueTarget?' selected':'')+'" data-inbox-id="'+esc(x.id)+'">'+esc(photoLabel(x))+'</button>').join(''):'<p class="hint">見つかりません。別の名前・図鑑No.で検索してね。</p>';
  holder.querySelectorAll('[data-inbox-id]').forEach(b=>b.onclick=()=>{
    const x=entries.find(x=>x.id===b.dataset.inboxId);if(!x)return;
    photoQueueTarget=x.id;
    $('inboxSelected').textContent='登録先：'+photoLabel(x);
    $('inboxSave').disabled=false;
    holder.querySelectorAll('.photoChoice').forEach(c=>c.classList.toggle('selected',c.dataset.inboxId===x.id));
  });
}
function cleanupPhotoInbox(){
  if(photoQueuePreview){URL.revokeObjectURL(photoQueuePreview);photoQueuePreview=''}
  photoQueue=[];photoQueueIndex=0;photoQueueTarget='';photoQueueSaved=0;
}
function closePhotoInbox(force=false){
  const remaining=photoQueue.length-photoQueueIndex;
  if(!force&&remaining>0&&!confirm('まだ仕分けていない写真が'+remaining+'枚あります。保存せず終了しますか？'))return;
  const count=photoQueueSaved;
  $('photoInboxDialog').close();
  cleanupPhotoInbox();
  render();
  if(count)alert(count+'枚を図鑑に登録しました。写真はこの端末内に保存されています。');
}
function displayPhotoInbox(){
  const d=$('photoInboxDialog'),el=$('photoInboxContent');
  if(photoQueueIndex>=photoQueue.length){
    const saved=photoQueueSaved;
    closePhotoInbox(true);
    if(saved===0)alert('今回保存した写真はありません。');
    return;
  }
  const item=photoQueue[photoQueueIndex],guess=photoFileName(item);
  photoQueueTarget='';
  if(photoQueuePreview)URL.revokeObjectURL(photoQueuePreview);
  photoQueuePreview=URL.createObjectURL(item.blob);
  const matchingExact=entries.filter(x=>x.name===guess||x.aliases.split(/[、,]/).some(a=>a.trim()===guess));
  el.innerHTML='<div class="inboxHeading"><h2>📷 写真を図鑑に登録</h2><span class="tag">'+(photoQueueIndex+1)+' / '+photoQueue.length+'枚</span></div>'+
    '<p class="hint">写真を見ながら品種を選ぶだけ。保存後は図鑑のカードに表示されます。</p>'+
    '<img class="inboxPreview" id="inboxPreview" alt="登録する写真">'+
    '<p class="hint">'+esc(item.name)+'　·　保存済み '+photoQueueSaved+'枚</p>'+
    '<label for="inboxSearch">この写真に写っているメダカの品種</label>'+
    '<input id="inboxSearch" type="search" autocomplete="off" placeholder="例：初恋、オロチ、No.0100" value="'+esc(guess)+'">'+
    '<div class="inboxMatches" id="inboxMatches"></div>'+
    '<p class="selectedPhotoTarget" id="inboxSelected">登録先を選んでね</p>'+
    '<div class="inboxActions"><button id="inboxSave" class="primary" disabled>この品種に保存 →</button><button id="inboxSkip">この写真はスキップ</button><button id="inboxClose">終了</button></div>'+
    '<p class="hint">登録していない写真は端末にも保存されません。写真そのものはGitHubには送信されません。</p>';
  $('inboxPreview').src=photoQueuePreview;
  $('inboxSearch').oninput=()=>{photoQueueTarget='';$('inboxSave').disabled=true;$('inboxSelected').textContent='登録先を選んでね';photoChoices($('inboxSearch').value)};
  photoChoices(guess);
  if(matchingExact.length===1){
    photoQueueTarget=matchingExact[0].id;
    $('inboxSelected').textContent='登録先：'+photoLabel(matchingExact[0]);
    $('inboxSave').disabled=false;
    photoChoices(guess);
  }
  $('inboxSave').onclick=async()=>{
    const id=photoQueueTarget,button=$('inboxSave');
    if(!id)return;
    button.disabled=true;button.textContent='保存中…';
    try{
      const old=await getPhotos(id);
      old.push(item.blob);
      await putPhotos(id,old);
      photoQueueSaved++;
      const x=entries.find(x=>x.id===id);
      if(x){x.updated=Date.now();save()}
      photoQueueIndex++;
      displayPhotoInbox();
    }catch(e){
      button.disabled=false;button.textContent='この品種に保存 →';
      alert('写真の保存に失敗しました。空き容量を確認してください。'+e.message);
    }
  };
  $('inboxSkip').onclick=()=>{photoQueueIndex++;displayPhotoInbox()};
  $('inboxClose').onclick=()=>closePhotoInbox();
  if(!d.open)d.showModal();
}
async function startPhotoInbox(files){
  if(photoQueue.length)cleanupPhotoInbox();
  if(files.length>50)alert('iPhoneの保存容量を守るため、一度に50枚まで登録します。残りは次の回に選んでね。');
  const selected=files.slice(0,50);
  photoQueue=[];photoQueueIndex=0;photoQueueSaved=0;
  for(const f of selected){
    try{photoQueue.push({name:f.name,blob:await optimize(f)})}
    catch(e){alert(f.name+'を読み込めませんでした: '+e.message)}
  }
  if(!photoQueue.length)return;
  const d=$('photoInboxDialog');
  d.oncancel=e=>{e.preventDefault();closePhotoInbox()};
  displayPhotoInbox();
}

function csvRows(t){let a=[],row=[],field='',quoted=false;for(let i=0;i<t.length;i++){let c=t[i];if(c==='"'){if(quoted&&t[i+1]==='"'){field+='"';i++}else quoted=!quoted}else if(c===','&&!quoted){row.push(field);field=''}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&t[i+1]==='\n')i++;row.push(field);if(row.some(Boolean))a.push(row);row=[];field=''}else field+=c}row.push(field);if(row.some(Boolean))a.push(row);return a}
async function handleFile(e){let files=[...e.target.files];if(!files.length)return;try{if(fileMode==='restore'){let d=JSON.parse(await files[0].text());if(!Array.isArray(d.entries))throw Error('対応するバックアップではありません');if(!confirm('現在のデータを置き換えます。事前にバックアップを保存しましたか？'))return;let fresh=d.entries.map(norm);for(let x of fresh){let p=d.photos?.[x.id],a=Array.isArray(p)?p:p?[p]:[];if(!a.length){let old=d.entries.find(z=>z.id===x.id)?.photo;if(old?.startsWith('data:'))a=[old]}await putPhotos(x.id,a.filter(s=>typeof s==='string'&&s.startsWith('data:')).map(toBlob))}entries=fresh;save();alert('復元しました')}else if(fileMode==='csv'){let rows=csvRows((await files[0].text()).replace(/^\uFEFF/,'')),head=rows.shift()?.map(s=>s.trim().toLowerCase())||[],n=head.indexOf('name');if(n<0)throw Error('CSVの先頭行に name 列が必要です');let count=0,names=new Set(entries.map(x=>x.name.toLowerCase()));for(let r of rows){let name=(r[n]||'').trim();if(!name||names.has(name.toLowerCase()))continue;let item={name};for(let k of ['aliases','traits','kind','description','care','url']){let idx=head.indexOf(k);if(idx>=0)item[k]=r[idx]||''}entries.push(norm(item));names.add(name.toLowerCase());count++}save();alert(count+'件を追加しました')}else if(fileMode==='inbox'){await startPhotoInbox(files)}else if(fileMode==='single'){const id=singlePhotoId,x=entries.find(e=>e.id===id);if(!x)throw Error('写真を保存する品種が見つかりません');let p=await getPhotos(id);for(const f of files)p.push(await optimize(f));await putPhotos(id,p);x.updated=Date.now();save();alert(x.name+'に写真を'+files.length+'枚登録しました。')}page=0;render()}catch(err){alert('読み込み失敗: '+err.message)}finally{e.target.value=''}}
init();if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
