chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'elementSelected') {
        chrome.storage.local.set({
            [`selectedElement${message.elemNumber}`]: message.element,
            selectingSlot: null
        });
    }
});
