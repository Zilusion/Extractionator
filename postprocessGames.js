import fs from 'fs/promises';
import {
	allSubCategoryMaps,
	getStandardCategory,
} from './categoryDefinitions.js';

const INPUT_JSON_FILE = 'games3.json';
const OUTPUT_PROCESSED_JSON_FILE = 'games_processed_for_ct_v4.json';
const OUTPUT_CSV_FILE = 'games_for_commercetools_v4.csv';

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

	for (const rawProduct of rawProducts) {
		const nameRu = rawProduct.name?.ru || '';
		const nameEn = rawProduct.name?.en || '';
		const descriptionRu = rawProduct.description?.ru || '';
		const descriptionEn = rawProduct.description?.en || '';
		const publisherRu = rawProduct.brand.ru || '';
		const publisherEn = rawProduct.brand.en || '';
		const countryOfOriginRu = (rawProduct.countryOfOrigin.ru || '').split(',')[0] || '';
		const countryOfOriginEn = (rawProduct.countryOfOrigin.en || '').split(',')[0] || '';

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

		const processed = {
			key: rawProduct.key,
			productTypeKey: 'board-game',
			name: { ru: nameRu, en: nameEn },
			slug: {
				ru: rawProduct.slug?.ru,
				en: rawProduct.slug?.en,
			},
			description: { ru: descriptionRu, en: descriptionEn },
			sku: rawProduct.sku,
			mainCategoryKeyCt: null,
			categoryKeysCt: [],
			price: { rub: rawProduct.price?.rub },
			mainImageUrl: rawProduct.mainImageUrl,
			additionalImages: rawProduct.additionalImages || [],
			attributes: attributesForCsv,
			meta: rawProduct.meta,
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

		if (!processed.mainCategoryKeyCt) delete processed.mainCategoryKeyCt;
		if (processed.categoryKeysCt.length === 0)
			delete processed.categoryKeysCt;
		if (processed.price.rub === null || processed.price.rub === undefined)
			delete processed.price.rub;
		if (Object.keys(processed.price).length === 0) delete processed.price;
		if (Object.keys(processed.attributes).length === 0)
			delete processed.attributes;

		processedProducts.push(processed);
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
		row.push(`${product.key || ''}`);
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
			row.push(`${product.key || ''}-price-rub`);
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
	}

	try {
		await fs.writeFile(filePath, csvContent);
		console.log(`CSV data for CommerceTools saved to ${filePath}`);
	} catch (err) {
		console.error(`Error writing CSV file:`, err);
	}
}

main().catch(console.error);
