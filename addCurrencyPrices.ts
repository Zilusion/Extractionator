// addCurrencyPrices.ts
import { createApiBuilderFromCtpClient, type Product, type PriceDraft, type ProductUpdateAction, type ByProjectKeyRequestBuilder } from '@commercetools/platform-sdk';
import { ClientBuilder, type AuthMiddlewareOptions, type HttpMiddlewareOptions } from '@commercetools/ts-client';
import dotenv from 'dotenv';
// import fetch from 'node-fetch'; // Используем node-fetch, так как глобальный fetch может требовать доп. настроек в старых Node

// Загружаем переменные окружения из .env файла
dotenv.config();

// --- Конфигурация ---
const CTP_PROJECT_KEY = process.env.CTP_PROJECT_KEY;
const CTP_CLIENT_ID = process.env.CTP_CLIENT_ID;
const CTP_CLIENT_SECRET = process.env.CTP_CLIENT_SECRET;
const CTP_API_URL = process.env.CTP_API_URL;
const CTP_AUTH_URL = process.env.CTP_AUTH_URL;
const CTP_SCOPES_STRING = process.env.CTP_SCOPES; // Например: "manage_products:your-project-key"

// Курсы валют (ОБНОВИ ИХ НА АКТУАЛЬНЫЕ!)
const RUB_TO_USD_RATE = 0.01256; // Пример: 1 RUB = 0.011 USD
const RUB_TO_EUR_RATE = 0.011001; // Пример: 1 RUB = 0.010 EUR

const TARGET_CURRENCIES = ['USD', 'EUR'];
const SOURCE_CURRENCY = 'RUB';

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
  // .withLoggerMiddleware() // Раскомментируй для отладки
  .build();

// Типизируем apiRoot явно
const apiRoot: ByProjectKeyRequestBuilder = createApiBuilderFromCtpClient(ctpClient)
    .withProjectKey({ projectKey: CTP_PROJECT_KEY });

// --- Вспомогательные функции ---
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Получает все продукты с пагинацией.
 */
async function getAllProducts(): Promise<Product[]> {
  const allProducts: Product[] = [];
  let lastId: string | undefined = undefined;
  let hasMore = true;
  const limit = 100; 

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
            expand: ['masterData.current.masterVariant.prices[*]'],
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
      await sleep(200);
    } catch (error: any) { // Используем any или unknown с проверкой типа
      console.error('Error fetching products batch:', error?.body?.errors || error?.message || error);
      throw error;
    }
  }
  console.log(`Total products fetched: ${allProducts.length}`);
  return allProducts;
}

/**
 * Добавляет или обновляет цены в USD и EUR для продукта на основе цены в RUB.
 */
async function updateProductPrices(product: Product): Promise<void> {
  if (!product.masterData?.current?.masterVariant) {
    console.warn(`   Product ${product.key || product.id}: No masterData.current.masterVariant found.`);
    return;
  }
  const masterVariant = product.masterData.current.masterVariant;

  if (!masterVariant.prices || masterVariant.prices.length === 0) {
    console.warn(`   Product ${product.key || product.id}: No prices found for master variant.`);
    return;
  }

  const rubPriceObject = masterVariant.prices.find(p => p.value.currencyCode === SOURCE_CURRENCY);
  if (!rubPriceObject) {
    console.warn(`   Product ${product.key || product.id}: No RUB price found to convert from.`);
    return;
  }

  const rubAmount = rubPriceObject.value.centAmount / 100;
  const updateActions: ProductUpdateAction[] = [];

  for (const targetCurrency of TARGET_CURRENCIES) {
    let newCentAmount: number;
    let rate: number;

    if (targetCurrency === 'USD') {
      rate = RUB_TO_USD_RATE;
      newCentAmount = Math.round(rubAmount * rate * 100);
    } else if (targetCurrency === 'EUR') {
      rate = RUB_TO_EUR_RATE;
      newCentAmount = Math.round(rubAmount * rate * 100);
    } else {
      continue;
    }

    if (newCentAmount <= 0) {
        console.warn(`   Product ${product.key || product.id}: Calculated ${targetCurrency} price is zero or negative, skipping.`);
        continue;
    }
    
    const existingTargetPrice = masterVariant.prices.find(
      p => p.value.currencyCode === targetCurrency &&
           p.country === rubPriceObject.country &&
           p.channel?.id === rubPriceObject.channel?.id &&
           p.customerGroup?.id === rubPriceObject.customerGroup?.id
    );

    const priceDraft: PriceDraft = {
      value: { currencyCode: targetCurrency, centAmount: newCentAmount },
      country: rubPriceObject.country,
      channel: rubPriceObject.channel ? { typeId: 'channel', id: rubPriceObject.channel.id } : undefined,
      customerGroup: rubPriceObject.customerGroup ? { typeId: 'customer-group', id: rubPriceObject.customerGroup.id } : undefined,
    };

    if (existingTargetPrice) {
      if (existingTargetPrice.value.centAmount !== newCentAmount) {
        console.log(`   Product ${product.key || product.id}: Updating existing ${targetCurrency} price from ${existingTargetPrice.value.centAmount / 100} to ${newCentAmount / 100}`);
        updateActions.push({
          action: 'changePrice',
          priceId: existingTargetPrice.id,
          price: priceDraft,
          staged: false,
        });
      } else {
        console.log(`   Product ${product.key || product.id}: Existing ${targetCurrency} price is already correct.`);
      }
    } else {
      console.log(`   Product ${product.key || product.id}: Adding new ${targetCurrency} price: ${newCentAmount / 100}`);
      updateActions.push({
        action: 'addPrice',
        variantId: masterVariant.id,
        price: priceDraft,
        staged: false,
      });
    }
  }

  if (updateActions.length > 0) {
    try {
      await apiRoot
        .products()
        .withId({ ID: product.id })
        .post({
          body: { version: product.version, actions: updateActions },
        })
        .execute();
      console.log(`   Product ${product.key || product.id}: Prices updated successfully.`);
    } catch (error: any) { // Используем any или unknown с проверкой типа
      console.error(`   Product ${product.key || product.id}: Failed to update prices:`, error?.body?.errors || error?.message || error);
    }
  } else {
    console.log(`   Product ${product.key || product.id}: No price updates needed.`);
  }
}

// --- Основной скрипт ---
async function runPriceUpdate() {
  console.log('--- Starting Price Update Script ---');
  try {
    const products = await getAllProducts();
    if (products.length === 0) {
      console.log('No products found to update.');
      return;
    }

    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      const productName = product.masterData?.current?.name['ru'] || product.masterData?.current?.name['en'] || 'Unknown Name';
      console.log(`\nProcessing product ${i + 1}/${products.length}: ${product.key || product.id} (${productName})`);
      await updateProductPrices(product);
      await sleep(300);
    }
    console.log('\n--- Price Update Script Finished ---');
  } catch (error) {
    console.error('Critical error during price update process:', error);
  }
}

runPriceUpdate();