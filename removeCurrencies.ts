// removeOtherCurrencies.ts
import {
	createApiBuilderFromCtpClient,
	type Product,
	type ProductUpdateAction,
	type ByProjectKeyRequestBuilder,
	type Price, // Импортируем тип Price
} from '@commercetools/platform-sdk';
import { ClientBuilder, type AuthMiddlewareOptions, type HttpMiddlewareOptions } from '@commercetools/ts-client';
import dotenv from 'dotenv';
// import fetch from 'node-fetch'; // Для Node.js < 18
// Для Node.js 18+ fetch доступен глобально

dotenv.config();

// --- Конфигурация ---
const CTP_PROJECT_KEY = process.env.CTP_PROJECT_KEY;
const CTP_CLIENT_ID = process.env.CTP_CLIENT_ID;
const CTP_CLIENT_SECRET = process.env.CTP_CLIENT_SECRET;
const CTP_API_URL = process.env.CTP_API_URL;
const CTP_AUTH_URL = process.env.CTP_AUTH_URL;
const CTP_SCOPES_STRING = process.env.CTP_SCOPES;

const CURRENCIES_TO_REMOVE = ['RUB', 'USD']; // Валюты, которые нужно удалить
const CURRENCY_TO_KEEP = 'EUR'; // Валюта, которую нужно оставить (или массив, если их несколько)

// Проверка наличия переменных окружения
if (!CTP_PROJECT_KEY || !CTP_CLIENT_ID || !CTP_CLIENT_SECRET || !CTP_API_URL || !CTP_AUTH_URL || !CTP_SCOPES_STRING) {
	console.error('Ошибка: Не все переменные окружения CommerceTools определены в .env файле.');
	process.exit(1);
}
const CTP_SCOPES = CTP_SCOPES_STRING.split(' ');

// --- Настройка Клиента SDK ---
const authMiddlewareOptions: AuthMiddlewareOptions = {
	host: CTP_AUTH_URL,
	projectKey: CTP_PROJECT_KEY,
	credentials: { clientId: CTP_CLIENT_ID, clientSecret: CTP_CLIENT_SECRET },
	scopes: CTP_SCOPES,
	httpClient: fetch,
};
const httpMiddlewareOptions: HttpMiddlewareOptions = { host: CTP_API_URL, httpClient: fetch as any };

const ctpClient = new ClientBuilder()
	.withClientCredentialsFlow(authMiddlewareOptions)
	.withHttpMiddleware(httpMiddlewareOptions)
	// .withLoggerMiddleware()
	.build();

const apiRoot: ByProjectKeyRequestBuilder = createApiBuilderFromCtpClient(ctpClient).withProjectKey({
	projectKey: CTP_PROJECT_KEY,
});

// --- Вспомогательные функции ---
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getAllProducts(): Promise<Product[]> {
	const allProducts: Product[] = [];
	let lastId: string | undefined = undefined;
	let hasMore = true;
	const limit = 50; // Уменьшим лимит для более частых сохранений состояния, если продуктов много

	console.log('Fetching all products...');
	while (hasMore) {
		try {
			const response = await apiRoot
				.products()
				.get({
					queryArgs: {
						limit,
						withTotal: false,
						sort: 'id asc',
						...(lastId && { where: `id > "${lastId}"` }),
						// Нам нужны все цены всех вариантов, чтобы их проверить
						expand: [
							'masterData.current.masterVariant.prices[*]',
							'masterData.current.variants[*].prices[*]',
						],
					},
				})
				.execute();

			const products = response.body.results;
			if (products.length > 0) {
				allProducts.push(...products);
				lastId = products[products.length - 1].id;
				console.log(`Fetched ${products.length} products. Total fetched: ${allProducts.length}`);
				if (products.length < limit) {
					hasMore = false;
				}
			} else {
				hasMore = false;
			}
			await sleep(250); // Небольшая задержка между запросами
		} catch (error: any) {
			console.error('Error fetching products batch:', error?.body?.errors || error?.message || error);
			// Можно добавить логику повторных попыток или остановки скрипта
			throw error;
		}
	}
	console.log(`Total products fetched: ${allProducts.length}`);
	return allProducts;
}

/**
 * Удаляет цены в указанных валютах для продукта, оставляя цены в CURRENCY_TO_KEEP.
 */
async function removePricesForProduct(product: Product): Promise<void> {
	const updateActions: ProductUpdateAction[] = [];
	const variantsToUpdate = [
		product.masterData?.current?.masterVariant,
		...(product.masterData?.current?.variants || []),
	].filter((variant) => variant !== undefined && variant.prices && variant.prices.length > 0);

	if (variantsToUpdate.length === 0) {
		console.log(`   Product ${product.key || product.id}: No variants with prices found.`);
		return;
	}

	for (const variant of variantsToUpdate) {
		if (!variant || !variant.prices) continue;

		// Проверяем, есть ли цена в CURRENCY_TO_KEEP
		const hasKeptCurrencyPrice = variant.prices.some((p) => p.value.currencyCode === CURRENCY_TO_KEEP);

		if (!hasKeptCurrencyPrice) {
			console.warn(
				`   Product ${product.key || product.id}, Variant ${
					variant.id
				}: No price in ${CURRENCY_TO_KEEP} found. Skipping price removal for this variant to avoid leaving it without prices.`
			);
			continue; // Пропускаем этот вариант, чтобы не удалить все цены
		}

		// Собираем ID цен, которые нужно удалить
		const pricesToRemove = variant.prices.filter((price: Price) =>
			CURRENCIES_TO_REMOVE.includes(price.value.currencyCode)
		);

		if (pricesToRemove.length === 0) {
			console.log(
				`   Product ${product.key || product.id}, Variant ${
					variant.id
				}: No prices in [${CURRENCIES_TO_REMOVE.join(', ')}] to remove.`
			);
			continue;
		}

		for (const price of pricesToRemove) {
			console.log(
				`   Product ${product.key || product.id}, Variant ${variant.id}: Marking price ID ${price.id} (${
					price.value.currencyCode
				}) for removal.`
			);
			updateActions.push({
				action: 'removePrice',
				priceId: price.id,
				staged: false, // Применяем сразу к current данным
			});
		}
	}

	if (updateActions.length > 0) {
		try {
			console.log(
				`   Product ${product.key || product.id}: Attempting to remove ${updateActions.length} prices...`
			);
			await apiRoot
				.products()
				.withId({ ID: product.id })
				.post({
					body: { version: product.version, actions: updateActions },
				})
				.execute();
			console.log(`   Product ${product.key || product.id}: Prices removed successfully.`);
		} catch (error: any) {
			console.error(
				`   Product ${product.key || product.id}: Failed to remove prices:`,
				error?.body?.errors || error?.message || error
			);
			// Можно добавить логику для сохранения ID продуктов, где произошла ошибка, для повторной обработки
		}
	} else {
		console.log(`   Product ${product.key || product.id}: No prices to remove after checks.`);
	}
}

// --- Основной скрипт ---
async function runPriceRemoval() {
	console.log('--- Starting Price Removal Script ---');
	console.log(
		`Attempting to REMOVE prices in [${CURRENCIES_TO_REMOVE.join(', ')}] and KEEP prices in [${CURRENCY_TO_KEEP}]`
	);

	// Дополнительное подтверждение, чтобы случайно не запустить
	const readline = await import('readline');
	const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

	const question = (query: string): Promise<string> => new Promise((resolve) => rl.question(query, resolve));
	const answer = await question(
		`ARE YOU SURE you want to proceed with removing prices? This is IRREVERSIBLE without a backup. (yes/no): `
	);

	if (answer.toLowerCase() !== 'yes') {
		console.log('Price removal cancelled by user.');
		rl.close();
		return;
	}
	rl.close();

	try {
		const products = await getAllProducts();
		if (products.length === 0) {
			console.log('No products found.');
			return;
		}

		for (let i = 0; i < products.length; i++) {
			const product = products[i];
			const productName =
				product.masterData?.current?.name?.['ru'] ||
				product.masterData?.current?.name?.['en'] ||
				product.key ||
				product.id;
			console.log(`\nProcessing product ${i + 1}/${products.length}: ${productName} (ID: ${product.id})`);
			await removePricesForProduct(product);
			await sleep(300); // Задержка между обновлениями продуктов
		}
		console.log('\n--- Price Removal Script Finished ---');
	} catch (error) {
		console.error('Critical error during price removal process:', error);
	}
}

runPriceRemoval();
