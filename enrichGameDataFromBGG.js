import fs from 'fs/promises';
import puppeteer from 'puppeteer'; // Puppeteer нам здесь не нужен, будем использовать fetch/axios
import { RateLimiter } from 'limiter'; // Для контроля частоты запросов
import { parseStringPromise as parseXmlString } from 'xml2js'; // Для парсинга XML
import he from 'he';

// --- Конфигурация ---
const INPUT_JSON_FILE = 'games3.json'; // Твой файл от предыдущего скрипта
const OUTPUT_ENRICHED_JSON_FILE = 'games_enriched_from_bgg.json';
const LOG_FILE = 'bgg_enrichment_log.txt';

const BGG_API_SEARCH_URL = 'https://boardgamegeek.com/xmlapi/search?search=';
const BGG_API_THING_URL = 'https://boardgamegeek.com/xmlapi/boardgame/'; // В доках /boardgame/, а не /thing/ для игр

// Ограничитель запросов: 1 запрос каждые 6 секунд (чуть больше 5 для надежности)
const limiter = new RateLimiter({ tokensPerInterval: 1, interval: 5000 });

let logStream;

// --- Вспомогательные функции ---
async function appendToLog(message) {
	const timestamp = new Date().toISOString();
	const logMessage = `[${timestamp}] ${message}\n`;
	process.stdout.write(logMessage); // Вывод в консоль
	if (logStream) {
		await logStream.write(logMessage);
	}
}

async function fetchAndParseXml(url) {
	await limiter.removeTokens(1); // Ждем разрешения от лимитера
	appendToLog(`Fetching: ${url}`);
	try {
		const response = await fetch(url, {
			headers: {
				'User-Agent':
					'MyBoardGameImporter/1.0 (Node.js script; +yourcontactinfo)', // Хорошая практика - представляться
			},
		});
		if (!response.ok) {
			appendToLog(
				`Error fetching ${url}: ${response.status} ${response.statusText}`
			);
			// BGG может вернуть 202, если запрос в очереди, нужно будет обрабатывать это отдельно
			if (response.status === 202) {
				appendToLog(
					`Request for ${url} queued by BGG. Retrying in 15s...`
				);
				await new Promise((resolve) => setTimeout(resolve, 15000));
				return fetchAndParseXml(url); // Повторная попытка
			}
			return null;
		}
		const xmlText = await response.text();
		return await parseXmlString(xmlText, {
			explicitArray: false,
			trim: true,
		});
	} catch (error) {
		appendToLog(
			`Exception during fetch/parse for ${url}: ${error.message}`
		);
		return null;
	}
}

// --- Основные функции BGG ---

async function searchGameOnBGG(gameNameRu) {
	const searchQuery = encodeURIComponent(gameNameRu);
	const searchUrl = `${BGG_API_SEARCH_URL}${searchQuery}`;
	const searchResult = await fetchAndParseXml(searchUrl);

	if (
		searchResult &&
		searchResult.boardgames &&
		searchResult.boardgames.boardgame
	) {
		const games = Array.isArray(searchResult.boardgames.boardgame)
			? searchResult.boardgames.boardgame
			: [searchResult.boardgames.boardgame]; // Если только одна игра найдена, она не будет в массиве

		if (games.length > 0) {
			// Пытаемся найти наиболее точное совпадение или первое с primary="true"
			// Сначала ищем с primary="true" и русским названием
			let foundGame = games.find(
				(game) =>
					game.name &&
					game.name.$ &&
					game.name.$?.primary === 'true' &&
					game.name._ === gameNameRu
			);
			if (foundGame) {
				appendToLog(
					`   [BGG Search] Exact primary match found for "${gameNameRu}": ID ${foundGame.$.objectid}`
				);
				return foundGame.$.objectid;
			}

			// Затем ищем первое с primary="true"
			foundGame = games.find(
				(game) =>
					game.name && game.name.$ && game.name.$?.primary === 'true'
			);
			if (foundGame) {
				appendToLog(
					`   [BGG Search] First primary match for "${gameNameRu}": ID ${foundGame.$.objectid} (Name: ${foundGame.name._})`
				);
				return foundGame.$.objectid;
			}

			// Если нет primary, берем первое в списке
			appendToLog(
				`   [BGG Search] No primary match for "${gameNameRu}". Taking first result: ID ${games[0].$.objectid} (Name: ${games[0].name._})`
			);
			return games[0].$.objectid;
		}
	}
	appendToLog(`   [BGG Search] No results found for "${gameNameRu}"`);
	return null;
}

async function getGameDetailsFromBGG(objectId) {
	if (!objectId) return null;
	const detailsUrl = `${BGG_API_THING_URL}${objectId}`;
	const detailsResult = await fetchAndParseXml(detailsUrl);

	if (
		detailsResult &&
		detailsResult.boardgames &&
		detailsResult.boardgames.boardgame
	) {
		// API может вернуть массив, даже если запрошен один ID, или объект, если только один результат
		const gameData = Array.isArray(detailsResult.boardgames.boardgame)
			? detailsResult.boardgames.boardgame[0]
			: detailsResult.boardgames.boardgame;
		return gameData;
	}
	appendToLog(`   [BGG Details] No details found for ID ${objectId}`);
	return null;
}

function extractEnglishDataFromBGG(bggGameData, originalNameRu) {
	if (!bggGameData)
		return { nameEn: '', descriptionEn: '', yearPublished: null };

	let nameEn = '';
	let descriptionEn = '';
	const yearPublished = bggGameData.yearpublished || null;

	// Извлечение имени
	if (Array.isArray(bggGameData.name)) {
		// Ищем английское имя или primary, которое не совпадает с русским
		const primaryNameEntry = bggGameData.name.find(
			(n) => n.$ && n.$?.primary === 'true'
		);
		if (primaryNameEntry) {
			// Если primary имя содержит и русское и английское в скобках
			const nameText = primaryNameEntry._;
			const match = nameText.match(/\(([^)]+)\)/); // Ищем текст в скобках
			if (match && match[1] && !/[\u0400-\u04FF]/.test(match[1])) {
				// Если в скобках не кириллица
				nameEn = match[1].trim();
			} else if (
				!nameText.includes(originalNameRu) &&
				!/[\u0400-\u04FF]/.test(nameText)
			) {
				// Если primary имя не содержит оригинальное русское и не кириллица
				nameEn = nameText.trim();
			} else if (match && match[1] && nameEn === '') {
				// Если все еще пусто, но есть что-то в скобках
				nameEn = match[1].trim(); // Берем из скобок, даже если может быть не идеально
			}
		}
		// Если не нашли в primary, ищем просто английское имя
		if (!nameEn) {
			const englishNameEntry = bggGameData.name.find(
				(n) =>
					n._ &&
					!/[\u0400-\u04FF]/.test(n._) &&
					n._.toLowerCase() !== originalNameRu.toLowerCase()
			);
			if (englishNameEntry) {
				nameEn = englishNameEntry._.trim();
			}
		}
	} else if (bggGameData.name && bggGameData.name._) {
		// Если имя одно
		const nameText = bggGameData.name._;
		const match = nameText.match(/\(([^)]+)\)/);
		if (
			match &&
			match[1] &&
			!/[\u00C0-\u017F\u0400-\u04FF]/.test(match[1])
		) {
			// Проверяем на не кириллицу и не акцентированные латинские
			nameEn = match[1].trim();
		} else if (
			!nameText.includes(originalNameRu) &&
			!/[\u00C0-\u017F\u0400-\u04FF]/.test(nameText)
		) {
			nameEn = nameText.trim();
		}
	}

	// Описание
	if (bggGameData.description) {
		descriptionEn = bggGameData.description.replace(/<br\s*\/?>/gi, '\n');
		descriptionEn = he.decode(descriptionEn);
		descriptionEn = descriptionEn.trim();
	}

	return { nameEn: nameEn || '', descriptionEn, yearPublished };
}

function generateCleanSlug(text) {
	if (!text || typeof text !== 'string') return '';
	// Для простоты и предсказуемости используем базовую логику,
	// можно заменить на slugify, если он установлен и настроен
	let slug = text.toLowerCase();

	// Простая транслитерация для русского в латиницу (можно улучшить или использовать библиотеку)
	const rusToLatMap = {
		а: 'a',
		б: 'b',
		в: 'v',
		г: 'g',
		д: 'd',
		е: 'e',
		ё: 'yo',
		ж: 'zh',
		з: 'z',
		и: 'i',
		й: 'j',
		к: 'k',
		л: 'l',
		м: 'm',
		н: 'n',
		о: 'o',
		п: 'p',
		р: 'r',
		с: 's',
		т: 't',
		у: 'u',
		ф: 'f',
		х: 'h',
		ц: 'c',
		ч: 'ch',
		ш: 'sh',
		щ: 'shch',
		ъ: '',
		ы: 'y',
		ь: '',
		э: 'e',
		ю: 'yu',
		я: 'ya',
	};
	slug = slug
		.split('')
		.map((char) => rusToLatMap[char] || char)
		.join('');

	return slug
		.replace(/\s+/g, '-') // Заменяем пробелы на дефисы
		.replace(/[^a-z0-9-]/g, '') // Удаляем все не-латинские буквы, не цифры и не дефисы
		.replace(/-+/g, '-') // Убираем двойные дефисы
		.replace(/^-+|-+$/g, ''); // Убираем дефисы в начале и конце
}

// --- Основной скрипт ---
async function processProducts() {
	logStream = await fs.open(LOG_FILE, 'a'); // Открываем лог-файл для дозаписи
	appendToLog('--- Starting BGG Data Enrichment Script ---');

	let rawProducts;
	try {
		const fileContent = await fs.readFile(INPUT_JSON_FILE, 'utf-8');
		rawProducts = JSON.parse(fileContent);
	} catch (error) {
		appendToLog(
			`Error reading or parsing ${INPUT_JSON_FILE}: ${error.message}`
		);
		if (logStream) await logStream.close();
		return;
	}

	const totalProducts = rawProducts.length;
	appendToLog(`Loaded ${totalProducts} products from ${INPUT_JSON_FILE}.`);

	const enrichedProducts = [];
	let foundOnBggCount = 0;
	let notFoundOnBgg = [];

	for (let i = 0; i < totalProducts; i++) {
		const product = rawProducts[i];
		const nameRu = product.name?.ru;
		appendToLog(
			`\nProcessing product ${
				i + 1
			}/${totalProducts}: "${nameRu}" (Key: ${product.key})`
		);

		let bggData = { nameEn: '', descriptionEn: '', yearPublished: null };

		if (nameRu) {
			const bggObjectId = await searchGameOnBGG(nameRu);
			if (bggObjectId) {
				const bggGameDetails = await getGameDetailsFromBGG(bggObjectId);
				if (bggGameDetails) {
					bggData = extractEnglishDataFromBGG(bggGameDetails, nameRu);
					foundOnBggCount++;
					appendToLog(
						`   [BGG Data] Extracted - EN Name: "${bggData.nameEn}", Year: ${bggData.yearPublished}`
					);
				} else {
					appendToLog(
						`   [BGG Data] Could not retrieve details for ID ${bggObjectId}`
					);
					notFoundOnBgg.push({
						nameRu,
						reason: `Details not found for ID ${bggObjectId}`,
					});
				}
			} else {
				appendToLog(
					`   [BGG Data] Not found on BGG by name: "${nameRu}"`
				);
				notFoundOnBgg.push({
					nameRu,
					reason: 'Not found by BGG search',
				});
			}
		} else {
			appendToLog(
				`   [BGG Data] Skipping BGG search for product without Russian name (Key: ${product.key})`
			);
			notFoundOnBgg.push({
				nameRu: 'N/A',
				key: product.key,
				reason: 'Missing Russian name in source JSON',
			});
		}

		// Обновляем поля в объекте продукта
		product.name.en = bggData.nameEn || product.name.en; // Оставляем старое, если BGG не дал лучшего
		product.description.en =
			bggData.descriptionEn || product.description.en;
		if (bggData.yearPublished && !product.yearPublished) {
			// Добавляем, если у нас не было
			product.yearPublished = bggData.yearPublished;
		}
		// Slug для английского лучше генерировать из name.en
		product.slug.en = generateCleanSlug(product.name.en || nameRu);

		enrichedProducts.push(product);
	}

	appendToLog(`\n--- Enrichment Summary ---`);
	appendToLog(`Total products processed: ${totalProducts}`);
	appendToLog(
		`Successfully found and enriched from BGG: ${foundOnBggCount} (${(
			(foundOnBggCount / totalProducts) *
			100
		).toFixed(2)}%)`
	);
	appendToLog(`Could not find/enrich from BGG: ${notFoundOnBgg.length}`);
	if (notFoundOnBgg.length > 0) {
		appendToLog('Games not found/enriched on BGG:');
		notFoundOnBgg.forEach((item) =>
			appendToLog(
				`  - "${item.nameRu || `Key: ${item.key}`}" (Reason: ${
					item.reason
				})`
			)
		);
	}

	try {
		await fs.writeFile(
			OUTPUT_ENRICHED_JSON_FILE,
			JSON.stringify(enrichedProducts, null, 2)
		);
		appendToLog(`Enriched data saved to ${OUTPUT_ENRICHED_JSON_FILE}`);
	} catch (err) {
		appendToLog(`Error writing enriched JSON file: ${err.message}`);
	}

	if (logStream) await logStream.close();
	console.log('--- BGG Data Enrichment Script Finished ---');
}

// Запускаем главный процесс
processProducts().catch(async (err) => {
	await appendToLog(`Unhandled error in main process: ${err.message}`);
	if (logStream) await logStream.close();
});
