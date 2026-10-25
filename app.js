'use strict';
const $=id=>document.getElementById(id),KEY='my-medaka-release-v1',OLD2='my-medaka-v2',OLD1='my-medaka-v1',DB='my-medaka-db',STORE='photos',SOURCE='https://medakazukan.net/varietyofmedaka/';
let entries=[],db,tab='all',page=0,visibleUrls=[],detailUrls=[],fileMode='restore';const PAGE=48;
let photoQueue=[],photoQueueIndex=0,photoQueueTarget='',photoQueueSaved=0,photoQueuePreview='',singlePhotoId='';
let traitNames=new Set(),sourceNames=new Set();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function foldName(s){return String(s||'').normalize('NFKC').toLocaleLowerCase().replace(/[\u3041-\u3096]/g,c=>String.fromCharCode(c.charCodeAt(0)+96)).replace(/[\s　・･ｰ‐－―—‐-]/g,'').replace(/ヴ/g,'ブ').replace(/ヵ/g,'カ').replace(/ヶ/g,'ケ')}
const ALIAS_CANONICAL={
'鈴蘭':['すずらん','スズラン'],'楊貴妃':['ようきひ','ヨウキヒ'],
'幹之':['みゆき','ミユキ'],'鱗光':['りんこう'],'初恋':['はつこい'],
'墨武':['ぼぶ'],'鯖の極み':['さばのきわみ','サバの極み'],
'王華':['おうか'],'月神':['げっしん'],'月弓':['つくゆみ'],
'深海':['しんかい'],'夜桜':['よざくら'],'青蝶':['あおちょう']
};
function searchText(x){
  const base=[x.name,x.aliases,x.reading,...(Array.isArray(x.readings)?x.readings:[]),x.traits,x.profile,x.description,x.webNo,x.webNo?'No.'+x.webNo:'',x.sourceOfficialName,x.sourceNickname,x.sourceBreeder,x.note];
  for(const [kanji,aliases] of Object.entries(ALIAS_CANONICAL)){
    if([x.name,x.aliases,x.sourceOfficialName].some(v=>String(v||'').includes(kanji)))base.push(...aliases);
    if(aliases.some(v=>foldName(x.name)===foldName(v)))base.push(kanji);
  }
  return foldName(base.join(' '));
}
function searchMatches(x,query){if(!query)return true;return searchText(x).includes(query)}
const makeId=()=> 'm-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9);
const norm=x=>({reading:String(x.reading||''),readings:Array.isArray(x.readings)?x.readings.map(String).slice(0,12):[],referenceLinks:Array.isArray(x.referenceLinks)?x.referenceLinks.filter(y=>y&&typeof y==='object').slice(0,12):[],sourceYear:String(x.sourceYear||''),sourceBreeder:String(x.sourceBreeder||''),sourceOfficialName:String(x.sourceOfficialName||''),sourceNickname:String(x.sourceNickname||''),sourceCheckedAt:String(x.sourceCheckedAt||''),id:x.id||makeId(),name:String(x.name||'').trim(),aliases:String(x.aliases||''),traits:String(x.traits||''),kind:String(x.kind||'品種・流通名（要照合）'),description:String(x.description||''),care:String(x.care||''),status:['current','past','none'].includes(x.status)?x.status:'none',ever:!!x.ever||x.status==='past'||x.status==='current',wish:!!x.wish,favorite:!!x.favorite,note:String(x.note||''),profile:String(x.profile||''),profileBasis:String(x.profileBasis||''),licensedPhoto:(x.licensedPhoto&&typeof x.licensedPhoto==='object')?x.licensedPhoto:null,licensedPhotos:Array.isArray(x.licensedPhotos)?x.licensedPhotos:[],webNo:String(x.webNo||''),url:String(x.url||x.source||SOURCE),updated:Number(x.updated)||0});
function openDB(){return new Promise((ok,no)=>{let r=indexedDB.open(DB,4);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE);if(!r.result.objectStoreNames.contains('gallery'))r.result.createObjectStore('gallery');if(!r.result.objectStoreNames.contains('traitGallery'))r.result.createObjectStore('traitGallery');if(!r.result.objectStoreNames.contains('sourceGallery'))r.result.createObjectStore('sourceGallery')};r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})}
function op(store,mode,key,value){return new Promise((ok,no)=>{let t=db.transaction(store,mode==='get'?'readonly':'readwrite'),s=t.objectStore(store),r=mode==='get'?s.get(key):mode==='put'?s.put(value,key):mode==='delete'?s.delete(key):s.getAllKeys();r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})}
const getPhotos=async id=>{let a=await op('gallery','get',id);if(Array.isArray(a)&&a.length)return a;let old=await op(STORE,'get',id);return old?[old]:[]};
async function putPhotos(id,a){await op('gallery','put',id,a);await op(STORE,'delete',id)}
function save(){localStorage.setItem(KEY,JSON.stringify(entries))}
function fileData(blob){return new Promise((ok,no)=>{let r=new FileReader();r.onload=()=>ok(r.result);r.onerror=()=>no(r.error);r.readAsDataURL(blob)})}
function toBlob(s){let [h,d]=s.split(','),mime=(h.match(/data:(.*?);/)||[])[1]||'image/jpeg',bin=atob(d),a=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)a[i]=bin.charCodeAt(i);return new Blob([a],{type:mime})}
async function optimize(f){if(!f.type.startsWith('image/'))throw Error('画像ファイルではありません');if(f.size>35*1024*1024)throw Error('画像が大きすぎます');try{let img=await createImageBitmap(f),scale=Math.min(1,1400/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale));c.getContext('2d').drawImage(img,0,0,c.width,c.height);img.close();return await new Promise(ok=>c.toBlob(b=>ok(b||f),'image/jpeg',.82))}catch{return f}}
const GENERIC_DESC=['詳しい系統や特徴は出典記事をご確認ください。','特徴・作出系統の詳細は出典を確認して追記してください。'];
const isGenericDescription=s=>{
  const v=String(s||'').trim();
  return !v||GENERIC_DESC.includes(v)
    ||v.startsWith('専門図鑑に掲載される改良メダカの流通名。')
    ||v.startsWith('専門図鑑で流通名と特徴が紹介される系統。')
    ||v.startsWith('専門図鑑に掲載される改良メダカの流通名。外見の細部')
    ||v.startsWith('専門図鑑に掲載される改良メダカの流通名。作出系統');
};
function mergeCatalog(catalog){
  if(!Array.isArray(catalog))throw Error('図鑑データの形式が正しくありません');
  const byNo=new Map(entries.filter(x=>x.webNo).map(x=>[String(x.webNo),x]));
  const byName=new Map(entries.map(x=>[foldName(x.name.trim()),x]));
  let added=0,refreshed=0;
  for(const item of catalog){
    if(!item||!String(item.name||'').trim())continue;
    const no=String(item.webNo||''),key=foldName(item.name.trim());
    let old=(no&&byNo.get(no))||byName.get(key);
    if(old){
      if(!old.webNo&&no)old.webNo=no;
      if(item.url&&(!old.url||old.url===SOURCE))old.url=item.url;
      if(!old.traits&&item.traits)old.traits=String(item.traits);
      if(item.traits&&String(item.sourceCheckedAt||'')&&!String(old.traits||'').trim())old.traits=String(item.traits);
      if(item.aliases){
        const aliases=String(old.aliases||'').split(/[、,，]/).map(s=>s.trim()).filter(Boolean);
        const present=new Set(aliases.map(foldName));
        for(const other of String(item.aliases).split(/[、,，]/)){
          const candidate=other.trim();if(candidate&&!present.has(foldName(candidate))){aliases.push(candidate);present.add(foldName(candidate))}
        }
        old.aliases=aliases.join('、');
      }
      if(isGenericDescription(old.description)&&!isGenericDescription(item.description))old.description=String(item.description);
      if(['品種・流通名（要照合）','WEB図鑑掲載名（区分は要確認）'].includes(old.kind)&&item.kind&&!['品種・流通名（要照合）','WEB図鑑掲載名（区分は要確認）'].includes(item.kind))old.kind=item.kind;
      for(const k of ['profile','profileBasis','sourceYear','sourceBreeder','sourceOfficialName','sourceNickname','sourceCheckedAt'])if(item[k])old[k]=String(item[k]);
      if(item.reading&&!old.reading)old.reading=String(item.reading);
      if(Array.isArray(item.readings))old.readings=[...new Set([...(old.readings||[]),...item.readings].map(String))].slice(0,12);
      if(Array.isArray(item.referenceLinks)){
        const prev=Array.isArray(old.referenceLinks)?old.referenceLinks:[];
        old.referenceLinks=[...new Map([...prev,...item.referenceLinks].filter(s=>s?.url).map(s=>[s.url,s])).values()].slice(0,12);
      }
      if(item.licensedPhoto)old.licensedPhoto=item.licensedPhoto;
      if(Array.isArray(item.licensedPhotos))old.licensedPhotos=item.licensedPhotos;
      refreshed++;
    }else{
      const x=norm(item);
      entries.push(x);byName.set(key,x);if(no)byNo.set(no,x);added++;
    }
  }
  save();return {added,refreshed};
}
async function refreshCatalog(){
  const button=$('catalogUpdate');if(button)button.disabled=true;
  try{
    const r=await fetch('./catalog.json?v='+Date.now(),{cache:'no-store'});
    if(!r.ok)throw Error('図鑑データが取得できません（HTTP '+r.status+'）');
    const cat=await r.json();
    if(!Array.isArray(cat)||cat.length<100)throw Error('図鑑データが不完全です');
    const result=mergeCatalog(cat);page=0;await render();
    alert('図鑑データを更新しました。\\n新規追加：'+result.added+'件\\n照合済み：'+result.refreshed+'件\\n飼育記録と登録写真は保持しています。\\n※元サイトの情報をその場で直接収集する機能ではありません。');
  }catch(err){alert('図鑑の更新に失敗しました：'+err.message+'\\n現在のデータはそのまま残しています。')}
  finally{if(button)button.disabled=false}
}
// One-time import explicitly authorized on 2026-10-25.
// Only the 'ever' flag changes; current/past/none, user photos and notes are retained.
const CONFIRMED_OWNED_KEY='my-medaka-20261025-confirmed-five-v1';
const CONFIRMED_OWNED=[
  {name:'ラムネブルー'},
  {name:'スズラン',webNo:'0882'},
  {name:'鯖の極み'},
  {name:'青蝶',webNo:'0277'},
  {name:'ポニョ',webNo:'0506'}
];
function registerConfirmedOwnedOnce(){
  if(localStorage.getItem(CONFIRMED_OWNED_KEY)==='done')return;
  let found=0,changed=0;
  for(const target of CONFIRMED_OWNED){
    const item=entries.find(x=>(target.webNo&&x.webNo===target.webNo)||foldName(x.name)===foldName(target.name));
    if(!item)continue;
    found++;
    if(!item.ever){item.ever=true;changed++}
  }
  if(changed)save();
  if(found===CONFIRMED_OWNED.length)localStorage.setItem(CONFIRMED_OWNED_KEY,'done');
}
async function init(){
  try{db=await openDB()}catch(e){alert('端末の写真保存領域を開けません: '+e.message);return}
  let data;
  for(const k of [KEY,OLD2,OLD1]){
    try{const v=JSON.parse(localStorage.getItem(k)||'null');
      if(Array.isArray(v)){data=v;if(k!==KEY){for(const x of v){if(x.photo?.startsWith('data:'))await putPhotos(x.id||'', [toBlob(x.photo)])}}break}
    }catch{}
  }
  entries=Array.isArray(data)?data.map(norm):[];
  try{const r=await fetch('./catalog.json');if(r.ok){const catalog=await r.json();mergeCatalog(catalog)}}catch(e){if(!data)console.warn('図鑑データ未取得',e)}
  registerConfirmedOwnedOnce();
  await refreshTraitNames();await refreshSourceNames();bind();render();
}
function bind(){for(let id of ['search','category','sort','origin'])$(id).addEventListener(id==='search'?'input':'change',()=>{page=0;render()});$('add').onclick=()=>edit(null);$('backup').onclick=backup;$('restore').onclick=()=>pick('restore','.json,application/json');$('import').onclick=()=>pick('csv','.csv,text/csv');$('batch').onclick=()=>pick('inbox','image/*',true);$('traitPack').onclick=()=>pick('traitpack','.json,application/json');if($('catalogUpdate'))$('catalogUpdate').onclick=refreshCatalog;$('sourcePack').onclick=()=>pick('sourcepack','.json,application/json',true);$('more').onclick=()=>{page++;render()};$('file').onchange=handleFile}
function pick(mode,accept,multiple=false){fileMode=mode;let f=$('file');f.accept=accept;f.multiple=multiple;f.value='';f.click()}

/* Local reference photos from a user-imported file. Never published in GitHub. */
const TRAIT_PRIORITY=['リアルロングフィン','ロングフィン','ワイドフィン','ナローフィン','ヒレライン','ヒレ長','スワロー','フサヒレ','モルフォ','ヒカリダルマ','ヒレ美','ヒレ光','一周光','シースルー','側面光','腹膜青','腹膜光','全身体内光','体内光','体外光','ブラックリム','ルビーアイ','スモールアイ','ビッグアイ','アースアイ','プラチナアイ','頂点眼','水泡眼','出目','目前','半透明鱗','透明鱗','アルビノ','パンダ','メラー','マルコ','サムライ','菱尾','体内黒','ヒゲ','背地反応なし','パウダー','ラメ','斑','ダルマ','ヒカリ','黄金','琥珀','朱赤','ピンク','オレンジ','ブラック','青','白','黄','茶'];
async function refreshTraitNames(){
  try{traitNames=new Set(await op('traitGallery','keys')||[])}
  catch{traitNames=new Set()}
}
function identifyTrait(x){
  if(!traitNames.size)return '';
  const source=[x.name,x.traits,x.profile].join('、');
  for(const t of TRAIT_PRIORITY)if(traitNames.has(t)&&source.includes(t))return t;
  if(/黒メダカ|黒系|(^|、)黒(、|$)/.test(source)&&traitNames.has('ブラック'))return 'ブラック';
  if(/紅白|三色|赤系/.test(source)&&traitNames.has('朱赤'))return '朱赤';
  if(/黄色|黄系/.test(source)&&traitNames.has('黄'))return '黄';
  if(/白系|純白/.test(source)&&traitNames.has('白'))return '白';
  if(/青系/.test(source)&&traitNames.has('青'))return '青';
  return '';
}
async function importTraitPack(file){
  const d=JSON.parse(await file.text());
  if(d?.format!=='my-medaka-trait-photo-pack-v1'||!Array.isArray(d.photos)||d.photos.length<1||d.photos.length>120)throw Error('個人用の形質写真パックではありません');
  if(!confirm(d.photos.length+'種類の形質写真をこのiPhone内に保存します。飼育記録は変更しません。よろしいですか？'))return;
  let count=0;
  for(const p of d.photos){
    if(typeof p.trait!=='string'||!p.trait.trim()||p.trait.length>70||typeof p.dataUrl!=='string'||!p.dataUrl.startsWith('data:image/jpeg;base64,'))continue;
    const blob=toBlob(p.dataUrl);
    if(blob.size>250000)continue;
    await op('traitGallery','put',p.trait,{blob,caption:String(p.caption||''),source:String(p.source||''),sourceUrl:String(p.sourceUrl||''),page:Number(p.page)||0});
    count++;
  }
  await refreshTraitNames();
  alert(count+'種類の参考写真を登録しました。図鑑のカードと詳細画面で見られます。');
}
async function traitForEntry(x){
  const trait=identifyTrait(x);
  return trait?{trait,photo:await op('traitGallery','get',trait)}:null;
}

async function refreshSourceNames(){
  try{sourceNames=new Set(await op('sourceGallery','keys')||[])}
  catch{sourceNames=new Set()}
}
async function importAuthorizedPacks(files){
  if(!files?.length)return;
  const status=$('importProgress'),button=$('sourcePack');
  let added=0,rejected=0,batches=0;const errors=[];
  button.disabled=true;
  try{
    for(let fi=0;fi<files.length;fi++){
      const file=files[fi];
      if(file.size>100000000){errors.push(file.name+': サイズが大きすぎます');continue}
      if(status)status.textContent='📷 写真パックを確認中 '+(fi+1)+'/'+files.length;
      let pack;
      try{pack=JSON.parse(await file.text())}catch{errors.push(file.name+': 読込エラー');continue}
      if(pack?.format!=='my-medaka-authorized-photo-pack-v1'||!Array.isArray(pack.photos)||pack.photos.length>1000){errors.push(file.name+': 形式が違います');continue}
      batches++;
      for(let i=0;i<pack.photos.length;i++){
        const p=pack.photos[i],no=String(p.webNo||'').padStart(4,'0');
        const matching=entries.find(x=>x.webNo===no);
        if(!/^\d{4}$/.test(no)||!matching||typeof p.dataUrl!=='string'||!p.dataUrl.startsWith('data:image/jpeg;base64,')){rejected++;continue}
        try{
          const blob=toBlob(p.dataUrl);
          if(blob.size<1200||blob.size>450000){rejected++;continue}
          await op('sourceGallery','put',no,{blob,sourceUrl:validUrl(p.sourceUrl),source:String(p.source||'改良メダカWEB図鑑'),name:String(p.name),webNo:no});
          sourceNames.add(no);added++;
        }catch(e){rejected++;errors.push(no+' '+String(e.message||e).slice(0,60))}
        if(i%15===0){
          if(status)status.textContent='📷 保存中：'+(fi+1)+'/'+files.length+'パック（'+added+'枚）';
          await new Promise(resolve=>setTimeout(resolve,0));
        }
      }
    }
    await refreshSourceNames();
    if(status)status.textContent='✅ 実物写真 '+sourceNames.size+'種類を端末に保存済み';
    alert(batches+'パックを読み込み、今回'+added+'枚を保存しました。\n保存済み合計：'+sourceNames.size+'種類\n照合できない画像：'+rejected+'枚'+(errors.length?'\n'+errors.slice(0,3).join('\n'):''));
  }catch(e){
    if(status)status.textContent='保存エラー。保存済み画像は残っています。';
    alert('保存に失敗しました: '+e.message);
  }finally{button.disabled=false}
}
function matching(){let q=foldName($('search').value.trim()),cat=$('category').value,origin=$('origin')?.value||'';let a=entries.filter(x=>searchMatches(x,q)&&(!cat||[x.traits,x.name,x.aliases].join(' ').includes(cat))&&(!origin||(origin==='official'&&!!x.webNo)||(origin==='jma'&&x.kind==='日本メダカ協会認定名')||(origin==='other'&&!x.webNo&&x.kind!=='日本メダカ協会認定名'))&&(tab==='all'||(tab==='current'&&x.status==='current')||(tab==='ever'&&x.ever)||(tab==='past'&&x.ever&&x.status!=='current')||(tab==='wish'&&x.wish)||(tab==='favorite'&&x.favorite)));a.sort((x,y)=>$('sort').value==='recent'?(y.updated-x.updated)||x.name.localeCompare(y.name,'ja'):$('sort').value==='number'?(Number(x.webNo)||99999)-(Number(y.webNo)||99999)||x.name.localeCompare(y.name,'ja'):x.name.localeCompare(y.name,'ja'));return a}
async function render(){const counts={current:entries.filter(x=>x.status==='current').length,past:entries.filter(x=>x.ever&&x.status!=='current').length,wish:entries.filter(x=>x.wish).length};$('stats').innerHTML=`<span>収録 ${entries.length}</span><span>WEB図鑑記事 ${entries.filter(x=>x.webNo).length}</span><span>実物写真 ${sourceNames.size}種類</span><span>形質写真 ${traitNames.size}種類</span><span>飼育中 ${counts.current}</span><span>飼育経験 ${entries.filter(x=>x.ever).length}</span><span>飼いたい ${counts.wish}</span><span>分類・情報は随時照合中</span>`;const tabs=[['all','全図鑑'],['current','飼育中'],['ever','飼育経験'],['past','過去に飼育'],['wish','飼いたい ♡'],['favorite','お気に入り ☆']];$('tabs').innerHTML=tabs.map(([k,n])=>`<button class="${tab===k?'active':''}" data-tab="${k}">${n}</button>`).join('');document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;page=0;render()});let list=matching(),shown=list.slice(0,(page+1)*PAGE);$('more').hidden=shown.length>=list.length;$('foot').textContent=`${shown.length}件表示 / 該当 ${list.length}件（全 ${entries.length}件）`;let grid=$('grid');grid.innerHTML=shown.map(x=>`<article data-id="${esc(x.id)}"><div class="cover" data-photo="${esc(x.id)}"><div class="photoPlaceholder">🐟<small>登録写真なし</small></div></div><div class="item"><strong>${esc(x.name)}</strong><span class="tag">${x.webNo?'No.'+esc(x.webNo)+' · ':''}${esc(x.traits||x.kind)}</span><p class="cardDescription">${esc(appearance(x))}</p>${trustedPhoto(x)?`<a class="photoCredit" href="${esc(trustedPhoto(x).pageUrl)}" target="_blank" rel="noopener noreferrer">写真：${esc(trustedPhoto(x).author)} · ${esc(trustedPhoto(x).license)}</a>`:''}${sourcePhotoLink(x,'📷 元サイトで写真を見る ↗')}<div class="actions"><button data-detail="${esc(x.id)}">詳細</button><button data-photo-add="${esc(x.id)}" title="このメダカの写真を登録">📷 写真</button><button data-wish="${esc(x.id)}" class="${x.wish?'active':''}">${x.wish?'♥':'♡'}</button><button data-fav="${esc(x.id)}" class="${x.favorite?'active':''}">${x.favorite?'★':'☆'}</button></div></div></article>`).join('')||'<p class="empty">該当するメダカはいません</p>';visibleUrls.forEach(URL.revokeObjectURL);visibleUrls=[];for(let x of shown){let a=await getPhotos(x.id).catch(()=>[]),node=grid.querySelector(`[data-photo="${CSS.escape(x.id)}"]`);if(!node)continue;if(a[0]){let u=URL.createObjectURL(a[0]);visibleUrls.push(u);node.innerHTML=`<img class="cover" src="${u}" alt="登録写真">`}else{let p=trustedPhoto(x);if(p)node.innerHTML=`<img class="cover" loading="lazy" src="${esc(p.imageUrl)}" alt="${esc(p.caption)}" title="写真: ${esc(p.author)}・${esc(p.license)}">`}}grid.querySelectorAll('[data-detail]').forEach(b=>b.onclick=()=>edit(b.dataset.detail));grid.querySelectorAll('[data-photo-add]').forEach(b=>b.onclick=()=>{singlePhotoId=b.dataset.photoAdd;pick('single','image/*',true)});grid.querySelectorAll('[data-wish]').forEach(b=>b.onclick=()=>toggle(b.dataset.wish,'wish'));grid.querySelectorAll('[data-fav]').forEach(b=>b.onclick=()=>toggle(b.dataset.fav,'favorite'))}
function toggle(id,key){let x=entries.find(x=>x.id===id);if(!x)return;x[key]=!x[key];x.updated=Date.now();save();render()}

const FEATURE_GUIDE={"朱赤":"赤みの強い朱色に見える体色。","茶":"茶系の色素が目立つ体色。","黄":"黄色い色素が目立つ体色。","白":"白い色合いの体色。","青":"青灰色などに見える体色。","ブラック":"暗い黒色が目立つ体色。背地反応の有無も品種ごとに異なります。","黄金":"金色を思わせる地色。","琥珀":"琥珀色を思わせる体色。","オレンジ":"黄赤に近いオレンジ系の体色。","ピンク":"淡い桃色系に見える体色。","透明鱗":"えら蓋付近の赤みなどが透けて見える特徴。","半透明鱗":"普通鱗と透明鱗の間のような透け感がある。","アルビノ":"黒色素が少なく、目が赤っぽく見える。","パンダ":"虹彩まで暗く見え、目全体が黒く見える。","ルビーアイ":"瞳孔に赤みのある表現。","スモールアイ":"黒目の部分が小さく見える特徴。","出目":"眼球が突出する特徴。","目前":"眼が斜め前方を向く特徴。","ビッグアイ":"眼径が大きい特徴。","水泡眼":"眼球の角膜部分が水泡のように膨らむ特徴。","ブルーアイ":"瞳孔が青っぽく見える特徴。","ラメ":"鱗一枚ずつにキラキラした光が現れる。","体外光":"背中に光沢が表れ、上見で見分けやすい。","体内光":"体の内側に光があるように見える。","全身体内光":"体内の複数箇所に鮮やかな光が表れる。","腹膜光":"腹膜部分に特徴的な光が現れる。","ヒレライン":"ヒレの軟条に沿って光の線が見える。","腹膜青":"腹膜付近が青く見える特徴で、単独の分類形質とは区別して扱います。","斑":"体の一部に黒っぽい斑点が表れる。","ブラックリム":"鱗の縁取りが黒く強調される模様。","紅白":"白と朱赤の二色を楽しむ色柄の表現。","三色":"白・朱赤・黒などの三色を楽しむ色柄の表現。","サムライ":"背びれが二枚に見える特徴。","菱尾":"尾びれが菱形に見える特徴。","マルコ":"背びれがない特徴。","メラー":"ヒレの膜が部分的に欠け、複数に分かれて見える。","スワロー":"ヒレの一部が突き出して長くなる。","ヒレ長":"ヒレ全体が伸びる表現。","ロングフィン":"背びれ・しりびれの軟条が長く伸びる特徴。","ワイドフィン":"背びれ・しりびれの幅が広がる特徴。","リアルロングフィン":"ヒレの形を保ったまま長く大きく伸びる特徴。","モルフォ":"尾びれが扇状になり、先端がギザギザに見える特徴。","フサヒレ":"ヒレの軟条が途中で分岐し、房状に見える。","ナローフィン":"しりびれが細めになる特徴。","ヒカリ":"背びれとしりびれが対称に近く、尾びれの形が変化する体型。","ダルマ":"胴が短く丸みが強い体型。水流や餌の届き方に配慮します。","ヒカリダルマ":"ヒカリ体型とダルマ体型が組み合わさった体型。"};
const FEATURE_GROUP={"朱赤":"体色","茶":"体色","黄":"体色","白":"体色","青":"体色","ブラック":"体色","黄金":"体色","琥珀":"体色","オレンジ":"体色","ピンク":"体色","透明鱗":"鱗","半透明鱗":"鱗","アルビノ":"目","パンダ":"目","ルビーアイ":"目","スモールアイ":"目","出目":"目","目前":"目","ビッグアイ":"目","水泡眼":"目","ブルーアイ":"目","ラメ":"光","体外光":"光","体内光":"光","全身体内光":"光","腹膜光":"光","ヒレライン":"光","腹膜青":"補足","斑":"模様","ブラックリム":"模様","紅白":"模様","三色":"模様","サムライ":"ヒレ","菱尾":"ヒレ","マルコ":"ヒレ","メラー":"ヒレ","スワロー":"ヒレ","ヒレ長":"ヒレ","ロングフィン":"ヒレ","ワイドフィン":"ヒレ","リアルロングフィン":"ヒレ","モルフォ":"ヒレ","フサヒレ":"ヒレ","ナローフィン":"ヒレ","ヒカリ":"体型","ダルマ":"体型","ヒカリダルマ":"体型"};
function featureNotes(x){
  const text=[x.profile,x.traits,x.name].join(' '),matches=[];
  for(const [key,desc] of Object.entries(FEATURE_GUIDE)){
    if(key==='ロングフィン'&&text.includes('リアルロングフィン'))continue;
    if(key==='ヒレ長'&&(text.includes('ロングフィン')||text.includes('リアルロングフィン'))&&!text.includes('ヒレ長'))continue;
    if(key==='透明鱗'&&text.includes('半透明鱗')&&!text.replaceAll('半透明鱗','').includes('透明鱗'))continue;
    if(key==='ダルマ'&&text.includes('ヒカリダルマ')&&!text.replaceAll('ヒカリダルマ','').includes('ダルマ'))continue;
    if(key==='ヒカリ'&&text.includes('ヒカリ体型'))continue;
    if(text.includes(key)){matches.push([key,desc]);if(matches.length>=8)break}
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
async function edit(id){let x=id?entries.find(x=>x.id===id):norm({name:''}),isNew=!id;if(!x)return;let photos=await getPhotos(x.id),sourceRecord=x.webNo?await op('sourceGallery','get',x.webNo).catch(()=>null):null,sourceDetailURL=sourceRecord?.blob?URL.createObjectURL(sourceRecord.blob):null,traitReference=await traitForEntry(x).catch(()=>null),traitDetailURL=traitReference?.photo?.blob?URL.createObjectURL(traitReference.photo.blob):null,el=$('details');el.innerHTML=`<h2>${isNew?'新しいメダカを追加':esc(x.name)}</h2>${x.webNo?`<p class="hint">改良メダカWEB図鑑 掲載No.${esc(x.webNo)}</p>`:''}<section class="profilePanel"><h3>🔎 品種の特徴</h3><p>${esc(appearance(x))}</p><p class="hint">名称区分：${esc(x.kind)}。名称区分が未確認の場合は、出典の品種名・通称欄をご確認ください。</p>${x.profileBasis?`<p class="hint">${esc(x.profileBasis)}。出典の写真と併せて確認してください。</p>`:''}${trustedPhoto(x)?`<p class="hint"><a href="${esc(trustedPhoto(x).pageUrl)}" target="_blank" rel="noopener noreferrer">写真：${esc(trustedPhoto(x).author)}／${esc(trustedPhoto(x).license)}（Wikimedia Commons）</a></p>`:''}${sourcePhotoLink(x,'📷 元サイトで実物写真を見る ↗')}${!isGenericDescription(x.description)?`<h3>📝 品種の解説</h3><p>${esc(x.description)}</p>`:''}${x.sourceOfficialName||x.sourceNickname||x.sourceYear||x.sourceBreeder?`<h3>🏷️ 名前と作出情報</h3><p>${x.sourceOfficialName?'分類名：'+esc(x.sourceOfficialName)+'　':''}${x.sourceNickname?'通称：'+esc(x.sourceNickname)+'　':''}${x.sourceYear?'作出年：'+esc(x.sourceYear)+'　':''}${x.sourceBreeder?'作出者：'+esc(x.sourceBreeder):''}</p>`:''}${x.referenceLinks?.length?`<h3>📚 調べた情報源</h3><ul class="referenceSources">${x.referenceLinks.map(s=>`<li><a target="_blank" rel="noopener noreferrer" href="${esc(validUrl(s.url))}">${esc(s.label||'参考資料')}</a>${s.note?' — '+esc(s.note):''}</li>`).join('')}</ul>`:''}<h3>✨ 特徴の見方</h3>${featureNotes(x).length?`<dl class="featureGuide">${featureNotes(x).map(([k,v])=>`<dt>${esc(k)} <small>(${esc(FEATURE_GROUP[k]||'参考')})</small></dt><dd>${esc(v)}</dd>`).join('')}</dl>`:'<p class="hint">特徴が確認でき次第追加します。</p>'}<h3>🌱 飼育のヒント</h3><p>${esc(husbandry(x))}</p></section><div id="sourcePhotoMount"></div><div id="traitPhotoMount"></div><div class="photoGrid" id="photoGrid"></div>${trustedPhotos(x).length?`<section class="referenceGallery"><h3>📷 掲載許可のある参考写真</h3><div class="referencePhotos">${trustedPhotos(x).map(p=>`<figure><a href="${esc(p.pageUrl)}" target="_blank" rel="noopener noreferrer"><img loading="lazy" src="${esc(p.imageUrl)}" alt="${esc(p.caption)}"></a><figcaption>${esc(p.caption)}<span>撮影：${esc(p.author)} ／ <a href="${esc(p.licenseUrl||p.pageUrl)}" target="_blank" rel="noopener noreferrer">${esc(p.license)}</a></span></figcaption></figure>`).join("")}</div></section>`:""}<label>写真を追加（複数選択可能）</label><input id="photos" type="file" accept="image/*" multiple><p class="hint">写真はこの端末内だけに保存します。出典サイトの写真を無断転載・直リンクしないでください。</p><label>品種名・流通名</label><input id="dn" value="${esc(x.name)}"><label>読みがな（ひらがな・カタカナ検索用／変更可能）</label><input id="dyomi" value="${esc(x.reading||'')}" placeholder="例：ようきひ"><p class="hint">読みを入力すると、ひらがな・カタカナのどちらからも検索できます。自動判定の誤りもここで修正できます。</p><label>別名</label><input id="da" value="${esc(x.aliases)}"><label>特徴・分類</label><input id="dt" value="${esc(x.traits)}"><label>名称の区分</label><select id="dk"><option>品種・流通名（要照合）</option><option>品種名（確認済み）</option><option>流通名</option><option>日本メダカ協会認定名</option><option>形質・分類</option><option>WEB図鑑掲載名（区分は要確認）</option></select><label>特徴・系統などの解説</label><textarea id="dd">${esc(x.description)}</textarea><label>飼育のポイント</label><textarea id="dc">${esc(x.care)}</textarea><label>飼育状況</label><select id="ds"><option value="none">現在は飼育していない</option><option value="current">現在飼育中</option><option value="past">過去に飼育</option></select><div class="switches"><label><input id="de" type="checkbox" ${x.ever?'checked':''}> 飼ったことがある</label><label><input id="dw" type="checkbox" ${x.wish?'checked':''}> 今後飼いたい ♡</label><label><input id="df" type="checkbox" ${x.favorite?'checked':''}> お気に入り ☆</label></div><label>飼育メモ・個体名</label><textarea id="dm">${esc(x.note)}</textarea><label>参考記事URL</label><input id="du" value="${esc(x.url)}"><p><a id="source" target="_blank" rel="noopener noreferrer" href="${esc(validUrl(x.url))}">出典・参考ページを開く ↗</a></p><div class="toolbar"><button class="primary" id="saveDetail">保存</button><button id="closeDetail">閉じる</button>${isNew?'':`<button id="deleteDetail" class="danger">この品種を削除</button>`}</div>`;const sourceMount=$('sourcePhotoMount');
if(sourceMount&&sourceDetailURL){
  sourceMount.innerHTML='<section class="sourceReference"><h3>📷 この品種の実物写真</h3><img src="'+sourceDetailURL+'" alt="'+esc(x.name)+'の実物写真"><p class="hint">'+esc(x.name)+' · No.'+esc(x.webNo)+'｜出典：'+esc(sourceRecord.source)+'。個人利用のため端末内に保存しています。</p></section>';
}
const mount=$('traitPhotoMount');if(mount&&traitDetailURL&&!sourceDetailURL){
  mount.innerHTML='<section class="traitReference"><h3>📷 '+esc(traitReference.trait)+'の参考写真</h3><img src="'+traitDetailURL+'" alt="'+esc(traitReference.trait)+'形質の参考写真"><p><strong>この品種そのものの写真ではありません。</strong></p><p class="hint">'+esc(traitReference.photo.source)+' p.'+Number(traitReference.photo.page)+'。個人利用のみ・公開や再配布は不可。</p></section>';
}$('dk').value=x.kind;$('ds').value=x.status;let currentPhotos=[...photos];function paint(){detailUrls.forEach(URL.revokeObjectURL);detailUrls=[];$('photoGrid').innerHTML=currentPhotos.map((b,i)=>{let u=URL.createObjectURL(b);detailUrls.push(u);return `<div class="photoTile"><img src="${u}" alt="登録写真"><button data-rm="${i}" title="写真削除">×</button></div>`}).join('')}$('photos').onchange=async e=>{try{for(let f of e.target.files)currentPhotos.push(await optimize(f));paint()}catch(err){alert(err.message)}};$('photoGrid').onclick=e=>{let b=e.target.closest('[data-rm]');if(b){currentPhotos.splice(Number(b.dataset.rm),1);paint()}};$('closeDetail').onclick=()=>$('dialog').close();$('saveDetail').onclick=async()=>{let name=$('dn').value.trim();if(!name){alert('名前を入力してね');return}if(isNew&&entries.some(y=>y.name===name)){alert('同じ名前が登録されています');return}Object.assign(x,{name,reading:$('dyomi').value.trim(),aliases:$('da').value,traits:$('dt').value,kind:$('dk').value,description:$('dd').value,care:$('dc').value,status:$('ds').value,ever:$('de').checked||$('ds').value!=='none',wish:$('dw').checked,favorite:$('df').checked,note:$('dm').value,url:validUrl($('du').value),updated:Date.now()});try{await putPhotos(x.id,currentPhotos);if(isNew)entries.push(x);save();$('dialog').close();page=0;render()}catch(err){alert('保存に失敗しました: '+err.message)}};if(!isNew)$('deleteDetail').onclick=async()=>{if(!confirm('この品種と登録写真を削除しますか？'))return;await putPhotos(x.id,[]);entries=entries.filter(y=>y.id!==x.id);save();$('dialog').close();render()};$('dialog').onclose=()=>{detailUrls.forEach(URL.revokeObjectURL);detailUrls=[];if(traitDetailURL)URL.revokeObjectURL(traitDetailURL);if(sourceDetailURL)URL.revokeObjectURL(sourceDetailURL)};paint();$('dialog').showModal()}
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
async function handleFile(e){let files=[...e.target.files];if(!files.length)return;try{if(fileMode==='restore'){let d=JSON.parse(await files[0].text());if(!Array.isArray(d.entries))throw Error('対応するバックアップではありません');if(!confirm('現在のデータを置き換えます。事前にバックアップを保存しましたか？'))return;let fresh=d.entries.map(norm);for(let x of fresh){let p=d.photos?.[x.id],a=Array.isArray(p)?p:p?[p]:[];if(!a.length){let old=d.entries.find(z=>z.id===x.id)?.photo;if(old?.startsWith('data:'))a=[old]}await putPhotos(x.id,a.filter(s=>typeof s==='string'&&s.startsWith('data:')).map(toBlob))}entries=fresh;save();alert('復元しました')}else if(fileMode==='sourcepack'){await importAuthorizedPacks(files)}else if(fileMode==='traitpack'){await importTraitPack(files[0])}else if(fileMode==='csv'){let rows=csvRows((await files[0].text()).replace(/^\uFEFF/,'')),head=rows.shift()?.map(s=>s.trim().toLowerCase())||[],n=head.indexOf('name');if(n<0)throw Error('CSVの先頭行に name 列が必要です');let count=0,names=new Set(entries.map(x=>x.name.toLowerCase()));for(let r of rows){let name=(r[n]||'').trim();if(!name||names.has(name.toLowerCase()))continue;let item={name};for(let k of ['aliases','traits','kind','description','care','url']){let idx=head.indexOf(k);if(idx>=0)item[k]=r[idx]||''}entries.push(norm(item));names.add(name.toLowerCase());count++}save();alert(count+'件を追加しました')}else if(fileMode==='inbox'){await startPhotoInbox(files)}else if(fileMode==='single'){const id=singlePhotoId,x=entries.find(e=>e.id===id);if(!x)throw Error('写真を保存する品種が見つかりません');let p=await getPhotos(id);for(const f of files)p.push(await optimize(f));await putPhotos(id,p);x.updated=Date.now();save();alert(x.name+'に写真を'+files.length+'枚登録しました。')}page=0;render()}catch(err){alert('読み込み失敗: '+err.message)}finally{e.target.value=''}}

/* Display trait examples only if neither personal nor cultivar-specific photos exist. */
let traitCoverUrls=[];
const originalRender=render;
render=async function(){
  traitCoverUrls.forEach(URL.revokeObjectURL);traitCoverUrls=[];
  await originalRender();
  if(!traitNames.size)return;
  const cards=document.querySelectorAll('#grid article[data-id]'),cache=new Map();
  for(const article of cards){
    const cover=article.querySelector('[data-photo]');
    if(!cover||cover.querySelector('img'))continue;
    const x=entries.find(e=>e.id===article.dataset.id),trait=x&&identifyTrait(x);
    if(!trait)continue;
    if(!cache.has(trait)){
      const photo=await op('traitGallery','get',trait).catch(()=>null);
      const u=photo?.blob?URL.createObjectURL(photo.blob):null;
      if(u)traitCoverUrls.push(u);
      cache.set(trait,u);
    }
    const u=cache.get(trait);
    if(u)cover.innerHTML='<img class="cover" src="'+u+'" alt="'+esc(trait)+'という形質の参考写真"><span class="traitPhotoLabel">形質参考：'+esc(trait)+'<small>この品種の写真ではありません</small></span>';
  }
};

/* Final image priority: user's photos, then privately imported true variety
 * photographs, then Wikimedia pictures, then clearly labeled trait examples. */
let sourceCoverUrls=[];
const renderWithTraits=render;
render=async function(){
  for(const u of sourceCoverUrls)URL.revokeObjectURL(u);
  sourceCoverUrls=[];
  await renderWithTraits();
  if(!sourceNames.size)return;
  const byId=new Map(entries.map(x=>[x.id,x]));
  for(const card of document.querySelectorAll('#grid article[data-id]')){
    const x=byId.get(card.dataset.id);
    if(!x||!x.webNo||!sourceNames.has(x.webNo))continue;
    const own=await getPhotos(x.id).catch(()=>[]);
    if(own.length)continue;
    const p=await op('sourceGallery','get',x.webNo).catch(()=>null);
    if(!p?.blob)continue;
    const cover=card.querySelector('[data-photo]');
    if(!cover)continue;
    const u=URL.createObjectURL(p.blob);
    sourceCoverUrls.push(u);
    cover.innerHTML='<img class="cover" src="'+u+'" alt="'+esc(x.name)+'の実物写真"><span class="sourcePhotoLabel">'+esc(x.name)+'<small>個人保存の実物写真</small></span>';
  }
};
init();if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
