/**
 * Background-скрипт. Слушает сообщения и записывает их в LocalStorage.
 * 
 * Связующее звено между content.js и popup.js
 * Использовать LocalStorage напрямую в content.js нельзя, потому нужен этот скрипт.
 */


// Ловим смену/создание вкладки и перезагружаем скрипт
//chrome.tabs.onActivated.addListener (function (tabId, changeInfo, tab)
//{
    //chrome.tabs.executeScript ({file: "content.js"});
//});

// Блокируем x-frame-options.
chrome.webRequest.onHeadersReceived.addListener(
    function(info) {
        var headers = info.responseHeaders;
        for (var i = headers.length - 1; i >= 0; --i) {
            var header = headers[i].name.toLowerCase();
            if (header == 'x-frame-options' || header == 'frame-options') {
                headers.splice(i, 1); // Remove header
            }
        }
		
		// Добавим заголовок Access-Control-Allow-Origin, позволяющий производить кросс-доменные запросы.
		headers.push({
			name: "access-control-allow-origin",
			value: "*"
		});
		
        return {responseHeaders: headers};
    },
    {
        urls: [ '*://*/*' ], // Pattern to match all http(s) pages
        types: ["main_frame", "sub_frame", "stylesheet", "script", "image", "object", "xmlhttprequest", "other"]
    },
    ['blocking', 'responseHeaders']
);

// Запускаем наш скрипт.
chrome.tabs.executeScript ({file: "content.js"});

