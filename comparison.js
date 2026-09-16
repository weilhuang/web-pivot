const lang = navigator.language.startsWith('zh') ? 'zh' : 'en';
const hasChrome = typeof chrome !== 'undefined'
    && chrome.storage
    && chrome.storage.local
    && typeof chrome.storage.local.get === 'function';

document.documentElement.lang = lang;

fetch(`locales/${lang}.json`)
    .then((response) => response.json())
    .then((translations) => {
        applyTranslations(translations);
        loadComparison(translations);
    })
    .catch(() => loadComparison({}));

function applyTranslations(translations) {
    const title = translations.comparisonTitle || 'Content Comparison';
    document.title = title;
    document.getElementById('pageTitle').textContent = title;
    document.getElementById('legendAdded').textContent = translations.legendAdded || 'Added';
    document.getElementById('legendRemoved').textContent = translations.legendRemoved || 'Removed';
    document.getElementById('leftTitle').textContent = translations.contentLabel1 || 'Content 1';
    document.getElementById('rightTitle').textContent = translations.contentLabel2 || 'Content 2';
}

function formatSource(meta, fallback) {
    if (!meta || !meta.url) return fallback || '';
    try {
        const url = new URL(meta.url);
        return url.hostname + (url.pathname === '/' ? '' : url.pathname);
    } catch (err) {
        return meta.url;
    }
}

function fillPane(titleId, sourceId, bodyId, html, meta, translations) {
    const title = document.getElementById(titleId);
    const source = document.getElementById(sourceId);
    const body = document.getElementById(bodyId);

    title.textContent = (meta && meta.title) || title.textContent;

    if (meta && meta.url) {
        source.replaceChildren();
        const link = document.createElement('a');
        link.href = meta.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = formatSource(meta, translations.unknownSource || 'Current page');
        source.appendChild(link);
    } else if (html) {
        source.textContent = translations.unknownSource || '';
    } else {
        source.textContent = '';
    }

    if (!html) {
        body.innerHTML = '';
        const empty = document.createElement('p');
        empty.className = 'pane-empty';
        empty.textContent = translations.paneEmpty || 'No comparison data to display.';
        body.appendChild(empty);
        return;
    }

    body.innerHTML = html;
}

function renderComparison(data, translations) {
    const payload = data || {};
    document.getElementById('pageSubtitle').textContent = translations.subtitle || '';
    fillPane('leftTitle', 'leftSource', 'leftBody', payload.oldDiffHtml, payload.left, translations);
    fillPane('rightTitle', 'rightSource', 'rightBody', payload.newDiffHtml, payload.right, translations);
}

function loadComparison(translations) {
    if (!hasChrome) {
        renderComparison({}, translations);
        return;
    }

    chrome.storage.local.get(['comparisonResult'], (result) => {
        renderComparison(result.comparisonResult, translations);
    });

    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.comparisonResult) {
            renderComparison(changes.comparisonResult.newValue, translations);
        }
    });
}
