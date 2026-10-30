'use strict';
/* Candidate retrieval only. Scores are metadata matches, never image identities. */
(function(root){
 const colorRules={黒:/黒|ブラック|オロチ|茶黒/,白:/白|プラチナ|シルバー/,青:/青|ブルー|マリン|サファイア|深海/,緑:/緑|グリーン|エメラルド/,黄:/黄|黄金|琥珀/,黄金:/黄金|金色|金ラメ|琥珀/,茶:/茶|琥珀|ブラウン|ブロンズ/,オレンジ:/オレンジ|朱赤|橙|楊貴妃|茶黒/,朱赤:/朱赤|赤|紅|楊貴妃|オレンジ/,ピンク:/ピンク|桃/,三色:/三色|３色|錦/};
 const traitRules={ヒレ長:/ヒレ長|鰭長|ひれ長|ロングフィン|ヒレロング/,ロングフィン:/ロングフィン|ヒレ長|鰭長|ヒレロング/,リアルロングフィン:/リアルロングフィン/,フサヒレ:/フサヒレ|房状|フサフサ/,ヒカリ:/ヒカリ体型|ヒカリメダカ|光体型|(?:^|[・、\s])ヒカリ(?:$|[・、\s])/,アースアイ:/アースアイ/};
 const fold=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[\u3041-\u3096]/g,c=>String.fromCharCode(c.charCodeAt(0)+96)).replace(/[\s・･‐－―—-]/g,'');
 function text(e){return [e.name,e.aliases,e.traits,e.profile,e.description,e.sourceOfficialName,e.sourceNickname].filter(Boolean).join(' ')}
 function traitMatch(e,t){let s=text(e);if(t==='透明鱗')s=s.replace(/半透明鱗/g,'');if(t==='体内光')s=s.replace(/全身体内光/g,'体内光');return traitRules[t]?traitRules[t].test(s):s.includes(t)}
 function nameMatch(e,q){return fold([e.name,e.aliases,e.reading,...(e.readings||[])].join(' ')).includes(fold(q))}
 function rank(list,colorEvidence,checks=[],query=''){
  const colors=(Array.isArray(colorEvidence)?colorEvidence:colorEvidence?[[colorEvidence,1]]:[]).filter(([c,w])=>colorRules[c]&&w>0);
  const max=Math.max(1,...colors.map(x=>x[1]));
  return list.filter(e=>!query||nameMatch(e,query)).map(e=>{
   const s=text(e),hits=[],matchedColors=[],matchedTraits=[];let score=0;
   for(const [c,w] of colors)if(colorRules[c].test(s)){score+=Math.min(1,w/max)*3;matchedColors.push(c)}
   if(matchedColors.length)hits.push('体色：'+matchedColors.join('・'));
   for(const t of new Set(checks))if(traitMatch(e,t)){score+=5;matchedTraits.push(t);hits.push(t)}
   return {e,score,hits,matchedColors,matchedTraits,unconfirmed:!e.traits||/照合中|要確認/.test(e.traits)};
  }).sort((a,b)=>b.score-a.score||a.e.name.localeCompare(b.e.name,'ja'));
 }
 const api={rank,traitMatch,nameMatch};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.medakaFinder=api;
})(typeof window!=='undefined'?window:globalThis);
