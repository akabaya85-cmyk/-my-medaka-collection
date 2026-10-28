'use strict';
/* Exact-match source photo display.
 * No copyrighted image bytes are shipped through GitHub Pages.
 * Never substitute a different variety, a trait example, or an ambiguous duplicate.
 * Private user photos and logs remain in the existing IndexedDB stores.
 */
(function () {
  let index = {photos:{},yakata:{}};
  let loadPromise = null;
  let renderGeneration = 0;

  function isAllowedImage(value, origin) {
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:') return false;
      return origin === 'yakata'
        ? /^img[0-9]+\.shop-pro\.jp$/i.test(url.hostname)
        : /^(www\.)?medakazukan\.net$/i.test(url.hostname);
    } catch (_) { return false; }
  }
  function isAllowedSupplementalImage(value) {
    try {
      const u=new URL(value);
      return u.protocol==='https:' && ['ibuki472.com','oitamedakabiyori.com'].includes(u.hostname);
    }catch{return false}
  }
  function isAllowedSupplementalSource(value) {
    try {
      const u=new URL(value);
      return u.protocol==='https:' && ['ibuki472.com','oitamedakabiyori.com'].includes(u.hostname);
    }catch{return false}
  }
  function isAllowedSource(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' &&
        (/^(www\.)?medakazukan\.net$/i.test(url.hostname) ||
         /^(www\.)?medakanoyakata\.jp$/i.test(url.hostname));
    } catch (_) { return false; }
  }
  async function loadIndex() {
    if (!loadPromise) {
      loadPromise = (async function () {
        const response = await fetch('./photo-index.json', {cache:'no-store'});
        if (!response.ok) throw new Error('photo-index.json HTTP ' + response.status);
        const file = await response.json();
        if (file.format !== 'my-medaka-source-photo-index-v1' ||
            !file.photos || !file.yakata) throw new Error('写真索引の形式が違います');
        index = file;
        return file;
      })().catch(error => {
        console.warn('写真索引を読み込めませんでした', error);
        loadPromise = null;
        return null;
      });
    }
    return loadPromise;
  }
  function sourceCandidates(entry) {
    if (!entry) return [];
    const found=[];
    const fromYakata=index.yakata?.[entry.name];
    if(fromYakata && isAllowedImage(fromYakata.imageUrl,'yakata') &&
       isAllowedSource(fromYakata.sourceUrl)) {
      found.push({imageUrl:fromYakata.imageUrl,sourceUrl:fromYakata.sourceUrl,
                  source:'めだかの館',ambiguous:false});
    }
    const external=index.external?.[entry.name];
    if(external && external.name===entry.name &&
       isAllowedSupplementalImage(external.imageUrl) &&
       isAllowedSupplementalSource(external.sourceUrl)) {
      found.push({imageUrl:external.imageUrl,sourceUrl:external.sourceUrl,
                  source:external.source||'専門店の品種写真',ambiguous:false});
    }
    const linkedNo=entry.webNo||entry.sourceArticleNo;
    const web=linkedNo && index.photos?.[String(linkedNo).padStart(4,'0')];
    if(web && isAllowedImage(web.imageUrl,'web') && isAllowedSource(web.sourceUrl)) {
      found.push({imageUrl:web.imageUrl,sourceUrl:web.sourceUrl,
                  source:'改良メダカWEB図鑑',ambiguous:!!web.ambiguous});
    }
    return [...new Map(found.map(p=>[p.imageUrl,p])).values()];
  }
  function sourceInfo(entry) {
    return sourceCandidates(entry).find(p=>!p.ambiguous) ||
      sourceCandidates(entry).find(p=>p.ambiguous) || null;
  }
  function getStatus(entry) {
    const photos=sourceCandidates(entry);
    if(photos.some(p=>!p.ambiguous))return 'available';
    if(photos.some(p=>p.ambiguous))return 'review';
    return 'missing';
  }
  window.medakaPhotoSources={getStatus,sourceCandidates};
  const statusFilter=document.getElementById('photoFilter');
  if(statusFilter)statusFilter.addEventListener('change',()=>{
    page=0;
    render().catch(err=>console.warn('写真フィルターを更新できません',err));
  });
  function clearMisleadingTrait(cover, awaitingVerification) {
    cover.innerHTML = '<div class="photoPlaceholder">📷<small>' +
      (awaitingVerification ? '品種写真の照合待ち' : 'この品種の写真は未登録') +
      '</small></div>';
  }
  function showSourcePhoto(cover, entry, photo, tried=[]) {
    const img = document.createElement('img');
    img.className = 'cover';
    img.alt = entry.name + '：' + photo.source + 'に掲載されている写真';
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    const label = document.createElement('span');
    label.className = 'sourcePhotoLabel';
    label.append(document.createTextNode(entry.name));
    const sub = document.createElement('small');
    sub.textContent = photo.source + 'の実物写真（外部表示）';
    label.append(sub);
    const sourceLink=document.createElement('a');
    sourceLink.href=photo.sourceUrl;
    sourceLink.target='_blank';
    sourceLink.rel='noopener noreferrer';
    sourceLink.className='sourcePhotoOrigin';
    sourceLink.textContent='出典を見る';
    label.append(sourceLink);
    cover.replaceChildren(img, label);
    let attemptedAlternateReferrer=false;
    img.onerror = () => {
      if (!cover.contains(img)) return;
      if (!attemptedAlternateReferrer) {
        // Some image CDNs reject a no-referrer request but accept the
        // browser's default strict-origin referrer behavior.
        attemptedAlternateReferrer=true;
        img.removeAttribute('referrerpolicy');
        img.src = photo.imageUrl + (photo.imageUrl.includes('?')?'&':'?') + 'retry_ref=1';
        return;
      }
      const fallback=sourceCandidates(entry).find(candidate=>
        !candidate.ambiguous && candidate.imageUrl!==photo.imageUrl &&
        !tried.includes(candidate.imageUrl));
      if(fallback){
        showSourcePhoto(cover,entry,fallback,[...tried,photo.imageUrl]);
        return;
      }
      cover.innerHTML='<div class="photoPlaceholder">📷<small>外部写真を読み込めませんでした</small></div>';
      const note = document.createElement('a');
      note.className = 'sourceLink';
      note.href = photo.sourceUrl;
      note.target = '_blank';
      note.rel = 'noopener noreferrer';
      note.textContent = '出典サイトの写真を開く ↗';
      cover.append(note);
    };
    img.src = photo.imageUrl;
  }
  function updatePhotoCount() {
    const counts={available:0,review:0,missing:0};
    for(const entry of entries)counts[getStatus(entry)]++;
    const stats=document.getElementById('stats');
    if(!stats)return;
    for(const span of stats.querySelectorAll('span')){
      if(span.textContent.startsWith('実物写真 ')){
        span.textContent='出典写真の参照先 '+counts.available+'件';
      }
      if(span.textContent.startsWith('分類・情報は随時照合中')){
        span.textContent='写真未登録 '+counts.missing+'件 / 照合待ち '+counts.review+'件';
      }
    }
  }
  async function paintCards(generation) {
    await loadIndex();
    if (generation !== renderGeneration) return;
    updatePhotoCount();
    const idMap = new Map(entries.map(item => [item.id,item]));
    for (const card of document.querySelectorAll('#grid article[data-id]')) {
      if (generation !== renderGeneration) return;
      const entry = idMap.get(card.dataset.id);
      const cover = card.querySelector('[data-photo]');
      if (!entry || !cover) continue;
      const own = await getPhotos(entry.id).catch(() => []);
      if (generation !== renderGeneration) return;
      if (own.length) continue; // Always preserve the user's own photo.
      const photo = sourceInfo(entry);
      const importedKey = sourceNames.has('yakata:' + entry.name)
        ? 'yakata:' + entry.name : (entry.webNo || entry.sourceArticleNo || '');
      const imported = importedKey && sourceNames.has(importedKey)
        ? await op('sourceGallery','get',importedKey).catch(() => null) : null;
      if (generation !== renderGeneration) return;
      const wrongImport = imported &&
        (!sourcePhotoMatchesEntry(imported,entry) ||
         (photo?.ambiguous && imported.source === '改良メダカWEB図鑑'));
      const exactImport = imported && !wrongImport && !!imported.blob;
      if (exactImport) continue; // Already rendered by app.js.
      if (cover.querySelector('.traitPhotoLabel') || wrongImport ||
          (photo?.ambiguous && cover.querySelector('.sourcePhotoLabel'))) {
        clearMisleadingTrait(cover, !!photo?.ambiguous);
      }
      if (photo && !photo.ambiguous) {
        showSourcePhoto(cover, entry, photo);
      } else if (photo?.ambiguous) {
        clearMisleadingTrait(cover, true);
      } else if (cover.querySelector('.traitPhotoLabel')) {
        clearMisleadingTrait(cover, false);
      }
      // The card's original outbound link remains available.
    }
  }
  const renderPrevious = render;
  render = async function (...args) {
    const generation = ++renderGeneration;
    // Source status filters must not render until their photo index is ready.
    await loadIndex();
    if(generation!==renderGeneration)return;
    await renderPrevious(...args);
    if(generation!==renderGeneration)return;
    await paintCards(generation);
  };

  const editPrevious = edit;
  edit = async function (...args) {
    const entryId = args[0];
    await editPrevious(...args);
    if (!entryId) return;
    const entry = entries.find(x => x.id === entryId);
    if (!entry) return;
    await loadIndex();
    const mount = document.getElementById('sourcePhotoMount');
    const trait = document.getElementById('traitPhotoMount');
    // Preserve an explicitly labeled morphology reference inside the
    // details only; it is never used as a cultivar's cover photograph.
    if (trait) {
      const label=trait.querySelector('.traitReference h3');
      if(label)label.textContent='形質の参考写真（この品種の実物写真ではありません）';
    }
    if (!mount) return;
    const sourcesForThisVariety=sourceCandidates(entry);
    function appendSources(){
      const verified=sourcesForThisVariety.filter(item=>!item.ambiguous);
      if(!verified.length)return;
      const section=document.createElement('section');
      section.className='sourceReference';
      const h=document.createElement('h3');
      h.textContent='🔎 元サイトの実物写真を比較';
      section.append(h);
      const list=document.createElement('ul');
      list.className='referenceSources';
      for(const item of verified){
        const li=document.createElement('li');
        const a=document.createElement('a');
        a.textContent=item.source+'の品種ページを開く';
        a.href=item.sourceUrl;
        a.target='_blank';
        a.rel='noopener noreferrer';
        li.append(a);
        list.append(li);
      }
      section.append(list);
      mount.append(section);
    }
    const photo = sourceInfo(entry);
    const importedKey = sourceNames.has('yakata:' + entry.name)
      ? 'yakata:' + entry.name : (entry.webNo || '');
    const imported = importedKey && sourceNames.has(importedKey)
      ? await op('sourceGallery','get',importedKey).catch(() => null) : null;
    if (imported?.blob && sourcePhotoMatchesEntry(imported,entry) &&
        !(photo?.ambiguous && imported.source === '改良メダカWEB図鑑')){
      appendSources();
      return;
    }
    if (photo && !photo.ambiguous) {
      mount.innerHTML = '';
      const section = document.createElement('section');
      section.className = 'sourceReference';
      const h3 = document.createElement('h3');
      h3.textContent = '📷 この品種の実物写真';
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.referrerPolicy = 'no-referrer';
      img.alt = entry.name + 'の掲載写真';
      img.src = photo.imageUrl;
      const note = document.createElement('p');
      note.className = 'hint';
      note.textContent = '出典：' + photo.source + '／写真ファイルはこのサイトに保存していません。';
      const link = document.createElement('a');
      link.href = photo.sourceUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = '出典の品種ページを見る ↗';
      let switched=false;
      img.onerror = () => {
        if(!switched){
          const alternative=sourcesForThisVariety.find(item=>
            !item.ambiguous && item.imageUrl!==photo.imageUrl);
          if(alternative){
            switched=true;
            note.textContent='出典：'+alternative.source+'（最初の画像を表示できなかったため切替）';
            link.href=alternative.sourceUrl;
            img.src=alternative.imageUrl;
            return;
          }
        }
        img.remove();
        note.textContent='外部写真を表示できません。下の元サイトで確認してください。';
      };
      section.append(h3,img,note,link);
      mount.append(section);
    } else {
      mount.innerHTML = '<p class="hint">📷 この品種と一致する実物写真は未確認です。別品種の写真は表示しません。</p>';
    }
    appendSources();
  };

  // Reload with the index so the first screen also gets accurate photos.
  loadIndex().then(() => {
    if (document.querySelector('#grid article[data-id]')) render();
  });
})();
