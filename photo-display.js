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
  function sourceInfo(entry) {
    if (!entry) return null;
    const fromYakata = index.yakata?.[entry.name];
    if (fromYakata &&
        isAllowedImage(fromYakata.imageUrl, 'yakata') &&
        isAllowedSource(fromYakata.sourceUrl)) {
      return {imageUrl:fromYakata.imageUrl,sourceUrl:fromYakata.sourceUrl,
              source:'めだかの館',ambiguous:false};
    }
    const fromWeb = entry.webNo && index.photos?.[String(entry.webNo)];
    if (!fromWeb || fromWeb.name !== entry.name) return null;
    if (!isAllowedImage(fromWeb.imageUrl, 'web') ||
        !isAllowedSource(fromWeb.sourceUrl)) return null;
    return {imageUrl:fromWeb.imageUrl,sourceUrl:fromWeb.sourceUrl,
            source:'改良メダカWEB図鑑',ambiguous:!!fromWeb.ambiguous};
  }
  function clearMisleadingTrait(cover, awaitingVerification) {
    cover.innerHTML = '<div class="photoPlaceholder">📷<small>' +
      (awaitingVerification ? '品種写真の照合待ち' : 'この品種の写真は未登録') +
      '</small></div>';
  }
  function showSourcePhoto(cover, entry, photo) {
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
    cover.replaceChildren(img, label);
    img.onerror = () => {
      if (!cover.contains(img)) return;
      clearMisleadingTrait(cover, false);
      const note = document.createElement('a');
      note.className = 'sourceLink';
      note.href = photo.sourceUrl;
      note.target = '_blank';
      note.rel = 'noopener noreferrer';
      note.textContent = '元サイトで写真を見る ↗';
      cover.append(note);
    };
    img.src = photo.imageUrl;
  }
  function updatePhotoCount() {
    const known = new Set();
    for (const entry of entries) {
      const photo = sourceInfo(entry);
      if ((photo && !photo.ambiguous) ||
          sourceNames.has('yakata:' + entry.name) ||
          (entry.webNo && sourceNames.has(String(entry.webNo))) ||
          entry.yakataImageUrl) known.add(entry.id);
    }
    for (const span of document.querySelectorAll('#stats span')) {
      if (span.textContent.startsWith('実物写真 ')) {
        span.textContent = '実物写真の参照先 ' + known.size + '種類';
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
        ? 'yakata:' + entry.name : (entry.webNo || '');
      const imported = importedKey && sourceNames.has(importedKey)
        ? await op('sourceGallery','get',importedKey).catch(() => null) : null;
      if (generation !== renderGeneration) return;
      const wrongImport = imported &&
        (imported.name !== entry.name ||
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
    await renderPrevious(...args);
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
    if (trait) trait.innerHTML = ''; // Never label a different fish as the selected variety.
    if (!mount) return;
    const photo = sourceInfo(entry);
    const importedKey = sourceNames.has('yakata:' + entry.name)
      ? 'yakata:' + entry.name : (entry.webNo || '');
    const imported = importedKey && sourceNames.has(importedKey)
      ? await op('sourceGallery','get',importedKey).catch(() => null) : null;
    if (imported?.blob && imported.name === entry.name &&
        !(photo?.ambiguous && imported.source === '改良メダカWEB図鑑')) return;
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
      img.onerror = () => {
        img.remove();
        note.textContent = '外部画像を表示できません。元サイトの掲載写真を確認してください。';
      };
      section.append(h3,img,note,link);
      mount.append(section);
    } else {
      mount.innerHTML = '<p class="hint">📷 この品種と一致する実物写真は未確認です。別品種の写真は表示しません。</p>';
    }
  };

  // Reload with the index so the first screen also gets accurate photos.
  loadIndex().then(() => {
    if (document.querySelector('#grid article[data-id]')) render();
  });
})();
