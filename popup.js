const lang = navigator.language.startsWith('zh') ? 'zh' : 'en';
const hasChrome = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;

let translations = {};
let content1 = null;
let content2 = null;
let selectingSlot = null;
let bannerTimer = null;
let selectionLocked = false;

const slots = {
    1: {
        type: 'content1',
        storageKey: 'selectedElement1',
        slotId: 'slot1',
        chipId: 'chip1',
        previewId: 'preview1',
        sourceId: 'source1',
        buttonId: 'selectContent1'
    },
    2: {
        type: 'content2',
        storageKey: 'selectedElement2',
        slotId: 'slot2',
        chipId: 'chip2',
        previewId: 'preview2',
        sourceId: 'source2',
        buttonId: 'selectContent2'
    }
};

document.documentElement.lang = lang;

fetch(`locales/${lang}.json`)
    .then((response) => response.json())
    .then((data) => {
        translations = data;
        applyTranslations();
        renderSlots();
    })
    .catch(() => {
        applyTranslations();
        renderSlots();
    });

function t(key, fallback) {
    return translations[key] || fallback || '';
}

function applyTranslations() {
    document.title = t('title', 'Web Pivot');
    document.querySelectorAll('[data-i18n]').forEach((el) => {
        el.textContent = t(el.dataset.i18n, el.textContent);
    });
    document.getElementById('selectContent1').textContent = t('selectAction', 'Select');
    document.getElementById('selectContent2').textContent = t('selectAction', 'Select');
    document.getElementById('clearContent').textContent = t('clearContent', 'Clear');
    document.getElementById('compareContent').textContent = t('compareContent', 'Compare');
}

function hasSelection(value) {
    return !!(value && value.html);
}

function previewText(item) {
    if (!item) return '';
    const raw = item.preview || stripHtml(item.html || '');
    return truncate(raw.replace(/\s+/g, ' ').trim(), 110);
}

function stripHtml(html) {
    return String(html || '').replace(/<[^>]+>/g, ' ');
}

function truncate(text, max) {
    if (!text) return '';
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function formatSource(item) {
    if (!item || !item.url) return '';
    try {
        const url = new URL(item.url);
        const path = url.pathname === '/' ? '' : url.pathname;
        return `${url.hostname}${path}`;
    } catch (err) {
        return item.url;
    }
}

function showBanner(message, type) {
    const banner = document.getElementById('banner');
    banner.hidden = false;
    banner.className = `banner ${type === 'error' ? 'error' : 'info'}`;
    banner.textContent = message;
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => {
        banner.hidden = true;
    }, 2800);
}

function slotState(slotNumber) {
    if (Number(selectingSlot) === slotNumber) return 'selecting';
    return hasSelection(slotNumber === 1 ? content1 : content2) ? 'selected' : 'empty';
}

function renderSlot(slotNumber) {
    const config = slots[slotNumber];
    const item = slotNumber === 1 ? content1 : content2;
    const state = slotState(slotNumber);
    const slot = document.getElementById(config.slotId);
    const chip = document.getElementById(config.chipId);
    const preview = document.getElementById(config.previewId);
    const source = document.getElementById(config.sourceId);
    const button = document.getElementById(config.buttonId);

    slot.dataset.state = state;
    button.disabled = selectionLocked && Number(selectingSlot) === slotNumber;
    button.setAttribute(
        'aria-label',
        slotNumber === 1 ? t('selectContent1', 'Select Content 1') : t('selectContent2', 'Select Content 2')
    );

    if (state === 'selecting') {
        button.textContent = t('statusSelecting', 'Selecting…');
        chip.textContent = t('statusSelecting', 'Selecting…');
        preview.textContent = t('hintSelecting', 'Click an element on the page to capture it.');
        source.hidden = true;
        return;
    }

    if (state === 'selected') {
        button.textContent = t('reselectAction', 'Reselect');
        chip.textContent = t('statusSelected', 'Selected');
        preview.textContent = previewText(item) || t('statusSelected', 'Selected');
        const host = formatSource(item);
        if (host) {
            source.hidden = false;
            source.textContent = host;
            source.title = item.url || host;
        } else {
            source.hidden = true;
        }
        return;
    }

    chip.textContent = t('statusEmpty', 'Empty');
    preview.textContent = t('hintEmpty', 'Pick an element on the current page.');
    source.hidden = true;
    button.textContent = t('selectAction', 'Select');
}

function renderSlots() {
    renderSlot(1);
    renderSlot(2);
    const compare = document.getElementById('compareContent');
    const ready = hasSelection(content1) && hasSelection(content2);
    compare.setAttribute('aria-disabled', ready ? 'false' : 'true');
}

function readStorage() {
    if (!hasChrome) {
        renderSlots();
        return;
    }

    chrome.storage.local.get(
        ['selectedElement1', 'selectedElement2', 'selectingSlot'],
        (result) => {
            content1 = result.selectedElement1 || null;
            content2 = result.selectedElement2 || null;
            selectingSlot = result.selectingSlot || null;
            renderSlots();
        }
    );
}

function selectContent(slotNumber) {
    if (selectionLocked) return;

    const config = slots[slotNumber];
    selectionLocked = true;
    selectingSlot = slotNumber;
    renderSlots();

    if (!hasChrome) return;

    chrome.storage.local.set({ selectingSlot: slotNumber });
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs && tabs[0];
        if (!tab || !tab.id) {
            failSelection(t('selectFailed', 'Unable to select content on this page.'));
            return;
        }

        chrome.scripting.executeScript(
            {
                target: { tabId: tab.id },
                files: ['content.js']
            },
            () => {
                if (chrome.runtime.lastError) {
                    failSelection(t('selectFailed', 'Unable to select content on this page.'));
                    return;
                }

                chrome.tabs.sendMessage(
                    tab.id,
                    {
                        action: 'startSelect',
                        contentType: config.type,
                        toastSuccess1: t('selectSuccess1', 'Content 1 selected.'),
                        toastSuccess2: t('selectSuccess2', 'Content 2 selected.')
                    },
                    () => {
                        if (chrome.runtime.lastError) {
                            failSelection(t('selectFailed', 'Unable to select content on this page.'));
                        }
                    }
                );
            }
        );
    });
}

function failSelection(message) {
    selectionLocked = false;
    selectingSlot = null;
    if (hasChrome) {
        chrome.storage.local.remove('selectingSlot');
    }
    renderSlots();
    showBanner(message, 'error');
}

document.getElementById('selectContent1').addEventListener('click', () => selectContent(1));
document.getElementById('selectContent2').addEventListener('click', () => selectContent(2));

document.getElementById('clearContent').addEventListener('click', () => {
    content1 = null;
    content2 = null;
    selectingSlot = null;
    selectionLocked = false;
    renderSlots();

    if (!hasChrome) {
        showBanner(t('clearedMessage', 'Selections cleared.'), 'info');
        return;
    }

    chrome.storage.local.remove(
        ['selectedElement1', 'selectedElement2', 'selectingSlot', 'comparisonResult'],
        () => {
            showBanner(t('clearedMessage', 'Selections cleared.'), 'info');
        }
    );
});

document.getElementById('compareContent').addEventListener('click', () => {
    if (!hasSelection(content1) || !hasSelection(content2)) {
        showBanner(
            t('missingSelection', 'Select both Content 1 and Content 2 before comparing.'),
            'error'
        );
        return;
    }

    try {
        const diffHtml = new HtmlDiff();
        const { oldDiffHtml, newDiffHtml } = diffHtml.diff_launch(content1.html, content2.html);
        const comparisonResult = {
            oldDiffHtml,
            newDiffHtml,
            left: {
                title: content1.title || t('contentLabel1', 'Content 1'),
                url: content1.url || '',
                preview: previewText(content1)
            },
            right: {
                title: content2.title || t('contentLabel2', 'Content 2'),
                url: content2.url || '',
                preview: previewText(content2)
            },
            lang
        };

        if (!hasChrome) return;

        const comparisonWindow = window.open(
            chrome.runtime.getURL('comparison.html'),
            'web-pivot-comparison',
            'width=1120,height=760,scrollbars=yes,resizable=yes'
        );
        if (!comparisonWindow) {
            showBanner(t('openFailed', 'Could not open the comparison window.'), 'error');
            return;
        }
        chrome.storage.local.set({ comparisonResult });
    } catch (err) {
        showBanner(t('openFailed', 'Could not open the comparison window.'), 'error');
    }
});

if (hasChrome && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;
        if (changes.selectedElement1) {
            content1 = changes.selectedElement1.newValue || null;
        }
        if (changes.selectedElement2) {
            content2 = changes.selectedElement2.newValue || null;
        }
        if (changes.selectingSlot) {
            selectingSlot = changes.selectingSlot.newValue || null;
        }
        if (changes.selectedElement1 || changes.selectedElement2) {
            selectionLocked = false;
        }
        renderSlots();
    });
}

readStorage();
