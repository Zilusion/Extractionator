export const rootCategoriesCt = [
	{
		keyCt: 'board-games',
		name: { ru: 'Настольные игры', en: 'Board Games' },
		slug: 'board-games',
		orderHint: '0.01',
		externalId: 'board-games',
		description: {
			ru: 'Настольные игры',
			en: 'Board Games',
		},
	},
	{
		keyCt: 'game-accessories',
		name: { ru: 'Аксессуары для игр', en: 'Game Accessories' },
		slug: 'game-accessories',
		orderHint: '0.02',
		externalId: 'game-accessories',
		description: {
			ru: 'Аксессуары для игр',
			en: 'Game Accessories',
		},
	},
	{
		keyCt: 'game-expansions',
		name: { ru: 'Дополнения к играм', en: 'Game Expansions' },
		slug: 'game-expansions',
		orderHint: '0.03',
		externalId: 'game-expansions',
		description: {
			ru: 'Дополнения к играм',
			en: 'Game Expansions',
		},
	},
	{
		keyCt: 'game-sets',
		name: { ru: 'Наборы игр и бандлы', en: 'Game Sets & Bundles' },
		slug: 'game-sets-bundles',
		orderHint: '0.04',
		externalId: 'game-sets-bundles',
		description: {
			ru: 'Наборы игр и бандлы',
			en: 'Game Sets & Bundles',
		},
	},
];

export const boardgamesSubCategories = {
	'igry-dlya-vecherinok': {
		parentKeyCt: 'board-games',
		keyCt: 'party-games',
		name: { ru: 'Вечериночные', en: 'Party Games' },
		slug: 'party-games',
		externalId: 'party-games',
		orderHint: '0.01',
		description: {
			ru: 'Вечериночные игры - это отличный способ провести свободное время с друзьями, развлечься и повысить настроение. В этом разделе вы найдете интересные и увлекательные игры, которые помогут вам организовать незабываемый вечер.',
			en: 'Party games are a great way to spend free time with friends, have fun and boost your mood. In this section, you will find interesting and engaging games that will help you organize an unforgettable evening.',
		},
	},
	'for-children': {
		parentKeyCt: 'board-games',
		keyCt: 'kids-games',
		name: { ru: 'Для детей', en: 'Kids Games' },
		slug: 'kids-games',
		externalId: 'kids-games',
		orderHint: '0.02',
		description: {
			ru: 'Игры для детей - это отличный способ развить у них интеллект, развлечься и повысить настроение. В этом разделе вы найдете интересные и увлекательные игры, которые помогут вам организовать незабываемый вечер с ребенком.',
			en: 'Games for kids are a great way to develop their intelligence, have fun and boost their mood. In this section, you will find interesting and engaging games that will help you organize an unforgettable evening with your child.',
		},
	},
	family: {
		parentKeyCt: 'board-games',
		keyCt: 'family-games',
		name: { ru: 'Для всей семьи', en: 'Family Games' },
		slug: 'family-games',
		externalId: 'family-games',
		orderHint: '0.03',
		description: {
			ru: 'Игры для всей семьи - это отличный способ провести свободное время с членами семьи, развлечься и повысить настроение. В этом разделе вы найдете интересные и увлекательные игры, которые помогут вам организовать незабываемый вечер.',
			en: 'Games for the whole family are a great way to spend free time with family members, have fun and boost your mood. In this section, you will find interesting and engaging games that will help you organize an unforgettable evening.',
		},
	},
	'klassicheskie-igri': {
		parentKeyCt: 'board-games',
		keyCt: 'classic-games',
		name: { ru: 'Классические', en: 'Classic Games' },
		slug: 'classic-games',
		externalId: 'classic-games',
		orderHint: '0.04',
		description: {
			ru: 'Классические настольные игры - это игры, которые проверены временем, популярны и любимы многими. Они помогают развивать логическое мышление, память, стратегическое мышление и социальные навыки.',
			en: 'Classic board games are games that have stood the test of time, are popular and loved by many. They help develop logical thinking, memory, strategic thinking and social skills.',
		},
	},
	'prikljuchencheskie-igri': {
		parentKeyCt: 'board-games',
		keyCt: 'adventure-games',
		name: { ru: 'Приключенческие', en: 'Adventure Games' },
		slug: 'adventure-games',
		externalId: 'adventure-games',
		orderHint: '0.05',
		description: {
			ru: 'Приключенческие игры полны захватывающих сюрпризов и позволяют игрокам отправиться в незабываемые путешествия и испытания.',
			en: 'Adventure games are filled with thrilling surprises and allow players to embark on unforgettable journeys and challenges.',
		},
	},
	strategicheskie: {
		parentKeyCt: 'board-games',
		keyCt: 'strategy-games',
		name: { ru: 'Стратегические', en: 'Strategy Games' },
		slug: 'strategy-games',
		externalId: 'strategy-games',
		orderHint: '0.06',
		description: {
			ru: 'Стратегические игры - это игры, которые требуют от игроков планирования, анализа, принятия решений и выполнения задач. Они помогают развивать логическое мышление, память, стратегическое мышление и социальные навыки.',
			en: 'Strategy games are games that require players to plan, analyze, make decisions and complete tasks. They help develop logical thinking, memory, strategic thinking and social skills.',
		},
	},
	kooperativnie: {
		parentKeyCt: 'board-games',
		keyCt: 'cooperative-games',
		name: { ru: 'Кооперативные', en: 'Cooperative Games' },
		slug: 'cooperative-games',
		externalId: 'cooperative-games',
		orderHint: '0.07',
		description: {
			ru: 'Кооперативные игры - это игры, в которых игроки объединяются в команды, чтобы достичь общей цели или решить задачу. Они помогают развивать навыки командной работы, доверие, коммуникацию и социальные навыки.',
			en: 'Cooperative games are games in which players form teams to achieve a common goal or solve a problem. They help develop teamwork skills, trust, communication and social skills.',
		},
	},
	'detective-game': {
		parentKeyCt: 'board-games',
		keyCt: 'detective-games',
		name: { ru: 'Детективные', en: 'Detective Games' },
		slug: 'detective-games',
		externalId: 'detective-games',
		orderHint: '0.08',
		description: {
			ru: 'Детективные игры - это игры, в которых игроки расследуют загадочные происшествия, собирают улики и разгадывают тайны, чтобы раскрыть преступления.',
			en: 'Detective games are games where players investigate mysterious events, gather clues, and solve mysteries to uncover crimes.',
		},
	},
	'2players': {
		parentKeyCt: 'board-games',
		keyCt: 'duel-games',
		name: { ru: 'Дуэльные', en: 'Duel Games' },
		slug: 'duel-games',
		externalId: 'duel-games',
		orderHint: '0.09',
		description: {
			ru: 'Дуэльные игры - это игры, предназначенные для двух игроков, где каждый из них должен обойти другого, чтобы достичь победы.',
			en: 'Duel games are games designed for two players, where each player must outmaneuver the other to achieve victory.',
		},
	},
	'nastolnye-igry-kvesty': {
		parentKeyCt: 'board-games',
		keyCt: 'quest-games',
		name: { ru: 'Квесты', en: 'Quest Games' },
		slug: 'quest-games',
		externalId: 'quest-games',
		orderHint: '0.10',
		description: {
			ru: 'Квесты - это настольные игры, в которых игроки отправляются в приключения, проходят испытания, собирают улики и разгадывают загадки, чтобы достичь победы.',
			en: 'Quest games are board games where players go on adventures, pass challenges, gather clues and solve puzzles to achieve victory.',
		},
	},
	kartochnye: {
		parentKeyCt: 'board-games',
		keyCt: 'card-games',
		name: { ru: 'Карточные', en: 'Card Games' },
		slug: 'card-games',
		externalId: 'card-games',
		orderHint: '0.11',
		description: {
			ru: 'Карточные игры - это игры, в которых используются традиционные игральные карты, а также специальные колоды, предназначенные для конкретной игры. Карточные игры - это отличный способ развлечься с друзьями или семьей, улучшить память, логику и стратегическое мышление.',
			en: 'Card games are games that use traditional playing cards as well as special decks designed for a specific game. Card games are a great way to have fun with friends or family, improve memory, logic, and strategic thinking.',
		},
	},
	'hardkornie-igri': {
		parentKeyCt: 'board-games',
		keyCt: 'hardcore-games',
		name: { ru: 'Хардкорные', en: 'Hardcore Games' },
		slug: 'hardcore-games',
		externalId: 'hardcore-games',
		orderHint: '0.12',
		description: {
			ru: 'Хардкорные игры - это игры, требующие от игроков стратегического мышления, расчета рисков, анализа и синтеза. Они предлагают сложные задачи, требующие решения, и не простят ошибок.',
			en: 'Hardcore games are games that require strategic thinking, risk calculation, analysis and synthesis from players. They offer complex challenges that require solving and do not forgive mistakes.',
		},
	},
	prostie: {
		parentKeyCt: 'board-games',
		keyCt: 'simple-games',
		name: { ru: 'Простые', en: 'Simple Games' },
		slug: 'simple-games',
		externalId: 'simple-games',
		orderHint: '0.13',
		description: {
			ru: 'Простые игры - это настольные игры, которые легко понять и быстро освоить, идеально подходят для быстрого развлечения и новичков.',
			en: 'Simple games are board games that are easy to understand and quick to learn, perfect for quick entertainment and beginners.',
		},
	},
	ekonomicheskie: {
		parentKeyCt: 'board-games',
		keyCt: 'economic-games',
		name: { ru: 'Экономические', en: 'Economic Games' },
		slug: 'economic-games',
		externalId: 'economic-games',
		orderHint: '0.14',
		description: {
			ru: 'Экономические игры - это игры, где игроки управляют ресурсами, производством, торговлей, планируют экономику и пытаются достичь своих целей.',
			en: 'Economic games are games where players manage resources, production, trade, plan economies and try to achieve their goals.',
		},
	},
	abstraktnye: {
		parentKeyCt: 'board-games',
		keyCt: 'abstract-games',
		name: { ru: 'Абстрактные', en: 'Abstract Games' },
		slug: 'abstract-games',
		externalId: 'abstract-games',
		orderHint: '0.15',
		description: {
			ru: 'Абстрактные игры - это логические игры, которые не имеют конкретной тематики и не включают в себя элементы случайности, они требуют от игроков логики, стратегического мышления и анализа.',
			en: 'Abstract games are logical games that do not have a specific theme and do not involve elements of chance, they require players to use logic, strategic thinking and analysis.',
		},
	},
	'interaktivnye-nastolnye-igry': {
		parentKeyCt: 'board-games',
		keyCt: 'interactive-games',
		name: { ru: 'Интерактивные', en: 'Interactive Games' },
		slug: 'interactive-games',
		externalId: 'interactive-games',
		orderHint: '0.16',
		description: {
			ru: 'Интерактивные игры - это игры, которые предлагают игрокам активное взаимодействие, например, с помощью мини-игр, задач, головоломок, интерактивных механик, требующих игроков общаться, договариваться, или конкурировать друг с другом.',
			en: 'Interactive games are games that offer players active interaction, such as through mini-games, challenges, puzzles, interactive mechanics, requiring players to communicate, negotiate, or compete with each other.',
		},
	},
	wargame: {
		parentKeyCt: 'board-games',
		keyCt: 'war-games',
		name: { ru: 'Военные', en: 'War Games' },
		slug: 'war-games',
		externalId: 'war-games',
		orderHint: '0.17',
		description: {
			ru: 'Военные игры - это захватывающие игры, в которых игроки принимают стратегические решения, чтобы победить оппонентов в условиях военных конфликтов.',
			en: 'War games are thrilling games where players make strategic decisions to defeat opponents in military conflict scenarios.',
		},
	},
	'romantic-boardgames': {
		parentKeyCt: 'board-games',
		keyCt: 'games-for-couples',
		name: { ru: 'Для влюбленных', en: 'Games for Couples' },
		slug: 'games-for-couples',
		externalId: 'games-for-couples',
		orderHint: '0.18',
		description: {
			ru: 'Для влюбленных - это игры для двоих, которые помогут вам укрепить отношения, поэкспериментировать с новыми чувствами и пережить вместе новые эмоции.',
			en: 'Games for Couples are games for two, which will help you strengthen your relationships, experiment with new feelings and experience new emotions together.',
		},
	},
};

export const accessorySubCategories = {
	'dice-and-dice-towers': {
		parentKeyCt: 'game-accessories',
		keyCt: 'dice-and-towers',
		name: { ru: 'Кубики и башни для кубиков', en: 'Dice & Dice Towers' },
		slug: 'dice-and-towers',
		externalId: 'dice-and-towers',
		orderHint: '0.01',
		description: {
			ru: 'Наборы игровых кубиков, кастомные дайсы и башни для их броска.',
			en: 'Sets of gaming dice, custom dice, and towers for rolling them.',
		},
		orderHint: '0.01',
	},
	'card-sleeves': {
		parentKeyCt: 'game-accessories',
		keyCt: 'card-sleeves',
		name: { ru: 'Протекторы для карт', en: 'Card Sleeves' },
		slug: 'card-sleeves',
		externalId: 'card-sleeves',
		orderHint: '0.02',
		description: {
			ru: 'Защитные кармашки (протекторы) различных размеров для карт настольных игр.',
			en: 'Protective pockets (sleeves) of various sizes for board game cards.',
		},
		orderHint: '0.02',
	},
	playmats: {
		parentKeyCt: 'game-accessories',
		keyCt: 'playmats',
		name: { ru: 'Игровые коврики', en: 'Playmats' },
		slug: 'playmats',
		externalId: 'playmats',
		description: {
			ru: 'Коврики для комфортной игры, защищающие компоненты и стол.',
			en: 'Mats for comfortable play, protecting components and the table.',
		},
		orderHint: '0.03',
	},
	'organizers-and-inserts': {
		parentKeyCt: 'game-accessories',
		keyCt: 'organizers-inserts',
		name: { ru: 'Органайзеры и вставки', en: 'Organizers & Inserts' },
		slug: 'organizers-inserts',
		externalId: 'organizers-inserts',
		description: {
			ru: 'Решения для хранения компонентов игр внутри коробок и на столе.',
			en: 'Solutions for storing game components inside boxes and on the table.',
		},
		orderHint: '0.04',
	},
	'tokens-and-markers': {
		parentKeyCt: 'game-accessories',
		keyCt: 'tokens-markers',
		name: { ru: 'Жетоны и маркеры', en: 'Tokens & Markers' },
		slug: 'tokens-markers',
		externalId: 'tokens-markers',
		description: {
			ru: 'Дополнительные или заменяющие жетоны, фишки и маркеры для игр.',
			en: 'Additional or replacement tokens, chips, and markers for games.',
		},
		orderHint: '0.05',
	},
};

export const expansionSubCategories = {
	// 'strategy-expansions': {
	//   parentKeyCt: 'game-expansions',
	//   keyCt: 'strategy-game-expansions',
	//   name: { ru: 'Дополнения для стратегий', en: 'Strategy Game Expansions' },
	//   slug: 'strategy-game-expansions',
	//   externalId: 'exp-strategy',
	//   description: { /* ... */ }
	// }
};

export const setSubCategories = {
	// 'starter-sets': {
	//   parentKeyCt: 'game-sets-bundles',
	//   keyCt: 'starter-sets',
	//   name: { ru: 'Стартовые наборы', en: 'Starter Sets' },
	//   slug: 'starter-sets',
	//   externalId: 'sets-starter',
	//   description: { /* ... */ }
	// }
};

export const allSubCategoryMaps = {
	...boardgamesSubCategories,
	...accessorySubCategories,
	...expansionSubCategories,
	...setSubCategories,
};

export function getStandardCategory(sourceKey) {
	const mappedSubCategory = allSubCategoryMaps[sourceKey.toLowerCase()];
	if (mappedSubCategory) {
		return mappedSubCategory;
	}
	const rootCategory = rootCategoriesCt.find(
		(cat) => cat.keyCt.toLowerCase() === sourceKey.toLowerCase()
	);
	if (rootCategory) {
		return {
			parentKeyCt: null,
			keyCt: rootCategory.keyCt,
			name: rootCategory.name,
			slug: rootCategory.slug,
			externalId: rootCategory.externalId,
			description: rootCategory.description,
			orderHint: rootCategory.orderHint,
		};
	}
	return null;
}
