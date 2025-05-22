import puppeteer from 'puppeteer';
import fs from 'fs/promises';

// --- Конфигурация ---
const START_URL = 'https://www.mosigra.ru/nastolnye-igry/';
const OUTPUT_JSON_FILE = 'games_refined_v2.json';
const BASE_URL = 'https://www.mosigra.ru';
const MAX_CATALOG_PAGES_TO_SCRAPE = 2;
const MAX_PRODUCT_DETAILS_TO_SCRAPE = Infinity;
const DELAY_BETWEEN_REQUESTS = 1500;
const DELAY_VARIATION = 1000;

// --- Вспомогательные функции ---
function sleep(ms) {
	return new Promise((resolve) =>
		setTimeout(resolve, ms + Math.random() * DELAY_VARIATION)
	);
}

function normalizeText(text) {
	return text ? text.replace(/\s+/g, ' ').trim() : '';
}

function parsePriceInRubles(priceStr) {
	if (!priceStr) return null;
	const cleaned = priceStr.replace(/\s*₽/g, '').replace(/\s/g, '');
	const price = parseInt(cleaned, 10);
	return isNaN(price) ? null : price;
}

function parsePlayerCount(playerText) {
	if (!playerText) return { minPlayers: null, maxPlayers: null };
	playerText = normalizeText(playerText.toLowerCase());
	let min = null,
		max = null;
	const rangeMatch =
		playerText.match(/(\d+)\s*-\s*(\d+)/) ||
		playerText.match(/от\s*(\d+)\s*до\s*(\d+)/);
	if (rangeMatch) {
		min = parseInt(rangeMatch[1], 10);
		max = parseInt(rangeMatch[2], 10);
	} else {
		const singlePlusMatch = playerText.match(/(\d+)\+/);
		if (singlePlusMatch) {
			min = parseInt(singlePlusMatch[1], 10);
			max = 99;
		} else {
			const fromMatch = playerText.match(/от\s*(\d+)/);
			if (fromMatch) {
				min = parseInt(fromMatch[1], 10);
			} else {
				const singleDigitMatch = playerText.match(/^(\d+)$/);
				if (singleDigitMatch) {
					min = parseInt(singleDigitMatch[1], 10);
					max = min;
				}
			}
		}
	}
	return {
		minPlayers: isNaN(min) ? null : min,
		maxPlayers: isNaN(max) ? null : max,
	};
}

function parseAge(ageText) {
	if (!ageText) return null;
	const match =
		normalizeText(ageText).match(/(\d+)\+/) ||
		normalizeText(ageText).match(/от\s*(\d+)/);
	return match && match[1] ? parseInt(match[1], 10) : null;
}

function parsePlaytime(timeText) {
	if (!timeText) return { minPlaytime: null, maxPlaytime: null };
	timeText = normalizeText(timeText.toLowerCase());
	let min = null,
		max = null;
	const rangeMatch =
		timeText.match(/(\d+)\s*-\s*(\d+)/) ||
		timeText.match(/от\s*(\d+)\s*до\s*(\d+)/);
	if (rangeMatch) {
		min = parseInt(rangeMatch[1], 10);
		max = parseInt(rangeMatch[2], 10);
	} else {
		const plusMatch = timeText.match(/(\d+)\+/);
		if (plusMatch) {
			min = parseInt(plusMatch[1], 10);
		} else {
			const fromMatch = timeText.match(/от\s*(\d+)/);
			if (fromMatch) {
				min = parseInt(fromMatch[1], 10);
			}
		}
	}
	return {
		minPlaytime: isNaN(min) ? null : min,
		maxPlaytime: isNaN(max) ? null : max,
	};
}

// --- Функции Парсинга ---

async function scrapeProductSummariesFromCatalogPage(page, catalogPageUrl) {
	console.log(
		`   [Catalog] Scraping product summaries from: ${catalogPageUrl}`
	);
	await page.goto(catalogPageUrl, {
		waitUntil: 'domcontentloaded',
		timeout: 60000,
	});
	try {
		await page.waitForSelector('article.card', {
			visible: true,
			timeout: 30000,
		});
	} catch (e) {
		console.warn(
			`   [Catalog] No product cards found or timeout on: ${catalogPageUrl}.`
		);
		return [];
	}

	return page.evaluate((baseUrl) => {
		const results = [];
		document.querySelectorAll('article.card').forEach((card) => {
			const summary = {};
			summary.sourceProductId = card.getAttribute('data-product_id');
			summary.nameRu = card
				.querySelector('.card__title')
				?.textContent?.trim();

			const priceData = card.getAttribute('data-price');
			if (priceData) {
				const priceInt = parseInt(priceData, 10);
				if (!isNaN(priceInt)) {
					summary.priceRubFromCard = priceInt;
				}
			}

			const relativeUrl = card
				.querySelector('.card__title')
				?.getAttribute('href');
			if (relativeUrl) {
				try {
					summary.productPageUrl = new URL(relativeUrl, baseUrl).href;
				} catch (e) {
					console.warn(
						`   [Catalog] Invalid URL on card: ${relativeUrl}`
					);
				}
			}
			summary.thumbnailImageUrl = card
				.querySelector('.card__image img')
				?.getAttribute('src');
			summary.brandFromCard = card.getAttribute('data-brand');
			summary.categoryFromCard = card.getAttribute('data-category');
			summary.sku =
				card.getAttribute('data-upc') ||
				card.getAttribute('data-offer-id');

			if (
				summary.nameRu &&
				summary.productPageUrl &&
				summary.sourceProductId
			) {
				results.push(summary);
			}
		});
		return results;
	}, BASE_URL);
}

async function scrapeProductDetailsPage(page, productUrl) {
	console.log(`      [Details] Scraping details from: ${productUrl}`);
	try {
		await page.goto(productUrl, {
			waitUntil: 'domcontentloaded',
			timeout: 60000,
		});
		await page.waitForSelector('article.product__article header h1', {
			visible: true,
			timeout: 30000,
		});
	} catch (e) {
		console.error(
			`      [Details] Failed to load or find key element on product page: ${productUrl}`,
			e.message
		);
		return null;
	}

	return page.evaluate((url) => {
		const productDetails = {
			nameRu:
				document
					.querySelector('article.product__article header h1')
					?.textContent?.trim() || '',
			slugRu: '',
			descriptionRu: '',
			additionalImages: [],
			brand: undefined,
			playersRaw: undefined,
			ageRaw: undefined,
			playtimeRaw: undefined,
			countryOfOrigin: undefined,
			weight: undefined,
			allCategories: [],
			priceFromPageRub: null,
			sourceMeta: {
				sourceUrl: url,
				pageTitle: document.title,
				complectation: [],
			},
		};

		try {
			const path = new URL(url).pathname;
			const slugVal = path.split('/').filter(Boolean).pop();
			if (slugVal) productDetails.slugRu = slugVal;
		} catch (e) {
			console.log(`Failed to extract slug from URL: ${url}`);
		}

		const priceTextPage = document
			.querySelector('.buy-wrapper__big-text b.h1')
			?.textContent?.trim();
		if (priceTextPage) {
			const priceNum = parseInt(
				priceTextPage.replace(/\s*₽/g, '').replace(/\s/g, ''),
				10
			);
			if (!isNaN(priceNum)) {
				productDetails.priceFromPageRub = priceNum;
			}
		}

		document
			.querySelectorAll(
				'section.product-info__images ul#lightSlider li:not(.clone) a.lightGallery'
			)
			.forEach((el) => {
				const href = el.getAttribute('href');
				if (href)
					productDetails.additionalImages.push(
						href.startsWith('http')
							? href
							: new URL(href, document.baseURI).href
					);
			});
		if (productDetails.additionalImages.length === 0) {
			document
				.querySelectorAll(
					'section.product-info__images ul#lightSlider li:not(.clone) img[itemprop="image"]'
				)
				.forEach((img) => {
					const src = img.getAttribute('src');
					if (src)
						productDetails.additionalImages.push(
							src.startsWith('http')
								? src
								: new URL(src, document.baseURI).href
						);
				});
		}
		productDetails.additionalImages = [
			...new Set(productDetails.additionalImages),
		];

		const descriptionTab = document.querySelector('section#description');
		if (descriptionTab) {
			let descText = '';
			descriptionTab.querySelectorAll('p, ul > li').forEach((el) => {
				descText += el.textContent?.trim() + '\n\n';
			});
			productDetails.descriptionRu = descText
				.replace(/\n\n+/g, '\n\n')
				.trim();
			const complectationHeader = Array.from(
				descriptionTab.querySelectorAll('h3, h4')
			).find(
				(h) => h.textContent?.trim().toLowerCase() === 'комплектация'
			);
			if (complectationHeader) {
				const nextUl = complectationHeader.nextElementSibling;
				if (nextUl && nextUl.tagName === 'UL') {
					productDetails.sourceMeta.complectation = Array.from(
						nextUl.querySelectorAll('li')
					)
						.map((li) => li.textContent?.trim())
						.filter(Boolean);
				}
			}
		}

		document
			.querySelectorAll('section#attributes table tbody tr')
			.forEach((row) => {
				const keyEl = row.querySelector('td:first-child');
				const valueEl = row.querySelector('td:last-child');
				if (keyEl && valueEl) {
					const keyRaw =
						keyEl.textContent
							?.trim()
							.toLowerCase()
							.replace(':', '') || '';
					const valueRaw = valueEl.textContent?.trim() || '';

					if (keyRaw.includes('количество игроков'))
						productDetails.playersRaw = valueRaw;
					else if (keyRaw.includes('возраст игроков'))
						productDetails.ageRaw = valueRaw;
					else if (keyRaw.includes('время игры'))
						productDetails.playtimeRaw = valueRaw;
					else if (keyRaw.includes('производитель'))
						productDetails.brand =
							valueEl.querySelector('a')?.textContent?.trim() ||
							valueRaw;
					else if (keyRaw.includes('страна производства'))
						productDetails.countryOfOrigin = valueRaw;
					else if (keyRaw.includes('вес'))
						productDetails.weight = valueRaw;
				}
			});

		const paramsDiv = document.querySelector(
			'div.product__header-inner div.params'
		);
		if (paramsDiv) {
			const playersText = paramsDiv
				.querySelector('.players span')
				?.textContent?.trim();
			if (playersText && !productDetails.playersRaw)
				productDetails.playersRaw = playersText;
			const timeText = paramsDiv
				.querySelector('.time span')
				?.textContent?.trim();
			if (timeText && !productDetails.playtimeRaw)
				productDetails.playtimeRaw = timeText;
			const ageText = paramsDiv
				.querySelector('.age span')
				?.textContent?.trim();
			if (ageText && !productDetails.ageRaw)
				productDetails.ageRaw = ageText;
		}

		const categoryBlock = document.querySelector(
			'section.sidebar article.categories'
		);
		if (categoryBlock) {
			categoryBlock
				.querySelectorAll('a.categories__link')
				.forEach((link) => {
					const name = link.textContent?.trim();
					const relativeUrl = link.getAttribute('href');
					if (name && relativeUrl) {
						try {
							const url = new URL(relativeUrl, document.baseURI)
								.href;
							const categoryKey = relativeUrl
								.split('/')
								.filter(Boolean)
								.pop();
							if (categoryKey) {
								productDetails.allCategories.push({
									nameRu: name,
									key: categoryKey,
									sourceUrl: url,
								});
							}
						} catch (e) {
							console.error(e);
						}
					}
				});
		}
		document
			.querySelectorAll(
				'.breadcrumbs span[itemprop="itemListElement"] > a[itemprop="item"]'
			)
			.forEach((a) => {
				const name = a
					.querySelector('span[itemprop="name"]')
					?.textContent?.trim();
				const breadcrumbUrl = a.getAttribute('href');
				if (
					name &&
					breadcrumbUrl &&
					name.toLowerCase() !== 'главная' &&
					name.toLowerCase() !== 'каталог'
				) {
					try {
						const url = new URL(breadcrumbUrl, document.baseURI)
							.href;
						const key = breadcrumbUrl
							.split('/')
							.filter(Boolean)
							.pop();
						if (
							key &&
							!productDetails.allCategories.find(
								(c) => c.key === key
							)
						) {
							productDetails.allCategories.push({
								nameRu: name,
								key: key,
								sourceUrl: url,
							});
						}
					} catch (e) {
						console.error(e);
					}
				}
			});
		productDetails.allCategories = productDetails.allCategories.filter(
			(cat, index, self) =>
				index === self.findIndex((c) => c.key === cat.key)
		);

		return productDetails;
	}, productUrl);
}

(async () => {
	console.log('[Main] Launching browser...');
	const browser = await puppeteer.launch({ headless: 'new' });
	const page = await browser.newPage();
	await page.setUserAgent(
		'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
	);

	const allProductSummaries = [];
	let currentCatalogUrl = START_URL;
	let scrapedCatalogPageCount = 0;

	console.log('[Main] Starting catalog scrape...');
	while (
		currentCatalogUrl &&
		scrapedCatalogPageCount < MAX_CATALOG_PAGES_TO_SCRAPE
	) {
		scrapedCatalogPageCount++;
		const summaries = await scrapeProductSummariesFromCatalogPage(
			page,
			currentCatalogUrl
		);
		if (summaries.length > 0) allProductSummaries.push(...summaries);

		try {
			currentCatalogUrl = await page.evaluate(
				() =>
					document.querySelector('ul.pagination li a.next')?.href ||
					null
			);
			if (currentCatalogUrl) {
				console.log(`   [Catalog] Next page URL: ${currentCatalogUrl}`);
				await sleep(DELAY_BETWEEN_REQUESTS);
			} else console.log('   [Catalog] No next page link found.');
		} catch (e) {
			console.log(
				'   [Catalog] Pagination next link not found or timeout. Ending catalog scrape.'
			);
			currentCatalogUrl = null;
		}
	}
	console.log(
		`[Main] Finished catalog scrape. Total summaries: ${allProductSummaries.length}. Scraped pages: ${scrapedCatalogPageCount}.`
	);

	const finalProductsData = [];
	console.log('\n[Main] Starting product details scrape...');
	for (
		let i = 0;
		i < allProductSummaries.length && i < MAX_PRODUCT_DETAILS_TO_SCRAPE;
		i++
	) {
		const summary = allProductSummaries[i];
		console.log(
			`   [Details] Scraping (${i + 1}/${Math.min(
				allProductSummaries.length,
				MAX_PRODUCT_DETAILS_TO_SCRAPE
			)}): ${summary.nameRu || 'Unknown Name'}...`
		);
		if (summary.productPageUrl) {
			const detailsPageData = await scrapeProductDetailsPage(
				page,
				summary.productPageUrl
			);
			if (detailsPageData) {
				const { minPlayers, maxPlayers } = parsePlayerCount(
					detailsPageData.playersRaw
				);
				const ageRecommended = parseAge(detailsPageData.ageRaw);
				const { minPlaytime, maxPlaytime } = parsePlaytime(
					detailsPageData.playtimeRaw
				);

				const productEntry = {
					key: summary.sourceProductId,
					sku: summary.sku,
					name: {
						ru: detailsPageData.nameRu || summary.nameRu,
						en: '',
					},
					slug: {
						ru:
							detailsPageData.slugRu ||
							summary.productPageUrl
								.split('/')
								.filter(Boolean)
								.pop(),
						en: '',
					},
					description: {
						ru: detailsPageData.descriptionRu || '',
						en: '',
					},
					mainImageUrl: summary.thumbnailImageUrl,
					additionalImages: detailsPageData.additionalImages || [],
					price: {
						rub:
							detailsPageData.priceFromPageRub !== null
								? detailsPageData.priceFromPageRub
								: summary.priceRubFromCard,
						usd: null,
					},
					categories: detailsPageData.allCategories.map((cat) => ({
						name: { ru: cat.nameRu, en: '' },
						key: cat.key,
					})),
					brand: detailsPageData.brand || summary.brandFromCard,
					minPlayers: minPlayers,
					maxPlayers: maxPlayers,
					ageRecommended: ageRecommended,
					minPlaytime: minPlaytime,
					maxPlaytime: maxPlaytime,
					countryOfOrigin: detailsPageData.countryOfOrigin,
					weight: detailsPageData.weight,
					meta: {
						sourceUrl: summary.productPageUrl,
						sourceProductId: summary.sourceProductId,
						sourceComplectation:
							detailsPageData.sourceMeta.complectation,
					},
				};

				const topLevelAttributes = [
					'brand',
					'minPlayers',
					'maxPlayers',
					'ageRecommended',
					'minPlaytime',
					'maxPlaytime',
					'countryOfOrigin',
					'weight',
				];
				topLevelAttributes.forEach((key) => {
					if (
						productEntry[key] === null ||
						productEntry[key] === undefined
					) {
						delete productEntry[key];
					}
				});
				if (productEntry.categories.length === 0)
					delete productEntry.categories;
				if (productEntry.price.rub === null)
					delete productEntry.price.rub;
				if (Object.keys(productEntry.price).length === 0)
					delete productEntry.price;

				finalProductsData.push(productEntry);
			}
		}
		if (
			i <
			Math.min(
				allProductSummaries.length,
				MAX_PRODUCT_DETAILS_TO_SCRAPE
			) -
				1
		) {
			await sleep(DELAY_BETWEEN_REQUESTS);
		}
	}
	console.log(
		`\n[Main] Finished product details scrape. Products with details: ${finalProductsData.length}.`
	);

	try {
		await fs.writeFile(
			OUTPUT_JSON_FILE,
			JSON.stringify(finalProductsData, null, 2)
		);
		console.log(`[Main] Data successfully saved to ${OUTPUT_JSON_FILE}`);
	} catch (err) {
		console.error('[Main] Error writing file:', err);
	}

	await browser.close();
	console.log('[Main] Browser closed.');
})();
