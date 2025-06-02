import fs from 'fs/promises';
import { getStandardCategory } from './categoryDefinitions.js';

// В начале скрипта postprocessGames.js
import fetch from 'node-fetch'; // Если используешь node-fetch
import path from 'path';
import { fileURLToPath } from 'url'; // Для __dirname в ES Modules
import puppeteer from 'puppeteer'; // Puppeteer для headless браузера

// --- Новая Конфигурация ---
const DOWNLOAD_IMAGES_VIA_PUPPETEER = false;
const LOCAL_IMAGE_FOLDER = 'downloaded_images'; // Папка для скачанных изображений
const IMAGE_BASE_URL_ON_VDS = `http://pathix.ru/images/boardgames`; // Твой базовый URL на VDS
const DELAY_BETWEEN_IMAGE_DOWNLOADS = 0;
const MAX_PARALLEL_IMAGE_DOWNLOADS_PER_PRODUCT = 100;

// Для ES Modules, чтобы получить аналог __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_JSON_FILE = 'games_enriched_from_bgg.json';
const OUTPUT_PROCESSED_JSON_FILE = 'games_processed_for_ct_v5.json';
const OUTPUT_CSV_FILE = 'games_for_commercetools_v5.csv';

const localImagesBasePath = path.join(__dirname, LOCAL_IMAGE_FOLDER);

// ... (после вспомогательных функций parse...)

async function downloadImageIfNotExists(imageUrl, localFolderPath, fileName) {
	if (!DOWNLOAD_IMAGES) {
		// console.log(`   [Image] Skipping download for: ${fileName} (DOWNLOAD_IMAGES is false)`);
		return path.join(localFolderPath, fileName); // Возвращаем предполагаемый путь, даже если не скачивали
	}

	const fullLocalPath = path.join(localFolderPath, fileName);
	try {
		// Проверяем, существует ли файл
		await fs.access(fullLocalPath);
		console.log(`   [Image] Exists locally: ${fileName}`);
		return fullLocalPath;
	} catch (e) {
		// Файл не существует, скачиваем
		console.log(`   [Image] Downloading: ${imageUrl} as ${fileName}`);
		try {
			const response = await fetch(imageUrl, {
				headers: {
					'User-Agent':
						'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
					Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
					'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
					// 'Referer': BASE_URL, // Можно попробовать добавить Referer, но он должен быть релевантным
				},
			});
			if (!response.ok) {
				console.error(
					`   [Image] Failed to download ${imageUrl}: ${response.status} ${response.statusText}`
				);
				return null;
			}
			await fs.mkdir(localFolderPath, { recursive: true });
			const fileStream = fs.createWriteStream(fullLocalPath);
			await new Promise((resolve, reject) => {
				response.body.pipe(fileStream);
				response.body.on('error', reject);
				fileStream.on('finish', resolve);
			});
			console.log(`   [Image] Downloaded successfully: ${fileName}`);
			return fullLocalPath;
		} catch (downloadError) {
			console.error(
				`   [Image] Error downloading ${imageUrl}:`,
				downloadError
			);
			return null;
		}
	}
}

async function downloadImageWithPuppeteer(
	page,
	imageUrl,
	localFolderPath,
	fileName
) {
	if (!DOWNLOAD_IMAGES_VIA_PUPPETEER) {
		console.log(
			`   [Image] Skipping download for: ${fileName} (DOWNLOAD_IMAGES_VIA_PUPPETEER is false)`
		);
		// Возвращаем предполагаемый путь, даже если не скачивали, чтобы URL формировался правильно
		return path.join(localFolderPath, fileName);
	}

	const fullLocalPath = path.join(localFolderPath, fileName);

	try {
		await fs.access(fullLocalPath); // Проверяем, существует ли файл
		console.log(`   [ImagePuppeteer] Exists locally: ${fileName}`);
		return fullLocalPath;
	} catch (e) {
		// Файл не существует, скачиваем
		console.log(
			`   [ImagePuppeteer] Downloading: ${imageUrl} as ${fileName}`
		);
		let imagePage = null; // Инициализируем здесь для доступа в catch/finally
		try {
			imagePage = await page.browser().newPage();
			await imagePage.setUserAgent(await page.browser().userAgent()); // Используем тот же User-Agent
			// Можно добавить setExtraHTTPHeaders, если нужно (например, Referer)
			// await imagePage.setExtraHTTPHeaders({'Referer': 'https://www.mosigra.ru/'});

			const response = await imagePage.goto(imageUrl, {
				timeout: 60000,
				waitUntil: 'networkidle0',
			});

			if (!response || !response.ok()) {
				console.error(
					`   [ImagePuppeteer] Failed to navigate to image ${imageUrl}: Status ${response?.status()}`
				);
				if (imagePage) await imagePage.close();
				return null;
			}

			const imageBuffer = await response.buffer();
			if (imageBuffer.length === 0) {
				console.error(
					`   [ImagePuppeteer] Downloaded empty buffer for ${imageUrl}`
				);
				if (imagePage) await imagePage.close();
				return null;
			}

			await fs.mkdir(localFolderPath, { recursive: true });
			await fs.writeFile(fullLocalPath, imageBuffer);

			console.log(
				`   [ImagePuppeteer] Downloaded successfully: ${fileName}`
			);
			if (imagePage) await imagePage.close();
			return fullLocalPath;
		} catch (downloadError) {
			console.error(
				`   [ImagePuppeteer] Error downloading image ${imageUrl} via Puppeteer:`,
				downloadError
			);
			if (imagePage && !imagePage.isClosed()) {
				try {
					await imagePage.close();
				} catch (closeError) {
					/* игнорируем */
				}
			}
			return null;
		}
	}
}

async function main() {
	console.log(`Reading data from ${INPUT_JSON_FILE}...`);
	let rawProducts;
	try {
		const fileContent = await fs.readFile(INPUT_JSON_FILE, 'utf-8');
		rawProducts = JSON.parse(fileContent);
	} catch (error) {
		console.error(`Error reading or parsing ${INPUT_JSON_FILE}:`, error);
		return;
	}

	console.log(`Processing ${rawProducts.length} products...`);
	const processedProducts = [];
	let productCounter = 1;
	// Инициализация Puppeteer один раз для всего процесса скачивания изображений
	let browser = null;
	let pageForDownloading = null; // Основная страница для скачивания (будем открывать новые вкладки от нее)

	if (DOWNLOAD_IMAGES_VIA_PUPPETEER) {
		console.log(
			'[ImageDownloader] Launching browser for image downloads...'
		);
		browser = await puppeteer.launch({
			headless: false, // <--- БРАУЗЕР БУДЕТ ВИДИМЫМ
			// args: ['--no-sandbox', '--disable-setuid-sandbox'] // Может понадобиться на Linux
		});
		pageForDownloading = await browser.newPage();
		await pageForDownloading.setUserAgent(
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.81 Safari/537.36' // Более свежий User-Agent
		);
		console.log('[ImageDownloader] Browser launched.');
	}

	for (const rawProduct of rawProducts) {
		const nameRu = rawProduct.name?.ru || '';
		const nameEn = rawProduct.name?.en || '';
		const descriptionRu = rawProduct.description?.ru || '';
		const descriptionEn = rawProduct.description?.en || '';
		const publisherRu = rawProduct.brand.ru || '';
		const publisherEn = rawProduct.brand.en || '';
		const countryOfOriginRu =
			(rawProduct.countryOfOrigin.ru || '').split(',')[0] || '';
		const countryOfOriginEn =
			(rawProduct.countryOfOrigin.en || '').split(',')[0] || '';

		const generatedProductKey = String(productCounter).padStart(4, '0');
		const generatedVariantKey = `${generatedProductKey}-1`;
		const generatedSku = `${generatedProductKey}-1`;

		const attributesForCsv = {
			'players-min': rawProduct.minPlayers,
			'players-max': rawProduct.maxPlayers,
			'playing-time-min': rawProduct.minPlaytime,
			'playing-time-max': rawProduct.maxPlaytime,
			'age-recommended': rawProduct.ageRecommended,
			publisher: {
				ru: publisherRu,
				en: publisherEn,
			},
			'country-of-origin': {
				ru: countryOfOriginRu,
				en: countryOfOriginEn,
			},
			weight: parseFloat(rawProduct.weight),
			// 'language': { ru: 'ключ_языка_ru', en: 'ключ_языка_en' }, // Если бы заполняли
			// 'mechanics': 'ключ_механики1;ключ_механики2', // Для Set of Enum
		};

		const productSlugForImage =
			rawProduct.slug?.en || rawProduct.slug?.ru || generatedProductKey;

		const imagesToDownload = [];
		if (rawProduct.mainImageUrl) {
			const originalUrl = rawProduct.mainImageUrl;
			const imageName = `${productSlugForImage}-main.webp`;
			// await downloadImageIfNotExists(
			// 	originalUrl,
			// 	localImagesBasePath,
			// 	imageName
			// );
			// await downloadImageWithPuppeteer(
			// 	pageForDownloading,
			// 	originalUrl,
			// 	localImagesBasePath,
			// 	imageName
			// );
			// finalMainImageUrl = `${IMAGE_BASE_URL_ON_VDS}/${imageName}`;
			imagesToDownload.push({
				url: originalUrl,
				localPath: path.join(localImagesBasePath, imageName),
				// targetVdsUrl: originalUrl,
				targetVdsUrl: `${IMAGE_BASE_URL_ON_VDS}/${imageName}`,
				isMain: true,
			});
		}

		if (
			rawProduct.additionalImages &&
			rawProduct.additionalImages.length > 0
		) {
			for (let i = 0; i < rawProduct.additionalImages.length; i++) {
				const originalUrl = rawProduct.additionalImages[i];
				if (originalUrl) {
					const imageName = `${productSlugForImage}-${i + 1}.webp`;
					// await downloadImageIfNotExists(
					// 	originalUrl,
					// 	localImagesBasePath,
					// 	imageName
					// );
					// await downloadImageWithPuppeteer(
					// 	pageForDownloading,
					// 	originalUrl,
					// 	localImagesBasePath,
					// 	imageName
					// );
					// finalAdditionalImages.push(
					// 	`${IMAGE_BASE_URL_ON_VDS}/${imageName}`
					// );
					imagesToDownload.push({
						url: originalUrl,
						localPath: path.join(localImagesBasePath, imageName),
						// targetVdsUrl: originalUrl,
						targetVdsUrl: `${IMAGE_BASE_URL_ON_VDS}/${imageName}`,
						isMain: false,
					});
				}
			}
		}

		let finalMainImageUrl = '';
		const finalAdditionalImages = [];

		if (
			DOWNLOAD_IMAGES_VIA_PUPPETEER &&
			pageForDownloading &&
			imagesToDownload.length > 0
		) {
			console.log(
				`   [ImageBatch] Downloading ${imagesToDownload.length} images for ${productSlugForImage}...`
			);
			const downloadPromises = [];
			for (const imageInfo of imagesToDownload) {
				// Создаем промис для каждой загрузки
				const downloadPromise = downloadImageWithPuppeteer(
					pageForDownloading, // Передаем основную страницу (или инстанс браузера)
					imageInfo.url,
					localImagesBasePath, // Передаем только папку
					path.basename(imageInfo.localPath) // Передаем только имя файла
				)
					.then((downloadedPath) => {
						if (downloadedPath) {
							if (imageInfo.isMain) {
								finalMainImageUrl = imageInfo.targetVdsUrl;
							} else {
								finalAdditionalImages.push(
									imageInfo.targetVdsUrl
								);
							}
						}
					})
					.catch((err) => {
						// Ошибки уже логируются внутри downloadImageWithPuppeteer
						console.error(
							`   [ImageBatch] Error in promise for ${imageInfo.url}: ${err}`
						);
					});
				downloadPromises.push(downloadPromise);

				// Если достигли лимита параллельных загрузок, ждем их завершения
				if (
					downloadPromises.length >=
					MAX_PARALLEL_IMAGE_DOWNLOADS_PER_PRODUCT
				) {
					await Promise.all(downloadPromises);
					downloadPromises.length = 0; // Очищаем массив для следующей пачки
					// await sleep(DELAY_BETWEEN_IMAGE_DOWNLOADS); // Пауза между пачками
				}
			}
			// Ждем завершения оставшихся загрузок
			if (downloadPromises.length > 0) {
				await Promise.all(downloadPromises);
				// await sleep(DELAY_BETWEEN_IMAGE_DOWNLOADS);
			}
		} else if (!DOWNLOAD_IMAGES_VIA_PUPPETEER) {
			// Если скачивание отключено, просто формируем URL
			imagesToDownload.forEach((imageInfo) => {
				if (imageInfo.isMain) {
					finalMainImageUrl = imageInfo.targetVdsUrl;
				} else {
					finalAdditionalImages.push(imageInfo.targetVdsUrl);
				}
			});
		}

		const processed = {
			key: generatedProductKey,
			productTypeKey: 'board-game',
			name: { ru: nameRu, en: nameEn },
			slug: {
				ru: rawProduct.slug?.ru,
				en: rawProduct.slug?.en,
			},
			description: { ru: descriptionRu, en: descriptionEn },
			sku: generatedSku,
			mainCategoryKeyCt: null,
			categoryKeysCt: [],
			price: { rub: rawProduct.price?.rub },
			mainImageUrl: finalMainImageUrl,
			additionalImages: finalAdditionalImages,
			attributes: attributesForCsv,
			meta: rawProduct.meta,
			variantKey: generatedVariantKey,
		};

		const ctCategories = new Set();
		if (rawProduct.mainCategory?.key) {
			const stdMainCat = getStandardCategory(rawProduct.mainCategory.key);
			if (stdMainCat) {
				processed.mainCategoryKeyCt = stdMainCat.keyCt;
				ctCategories.add(stdMainCat.keyCt);
			} else
				console.warn(
					`   [Category] No standard mapping for main category key: ${rawProduct.mainCategory.key} (Product: ${nameRu})`
				);
		} else if (rawProduct.meta?.sourceCategoryFromCard) {
			/* ... фоллбэк ... */
		}

		if (rawProduct.categories && Array.isArray(rawProduct.categories)) {
			rawProduct.categories.forEach((cat) => {
				if (cat.key) {
					const stdCat = getStandardCategory(cat.key);
					if (stdCat) ctCategories.add(stdCat.keyCt);
					else
						console.warn(
							`   [Category] No standard mapping for category key: ${cat.key} (Product: ${nameRu})`
						);
				}
			});
		}
		processed.categoryKeysCt = Array.from(ctCategories);

		processedProducts.push(processed);
		productCounter++;
	}

	if (browser) {
		await browser.close();
		console.log('[ImageDownloader] Browser closed.');
	}

	await fs.writeFile(
		OUTPUT_PROCESSED_JSON_FILE,
		JSON.stringify(processedProducts, null, 2)
	);
	console.log(`Processed data saved to ${OUTPUT_PROCESSED_JSON_FILE}`);
	await generateCommerceToolsCSV(processedProducts, OUTPUT_CSV_FILE);
}

async function generateCommerceToolsCSV(products, filePath) {
	let csvContent = '';
	const baseHeaders = [
		'key',
		'productType.key',
		'productType.typeId',
		'name.ru',
		'name.en',
		'slug.ru',
		'slug.en',
		'description.ru',
		'description.en',
		'variants.key',
		'variants.sku',
		'taxCategory.key',
		'taxCategory.typeId',
		'categories',
	];

	const usedCtAttributeNames = new Set();
	products.forEach((p) => {
		if (p.attributes) {
			Object.keys(p.attributes).forEach((attrKey) =>
				usedCtAttributeNames.add(attrKey)
			);
		}
	});

	const attributeHeaders = [];
	usedCtAttributeNames.forEach((attrName) => {
		const firstProductAttr = products[0]?.attributes?.[attrName];
		if (
			typeof firstProductAttr === 'object' &&
			firstProductAttr !== null &&
			!Array.isArray(firstProductAttr)
		) {
			if ('ru' in firstProductAttr)
				attributeHeaders.push(`attributes.${attrName}.ru`);
			if ('en' in firstProductAttr)
				attributeHeaders.push(`attributes.${attrName}.en`);
		} else {
			attributeHeaders.push(`attributes.${attrName}`);
		}
	});

	const priceHeaders = [
		'variants.prices.key',
		'variants.prices.value.currencyCode',
		'variants.prices.value.centAmount',
		'variants.prices.value.type',
		'variants.prices.value.fractionDigits',
	];
	const imageHeaders = [
		'variants.images.url',
		'variants.images.label',
		'variants.images.dimensions.w',
		'variants.images.dimensions.h',
	];

	const finalHeaders = [
		...baseHeaders,
		...attributeHeaders,
		...priceHeaders,
		...imageHeaders,
	];
	csvContent += finalHeaders.join(',') + '\n';

	for (const product of products) {
		const row = [];
		row.push(product.key || '');
		row.push(product.productTypeKey || 'board-game');
		row.push('product-type');
		row.push(`"${(product.name?.ru || '').replace(/"/g, '""')}"`);
		row.push(`"${(product.name?.en || '').replace(/"/g, '""')}"`);
		row.push(`"${(product.slug?.ru || '').replace(/"/g, '""')}"`);
		row.push(`"${(product.slug?.en || '').replace(/"/g, '""')}"`);
		row.push(
			`"${(product.description?.ru || '')
				.replace(/\n/g, '\\n')
				.replace(/"/g, '""')}"`
		);
		row.push(
			`"${(product.description?.en || '')
				.replace(/\n/g, '\\n')
				.replace(/"/g, '""')}"`
		);
		row.push(`${product.variantKey || ''}`);
		row.push(product.sku || '');
		row.push('zero-tax');
		row.push('tax-category');
		row.push((product.categoryKeysCt || []).join(';'));

		usedCtAttributeNames.forEach((attrName) => {
			const attrValue = product.attributes?.[attrName];
			if (
				typeof attrValue === 'object' &&
				attrValue !== null &&
				!Array.isArray(attrValue)
			) {
				// Локализованный атрибут
				if ('ru' in attrValue)
					row.push(
						`"${String(attrValue.ru || '').replace(/"/g, '""')}"`
					);
				else if (attributeHeaders.includes(`attributes.${attrName}.ru`))
					row.push('');

				if ('en' in attrValue)
					row.push(
						`"${String(attrValue.en || '').replace(/"/g, '""')}"`
					);
				else if (attributeHeaders.includes(`attributes.${attrName}.en`))
					row.push('');
			} else {
				// Нелокализованный атрибут
				if (attrValue !== undefined && attrValue !== null) {
					row.push(`"${String(attrValue).replace(/"/g, '""')}"`);
				} else {
					row.push('');
				}
			}
		});

		// Цена (рубли)
		if (product.price?.rub !== undefined && product.price.rub !== null) {
			row.push(`${product.key || ''}-1`);
			row.push('RUB');
			row.push(product.price.rub * 100);
			row.push('centPrecision');
			row.push('2');
		} else {
			row.push('', '', '', '', '');
		}

		// Изображение
		if (product.mainImageUrl) {
			row.push(product.mainImageUrl);
			row.push(`"${(product.name?.ru || 'Image').replace(/"/g, '""')}"`);
			row.push('266');
			row.push('266');
		} else {
			row.push('', '');
		}

		csvContent += row.join(',') + '\n';

		if (product.additionalImages && product.additionalImages.length > 0) {
			product.additionalImages.forEach((imageUrl, index) => {
				if (!imageUrl) return;

				const imageRow = [];
				imageRow.push(product.key || '');
				imageRow.push('');
				imageRow.push('');
				imageRow.push('');
				imageRow.push('');
				imageRow.push('');
				imageRow.push('');
				imageRow.push('');
				imageRow.push('');

				imageRow.push(product.variantKey || '');
				imageRow.push(product.sku || '');

				imageRow.push('');
				imageRow.push('');
				imageRow.push('');
				imageRow.push('');
				imageRow.push('');

				usedCtAttributeNames.forEach(() => imageRow.push(''));
				priceHeaders.forEach(() => imageRow.push(''));

				imageRow.push(imageUrl);
				imageRow.push(
					`"${(product.name?.ru || `Image ${index + 1}`).replace(
						/"/g,
						'""'
					)}"`
				);
				imageRow.push('1024');
				imageRow.push('1024');

				csvContent += imageRow.join(',') + '\n';
			});
		}
	}

	try {
		await fs.writeFile(filePath, csvContent);
		console.log(`CSV data for CommerceTools saved to ${filePath}`);
	} catch (err) {
		console.error(`Error writing CSV file:`, err);
	}
}

main().catch(console.error);
