import fs from 'fs/promises';
import { rootCategoriesCt, allSubCategoryMaps } from './categoryDefinitions.js';

const OUTPUT_CATEGORIES_CSV_FILE = 'categories_for_import.csv';

function generateSlugFromText(text, lang = 'en') {
	if (!text) return '';
	let slug = text.toLowerCase();
	if (lang === 'ru') {
		const a = {
			Ё: 'YO',
			Й: 'I',
			Ц: 'TS',
			У: 'U',
			К: 'K',
			Е: 'E',
			Н: 'N',
			Г: 'G',
			Ш: 'SH',
			Щ: 'SCH',
			З: 'Z',
			Х: 'H',
			Ъ: '',
			ё: 'yo',
			й: 'i',
			ц: 'ts',
			у: 'u',
			к: 'k',
			е: 'e',
			н: 'n',
			г: 'g',
			ш: 'sh',
			щ: 'sch',
			з: 'z',
			х: 'h',
			ъ: '',
			Ф: 'F',
			Ы: 'I',
			В: 'V',
			А: 'a',
			П: 'P',
			Р: 'R',
			О: 'O',
			Л: 'L',
			Д: 'D',
			Ж: 'ZH',
			Э: 'E',
			ф: 'f',
			ы: 'i',
			в: 'v',
			а: 'a',
			п: 'p',
			р: 'r',
			о: 'o',
			л: 'l',
			д: 'd',
			ж: 'zh',
			э: 'e',
			Я: 'Ya',
			Ч: 'CH',
			С: 'S',
			М: 'M',
			И: 'I',
			Т: 'T',
			Ь: '',
			Б: 'B',
			Ю: 'YU',
			я: 'ya',
			ч: 'ch',
			с: 's',
			м: 'm',
			и: 'i',
			т: 't',
			ь: '',
			б: 'b',
			ю: 'yu',
		};
		slug = slug
			.split('')
			.map((char) => a[char] || char)
			.join('');
	}
	return slug
		.replace(/\s+/g, '-')
		.replace(/[^a-z0-9-]/g, '')
		.replace(/-+/g, '-');
}

async function generateCategoriesCsv() {
	let csvContent = '';
	const headers = [
		'key', // Обязательный - твой keyCt
		'name.ru', // Обязательный
		'name.en', // Обязательный
		'slug.en', // Обязательный
		'parent.key', // Ключ родительской категории (если есть)
		'parent.typeId', // 'category' (если parent.key есть)
		'orderHint', // Опционально
		'description.ru', // Опционально
		'description.en', // Опционально
		'externalId', // Опционально
		// Добавь metaTitle, metaDescription, metaKeywords, если нужно
	];
	csvContent += headers.join(',') + '\n';

	const allCategoriesToImport = [];

	rootCategoriesCt.forEach((cat) => {
		allCategoriesToImport.push({
			key: cat.keyCt,
			nameRu: cat.name.ru,
			nameEn: cat.name.en,
			slugEn: cat.slug.en || generateSlugFromText(cat.name.en, 'en'),
			parentKey: '',
			orderHint: cat.orderHint || '',
			descriptionEn: cat.description.en || '',
			descriptionRu: cat.description.ru || '',
			externalId: cat.externalId || cat.keyCt,
		});
	});

	for (const sourceKey in allSubCategoryMaps) {
		const catDef = allSubCategoryMaps[sourceKey];
		allCategoriesToImport.push({
			key: catDef.keyCt,
			nameRu: catDef.name.ru,
			nameEn: catDef.name.en,
			slugEn: catDef.slug || generateSlugFromText(catDef.name.en, 'en'),
			parentKey: catDef.parentKeyCt || '',
			orderHint: catDef.orderHint || '',
			descriptionEn: catDef.description.en || '',
			descriptionRu: catDef.description.ru || '',
			externalId: catDef.externalId || catDef.keyCt,
		});
	}

	// Удаляем дубликаты по key, если вдруг образовались (хотя не должны при такой структуре)
	const uniqueCategories = allCategoriesToImport.filter(
		(cat, index, self) => index === self.findIndex((c) => c.key === cat.key)
	);

	uniqueCategories.forEach((cat) => {
		const row = [];
		row.push(cat.key);
		row.push(`"${cat.nameRu.replace(/"/g, '""')}"`);
		row.push(`"${cat.nameEn.replace(/"/g, '""')}"`);
		row.push(`"${cat.slugEn.replace(/"/g, '""')}"`);
		row.push(cat.parentKey || '');
		row.push(cat.parentKey ? 'category' : '');
		row.push(cat.orderHint || '');
		row.push(
			`"${(cat.descriptionRu || '')
				.replace(/\n/g, '\\n')
				.replace(/"/g, '""')}"`
		);
		row.push(
			`"${(cat.descriptionEn || '')
				.replace(/\n/g, '\\n')
				.replace(/"/g, '""')}"`
		);
		row.push(cat.externalId || '');

		csvContent += row.join(',') + '\n';
	});

	try {
		await fs.writeFile(OUTPUT_CATEGORIES_CSV_FILE, csvContent);
		console.log(
			`Categories CSV data for CommerceTools saved to ${OUTPUT_CATEGORIES_CSV_FILE}`
		);
	} catch (err) {
		console.error(`Error writing categories CSV file:`, err);
	}
}

generateCategoriesCsv().catch(console.error);
