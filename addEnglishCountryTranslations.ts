import {
	createApiBuilderFromCtpClient,
	type Product,
	type LocalizedString,
	type ProductUpdateAction,
	type ByProjectKeyRequestBuilder,
  } from '@commercetools/platform-sdk';
  import {
	ClientBuilder,
	type AuthMiddlewareOptions,
	type HttpMiddlewareOptions,
  } from '@commercetools/ts-client';
  import dotenv from 'dotenv';
  // import fetch from 'node-fetch';
  
  dotenv.config();
  
  // --- Конфигурация (УБРАН VITE_ ПРЕФИКС) ---
  const CTP_PROJECT_KEY = process.env.CTP_PROJECT_KEY;
  const CTP_CLIENT_ID = process.env.CTP_CLIENT_ID;
  const CTP_CLIENT_SECRET = process.env.CTP_CLIENT_SECRET;
  const CTP_API_URL = process.env.CTP_API_URL;
  const CTP_AUTH_URL = process.env.CTP_AUTH_URL;
  const CTP_SCOPES_STRING = process.env.CTP_SCOPES || `manage_products:${CTP_PROJECT_KEY}`;
  
  const ATTRIBUTE_NAME_COUNTRY = 'country-of-origin';
  
  // Маппинг переводов (Гонконг здесь не нужен, так как он будет заменен)
  const countryTranslations: Record<string, string> = {
	"Россия": "Russia",
	"Китай": "China", // Если "Китай" уже есть, он получит "China"
	"Бельгия": "Belgium",
	"Украина": "Ukraine",
	// "Гонконг" обрабатывается отдельно
	"Германия": "Germany",
  };
  
  const HONG_KONG_RU = "Гонконг";
  const CHINA_RU = "Китай";
  const CHINA_EN = "China";
  
  if (!CTP_PROJECT_KEY || !CTP_CLIENT_ID || !CTP_CLIENT_SECRET || !CTP_API_URL || !CTP_AUTH_URL || !CTP_SCOPES_STRING) {
	console.error('Ошибка: Не все переменные окружения CommerceTools определены в .env файле.');
	process.exit(1);
  }
  const CTP_SCOPES = CTP_SCOPES_STRING.split(' ');
  
  const authMiddlewareOptions: AuthMiddlewareOptions = {
	host: CTP_AUTH_URL, projectKey: CTP_PROJECT_KEY,
	credentials: { clientId: CTP_CLIENT_ID, clientSecret: CTP_CLIENT_SECRET },
	scopes: CTP_SCOPES, httpClient: fetch as any,
  };
  const httpMiddlewareOptions: HttpMiddlewareOptions = { host: CTP_API_URL, httpClient: fetch as any };
  
  const ctpClient = new ClientBuilder()
	.withClientCredentialsFlow(authMiddlewareOptions)
	.withHttpMiddleware(httpMiddlewareOptions)
	.build();
  
  const apiRoot: ByProjectKeyRequestBuilder = createApiBuilderFromCtpClient(ctpClient)
	.withProjectKey({ projectKey: CTP_PROJECT_KEY });
  
  function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  async function getAllProductsWithVersion(): Promise<Product[]> {
	const allProducts: Product[] = [];
	let lastId: string | undefined = undefined;
	let hasMore = true;
	const limit = 200; // Уменьшим лимит для полных продуктов
  
	console.log('Fetching all products (with version) to update country attribute...');
	while (hasMore) {
	  try {
		const response = await apiRoot
		  .products() // Получаем полные продукты
		  .get({
			queryArgs: {
			  limit,
			  withTotal: false,
			  sort: 'id asc',
			  ...(lastId && { where: `id > "${lastId}"` }),
			  // expand не нужен, так как атрибуты и так в masterData.current.masterVariant
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
		await sleep(300); // Задержка
	  } catch (error: unknown) {
		const e = error as { body?: { errors?: any[] }; message?: string };
		console.error('Error fetching products batch:', e.body?.errors || e.message || e);
		throw error;
	  }
	}
	console.log(`Total products fetched: ${allProducts.length}`);
	return allProducts;
  }
  
  /**
   * Обновляет атрибут 'country-of-origin' для продукта.
   * Если страна "Гонконг", меняет на "Китай" (ru) и "China" (en).
   * Для других стран добавляет английский перевод, если его нет.
   */
  async function updateProductCountryAttribute(product: Product): Promise<void> {
	if (!product.masterData?.current?.masterVariant?.attributes) {
	  console.warn(`   Product ${product.key || product.id}: No attributes found.`);
	  return;
	}
  
	const attributes = product.masterData.current.masterVariant.attributes;
	const countryAttribute = attributes.find(attr => attr.name === ATTRIBUTE_NAME_COUNTRY);
  
	if (!countryAttribute || typeof countryAttribute.value !== 'object' || countryAttribute.value === null) {
	  return;
	}
  
	const localizedValue = { ...(countryAttribute.value as LocalizedString) }; // Создаем копию для изменения
	let needsUpdate = false;
	let actionLog = "";
  
	const russianValue = localizedValue.ru;
  
	if (russianValue === HONG_KONG_RU) {
	  // Обработка Гонконга
	  if (localizedValue.ru !== CHINA_RU || localizedValue.en !== CHINA_EN) {
		localizedValue.ru = CHINA_RU;
		localizedValue.en = CHINA_EN;
		needsUpdate = true;
		actionLog = `Changing '${HONG_KONG_RU}' to RU:'${CHINA_RU}', EN:'${CHINA_EN}'`;
	  }
	} else if (russianValue && countryTranslations[russianValue]) {
	  // Обработка других стран из словаря
	  const englishValueFromDict = countryTranslations[russianValue];
	  if (localizedValue.en !== englishValueFromDict) { // Обновляем или добавляем, если отличается
		localizedValue.en = englishValueFromDict;
		needsUpdate = true;
		actionLog = `Adding/Updating EN:'${englishValueFromDict}' for RU:'${russianValue}'`;
	  }
	} else if (russianValue && !localizedValue.en) {
	  console.warn(`   Product ${product.key || product.id}: No EN translation in dictionary for RU value: "${russianValue}". Skipping.`);
	  return;
	}
  
	if (needsUpdate) {
	  const updateAction: ProductUpdateAction = {
		action: 'setAttribute',
		variantId: product.masterData.current.masterVariant.id,
		name: ATTRIBUTE_NAME_COUNTRY,
		value: localizedValue, // Передаем измененный объект LocalizedString
		staged: false,
	  };
	  
	  console.log(`   Product ${product.key || product.id}: Updating '${ATTRIBUTE_NAME_COUNTRY}'. ${actionLog}`);
  
	  try {
		await apiRoot
		  .products()
		  .withId({ ID: product.id })
		  .post({
			body: {
			  version: product.version,
			  actions: [updateAction],
			},
		  })
		  .execute();
		console.log(`   Product ${product.key || product.id}: Attribute '${ATTRIBUTE_NAME_COUNTRY}' updated successfully.`);
	  } catch (error: unknown) {
		const e = error as { body?: { errors?: any[] }; message?: string };
		console.error(`   Product ${product.key || product.id}: Failed to update attribute:`, e.body?.errors || e.message || e);
	  }
	} else {
	  // console.log(`   Product ${product.key || product.id}: Attribute '${ATTRIBUTE_NAME_COUNTRY}' requires no update.`);
	}
  }
  
  async function runCountryTranslationUpdate() {
	console.log('--- Starting Country Attribute Translation Script ---');
	try {
	  const products = await getAllProductsWithVersion(); // Получаем полные продукты
	  if (products.length === 0) {
		console.log('No products found to update.');
		return;
	  }
  
	  for (let i = 0; i < products.length; i++) {
		const product = products[i];
		const productName = product.masterData?.current?.name?.['ru'] || product.masterData?.current?.name?.['en'] || product.key || product.id;
		console.log(`\nProcessing product ${i + 1}/${products.length}: ${product.key || product.id} (${productName})`);
		await updateProductCountryAttribute(product);
		await sleep(350); // Немного увеличим задержку, так как это операция записи
	  }
	  console.log('\n--- Country Attribute Translation Script Finished ---');
	} catch (error) {
	  console.error('Critical error during country translation process:', error);
	}
  }
  
  runCountryTranslationUpdate();