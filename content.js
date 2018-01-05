// ИЗВЕСТНЫЕ БАГИ:
// При работе с ящиками.
// Ибо стим при запросе "Chroma 2 Case"
// РАНДОМНО выдает то "Хромированный кейс #2", то "Ключ от хромированного кейса 2". И софт неверно расчитывает цены.
// 
// Это можно исправить принудительной фильтрацией по состоянию, сувенирности и т.п. Тогда софт будет искать точно то, что надо.
// 
// ИДЕИ:
// - сделать отображение цены мгновенного выкупа и роя при мгновенном выкупе.
// - отображение роя при перепродаже на этой же бирже с дискаунтом.
// 
// - сделать отображение цены мгновенного выкупа из метода getItemInfoByDirectQuery(). При парсинге регулярками цен, создавать удобные числовые массивы с этими данными. Чтобы они не просто висели в воздухе, а были представлены в удобном виде.
// - средняя цена мгновенного выкупа.
// - отображать roi цены мгновенного выкупа.
// 
// !!!!ЗАМЕТКИ!!!!:
// - DONE - Сделать переодическую подгрузку инфы из background.js, чтобы разгрузить контент-скрипт.
// - DONE - Сделать подгрузку инфы СРАЗУ О ВСЕХ предметах на странице.
// - Сделать кнопку для прогрузки реальных цен магазина и предметов на странице, чтобы сразу авидеть наиболее прибыльный предмет.
// - Сделать сортировку по реальному профиту. Ибо встроенная сортировка фигня.
// - Сделать автоматическую покупку предмета, если объем > 1000, а цена < 55% от стима.
// 

/**
 * Получить минимальную цену предмета на торговой площадке через "steamcommunity.com/market/priceoverview/".
 */
function getItemInfoByPriceOverview (_marketHashName)
{
    var lowest_price = 'ERROR';
    var volume = 'ERROR';

    jQuery.ajax ({
        url : "https://steamcommunity.com/market/priceoverview/?appid=730&currency=5&market_hash_name=" + _marketHashName.replace (/\?filter=.+/, ''),
        success : function (data)
        {
            lowest_price = data.lowest_price.replace (',', '.').replace (' p\u0443\u0431.', '');
            volume = data.volume;
        },
        async : false
    });

    return {
        'lowest_price' : lowest_price,
        'volume' : volume
    };
}

/**
 * Вернуть информацию о предмете, полученную с помощью поиска.
 * 
 * @return Массив вида {'lowest_price' : lowest_price, 'quantity' : quantity}.
 */
function getItemInfoBySearch (_anyName)
{
    var isFound = false;
    var lowest_price = 'ERROR';
    var quantity = 'ERROR';
    var targetTableForIframe = 'ERROR';
    var html = 'ERROR';
    var englishName = 'NOT_FOUND';

    jQuery.ajax ({
        url : 'https://steamcommunity.com/market/search?q=' + encodeURIComponent (_anyName) + '&category_730_ItemSet%5B%5D=any&category_730_ProPlayer%5B%5D=any&category_730_StickerCapsule%5B%5D=any&category_730_TournamentTeam%5B%5D=any&category_730_Weapon%5B%5D=any&appid=730',
        success : function (data)
        {
            // Вернем html-код запроса.
            html = data;

            // Получаем таблицу с результатами поиска.
            var tempTargetTable = $ (data).find ('#searchResultsTable').html ();
            targetTableForIframe = data.replace (/<body class=" responsive_page">[\s\S]+<\/body>/i, tempTargetTable);

            // Если поиск не дал результатов, выходим.
            isFound = !(data.indexOf ("Не обнаружены предметы, соответствующие поисковому запросу") != -1);
            if (!isFound)
            {
                return;
            }

            lowest_price = parseFloat ($ (data).find ('span.normal_price:nth-child(2)').html ().replace (',', '.').replace (' pуб.', ''));
            quantity = parseFloat ($ (data).find ('.market_listing_num_listings_qty').html ().replace (',', '.'));

            // Ищем оригинальное английское имя предмета.
            englishName = decodeURIComponent ($ (data).find ('a.market_listing_row_link').attr ('href').replace ('https://steamcommunity.com/market/listings/730/', '')).replace (/\?filter=.+/, '');
        },
        async : false
    });

    return {
        'is_found' : isFound,
        'html' : html,
        'target_table_for_iframe' : targetTableForIframe,
        'lowest_price' : lowest_price,
        'quantity' : quantity,
        'english_name' : englishName
    };
}

// http://jsperf.com/min-and-max-in-array/2
function minLoop (arr)
{
    var len = arr.length, min = Infinity;
    while (len--)
    {
        if (arr[len] < min)
        {
            min = arr[len];
        }
    }
    return min;
}

function maxLoop (arr)
{
    var len = arr.length, max = -Infinity;
    while (len--)
    {
        if (arr[len] > max)
        {
            max = arr[len];
        }
    }
    return max;
}

/**
 * Получить информацию по таблице ордеров.
 * 
 * @param _order_table Часть массива "https://steamcommunity.com/market/itemordershistogram".
 */
function getOrderTableInfo (_order_table)
{
    var orderTableArr = [];
    var values = [];
    var quantities = [];
    var sum = 0.0;
    var averagePrice = 0.0;

    // Расчитываем среднюю цену.
    var pattern1 = /<td align="right" class="">([0-9,]+) pуб.<\/td><td align="right"( class="")?>([0-9]+)<\/td>/ig;
    var pattern2 = /<td align="right" class="">([0-9,]+) pуб.<\/td><td align="right"( class="")?>([0-9]+)<\/td>/i;
    var arrSell = _order_table.match (pattern1);

    var counter = 0;
    for (var i = 0; i < arrSell.length; i++)
    {
        var value = parseFloat (arrSell[i].match (pattern2)[1].replace (',', '.'));
        var quantity = parseFloat (arrSell[i].match (pattern2)[3].replace (',', '.'));

        orderTableArr.push ({'value' : value, 'quantity' : quantity});
        values.push (value);
        quantities.push (quantity);

        counter += quantity;
        sum += value * quantity;
    }
    averagePrice = sum / counter;

    return {
        'average_price' : averagePrice,
        'min_price' : minLoop (values),
        'max_price' : maxLoop (values),
        'order_table_arr' : orderTableArr,
        'values' : values,
        'quantities' : quantities
    };
}

/**
 * Получить инфу о предмете прямым запросом на страницу вида "https://steamcommunity.com/market/listings/730/XXX".
 * 
 * А затем получить инфу со страницы "https://steamcommunity.com/market/itemordershistogram".
 */
function getItemInfoByDirectQuery (_marketHashName)
{
	console.time ('LOADING_ITEMORDERSHISTOGRAM');
	
    var isFound = false;
    var item_nameid = 'ERROR';
    var jsonItemordershistogram = 'ERROR';
    var sell_order_table = 'ERROR';
    var buy_order_table = 'ERROR';
    var sell_order_table_info = 'ERROR';
    var buy_order_table_info = 'ERROR';

    // Грузим страницу с итемом, чтобы получить item_nameid.
    jQuery.ajax ({
        url : 'https://steamcommunity.com/market/listings/730/' + encodeURIComponent (_marketHashName),
        success : function (data)
        {
            // Если поиск не дал результатов, выходим.
            isFound = !(data.indexOf ("Этот предмет никто не продает") != -1);
            if (!isFound)
            {
                return;
            }

            // Важный параметр - по нему загружается json с параметрами об итеме.
            item_nameid = parseInt (data.match (/Market_LoadOrderSpread\( ([0-9]+) \);/i)[1]);
        },
        dataType : 'html',
        async : false
    });

    // Если предмет не найден, выходим.
    if (!isFound)
    {
        return {'is_found' : isFound};
    }



    // Грузим хисториограф.
    jQuery.ajax ({
        url : 'https://steamcommunity.com/market/itemordershistogram?country=RU&language=russian&currency=5&item_nameid=' + item_nameid + '&two_factor=0',
        success : function (data)
        {
            jsonItemordershistogram = data;
            sell_order_table = jsonItemordershistogram.sell_order_table;
            buy_order_table = jsonItemordershistogram.buy_order_table;
        },
        dataType : 'json',
        async : false
    });

    // Получаем инфу по таблицам ордеров.
    sell_order_table_info = getOrderTableInfo (sell_order_table);
    buy_order_table_info = getOrderTableInfo (buy_order_table);

	
	
	console.timeEnd ('LOADING_ITEMORDERSHISTOGRAM');
    return {
        'is_found' : isFound,
        'item_nameid' : item_nameid,
        'jsonItemordershistogram' : jsonItemordershistogram,
        'sell_order_table' : sell_order_table,
        'buy_order_table' : buy_order_table,
        'sell_order_table_info' : sell_order_table_info,
        'buy_order_table_info' : buy_order_table_info
    };
}

function removeActiveTrade ()
{
    var result = 'ERROR!';

    // Получим ид текущего трейда
    var idCurrentTrade = -1;
    jQuery.ajax ({
        url : 'http://csgolounge.com/mytrades',
        data : {},
        type : 'GET',
        dataType : 'text',
        async : false,
        success : function (data)
        {
            idCurrentTrade = $ (data).find ('.tradepoll').attr ('id').replace ('trade', '');
        }
    });


    // Удаляем этот трейд
    jQuery.ajax ({
        url : 'http://csgolounge.com/ajax/removeTrade.php',
        data : {
            'trade' : idCurrentTrade,
        },
        type : 'POST',
        dataType : 'text',
        async : false,
        success : function (data)
        {
            //alert ('Done! ' + data);
            result = data;
        }
    });

    return result;
}

function getTokenToPostTrade ()
{
    var html = 'ERROR!';

    // Шлем запрос
    jQuery.ajax ({
        url : 'http://csgolounge.com/addtrade',
        data : {},
        success : function (data)
        {
            html = data;
        },
        type : 'GET',
        dataType : 'text',
        async : false
    });

    return html.match (/postTrade\('(.+)'\)">Post Trade<\/a>/i)[1];
}

function postTrade ()
{
    var result = 'ERROR!';
    var tokenTrade = getTokenToPostTrade ();

    var note = 'Hello, dude! Yes, I beleave, you want to echange some of your skins or keys to some of mine!' + "\n"
            + 'Send me good offer!' + "\n" + "\n"

            + 'PLEASE, SEND ME ONLY STEAM OFFERS, I DON\'T SEE OFFERS HERE!' + "\n"
            + 'MY TRADE LINK:' + "\n"
            + 'https://steamcommunity.com/tradeoffer/new/?partner=245159969&token=UpOS2P5t';

    // Шлем запрос
    jQuery.ajax ({
        url : 'http://csgolounge.com/ajax/postTrade.php',
        data : decodeURIComponent ('ldef_index%5B%5D=4809&lquality%5B%5D=0&id%5B%5D=5274073084&ldef_index%5B%5D=4790&lquality%5B%5D=0&id%5B%5D=5274073175&ldef_index%5B%5D=1965&lquality%5B%5D=0&id%5B%5D=5274073035&ldef_index%5B%5D=5675&lquality%5B%5D=0&id%5B%5D=5274073139&rdef_index%5B%5D=5&rquality%5B%5D=0&rdef_index%5B%5D=1&rquality%5B%5D=0&tslt=13a6b686ad7094ac19dbd4cbad14279e&notes=') + note,
        success : function (data)
        {
            //alert ('Done! Message: "' + data + '".');
            result = data;
        },
        type : 'POST',
        dataType : 'text',
        async : false
    });

    return result;
}

/**
 * Блокировать/разблокировать формы ввода данных.
 */
function blockForms (_status)
{
    $ ("#countBumps").prop ('disabled', _status);
    $ ("#log").prop ('disabled', _status);
    $ ("#stopAutobump").prop ('disabled', !_status);
    $ ("#startAutobump").prop ('disabled', _status);
    $ ("#timeoutUpdate").prop ('disabled', _status);
}

function log (_str)
{
    var old = $ ('#logTextarea').val ();
    $ ('#logTextarea').val (old + _str + "\n");

    document.getElementById ("logTextarea").scrollTop = document.getElementById ("logTextarea").scrollHeight;
}

/**
 * Начать цикл бампинга. Возвращается ид счетчика.
 * 
 * @return ID счетчика.
 */
function startBumpCycle (_countBumps, _timeoutBumpMilis)
{
    // Цикл бампинга
    var i = 0;
    return setInterval (function ()
    {
        ++i;

        //---------------
        // Меняем значения счетчика.
        $ ('#countBumps').val (_countBumps - i);


        // Бампим трейд.
        removeActiveTrade ();
        postTrade ();

        // Пишем в лог.
        log (i + '.) OK');
        //---------------

        if (i >= _countBumps)
        {
            // Выключаем счетчик и бампинг.
            $ ("#stopAutobump").click ();
        }
    }, _timeoutBumpMilis);
}

function getPricesFromCsgofastcom ()
{
	var result = 'ERROR';
	
	// Шлем запрос
    jQuery.ajax ({
        url : 'https://api.csgofast.com/price/all',
        data : {},
        success : function (data)
        {
            //alert ('Done! Message: "' + data + '".');
            result = data;
        },
        type : 'GET',
        dataType : 'json',
        async : false
    });
	
	return result;
}

function replaceItemWearRussianToEnglish (_str)
{
	return _str
		.replace ('Прямо с завода',				'Factory new')
		.replace ('Немного поношенное',			'Minimal Wear')
		.replace ('После полевых испытаний',	'Field-Tested')
		.replace ('Поношенное',					'Well-Worn')
		.replace ('Закаленное в боях',			'Battle-Scarred')
		.replace ('Наклейка',					'Sticker')
		.replace ('Именной ярлык',				'Name Tag')
		.replace ('Набор музыки',				'Music Kit')
		.replace (' (Ключ)',					'')
		.replace (' (Набор музыки)',			'')
		.replace (' (Наклейка)',				'')
		.replace (' (Подарок)',					'')
		.replace (' (Инструмент)',				'');
}


//-------------------------------------------------------------------------------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------------------------------------------------------------------------
// Запускаем
//$ (document).ready (function ()
//{
    mainContent ();
//});

/**
 * Основная функция расширения.
 * Именно ФУНКЦИЯ нужна, чтобы в нужный момент юзать "return" для выхода.
 * 
 * @returns {Boolean}
 */
function mainContent ()
{
    // Скрипт работает только на csgo.tm/item/*
    if (document.location.toString ().match (/^https:\/\/market\.csgo\.com\/item\//i))
    {
		// Запрашиваем у background.js информацию о ценах.
		chrome.runtime.sendMessage({target: "getMePrices"}, function(response) {
			var prices = JSON.parse (response.prices);
			
			// Запускаем отрисовку интерфейса и работу с ценами.
			//printPrices ();
			pricesHandler (prices);
		});
    }
	
	// Страница со списком товаров (пока только отсортированных по выгоде).
	else if (document.location.toString ().match (/^https:\/\/market\.csgo\.com\/.*rs=[0-9\.]+;[0-9\.]+(&search=.+)?$/i))
	{
		// Запрашиваем у background.js информацию о ценах.
		chrome.runtime.sendMessage({target: "getMePrices"}, function(response) {
			var prices = JSON.parse (response.prices);
			
			//-------------------------
			// Проходимся по всем предметам на странице и собираем их цены.
			var pricesShop = [];
			var pricesReal = [];
			$('div.imageblock > div.price').each(function (i)
			{
				pricesShop.push (parseFloat ($(this).text ().replace ('.', ',')));
			});
			
			// Проходимся по всем предметам на странице и показываем их профит.
			var itemNumber1 = -1;
			$('.item.hot > div.name').each(function (i)
			{
				++itemNumber1;
				var itemName		= replaceItemWearRussianToEnglish ($(this).text ().trim ());
				var itemPriceShop	= pricesShop[itemNumber1];
				
				if (prices[itemName] != undefined)
				{
					var itemPriceReal	= prices[itemName]['lowest_price'];
					var itemValue		= prices[itemName]['quantity'];
					var itemPrifitHtml	= getColorPercentageProfitHtmlString (itemPriceShop, itemPriceReal);

					$(this).html (itemPrifitHtml + ' - ' + '#' + itemName + '#');
					pricesReal[itemNumber1] = itemPriceReal;
					
					// Цветные рамки
					/*
					var color = '';
					if (itemValue >= 200)
					{
						color = 'yellow';
					}
					else if (itemValue >= 500)
					{
						color = 'green';
					}
					else if (itemValue >= 1000)
					{
						color = 'blue';
					}
					*/
					
					// Сначала скроем вообще все:
					$(this).parent ().css({"opacity":"0.5"});
					var percentProfit = getRoi (itemPriceShop, itemPriceReal) - 100;
					
					// Рамки в зависимости от профита:
					if (percentProfit >= 30 || itemName.indexOf('key') > -1)
					{
						// Если профит больше 30%, просто покажем предмет
						$(this).parent ().css({"opacity":"1"});
					}
					if (percentProfit >= 40)
					{
						$(this).parent ().find ('div.imageblock').css({"border-color": 'green', "border-width":"3px", "border-style":"solid"});
						$(this).parent ().css({"opacity":"1"});
					}
					if (percentProfit >= 50)
					{
						$(this).parent ().find ('div.imageblock').css({"border-color": 'blue', "border-width":"4px", "border-style":"solid"});
						$(this).parent ().css({"opacity":"1"});
					}
					if (percentProfit >= 60)
					{
						$(this).parent ().find ('div.imageblock').css({"border-color": 'DarkViolet', "border-width":"5px", "border-style":"solid"});
						$(this).parent ().css({"opacity":"1"});
					}
					
					// Рамки в зависимости от объема:
					if (itemValue >= 100)
					{
						$(this).parent ().find ('div.name').css({"border-color": 'green', "border-width":"2px", "border-style":"dotted"});
					}
					if (itemValue >= 200)
					{
						$(this).parent ().find ('div.name').css({"border-color": 'blue', "border-width":"3px", "border-style":"dotted"});
					}
					if (itemValue >= 500)
					{
						$(this).parent ().find ('div.name').css({"border-color": 'DarkViolet', "border-width":"4px", "border-style":"dotted"});
					}
					
					// Если профит меньше 20%, или количество продаж меньше 100, скрываем предмет
				}
				else
				{
					pricesReal[itemNumber1] = '???';
				}
			});
			
			// Проходимся по ценам еще раз, чтобы добавить цену стима рядом.
			var itemNumber2 = 0;
			$('div.imageblock > div.price').each(function (i)
			{
				var prrrr = parseFloat ($(this).text ().replace ('.', ','));
				$(this).html (prrrr + ' / ' + pricesReal[itemNumber2++]);
			});
		});
	}
    //---------------------------------------------------------------------------------------------------------------------------------------------------------
    // CSGOLOUNGE.COM
    else if (document.location.toString ().match (/^http:\/\/csgolounge\.com\/addtrade$/i))
    {
        // !!!ВНИМАНИЕ!!! ТОКЕН ОТПРАВКИ ТРЕЙДА ГЕНЕРИРУЕТСЯ ЗАНОВО КАЖДЫЙ РАЗ ДЛЯ НОВОГО ТРЕЙДА.
        // Таким образом, надо перезагружать страницу для получения нового токена ПЕРЕД КАЖДЫМ БАМПОМ.
        // 
        // 
        // 

        //------------------------------------------------------------------------------
        // Внедряем дополнительный код
        $ ('head').append ('<style>'
                + '.myMainDiv	{box-sizing: border-box; width: 100%; padding: 3px; padding-left: 15px; background: #CCC; border: 1px solid #F11}'
                + '.myButton	{padding: 5px; font-size: 17px; height: 50px;}'
                + 'textarea		{box-sizing: border-box; width: 50%; margin-top: 3px;}'
                + '.myTable		{border-collapse: collapse;}'
                //+ '.myTable td	{border: 2px solid #000;}'
                + '.myTable td	{vertical-align: middle; background: #CCC; padding: 3px 5px 3px 0px;}'
		+ '</style>');

        $ ('header').after ('<div class="myMainDiv">'
                + '<table class="myTable">'

                + '<tr>'
                + '<td>Count bumps:</td>'
                + '<td><input id="countBumps" type="text" size="1" value="1000" /></td>'
                + '<td rowspan=2><button id="startAutobump" class="myButton">Start autobump</button></td>'
                + '<td rowspan=2><button id="stopAutobump" class="myButton" disabled>Stop autobump</button></td></tr>'
                + '</tr>'

                + '<tr>'
                + '<td>Update timeout:</td>'
                + '<td><input id="timeoutUpdate" type="text" size="1" value="60" /></td>'
                + '</tr>'

                + ''
                + ''
                + '</table>'
                + '<textarea id="logTextarea" rows="10">Log...</textarea>'

		+ '</div>');

        // Обрабатываем нажатия кнопок.
        // ЗАПУСК.
        var refreshIntervalId = -1;
        $ ("#startAutobump").click (function ()
        {
            // Число бампов. Получаем каждый раз заново.
            var countBumps = parseInt ($ ('#countBumps').val ());
            if (countBumps <= 0)
            {
                return;
            }

            // Таймаут между бампами.
            var timeoutBumpMilis = parseInt ($ ('#timeoutUpdate').val ()) * 1000;

            // Блокируем формы
            blockForms (true);

            // Очистим лог
            $ ('#logTextarea').val ('');

            refreshIntervalId = startBumpCycle (countBumps, timeoutBumpMilis);
        });

        // ОСТАНОВКА.
        $ ("#stopAutobump").click (function ()
        {
            // Блокируем формы
            blockForms (false);

            // Выключаем счетчик.
            clearInterval (refreshIntervalId);
        });
    }
}


function printPrices (_pricesAfterMerge)
{
	console.log ('Printing prices...');
	Object.keys(_pricesAfterMerge).forEach(function(key, index) {
		console.log (key + ' - ' + this[key]);
	}, _pricesAfterMerge);
}

//------------------------------------------------------------------------------------------------------------------------------------------------------------
/**
 * Обработчик цен.
 */
function pricesHandler (_results)
{
	// Грузим цены с рендера стима.
	var prices = _results;
		
	// Название предмета
	var itemName = $ ('title').html ().replace (" | Магазин Counter-Strike: Global Offensive", "");
		
	// Состояние предмета
	var itemWear = $ ('.item-appearance').attr ('data-wear');

	// Строка для поиска
	var searchStringRussian = replaceItemWearRussianToEnglish ((itemName + ' (' + itemWear + ')').replace (' (undefined)', ''));
	
	// Объект с базовой инфой по текущему предмету.
	var itemObject = prices[searchStringRussian];
		
	console.log ('Searching name: #' + searchStringRussian + '#');
	console.log ("");
	console.log ('Overview:' + "\n" + itemObject['overview']);
	console.log ("");

	// Цена предмета в магазине.
	var costShop = parseFloat ($ ('.ip-bestprice').text ());

	// Изменим ширину правой колонки
	//$('.item-page-right').css ({'width' : '100%', 'background-color' : 'yellow'});

	//-------------------------------------------------------------
	// Внедряем стили.
	$ ('head').append ('<style>'
		+ '.myMainDiv			{background: #e3e0ca; padding: 10px; font-size: 20px; line-height: 23px;}'
		+ 'table.info_table		{width: 100%; border-collapse: collapse;}'
		+ '.info_table td		{border: 1px solid black;}'
		+ '.center				{text-align: center;}'
		+ 'a.market_link		{text-decoration: none;}'
	+ '</style>');
	
	// Внедряем таблицу.
	$ ('.item-tags').after ('<div class="myMainDiv">'
		+ '<table class="info_table">'
		+ '<tr><td colspan=4 class="center">"<b><span id="englishname">UNKNOWN</span></b>".</td>'

		+ '<tr><td class="center" colspan=2>'
		+ '<a id="bitskinsUrl" class="market_link" target="_blank" href="UNKNOWN">&gt&gtGO TO THE BS&lt&lt</a>'
		+ '<a id="opsUrl" class="market_link" target="_blank" href="UNKNOWN">&gt&gtGO TO THE OPS&lt&lt</a>'
		+ '</td>'
		+ '<td colspan=2 class="center"><a id="steamPageUrl" class="market_link" target="_blank" href="UNKNOWN">&gt&gtGO TO THE STEAM&lt&lt</a></td></tr>'
		+ '<tr><td colspan=4 class="center"><b>ЦЕНА:</b></td></tr>'

		+ '<tr><td class="center">Минимальная:<br><b><span id="lowest_price_1">UNKNOWN</span> руб.</b></td>'
		+ '<td class="center">Средняя:<br><span id="average_price_sell">UNKNOWN</span> руб.</td>'
		+ '<td class="center">Автовыкуп:<br><b><span id="best_price_buy">UNKNOWN</span> руб.</b></td>'
		+ '<td class="center">Средняя:<br><span id="average_price_buy">UNKNOWN</span> руб.</td></tr>'

		+ '<tr><td class="center"><span id="lowest_price_1_real">UNKNOWN</span> руб.</b></td>'
		+ '<td class="center"><span id="average_price_sell_real">UNKNOWN</span> руб.</td>'
		+ '<td class="center"><span id="best_price_buy_real">UNKNOWN</span> руб.</b></td>'
		+ '<td class="center"><span id="average_price_buy_real">UNKNOWN</span> руб.</td></tr>'

		+ '<tr><td>diff_av: <b><span id="diff_1">UNKNOWN</span>%</b></td>'
		+ '<td>diff_auto: <b><span id="diff_auto">UNKNOWN</span>%</b></td>'
		+ '<td colspan=2 class="center">diff: <b><span id="diff_2">UNKNOWN</span>%</b></td></tr>'

		+ '<tr><td colspan=2></td><td colspan=2><br></td></tr>'
		+ '<tr><td colspan=2>Объем:</td><td colspan=2><b><span id="volume_1">UNKNOWN</span></b>.</td>'
		+ '<tr><td colspan=2>Цена от стима:</td><td colspan=2><b><span id="cost_to_steam_diff">UNKNOWN</span></b>.</td>'
		+ '<tr><td colspan=2>ROI:</td><td colspan=2><span id="cost_roi">UNKNOWN</span>.</td>'

		+ '<tr><td colspan=2></td><td colspan=2><br></td></tr>'
		+ '<tr><td colspan=2>Прибыль чистыми:</td>'
		+ '<td><b><span id="cost_profit_part_1">UNKNOWN</span></b></td>'
		+ '<td><b>(<span id="cost_profit_part_2">UNKNOWN</span>)</b></td></tr>'

		+ '<tr><td colspan=2>Прибыль чистыми с автовыкупа:</td>'
		+ '<td><b><span id="cost_profit_part_1_fast">UNKNOWN</span></b></td>'
		+ '<td><b>(<span id="cost_profit_part_2_fast">UNKNOWN</span>)</b></td></tr>'
		
		+ '<tr><td colspan=2></td><td colspan=2><br></td></tr>'
		+ '<tr><td colspan=4 class="center"><b>ПЕРЕПРОДАЖА:</b></td></tr>'
		+ '<tr><td colspan=2 class="center">Обычная:</td><td colspan=2 class="center">Автовыкуп:</td></tr>'
		+ '<tr>'
			+ '<td class="center"><b><span id="resell_normal_part_1">UNKNOWN</span></b></td>'
			+ '<td class="center"><b><span id="resell_normal_part_2">UNKNOWN</span></b></td>'
			+ '<td class="center"><b><span id="resell_fast_part_1">UNKNOWN</span></b></td>'
			+ '<td class="center"><b><span id="resell_fast_part_2">UNKNOWN</span></b></td>'
		+ '</tr>'

		+ '</table>'
		+ ''
		+ ''
		+ ''
		+ ''
		+ ''
		+ '<br>'
		//+ '<iframe id="myframe" src="" width="100%" height="1000" align="left">Ваш браузер не поддерживает плавающие фреймы!</iframe><br>'
	+ '</div>');

	//-------------------------------------------------------------
	// Выполняем загрузку инфы с гистограммы ордеров.
	var infoDirect = getItemInfoByDirectQuery (itemObject['nameEnglish']);
	
	var average_price_sell	= infoDirect.sell_order_table_info.average_price
	var lowest_price_1		= infoDirect.sell_order_table_info.min_price;
	var average_price_buy	= infoDirect.buy_order_table_info.average_price;
	var best_price_buy		= infoDirect.buy_order_table_info.max_price

	// Вычисляем разброс цен.
	var diff_1 = (average_price_sell / lowest_price_1 * 100) - 100;
	var diff_2 = (best_price_buy / average_price_buy * 100) - 100;
	var diff_auto = (lowest_price_1 / best_price_buy * 100) - 100;


	document.getElementById ('lowest_price_1').innerHTML = lowest_price_1;
	document.getElementById ('lowest_price_1_real').innerHTML = (lowest_price_1 * 0.85).toFixed (2);
	document.getElementById ('average_price_sell').innerHTML = average_price_sell.toFixed (2);
	document.getElementById ('average_price_sell_real').innerHTML = (average_price_sell * 0.85).toFixed (2);

	document.getElementById ('average_price_buy').innerHTML = average_price_buy.toFixed (2);
	document.getElementById ('average_price_buy_real').innerHTML = (average_price_buy * 0.85).toFixed (2);
	document.getElementById ('best_price_buy').innerHTML = best_price_buy;
	document.getElementById ('best_price_buy_real').innerHTML = (best_price_buy * 0.85).toFixed (2);

	document.getElementById ('diff_1').innerHTML = diff_1.toFixed (2);
	document.getElementById ('diff_2').innerHTML = diff_2.toFixed (2);
	document.getElementById ('diff_auto').innerHTML = diff_auto.toFixed (2);


	// Отображаем оригинальное английское имя предмета.
	document.getElementById ('englishname').innerHTML = itemObject['nameEnglish'];
	
	// И ссылку на страницу торговой площадки стима с предметом.
	document.getElementById ('steamPageUrl').setAttribute ('href', 'http://steamcommunity.com/market/listings/730/' + encodeURIComponent (itemObject['nameEnglish']));
	
	// Ссылку на OPSKINS и BITSKINS
	document.getElementById ('opsUrl').setAttribute ('href', 'https://ru.opskins.com/?loc=shop_search&app=730_2&search_item=' + encodeURIComponent (itemObject['nameEnglish']) + '&sort=lh');
	document.getElementById ('bitskinsUrl').setAttribute ('href', 'https://bitskins.com/?market_hash_name=' + encodeURIComponent (itemObject['nameEnglish']) + '&sort_by=price&order=asc');
	
	

	//-------------------------------------------
	// Отображаем цену и количество имеющихся в продаже предметов (из поиска).
	document.getElementById ('volume_1').innerHTML = itemObject['quantity'];

	// Узнаем соотношение цен между стимом и магазином.
	document.getElementById ('cost_to_steam_diff').innerHTML = ((costShop / infoDirect.sell_order_table_info.min_price) * 100).toFixed (0) + "%";

	// Отображаем ROI - возврат затраченных денег.
	var roi			= getRoi (costShop, infoDirect.sell_order_table_info.min_price);
	var profitWhite	= getRealProfit (roi, costShop);
	document.getElementById ('cost_roi').innerHTML = roi.toFixed (0) + "%";
	document.getElementById ('cost_profit_part_1').innerHTML = (roi - 100).toFixed (0) + "%";
	document.getElementById ('cost_profit_part_2').innerHTML = profitWhite.toFixed (2) + " руб";

	// roi мгновенного выкупа.
	var roiFast			= getRoi (costShop, infoDirect.buy_order_table_info.max_price);
	var profitWhiteFast	= getRealProfit (roiFast, costShop);
	document.getElementById ('cost_profit_part_1_fast').innerHTML = (roiFast - 100).toFixed (0) + "%";
	document.getElementById ('cost_profit_part_2_fast').innerHTML = profitWhiteFast.toFixed (2) + " руб";


	// Изменяем цвета в зависимости от того, является ли сделка прибыльной.
	roi > 100 ? $ ('#cost_profit_part_1').css ({'color' : 'green'}) : $ ('#cost_profit_part_1').css ({'color' : 'red'});
	roiFast > 100 ? $ ('#cost_profit_part_1_fast').css ({'color' : 'green'}) : $ ('#cost_profit_part_1_fast').css ({'color' : 'red'});
	
	//--------------------
	// Перепродажа ключами.
	var resellInfoNormal	= getResellFromSomeSteamPrice (infoDirect.sell_order_table_info.min_price, costShop);
	var resellInfoFast		= getResellFromSomeSteamPrice (infoDirect.buy_order_table_info.max_price, costShop);
	document.getElementById ('resell_normal_part_1').innerHTML = resellInfoNormal.profitResellPercent;
	document.getElementById ('resell_normal_part_2').innerHTML = resellInfoNormal.profitResellMoney;
	document.getElementById ('resell_fast_part_1').innerHTML = resellInfoFast.profitResellPercent;
	document.getElementById ('resell_fast_part_2').innerHTML = resellInfoFast.profitResellMoney;
}

function getRoi (_shopPrice, _lowestPrice)
{
	return parseFloat ((parseFloat (_lowestPrice) * 0.85 / parseFloat (_shopPrice)) * 100);
}

function getRealProfit (_roi, _shopPrice)
{
	return parseFloat ((parseFloat (_roi) - 100) * parseFloat (_shopPrice) / 100);
}

function getColorPercentageProfitHtmlString (_shopPrice, _lowestPrice)
{
	var roi = getRoi (_shopPrice, _lowestPrice);
	var color = (roi > 100 ? 'green' : 'red');
	
	var html = '<span style="font-weight: bold; font-size: 17px; color: ' + color + ';">' + (roi - 100).toFixed (0) + "%" + '</span>';
	
	return html;
}

function getColorHtmlString (_number, _comparison, _displayInfo)
{
	var color = (parseFloat (_number) > parseFloat (_comparison) ? 'green' : 'red');
	return '<span style="font-weight: bold; color: ' + color + ';">' + _displayInfo + '</span>';
}

/**
 * Получить данные о перепродаже ключами для данной цены предмета на торговой площадке стима.
 * 
 * _steamMarketPrice - lowest_price или же fast_price.
 */
function getResellFromSomeSteamPrice (_steamMarketPrice, _shopPrice)
{
	// Деньги, которые я смогу вывести на wm.
	//var moneyOut = parseFloat (_steamMarketPrice) * (0.75 * 0.9 * 0.95);
	//var moneyOut = parseFloat (_steamMarketPrice) * (0.85 * 0.75 * 0.9);
	var moneyOut = parseFloat (_steamMarketPrice) * (0.15 * 0.75 * 0.9 * 0.95);// 0.75 от маркета - цена для покупателя на csgo.tm, 0.9 - комиссия при продаже, 0.95 - комиссия на вывод оттуда.
	var profitResellPercent	= (moneyOut / parseFloat (_shopPrice)) - 1;
	var profitResellMoney	= profitResellPercent * parseFloat (_shopPrice);

	return {
		'profitResellPercent'	: getColorHtmlString (profitResellPercent, 0, (profitResellPercent * 100).toFixed (2) + '%'),
		'profitResellMoney'		: (profitResellMoney).toFixed (2) + ' руб'
	};
}
