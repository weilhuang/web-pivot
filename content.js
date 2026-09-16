if (typeof isSelecting === 'undefined') {
    var isSelecting = false;
}

if (typeof selectedElement === 'undefined') {
    var selectedElement = null;
}

if (typeof currentContentType === 'undefined') {
    var currentContentType = null;
}

if (typeof toastSuccess1 === 'undefined') {
    var toastSuccess1 = '';
}

if (typeof toastSuccess2 === 'undefined') {
    var toastSuccess2 = '';
}

if (typeof webPivotListenerBound === 'undefined') {
    var webPivotListenerBound = true;

    chrome.runtime.onMessage.addListener((message) => {
        if (message.action === 'startSelect') {
            if (isSelecting) {
                cancelSelection();
            }
            isSelecting = true;
            currentContentType = message.contentType;
            toastSuccess1 = message.toastSuccess1 || '';
            toastSuccess2 = message.toastSuccess2 || '';
            startSelectingElement();
        }
    });
}

function cancelSelection() {
    isSelecting = false;
    currentContentType = null;

    document.removeEventListener('mousemove', highlightElement);
    document.removeEventListener('click', selectElement);

    if (selectedElement) {
        selectedElement.style.backgroundColor = '';
        selectedElement.style.outline = '';
    }
}

function startSelectingElement() {
    document.addEventListener('mousemove', highlightElement);
    document.addEventListener('click', selectElement);
}

function highlightElement(event) {
    if (!isSelecting) return;

    if (selectedElement) {
        selectedElement.style.backgroundColor = '';
        selectedElement.style.outline = '';
    }

    selectedElement = event.target;
    selectedElement.style.backgroundColor = 'rgba(61, 90, 254, 0.16)';
    selectedElement.style.outline = '2px solid #3d5afe';
}

function selectElement(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!isSelecting) return;

    const target = event.target;
    if (target) {
        target.style.backgroundColor = '';
        target.style.outline = '';
    }

    const selectedType = currentContentType;
    const selectedHtmlWithStyles = getHtmlWithInlineStyles(target);
    const preview = (target.innerText || target.textContent || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 240);

    const elementData = {
        html: selectedHtmlWithStyles,
        url: location.href,
        title: document.title,
        preview
    };

    chrome.runtime.sendMessage({
        type: 'elementSelected',
        elemNumber: selectedType === 'content1' ? 1 : 2,
        element: elementData
    });

    cancelSelection();
    showPageToast(
        selectedType === 'content1'
            ? toastSuccess1 || (navigator.language.startsWith('zh') ? '内容 1 已选择。' : 'Content 1 selected.')
            : toastSuccess2 || (navigator.language.startsWith('zh') ? '内容 2 已选择。' : 'Content 2 selected.')
    );
}

function showPageToast(message) {
    const existing = document.getElementById('web-pivot-toast');
    if (existing) existing.remove();

    const el = document.createElement('div');
    el.id = 'web-pivot-toast';
    el.textContent = message;
    el.setAttribute(
        'style',
        [
            'position:fixed',
            'z-index:2147483647',
            'left:50%',
            'bottom:24px',
            'transform:translateX(-50%)',
            'background:#1c2430',
            'color:#fff',
            'padding:10px 16px',
            'border-radius:10px',
            'font:13px/1.4 Segoe UI,PingFang SC,Noto Sans SC,sans-serif',
            'box-shadow:0 8px 24px rgba(0,0,0,.18)',
            'pointer-events:none',
            'max-width:min(420px,calc(100vw - 32px))'
        ].join(';')
    );
    document.documentElement.appendChild(el);
    setTimeout(() => el.remove(), 2200);
}

function getHtmlWithInlineStyles(element) {
    const clone = element.cloneNode(true);
    applyInlineStyles(clone);
    return clone.outerHTML;
}

function applyInlineStyles(element) {
    const computedStyle = getComputedStyle(element);

    for (let i = 0; i < computedStyle.length; i++) {
        const property = computedStyle[i];
        element.style[property] = computedStyle.getPropertyValue(property);
    }

    for (let i = 0; i < element.children.length; i++) {
        applyInlineStyles(element.children[i]);
    }
}
