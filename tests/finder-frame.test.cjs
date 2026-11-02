'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../personal.js'),'utf8');
const geometry=source.slice(source.indexOf('function finderRegion()'),source.indexOf('function renderFinderPhoto()'));
const sampling=source.slice(source.indexOf('async function pickColorFromCanvas'),source.indexOf('function pinCandidate'));
let actualCrop,closed=0,bitmapSize={width:1600,height:900};
const box={style:{}},sliders={pcRegionWidth:{value:'85'},pcRegionHeight:{value:'55'}};
const img={naturalWidth:1600,naturalHeight:900,getBoundingClientRect:()=>({left:10,top:20,width:400,height:300}),parentElement:{getBoundingClientRect:()=>({left:10,top:20})}};
const px=new Uint8ClampedArray(90*64*4);for(let i=0;i<px.length;i+=4)px.set([220,110,30,255],i);
const ctx={focus:{x:.95,y:.05},document:{getElementById:id=>id==='pcImg'?img:id==='pcFocus'?box:sliders[id],createElement:()=>({getContext:()=>({drawImage:(...args)=>actualCrop=args.slice(1,5),getImageData:()=>({data:px})})})},createImageBitmap:async()=>({...bitmapSize,close:()=>closed++})};
vm.createContext(ctx);vm.runInContext(geometry+sampling+';this.api={finderCrop,positionFinderBox,pickColorFromCanvas};',ctx);
(async()=>{
 ctx.api.positionFinderBox();
 const displayed=[parseFloat(box.style.left)-parseFloat(box.style.width)/2,parseFloat(box.style.top)-parseFloat(box.style.height)/2-37.5,parseFloat(box.style.width),parseFloat(box.style.height)];
 await ctx.api.pickColorFromCanvas({},ctx.focus,{width:.85,height:.55});
 for(let i=0;i<4;i++)assert(Math.abs(displayed[i]*4-actualCrop[i])<1e-8,'overlay and canvas must select the same pixels');
 assert.equal(actualCrop[2],1360);assert(Math.abs(actualCrop[3]-495)<1e-8);
 for(const [w,h] of [[1600,900],[900,1600],[800,800]]){
  const full=ctx.api.finderCrop(w,h,{x:0,y:1},{width:1,height:1});
  assert.equal(full.sx,0);assert.equal(full.sy,0);assert.equal(full.sw,w);assert.equal(full.sh,h);
  const narrow=ctx.api.finderCrop(w,h,{x:1,y:0},{width:.95,height:.2});
  assert(narrow.sx>=0&&narrow.sy>=0&&narrow.sx+narrow.sw<=w&&narrow.sy+narrow.sh<=h);
 }
 assert.equal(closed,1);assert(source.includes('id="pcRegionWidth" type="range" min="4" max="100"'));assert(source.includes('id="pcRegionHeight" type="range" min="4" max="100"'));
 console.log('PASS: independent 100% width/height, full-image and edge selection, overlay/canvas alignment with letterboxing, bitmap cleanup');
})().catch(e=>{console.error(e);process.exitCode=1});
