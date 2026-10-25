'use strict';
/* Explainable culture advice, 2026-10-25.
 * Offline deterministic decision support, NOT an AI vision test or a purity test.
 * Uses the last observation / actions and exact local YYYY-MM-DD dates.
 * No nutrient dosages or guaranteed harvest windows.
 */
(()=>{
const CHECK={moina:1,paramecium:1,euglena:2,psb:2,green:1};
const SOURCE={
 moina:'https://aquatorch.jp/food_moina/',
 paramecium:'https://nbrpcms.nig.ac.jp/paramecium/faq/',
 euglena:'https://www.carolina.com/algae/euglena-gracilis-living/152800.pr',
 psb:'https://www.hidegen.jp/p/00008/',
 green:'https://www.kyorin-net.co.jp/wave/wa11.html'
};
function add(date,days){if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return '';const [y,m,d]=date.split('-').map(Number);const z=new Date(Date.UTC(y,m-1,d));z.setUTCDate(z.getUTCDate()+days);return z.toISOString().slice(0,10)}
function daysBetween(a,b){if(!a||!b)return NaN;return Math.round((Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/86400000)}
function latest(observations){return (observations||[]).filter(x=>x&&x.date).slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.created||'').localeCompare(String(a.created||'')))[0]||null}
const LEGACY={'良好・増えている':'increasing','横ばい':'stable','減少・弱っている':'decreasing','水が濁っている':'cloudy','異臭・汚染疑い':'foul','培養を再開した':'restart'};
function assess(batch,logs,asOf){
 const today=/^\d{4}-\d{2}-\d{2}$/.test(asOf)?asOf:new Date().toISOString().slice(0,10);
 const type=batch?.type||'',label={moina:'タマミジンコ',paramecium:'ゾウリムシ',euglena:'ミドリムシ',psb:'PSB',green:'グリーンウォーター'}[type]||'培養';
 if(batch?.status!=='running')return {items:[],latest:null,method:'一時停止・終了',type};
 const valid=(logs||[]).filter(l=>l&&l.batchId===batch.id&&l.date&&l.date<=today);
 const sorted=valid.slice().sort((a,b)=>b.date.localeCompare(a.date)||String(b.created||'').localeCompare(String(a.created||'')));
 const last=sorted.find(l=>l.obs&&Object.values(l.obs).some(v=>v!==''&&v!=null)||LEGACY[l.condition])||null;
 const o=last?.obs||{},legacy=LEGACY[last?.condition]||'',age=last?daysBetween(last.date,today):NaN;
 const density=o.density||'';
 const second=sorted.find(l=>l!==last&&l.obs?.density&&l.obs.density!=='none'&&l.date<=last.date);
 const densityOrder={low:1,medium:2,high:3};
 const derivedTrend=!o.trend&&second&&densityOrder[density]&&densityOrder[second.obs.density]&&daysBetween(second.date,last.date)<=7?(densityOrder[density]>densityOrder[second.obs.density]?'increasing':densityOrder[density]<densityOrder[second.obs.density]?'decreasing':'stable'):'';
 const trend=o.trend||derivedTrend||legacy,water=o.water|| (legacy==='cloudy'?'cloudy':''),odor=o.odor||(legacy==='foul'?'foul':''),feed=o.feed||'';
 const temp=o.temp===''||o.temp==null?NaN:Number(o.temp);
 const pressure=o.pressure||'',light=o.light||'',mix=o.mixed||'';
 const recent=(action)=>sorted.find(l=>l.action===action)||null;
 let seq=0,items=[],isUrgent=false;
 const push=(level,action,title,reason,when=today,how='')=>{
   if(items.some(x=>x.action===action&&x.level===level))return;
   items.push({id:action+'-'+seq++,level,action,title,reason,when,how});
   if(level==='urgent')isUrgent=true;
 };
 // Unknown conditions MUST prompt observation, not make up biological growth.
 if(!last){
   push('today','check','まず培養の状態を記録','開始日だけでは給餌・植え継ぎの要否を判定できません。生存数や色・濁りを観察して入力してね。');
   return {items,latest:null,method:'初回記録待ち',type,source:SOURCE[type]};
 }
 // Observation is stale; do not issue nutrient manipulation from old readings.
 if(age>(CHECK[type]||1)){
   push('today','check','今日の状態を先に確認','最後の状態記録は'+age+'日前。古い情報で餌や水の量を判断するのは危険です。');
   return {items,latest:last,method:'最新観察が必要',type,source:SOURCE[type]};
 }
 const danger=odor==='foul'||water==='cloudy'||(type==='psb'&&['green','pale','cloudy','white'].includes(water))||(type==='psb'&&pressure==='swollen')||density==='none'||trend==='foul';
 if(danger){
   if(type==='psb'){
     push('urgent','isolate','今日：使用を控えて異常を確認',pressure==='swollen'?'容器の膨張を記録しています。密閉容器の取り扱いに注意し、製品説明を確認してね。':'異臭・白濁・緑色の変化や生菌不明を記録。PSBの品質が確認できるまで水槽投入を控えてね。');
   }else{
     push('urgent','isolate','今日：投入・追加給餌を控えて確認',odor==='foul'?'異臭が記録されています。汚染・劣化の可能性があるため、培養液をそのまま魚へ使わず状態を確認してね。':water==='cloudy'?'白濁・強い濁りの記録があります。腐敗の可能性や生存状況を調べ、餌の追加をいったん控えてね。':'生体が見当たらない記録です。顕微鏡等でも確認し、予備の種があれば別容器で立て直す準備を。');
   }
   push('today','check','今日：生存・臭い・色を再確認','異常が見えるときは日数による自動給餌・完成判断をしません。');
   return {items,latest:last,method:'異常時の安全優先',type,source:SOURCE[type]};
 }
 if(Number.isFinite(temp)&&temp>=32)push('today','temperature','今日：高温・直射日光を確認','記録水温が'+temp+'℃です。水温の急上昇や酸素不足に注意し、直射日光など環境を点検してね。');
 if(type==='moina'){
   if(trend==='decreasing'||density==='low'){
     push('today','check','今日：生きている個体と水質を確認','タマミジンコが減少／少数との記録。餌を増やす前に濁り・臭い・水温・予備容器を確認してね。');
     if(density==='low')push('soon','backup','今日：別容器への保険を検討','残存個体が少ない記録。元気な個体だけでも清潔な別容器に分けるか検討。');
   } else {
     if(feed==='low'||feed==='empty'){
       const fedAfter=sorted.some(l=>l.action==='feed'&&(l.date>last.date||(l.date===last.date&&String(l.created||'')>=String(last.created||''))));
       if(fedAfter)push('monitor','check','餌を追加した後の状態を確認','同じ観察以降に給餌が記録されています。追加で与える前に、餌の濃さを新しく観察してね。',add(today,1));
       else push('today','feed','今日：粉末クロレラなどの少量給餌を検討','餌の色が薄い／なくなったという記録。水が急に濃くならない少量から、使う製品の説明に従ってね。');
     }else if(feed==='high')push('today','wait','今日は餌の追加を控え様子を見る','餌の濃さがまだ高いという記録。過剰添加による水質悪化を防ごう。');
     if(density==='high'&&trend==='increasing')push('soon','split','今日〜明日：予備培養への分割を検討','生体が多く増加中。全滅リスクを減らすため、元気なうちに別容器への分割を検討。',add(today,1));
   }
 }else if(type==='paramecium'){
   if(trend==='decreasing'||density==='low'){
     push('today','check','今日：生存数・培養液を確認','ゾウリムシが減っている記録。雑菌混入や培地の消耗を確認してね。餌の増量を自動判断しません。');
   }else if(density==='high'&&['increasing','stable'].includes(trend)){
     push('soon','split','次の植え継ぎ容器を準備','よく増えている記録。培地が劣化する前に種を別容器へ分けることを検討。培地によって適切な間隔は変わります。',add(today,1));
   }
   if(water==='clear')push('soon','medium','培養液の栄養状態を点検','透明になったとの記録。培地の種類によっては栄養消耗のサインなので、選んだ培養法を確認してね。');
 }else if(type==='euglena'){
   if(trend==='decreasing'||density==='low'||water==='clear'||water==='pale'||light==='dim')push('today','environment','今日：光・温度・専用培地を点検','増殖が弱い／色が薄い記録。ユーグレナの種と培地の条件を確認し、栄養の自己流追加は避けよう。');
   else if(density==='high'&&trend==='increasing')push('soon','split','増殖を確認後、植え継ぎを検討','濃度が上がっている記録。清潔な別容器と指定培地を準備してね。',add(today,1));
 }else if(type==='psb'){
   if(light==='dim')push('today','light','今日：光の当たり方を確認','暗い場所と記録されています。使っているPSB製品の培養条件に合う光量か確認してね。');
   if(water==='red'||water==='brown'){
     push('soon','verify','次回：製品説明と成熟状態を照合','紅色・紅褐色の記録。ただし色だけでPSBの純度・完成・水槽使用可否は確定できません。',add(today,CHECK.psb));
   }else{
     push('soon','light','光・温度と培養液の表示を確認','色の記録が未成熟／不明です。種菌と専用培養液の製品条件を照合しよう。',add(today,CHECK.psb));
   }
 }else if(type==='green'){
   if(water==='dark')push('today','thin','今日：濃過ぎる緑水への対策を検討','非常に濃い緑水との記録。魚に使う場合は夜間の酸素不足を避けるため、薄め方や水量を確認してね。');
   else if(water==='clear'||water==='pale'||light==='dim')push('soon','light','日照・種水・色の変化を確認','緑色が薄い記録。ライト・水温や種水の状況を見直し、日数だけで完成を判断しないでね。');
   else if(water==='green')push('soon','check','緑水の濃さと臭いを維持確認','緑色を維持している記録。毎日濃さが急変しないか確認しよう。');
 }
 if(!items.some(x=>x.action==='check')){
   const next=add(last.date,CHECK[type]||1);
   push('monitor','check','次の状態確認','最後の観察'+last.date+'を基準に'+(CHECK[type]||1)+'日後の確認を提案。生体・色・濁り・臭いを新しく記録してね。',next<today?today:next);
 }
 // Redundant actions (e.g. another split done today) are not prescribed blindly.
 const already=recent('split');
 if(already&&items.some(x=>x.action==='split')&&daysBetween(already.date,today)<2)items=items.filter(x=>x.action!=='split');
 const rank={urgent:0,today:1,soon:2,monitor:3};
 items.sort((a,b)=>rank[a.level]-rank[b.level]||a.when.localeCompare(b.when));
 return {items,latest:last,method:'状態記録からの参考提案',type,source:SOURCE[type]};
}
window.medakaCultureAdvisor={assess,add,daysBetween};
})();