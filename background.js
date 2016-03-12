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


//-------------------------------------------------------------------------------------------------------------------------------------------------------------
// Число страниц для загрузки каталога стима.
var countPages			= 6000;
var isAsync				= true;
var updateTimeMinutes	= 30;

// Первый раз грузим каталог сразу, чтобы не ждать по минуте при каждом запуске.
getPricesFromSteamRender (countPages, isAsync);

var i = 0;
var refreshIntervalId	= setInterval (function ()
{
	++i;

	//---------------
	// Запускаем коллбеки получения цен.
	getPricesFromSteamRender (countPages, isAsync);
	//---------------

	/*
	// Остановка не предусмотрена.
	if (i >= 10)
	{
		clearInterval (refreshIntervalId);
	}
	*/
}, updateTimeMinutes * 60 * 1000);



//--------------------------------------------------------------------------------------------
/**
 * Получить цены прямо из стима циклом запросов по 100 предметов. Всего ~6000 предметов, 60 запросов.
 * Запрос на "http://steamcommunity.com/market/search/render/?query=".
 */
function getPricesFromSteamRender (_countPages, _isAsync)
{
	console.time ('LOADING_PRICES');
	var promises = [];
	
	// Проходим цикл из всех страниц.
	for (pageNumber = 0; pageNumber < _countPages; pageNumber += 100)
	{
		var promise = new Promise(function(resolve, reject) {
			// Эта функция будет вызвана автоматически
			// В ней можно делать любые асинхронные операции,
			// А когда они завершатся — нужно вызвать одно из:
			// resolve(результат) при успешном выполнении
			// reject(ошибка) при ошибке
			
			
			// Шлем запрос
			var resultOfThisPromise = {};
			jQuery.ajax ({
				url : 'https://steamcommunity.com/market/search/render/?query=&start=' + pageNumber + '&count=100&search_descriptions=0&sort_column=popular&sort_dir=desc&appid=730&category_730_ItemSet%5B%5D=any&category_730_ProPlayer%5B%5D=any&category_730_StickerCapsule%5B%5D=any&category_730_TournamentTeam%5B%5D=any&category_730_Weapon%5B%5D=any',
				data : {},
				success : function (data)
				{	
					$('<div id="container">' + data.results_html + '</div>').find ('a.market_listing_row_link').each(function (i)
					{
						var itemRowHtml = $(this).html ();
						
						var lowest_price	= parseFloat ($(itemRowHtml).find ('span.normal_price:nth-child(2)').html ().replace (',', '.').replace (' pуб.', ''));
						var quantity		= parseFloat ($(itemRowHtml).find ('.market_listing_num_listings_qty').html ().replace (',', ''));
						var nameRussian		= $(itemRowHtml).find ('span.market_listing_item_name').html ();
						var nameEnglish		= decodeURIComponent ($(this).attr ('href').replace ('https://steamcommunity.com/market/listings/730/', '')).replace (/\?filter=.+/, '');
						var nameCombo		= replaceItemWearRussianToEnglish (nameRussian);
						
						var currentObjectData = {
							'lowest_price'	: lowest_price,
							'quantity'		: quantity,
							'nameRussian'	: nameRussian,
							'nameEnglish'	: nameEnglish,
							'nameCombo'		: nameCombo,
							'pageNumber'	: pageNumber,
							'overview'		: 'nameEnglish:   ' + nameEnglish + "\nnameRussian:   " + nameRussian + "\nNameCombo:     " + nameCombo + "\nPrice:         " + lowest_price + " руб. \nQuantity:      " + quantity + "\nPageNumber:    " + pageNumber
						};
						
						resultOfThisPromise[nameEnglish] = currentObjectData;
						resultOfThisPromise[nameRussian] = currentObjectData;
						resultOfThisPromise[nameCombo]	= currentObjectData;
						
						// НЕ ЗНАЮ КАК ЭТА ХРЕНЬ РАБОТАЕТ, НО В ГУГЛ ХРОМЕ БУДЕТ ВЫВОДИТЬСЯ ОСОБАЯ ТАБЛИЧКА С ПЕРЕМЕННОЙ ЦИКЛА, ОЧЕНЬ УДОБНО И КРАСИВО.
						console.log ('Loading pages (' + _countPages + ')...');
						
						//alert (resultOfThisPromise[nameRussian][nameEnglish] + " -  count:" + resultOfThisPromise[nameRussian][lowest_price] + ". quantity:" + resultOfThisPromise[nameRussian][quantity]);
					});
				},
				error : function (data)
				{
					console.log ('    page loading error.');
				},
				complete : function (data)
				{
					resolve (resultOfThisPromise);
				},
				type : 'GET',
				dataType : 'json',
				async : _isAsync
			});
		});
		
		promises.push (promise);
	}
	
	// Обрабатываем результаты выполнения ВСЕХ промисов.
	Promise.all(promises).then(promisesResultsHandler);
}

/**
 * Объединить результаты выполнения промисов в один массив.
 * (результаты каждого промиса должны быть также массивом).
 */
function mergePromisesResults (_promisesResultsArray)
{
	// !!!ВНИМАНИЕ!!! Тип скобок имеет очень большое значение. Если сделать переменную массивом [] - JSON.stringify() не сможет сереализовать данные в строку.
	// Он сможет это сделать только с объектом - {}.
	var bingo = {};
		
	for (x = 0; x < _promisesResultsArray.length; x++)
	{
		Object.keys(_promisesResultsArray[x]).forEach(function(key, index) {
			bingo[key] = this[key];
			//console.log (key + ' - ' + this[key]['lowest_price']);
		}, _promisesResultsArray[x]);
	}
	
	return bingo;
}

function getCurrentTimeString ()
{
	var	currentdate = new Date(); 
	return currentdate.getHours() + ":"  
                + currentdate.getMinutes() + ":" 
                + currentdate.getSeconds();
}

function replaceItemWearRussianToEnglish (_str)
{
	return _str
		.replace ('Прямо с завода',				'Factory new')
		.replace ('Немного поношенное',			'Minimal Wear')
		.replace ('После полевых испытаний',	'Field-Tested')
		.replace ('Поношенное',					'Well-Worn')
		.replace ('Закаленное в боях',			'Battle-Scarred');
}

function printPrices (_pricesAfterMerge)
{
	console.log ('Printing prices...');
	
	Object.keys(_pricesAfterMerge).forEach(function(key, index) {
		console.log (key + ' - ' + this[key]['lowest_price']);
	}, _pricesAfterMerge);
}

function promisesResultsHandler (_results)
{
	var pricesDone = mergePromisesResults (_results);
	
	//alert ('pricesDone: ' + JSON.stringify (pricesDone));
	//printPrices (pricesDone);
	
	
	// Ловим сообщения конент-скрипта.
	chrome.runtime.onMessage.addListener(function(message,sender,sendResponse)
	{
		// Обрабатываем только определенные сообщения.
		if (message.target == 'getMePrices')
		{
			//alert ('message received, sending data. Prices: ' + JSON.stringify (pricesDone));
			//printPrices (pricesDone);
			sendResponse({
				prices	: JSON.stringify (pricesDone)
			});
		}
	});
	
	console.timeEnd ('LOADING_PRICES');
	console.log ('Цены загружены');
}

