'use strict';
/* Five-culture companion: all user records and pictures stay in local IndexedDB.
 * Dates are the user's plans, NOT biological guarantees.
 * Visible due dates are checked when opening the app; no push notification.
 */
(()=>{
const el=document.getElementById('cultureDialog'),root=document.getElementById('cultureContent');
const TYPES={
 moina:{name:'タマミジンコ',icon:'🦐',check:1,tag:'生き餌',short:'生存数と餌の濃さを見て、増え方を記録',steps:[
'清潔な容器にカルキを抜いた淡水を用意し、元の水との急な温度差を避ける。',
'種のタマミジンコを水温を合わせながら移す。できれば予備容器にも分ける。',
'生クロレラや説明書に従った餌を少量から与える。粉末クロレラは溶かして少しずつ試し、濁り過ぎを避ける。',
'毎日、生存数・泳ぎ方・白濁・水の臭いを確認する。強いエアレーションや水流は避ける。',
'減少・水質悪化があれば、元気な個体を清潔な別容器へ退避して培養を立て直す。'
],watch:'毎日、生きて泳ぐ個体数・餌の残り方・水の濁りを確認。単純な「○日ごとに必ず給餌」は設定しない。',warning:'急に全滅、濃い白濁、腐敗臭がある場合は給餌を中断して別容器の予備も確認。',note:'粉末クロレラを使うなら、先に少量の水に分散してから。生クロレラの製品量を粉末にそのまま当てはめない。',sources:[['タマミジンコ休眠卵の取扱い（アイエスシー）','https://www.isc1960.co.jp/menu/moina_macrocopa_dormant_egg/'],['ミジンコ取扱説明（和香）','https://www.nagoyakashop.jp/?mode=f8']]},
 paramecium:{name:'ゾウリムシ',icon:'🔬',check:1,tag:'針子の生き餌',short:'培養液の状態を見て、必要に応じて植え継ぐ',steps:[
'清潔な培養容器と種ゾウリムシを用意する。培養液は選んだ方式の説明に従って作る。',
'乾燥わら・レタスジュース・市販培地など、ひとつの方法を選んで使い、混ぜ過ぎない。',
'直射日光や極端な温度を避け、通気・蓋はその培養方法に合わせる。',
'生存数と培養液の濁り・臭いを定期確認し、過度な栄養追加を避ける。',
'数が増えているうちに別容器へ種を分ける。減少してから慌てないよう予定を記録。'
],watch:'毎日の様子確認に加え、植え継ぎ日を容器ごとに予定登録。数が減ってからより、増えている間の分割が安心。',warning:'強い腐敗臭、異常な膜、全く動く個体が見えない場合は汚染を疑い、魚への投入を控えて確認。',note:'研究機関のわら・レタス培地と、市販のエビオス培養は別方式。投入量は選んだ方法に合わせて。',sources:[['慶應義塾大学 ゾウリムシ飼育法','https://www.sci.keio.ac.jp/gp2010/practice/biology/additional00008.html'],['東邦大学 ゾウリムシ簡易培養','https://www.mnc.toho-u.ac.jp/v-lab/Paramecium/index.html'],['NBRP ゾウリムシ FAQ','https://nbrpcms.nig.ac.jp/paramecium/faq/']]},
 euglena:{name:'ミドリムシ',icon:'🌱',check:2,tag:'ユーグレナ',short:'培地・光・温度を一定にして緑色と状態を記録',steps:[
'「ミドリムシ（ユーグレナ）」の種液かどうかを確認。単なる緑水やミドリゾウリムシとは別物。',
'清潔な容器に、その種液の指定培地または培養キットの培地を準備する。',
'種液を添加し、明るい屋内で直射日光と過熱を避けて管理する。',
'数日おきに色・濁り・沈殿・動き・気温を記録。緑色だけでミドリムシ純度は分からない。',
'培養条件を維持し、増殖を確認したら別の容器へ継代。製品ごとの手順を優先する。'
],watch:'2日ごとの確認を初期予定に設定。特別な培地が必要な株があり、使っている製品名も残してね。',warning:'培養が緑色でも別の藻類が混じる場合あり。種の同定や増殖確認には顕微鏡等が必要。',note:'土・エンドウ豆などを使う教材の培地は、そのままメダカの水槽へ投入する用途ではない。培地や採取方法を区別する。',sources:[['兵庫県教育資料 ミドリムシ','https://dmzcms.hyogo-c.ed.jp/kagakubukai/NC3/jjmanual/general/material/euglena'],['Carolina Euglena培養条件','https://www.carolina.com/algae/euglena-gracilis-living/152800.pr'],['Carolina プロトゾア培養ガイド','https://knowledge.carolina.com/discipline/life-science/protozoans/']]},
 psb:{name:'PSB（光合成細菌）',icon:'🧫',check:2,tag:'種菌・専用培養液',short:'種菌と培養液の製品を揃えて色・濁りを追跡',steps:[
'使うPSB製品名、種菌と専用培養液の銘柄を記録。添加率はメーカーごとに違うため一律に混ぜない。',
'清潔な容器を用意し、その製品の説明に従って種菌・水・培養液を入れる。',
'光と温度を保ちながら培養。ガスで容器が膨張する場合があるので容器状態も確認する。',
'2日ごとを目安に赤〜紅褐色への変化、異常な白・緑濁り、容器の膨張を外から観察。',
'製品指定の成熟目安に達したか確認。怪しい色や異常があれば魚水槽には投入しない。'
],watch:'培養の変化は一般に1〜2週間という製品例があるが、温度・種・方法により変わる。完了日は見た目と製品説明で確認。',warning:'PSBは製品・菌株で条件が違う。膨張した密閉容器や腐敗が疑われる液を不用意に扱わず、飲食に使用しない。',note:'PSBの種菌がない培養液だけではPSBを増やせない。水道水のカルキの扱いも製品ごとに異なるので製品説明を優先。',sources:[['PSB専門店 秀玄 FAQ','https://www.hidegen.jp/p/00008/'],['PSB専門店 秀玄 培養方法','https://www.hidegen.jp/p/00003/'],['和香 PSBマニュアル','https://www.nagoyakashop.jp/?mode=f12']]},
 green:{name:'グリーンウォーター',icon:'💚',check:1,tag:'植物プランクトン',short:'色の濃さ・光・水温を確認して薄緑を維持',steps:[
'魚の飼育水とは別に、光を通す清潔な容器を用意する。',
'カルキ抜きした水と安全な種水・植物プランクトンを用いる。種が無い場合は自然発生まで時間がかかる。',
'日差しやライトに当てつつ、容器が過熱しないよう管理。必要に応じて穏やかに混ぜる。',
'毎日、水の色・底の見え方・臭い・水温を確認する。濃すぎる場合は薄める。',
'薄い緑茶程度の見え方を目標に、稚魚用水槽への投入量は少しずつ調整する。'
],watch:'光・水温により3〜14日程度で緑になることがあるが、自然発生ではもっとかかることもある。日付より色の変化を優先。',warning:'魚や底が全く見えないほど濃い緑水は夜間の酸欠リスク。カビ臭さや不自然な青緑の塊がある場合は利用を控える。',note:'粉末クロレラを溶かした緑の水が、自然増殖したグリーンウォーターと同じとは限らない。顕微鏡等で確認できない場合は区別して記録する。',sources:[['キョーリン イージーグリーン','https://www.kyorin-net.co.jp/wave/wa11.html'],['小田原市 メダカ飼育Q&A','https://www.city.odawara.kanagawa.jp/field/envi/pet-wildlife/wildlife/p34504.html']]}
};
const ACTIONS=[['check','状態確認'],['feed','餌・添加'],['split','分割・植え継ぎ'],['water','換水・交換'],['harvest','採取・使用'],['restart','培養開始・再開']];
const FIELDS=[['check','状態確認'],['feed','餌・添加'],['split','分割・植え継ぎ'],['water','換水・交換']];
let database,view='dashboard',urls=[];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&#39;'}[c]));
const today=()=>{const t=new Date();return [t.getFullYear(),String(t.getMonth()+1).padStart(2,'0'),String(t.getDate()).padStart(2,'0')].join('-')};
const dateAdd=(str,n)=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(str)||!Number.isFinite(n))return '';const [y,m,d]=str.split('-').map(Number);const t=new Date(Date.UTC(y,m-1,d));t.setUTCDate(t.getUTCDate()+n);return t.toISOString().slice(0,10)};
const dateOK=s=>/^\d{4}-\d{2}-\d{2}$/.test(s||'')?s:'';
const id=()=> 'c-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9);
function closeUrls(){for(const u of urls)URL.revokeObjectURL(u);urls=[]}
function photo(blob){if(!(blob instanceof Blob))return '';const u=URL.createObjectURL(blob);urls.push(u);return '<img src="'+u+'" alt="培養の記録写真" class="culturePic">'}
const ui=s=>{closeUrls();root.innerHTML=s;dlg.scrollTop=0};
const dlg=document.getElementById('cultureDialog');
async function open(){if(!database)database=await openDB();if(!dlg.open)dlg.showModal();return dashboard()}
function base(title,back='dashboard'){return '<div class="cultureBar"><button id="cultureBack">← 戻る</button><strong>'+esc(title)+'</strong><button id="cultureClose">閉じる</button></div>'}
function nav(back){root.querySelector('#cultureBack').onclick=back||dashboard;root.querySelector('#cultureClose').onclick=()=>dlg.close()}
function request(store,action,key,value){return new Promise((ok,no)=>{const tx=database.transaction(store,action==='get'||action==='all'?'readonly':'readwrite'),s=tx.objectStore(store);let r=action==='get'?s.get(key):action==='set'?s.put(value,key):action==='del'?s.delete(key):s.getAll();r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})}
const all=s=>request(s,'all'),get=(s,k)=>request(s,'get',k),set=(s,k,v)=>request(s,'set',k,v),del=(s,k)=>request(s,'del',k);
function dueTasks(batch){if(batch.status!=='running')return [];const tasks=[];for(const [key,name] of FIELDS){let date=batch.next?.[key];if(!date)continue;tasks.push({key,name,date,overdue:date<today(),now:date<=today()})}return tasks.sort((a,b)=>a.date.localeCompare(b.date))}
function dueLabel(d){return d<today()?'期限超過':d===today()?'今日':'予定'}

const OBS={
 trend:[['','未確認'],['increasing','増えている'],['stable','変わらない'],['decreasing','減っている'],['unknown','判断できない']],
 density:[['','未確認'],['high','多い'],['medium','普通'],['low','少ない'],['none','見当たらない']],
 water:[['','未確認'],['clear','透明に近い'],['pale','薄い色'],['green','緑色'],['dark','濃い緑色'],['red','赤・紅色'],['brown','紅褐色'],['cloudy','白濁・異常な濁り']],
 odor:[['','未確認'],['normal','気になる異臭なし'],['foul','腐敗臭・異臭あり']],
 feed:[['','未確認'],['low','餌の色が薄い'],['empty','餌がほぼない'],['normal','適度な濃さ'],['high','餌の色が濃い・残っている']],
 pressure:[['','未確認'],['normal','膨張なし'],['swollen','容器が膨張している']],
 light:[['','未確認'],['bright','明るい'],['dim','暗い'],['direct','直射日光あり']]
};
const obsOption=(name,label,group)=>'<label>'+label+'<select id="co'+name+'">'+OBS[group].map(([val,text])=>'<option value="'+val+'">'+text+'</option>').join('')+'</select></label>';
const labelObs=(field,val)=>OBS[field]?.find(pair=>pair[0]===val)?.[1]||'';
function advisor(batch,logs){if(!window.medakaCultureAdvisor)return {items:[],latest:null,method:'分析処理を読み込めません'};return window.medakaCultureAdvisor.assess(batch,logs,today())}
function adviceCards(report,batch,compact=false){
 const cards=report.items.slice(0,compact?3:7);
 if(!cards.length)return '<p class="cultureEmpty">現在は提案なし。停止中・終了した容器は自動提案しません。</p>';
 return cards.map(item=>'<div class="cultureAdvice cultureAdvice-'+item.level+'"><div><small>'+esc(item.when===today()?'今日':item.when)+' · '+(item.level==='urgent'?'要注意':item.level==='monitor'?'観察予定':'おすすめ')+'</small><b>'+esc(item.title)+'</b><p>'+esc(item.reason)+'</p></div><button data-advice-batch="'+esc(batch.id)+'" data-advice-action="'+esc(item.action)+'">記録</button></div>').join('')
}
function bindAdvice(node){node.querySelectorAll('[data-advice-batch]').forEach(b=>b.onclick=()=>writeLog(b.dataset.adviceBatch,['feed','split','water','check'].includes(b.dataset.adviceAction)?b.dataset.adviceAction:'check'))}

async function dashboard(){
 view='dashboard';const batches=(await all('cultureBatches')).sort((a,b)=>String(b.updated||b.started||'').localeCompare(String(a.updated||a.started||''))),active=batches.filter(x=>x.status==='running'),due=active.flatMap(b=>dueTasks(b).filter(t=>t.now).map(t=>({...t,b}))).sort((a,b)=>a.date.localeCompare(b.date));
 const logs=await all('cultureLogs'),reports=new Map(active.map(b=>[b.id,advisor(b,logs.filter(l=>l.batchId===b.id))]));const suggestions=active.flatMap(b=>(reports.get(b.id)?.items||[]).slice(0,2).map(item=>({b,item})));const rank={urgent:0,today:1,soon:2,monitor:3};suggestions.sort((x,y)=>rank[x.item.level]-rank[y.item.level]||x.item.when.localeCompare(y.item.when));const advised=suggestions.filter(x=>x.item.level==='urgent'||x.item.level==='today'||x.item.when<=today()).length;
 ui(base('培養の管理')+'<div class="cultureHero"><h2>🧫 培養ノート</h2><p>培養中のもの、次にする作業、作り方をまとめて管理。</p><div><span>培養中 <b>'+active.length+'</b></span><span>今日までに確認 <b>'+due.length+'</b>件</span><span>記録済み <b>'+batches.length+'</b>容器</span></div></div><h3>💡 記録から考えた次のおすすめ</h3><div id="cultureRecommendations"></div><h3>📅 自分で設定した予定</h3><div id="cultureDue"></div><button class="primary cultureFull" id="cultureNew">＋ 新しい培養容器を登録</button><h3>🧪 培養の種類を選んで手順を見る</h3><div class="cultureKinds">'+Object.entries(TYPES).map(([k,v])=>'<button class="cultureKind" data-guide="'+k+'"><span>'+v.icon+'</span><b>'+v.name+'</b><small>'+v.short+'</small></button>').join('')+'</div><h3>🗂️ 培養中・過去の容器</h3><div id="cultureList"></div><p class="hint">この画面を開いたときに予定日を確認します。iPhoneへのプッシュ通知はありません。餌・培養液の量は使う製品の説明に従ってください。</p>');
 updateDueBadge(active,advised);nav(()=>dlg.close());const recommendationArea=root.querySelector('#cultureRecommendations');recommendationArea.innerHTML=suggestions.length?suggestions.slice(0,12).map(x=>'<div class="cultureAdviceGroup"><small>🧪 '+esc(x.b.name)+'</small>'+adviceCards({items:[x.item]},x.b,true)+'</div>').join(''):'<p class="cultureEmpty">記録を追加すると、培養ごとの次の作業と理由をここに表示するよ。</p>';bindAdvice(recommendationArea);root.querySelector('#cultureNew').onclick=()=>editBatch();root.querySelectorAll('[data-guide]').forEach(b=>b.onclick=()=>guide(b.dataset.guide));
 const dueArea=root.querySelector('#cultureDue');dueArea.innerHTML=due.length?due.map(t=>'<div class="cultureDue"><div><b>'+esc(t.b.name||TYPES[t.b.type].name)+'</b><small>'+esc(t.name)+' · '+esc(t.date)+' · '+dueLabel(t.date)+'</small></div><button data-log-batch="'+esc(t.b.id)+'" data-log-type="'+t.key+'">記録する</button></div>').join(''):'<p class="cultureEmpty">今日までに予定された作業はないよ。培養の様子は毎日でも確認してね。</p>';
 dueArea.querySelectorAll('[data-log-batch]').forEach(b=>b.onclick=()=>writeLog(b.dataset.logBatch,b.dataset.logType));
 const area=root.querySelector('#cultureList');if(!batches.length)area.innerHTML='<p class="cultureEmpty">まだ培養容器は登録されていないよ。タマミジンコから1つずつ追加してみてね。</p>';
 for(const b of batches){const t=TYPES[b.type],tasks=dueTasks(b),closest=tasks[0],div=document.createElement('div');div.className='cultureBatch';div.innerHTML='<div><span class="cultureEmoji">'+(t?.icon||'🧪')+'</span><div><b>'+esc(b.name||t?.name||'培養')+'</b><small>'+esc(t?.name||'')+(b.volume?' · '+esc(b.volume):'')+(b.location?' · '+esc(b.location):'')+'</small><small>'+(b.status==='running'?'培養中':b.status==='paused'?'一時停止':'終了')+' · '+(closest?'次回 '+esc(closest.date)+' '+esc(closest.name):'予定日未設定')+'</small></div></div><button data-batch="'+esc(b.id)+'">開く</button>';area.appendChild(div)}
 area.querySelectorAll('[data-batch]').forEach(b=>b.onclick=()=>detail(b.dataset.batch));
}
function guide(type,back=dashboard){
 const t=TYPES[type];if(!t)return dashboard();
 ui(base(t.name)+'<div class="cultureGuide"><div class="cultureGuideHead"><span>'+t.icon+'</span><div><h2>'+t.name+'</h2><p>'+t.short+'</p></div></div><h3>準備・管理手順</h3><ol>'+t.steps.map(step=>'<li>'+esc(step)+'</li>').join('')+'</ol><h3>⏰ タイミングの考え方</h3><p>'+esc(t.watch)+'</p><h3>🟠 注意したい変化</h3><p>'+esc(t.warning)+'</p><h3>💡 補足</h3><p>'+esc(t.note)+'</p><details><summary>確認した資料・出典</summary><div class="cultureSources">'+t.sources.map(([name,url])=>'<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(name)+' ↗</a>').join('')+'</div></details><p class="hint">培養キットの説明書がある場合はその手順を優先。色だけで培養の純度や安全性は断定できません。</p></div><button class="primary cultureFull" id="cultureGuideAdd">この種類の培養を登録</button>');
 nav(back);root.querySelector('#cultureGuideAdd').onclick=()=>editBatch(null,type);
}
function defaults(type,start){return {interval:{check:0,feed:0,split:0,water:0},next:{check:'',feed:'',split:'',water:''}}}
async function editBatch(batchId=null,choice='moina'){
 const prev=batchId?await get('cultureBatches',batchId):null,type=prev?.type||choice,init=defaults(type,today());
 ui(base(prev?'培養容器を編集':'培養容器を登録')+'<h2>🧫 培養容器の設定</h2><p class="hint">開始日と種類だけでも登録OK。状態を記録すると次に必要な観察・給餌・分割の候補を提案するよ。</p><label>培養する種類</label><select id="cbType">'+Object.entries(TYPES).map(([k,v])=>'<option value="'+k+'">'+v.name+'</option>').join('')+'</select><label>容器の名前</label><input id="cbName" placeholder="例：タマミジンコA／ゾウリムシ予備" value="'+esc(prev?.name||'')+'"><div class="culture2"><div><label>開始日</label><input type="date" id="cbStarted" value="'+esc(prev?.started||today())+'"></div><div><label>状態</label><select id="cbStatus"><option value="running">培養中</option><option value="paused">一時停止</option><option value="finished">終了</option></select></div></div><div class="culture2"><div><label>水量・容器</label><input id="cbVolume" value="'+esc(prev?.volume||'')+'" placeholder="例：500mlペットボトル"></div><div><label>置き場所</label><input id="cbLocation" value="'+esc(prev?.location||'')+'" placeholder="例：窓際・室内"></div></div><label>餌・培養液・種菌の製品名</label><input id="cbMedium" value="'+esc(prev?.medium||'')+'" placeholder="例：粉末クロレラ／専用PSB培養液"><label>培養方法・注意したいこと</label><textarea id="cbMemo" placeholder="例：粉末クロレラを少量ずつ／予備容器あり">'+esc(prev?.memo||'')+'</textarea><details class="cultureManualSchedule"><summary>📅 手動で予定を設定したい場合（任意）</summary><h3>手動の次回日</h3><p class="hint">「次回日」と「終わった後に何日後を予定するか」を設定できます。頻度は個人設定です。0日は単発予定として、作業完了後に予定欄を空にします。</p><div class="cultureSchedule">'+FIELDS.map(([k,n])=>'<div><b>'+n+'</b><label>次回日<input type="date" data-next="'+k+'" value="'+esc(prev?(prev.next?.[k]||''):init.next[k])+'"></label><label>完了後の間隔（日）<input type="number" min="0" max="365" data-interval="'+k+'" value="'+esc(prev?.interval?.[k]??init.interval[k])+'"></label></div>').join('')+'</div></details><button class="primary cultureFull" id="cbSave">保存する</button>'+(prev?'<button id="cbDelete" class="cultureFull">この培養記録を削除</button>':''));
 nav(()=>prev?detail(prev.id):dashboard());root.querySelector('#cbType').value=type;root.querySelector('#cbStatus').value=prev?.status||'running';
 
 
 root.querySelector('#cbSave').onclick=async()=>{const kind=root.querySelector('#cbType').value;const next={},interval={};for(const [k] of FIELDS){next[k]=dateOK(root.querySelector('[data-next="'+k+'"]').value);interval[k]=Math.min(365,Math.max(0,Math.round(Number(root.querySelector('[data-interval="'+k+'"]').value)||0)))}const b={id:prev?.id||id(),type:kind,name:root.querySelector('#cbName').value.trim()||TYPES[kind].name,started:dateOK(root.querySelector('#cbStarted').value)||today(),status:root.querySelector('#cbStatus').value,volume:root.querySelector('#cbVolume').value.trim(),location:root.querySelector('#cbLocation').value.trim(),medium:root.querySelector('#cbMedium').value.trim(),memo:root.querySelector('#cbMemo').value.trim(),next,interval,updated:new Date().toISOString()};try{await set('cultureBatches',b.id,b);await detail(b.id)}catch(e){alert('保存できません：'+e.message)}};
 if(prev)root.querySelector('#cbDelete').onclick=async()=>{if(!confirm('この容器の記録と写真・実施履歴も削除しますか？'))return;const logs=(await all('cultureLogs')).filter(x=>x.batchId===prev.id);for(const l of logs)await del('cultureLogs',l.id);await del('culturePhotos',prev.id);await del('cultureBatches',prev.id);dashboard()};
}
async function detail(batchId){
 const b=await get('cultureBatches',batchId);if(!b)return dashboard();
 const t=TYPES[b.type],logs=(await all('cultureLogs')).filter(x=>x.batchId===batchId).sort((a,c)=>String(c.date).localeCompare(String(a.date))||String(c.created).localeCompare(String(a.created))),pics=await get('culturePhotos',batchId)||[];
 const report=advisor(b,logs);updateDueBadge();
 ui(base(b.name)+'<div class="cultureDetailHead"><h2>'+t.icon+' '+esc(b.name)+'</h2><p>'+esc(t.name)+' · '+(b.status==='running'?'培養中':b.status==='paused'?'一時停止':'終了')+'</p><small>開始：'+esc(b.started||'不明')+(b.volume?' · '+esc(b.volume):'')+(b.location?' · '+esc(b.location):'')+'</small></div><div class="cultureActions"><button id="cdEdit">⚙️ 容器設定</button><button id="cdGuide">📖 培養手順</button><button class="primary" id="cdLog">＋ 作業を記録</button></div><div class="cultureNotes">'+(b.medium?'<p><b>餌・製品：</b>'+esc(b.medium)+'</p>':'')+(b.memo?'<p><b>メモ：</b>'+esc(b.memo)+'</p>':'')+'</div><h3>💡 最新の記録からおすすめ</h3><div class="cultureAdvisorInfo">記録した状態と最後の作業から提案します。<strong>自動給餌や自動培養ではありません。</strong> 条件不明なら観察を優先します。</div><div id="cdAdvice">'+adviceCards(report,b)+(report.comparison?'<p class="hint">📈 '+esc(report.comparison)+'</p>':'')+(report.source?'<a class="cultureAdviceSource" href="'+esc(report.source)+'" target="_blank" rel="noopener noreferrer">判断の参考にした培養資料を見る ↗</a>':'')+'</div><details class="cultureManualSchedule"><summary>📅 以前の予定・手動設定（参考）</summary><p class="hint">記録に基づくおすすめと異なる場合は、最新の観察を優先して考えてね。</p><div id="cdTasks">'+(dueTasks(b).length?dueTasks(b).map(x=>'<div class="cultureDue"><div><b>'+esc(x.name)+'</b><small>'+esc(x.date)+' · '+(x.now?dueLabel(x.date):'予定')+'</small></div><button data-action="'+x.key+'">記録する</button></div>').join(''):'<p class="cultureEmpty">予定日なし。容器設定から次回日を登録できるよ。</p>')+'</div></details><h3>📷 培養の写真</h3><input type="file" id="cdPhotoInput" accept="image/*" multiple><div class="culturePics">'+pics.map((p,i)=>'<div>'+photo(p)+'<button type="button" data-remove-photo="'+i+'">削除</button></div>').join('')+'</div><p class="hint">写真は容器につき最大10枚。iPhone内のみ保存。</p><h3>📝 作業・観察の履歴</h3><div class="cultureTimeline">'+(logs.length?logs.map(l=>'<section><span>'+esc(l.date)+'</span><b>'+esc(ACTIONS.find(x=>x[0]===l.action)?.[1]||l.action)+'</b>'+(l.condition?'<small>状態：'+esc(l.condition)+'</small>':'')+(l.obs?'<small>観察：'+esc([labelObs('trend',l.obs.trend),labelObs('density',l.obs.density),(l.obs.count!==''&&l.obs.count!=null?'生体約'+l.obs.count+'匹':''),labelObs('water',l.obs.water),labelObs('odor',l.obs.odor),labelObs('feed',l.obs.feed)].filter(Boolean).join(' / '))+'</small>':'')+(l.note?'<p>'+esc(l.note)+'</p>':'')+'<button type="button" data-delete-log="'+esc(l.id)+'">記録を削除</button></section>').join(''):'<p class="cultureEmpty">まだ実施履歴はありません。</p>')+'</div>');
 nav(dashboard);bindAdvice(root.querySelector('#cdAdvice'));root.querySelector('#cdEdit').onclick=()=>editBatch(batchId);root.querySelector('#cdGuide').onclick=()=>guide(b.type,()=>detail(batchId));root.querySelector('#cdLog').onclick=()=>writeLog(batchId,'check');
 root.querySelectorAll('[data-action]').forEach(x=>x.onclick=()=>writeLog(batchId,x.dataset.action));
 root.querySelectorAll('[data-delete-log]').forEach(x=>x.onclick=async()=>{if(!confirm('この作業履歴を削除しますか？　予定日は戻りません。'))return;await del('cultureLogs',x.dataset.deleteLog);detail(batchId)});
 root.querySelector('#cdPhotoInput').onchange=async e=>{try{const input=[...e.target.files];const old=await get('culturePhotos',batchId)||[];if(input.length+old.length>10){alert('写真は最大10枚までです');return}for(const f of input)old.push(await optimize(f));await set('culturePhotos',batchId,old);detail(batchId)}catch(err){alert('写真保存失敗：'+err.message)}};
 root.querySelectorAll('[data-remove-photo]').forEach(x=>x.onclick=async()=>{if(!confirm('この写真を削除しますか？'))return;const old=await get('culturePhotos',batchId)||[];old.splice(Number(x.dataset.removePhoto),1);await set('culturePhotos',batchId,old);detail(batchId)});
}
async function writeLog(batchId,action='check'){
 const b=await get('cultureBatches',batchId);if(!b)return dashboard();
 const options=ACTIONS.map(([k,n])=>'<option value="'+k+'">'+n+'</option>').join('');
 ui(base('培養の記録')+'<h2>📝 '+esc(b.name)+'</h2><label>行った作業</label><select id="clAction">'+options+'</select><label>実施日</label><input type="date" id="clDate" value="'+today()+'"><label>全体の様子（かんたん入力）</label><select id="clCondition"><option value="">未選択</option><option>良好・増えている</option><option>横ばい</option><option>減少・弱っている</option><option>水が濁っている</option><option>異臭・汚染疑い</option><option>培養を再開した</option></select><h3>🔬 今日の状態を教えて（おすすめの判断材料）</h3><p class="hint">分かる項目だけで大丈夫。品種ごとに適切な次の行動を提案するため、状態を具体的に選んでね。</p><div class="cultureObservations">'+obsOption('Trend','数の増減','trend')+obsOption('Density','生体の多さ','density')+(['moina','paramecium'].includes(b.type)?'<label>およその生体数（任意）<input type="number" id="coCount" min="0" max="1000000" step="1" placeholder="例：20"></label>':'')+obsOption('Water','水・培養液の色','water')+obsOption('Odor','臭い','odor')+obsOption('Feed','餌・培地の残り','feed')+(b.type==='psb'?obsOption('Pressure','容器の膨張','pressure'):'')+obsOption('Light','光の当たり方','light')+'<label>水温（℃／任意）<input id="coTemp" type="number" min="0" max="42" step="0.5" placeholder="例：24"></label></div><label>具体的に何をした？　量・餌・水など</label><textarea id="clNote" placeholder="例：粉末クロレラを少量添加。生きている個体は約○匹。"></textarea><p class="hint">記録を保存すると最新の観察をもとに次のおすすめが表示されます。手動予定を設定した場合はそちらも更新します。</p><button class="primary cultureFull" id="clSave">保存して次のおすすめを見る</button>');
 nav(()=>detail(batchId));root.querySelector('#clAction').value=action;
 root.querySelector('#clSave').onclick=async()=>{const act=root.querySelector('#clAction').value,date=dateOK(root.querySelector('#clDate').value)||today(),condition=root.querySelector('#clCondition').value,note=root.querySelector('#clNote').value.trim();if(date>today()){alert('未来の日付を実施日として保存することはできません');return}
 const pick=key=>root.querySelector('#co'+key)?.value||'';
 const tempRaw=pick('Temp');
 if(tempRaw!==''&&(!Number.isFinite(Number(tempRaw))||Number(tempRaw)<0||Number(tempRaw)>42)){alert('水温は0〜42℃の範囲で入力してね');return}
 const countRaw=pick('Count');if(countRaw!==''&&(!Number.isSafeInteger(Number(countRaw))||Number(countRaw)<0||Number(countRaw)>1000000)){alert('生体数は0〜100万匹の整数で入力してね');return}
 const obs={trend:pick('Trend'),density:pick('Density'),water:pick('Water'),odor:pick('Odor'),feed:pick('Feed'),pressure:pick('Pressure'),light:pick('Light'),temp:tempRaw,count:countRaw};
 const record={id:id(),batchId,date,action:act,condition,note,obs,created:new Date().toISOString()};try{await set('cultureLogs',record.id,record);if(FIELDS.some(([key])=>key===act)){const days=Number(b.interval?.[act])||0;b.next={...b.next,[act]:days>0?dateAdd(date,days):''};b.updated=new Date().toISOString();await set('cultureBatches',b.id,b)}await detail(batchId)}catch(err){alert('記録できません：'+err.message)}};
}
async function updateDueBadge(active=null,dueCount=null){
 try{
   const button=document.getElementById('cultureOpen');if(!button)return;
   if(active===null){if(!database)database=await openDB();active=(await all('cultureBatches')).filter(x=>x.status==='running')}
   const logs=dueCount===null?await all('cultureLogs'):null;const count=dueCount===null?active.reduce((n,b)=>n+advisor(b,logs.filter(l=>l.batchId===b.id)).items.filter(x=>x.level==='urgent'||x.level==='today'||x.when<=today()).length,0):dueCount;
   button.textContent=count?'🧫 培養ノート・要確認 '+count+'件':'🧫 培養ノート・次回予定';
   button.setAttribute('aria-label',count?'培養ノート。今日までに確認する作業'+count+'件':'培養ノートを開く');
 }catch(err){console.warn('培養予定を表示できません',err)}
}
window.medakaCulture={open,types:TYPES};
const button=document.getElementById('cultureOpen');if(button)button.onclick=()=>open().catch(err=>alert('培養ノートを開けません：'+err.message));
dlg.addEventListener('close',closeUrls);
updateDueBadge();
})();