export const calculateRTP = (items, casePrice) => {
    let totalProbability = 0;
    let expectedValue = 0;

    items.forEach(item => {
        if (item.price) {
            totalProbability += item.chance / 100;
            expectedValue += item.chance / 100 * item.price;
        } else {
            item.steam_items.forEach(steamItem => {
                totalProbability += steamItem.probability;
                expectedValue += steamItem.probability * (steamItem.steam_price / 100);
            });
        }

    });

    return (expectedValue / (casePrice || 1)) * 100;
};

const determineRiskType = (maxLootToPriceRatio) => {
    if (maxLootToPriceRatio <= 10) return "Minimal";
    if (maxLootToPriceRatio <= 50) return "Moderate";
    if (maxLootToPriceRatio <= 100) return "Balanced";
    if (maxLootToPriceRatio <= 200) return "Elevated";
    return "Significant";
};

export const calculateDistribution = (items, casePrice) => {
    // Define tier thresholds as multiples of case price
    const priceRatioThresholds = {
        lowTier: 0.5,     // Items below 50% of case price
        midTier: 0.99,       // Items between 50% and 99% of case price
        highTier: 5,      // Items between 100% and 500% of case price
        premiumTier: 10   // Items between 500% and 1000% of case price
        // Exotic tier: Items above 1000% of case price
    };

    let distribution = {
        lowTier: 0,
        midTier: 0,
        highTier: 0,
        premiumTier: 0,
        exoticTier: 0
    };

    // Count items in each tier based on their price ratio to case price
    items.forEach(item => {
        let price;

        if (item.price) {
            price = item.price;
        } else {
            price = item.steam_items[0].steam_price / 100; // Convert to dollars
        }

        const priceRatio = price / casePrice;

        if (priceRatio <= priceRatioThresholds.lowTier) {
            distribution.lowTier++;
        } else if (priceRatio <= priceRatioThresholds.midTier) {
            distribution.midTier++;
        } else if (priceRatio <= priceRatioThresholds.highTier) {
            distribution.highTier++;
        } else if (priceRatio <= priceRatioThresholds.premiumTier) {
            distribution.premiumTier++;
        } else {
            distribution.exoticTier++;
        }
    });

    // Convert to percentages
    const totalItems = items.length;
    Object.keys(distribution).forEach(key => {
        distribution[key] =
            Number(((distribution[key] / totalItems) * 100).toFixed(2));
    });

    return distribution;
};

export const SITE_PROCESSORS = {
    'froggy': {
        name: 'Froggy',
        processData: (data) => {
            const items = data.data.crate.crateItems
                .filter(item => !item.isJokerMode)
                .sort((a, b) => Number(b.price) - Number(a.price))
                .map(item => ({
                    steam_items: [{
                        steam_price: item.price * 100, // Convert to cents
                        probability: parseFloat(item.chance) / 100
                    }]
                }));

            const price = data.data.crate.price;
            const maxPrice = Math.max(...items.flatMap(item =>
                item.steam_items.map(si => si.steam_price)
            )) / 100;
            const maxLootToPriceRatio = maxPrice / price;

            return {
                name: data.data.crate.title,
                price: Number(price),
                items: items,
                rtp: calculateRTP(items, price),
                minPrice: Math.min(...items.flatMap(item =>
                    item.steam_items.map(si => si.steam_price)
                )) / 100,
                maxPrice: maxPrice,
                maxLootToPriceRatio: maxLootToPriceRatio,
                riskType: determineRiskType(maxLootToPriceRatio)
            };
        }
    },
    'g4skins': {
        name: 'G4Skins',
        processData: (data) => {
            const items = data.result.items
                .sort((a, b) => Number(b.value) - Number(a.value))
                .map(item => ({
                    steam_items: [{
                        steam_price: item.value * 100, // Convert to cents
                        probability: (item.rangeTo - item.rangeFrom + 1) / 100000 // Convert range to probability
                    }]
                }));

            const price = data.result.price;
            const maxPrice = Math.max(...items.flatMap(item =>
                item.steam_items.map(si => si.steam_price)
            )) / 100;
            const maxLootToPriceRatio = maxPrice / price;

            return {
                name: data.result.name,
                price: price,
                items: items,
                rtp: calculateRTP(items, price),
                minPrice: Math.min(...items.flatMap(item =>
                    item.steam_items.map(si => si.steam_price)
                )) / 100,
                maxPrice: maxPrice,
                maxLootToPriceRatio: maxLootToPriceRatio,
                riskType: determineRiskType(maxLootToPriceRatio)
            };
        }
    },
    'skinclub': {
        name: 'Skin Club',
        processData: (data) => {
            const items = data.data.last_successful_generation.contents
                .sort((a, b) => Number(b.item.price) - Number(a.item.price))
                .map(content => ({
                    steam_items: [{
                        steam_price: content.item.price,
                        probability: parseFloat(content.chance_percent) / 100 // Convert percentage to decimal
                    }]
                }));

            const price = data.data.price / 100;
            const maxPrice = Math.max(...items.flatMap(item =>
                item.steam_items.map(si => si.steam_price)
            )) / 100;
            const maxLootToPriceRatio = maxPrice / price;

            return {
                name: data.data.title,
                price: price,
                items: items,
                rtp: calculateRTP(items, price),
                minPrice: Math.min(...items.flatMap(item =>
                    item.steam_items.map(si => si.steam_price)
                )) / 100,
                maxPrice: maxPrice,
                maxLootToPriceRatio: maxLootToPriceRatio,
                riskType: determineRiskType(maxLootToPriceRatio)
            };
        }
    },
    'ggdrop': {
        name: 'GGDrop',
        processData: (data) => {
            const maxPrice = Math.max(...data.data.items.flatMap(item =>
                item.steam_items.map(si => si.steam_price)
            )) / 100;
            const price = data.data.price / 104.5;
            const maxLootToPriceRatio = maxPrice / price;

            return {
                name: data.data.title_en,
                price: price,
                items: data.data.items,
                rtp: calculateRTP(data.data.items, price),
                minPrice: Math.min(...data.data.items.flatMap(item =>
                    item.steam_items.map(si => si.steam_price)
                )) / 100,
                maxPrice: maxPrice,
                maxLootToPriceRatio: maxLootToPriceRatio,
                riskType: determineRiskType(maxLootToPriceRatio)
            };
        }
    },
    'hellcase': {
        name: 'HellCase',
        processData: (data) => {
            const items = data.itemlist.map(item => ({
                steam_items: item.items.map(subItem => ({
                    steam_price: subItem.steam_price_en * 100, // convert to cents
                    probability: subItem.odds / 100
                }))
            }));

            const maxPrice = Math.max(...items.flatMap(item =>
                item.steam_items.map(si => si.steam_price)
            )) / 100;
            const maxLootToPriceRatio = maxPrice / data.case_price;

            return {
                name: data.casename,
                price: data.case_price,
                items: items,
                rtp: calculateRTP(items, data.case_price),
                minPrice: Math.min(...items.flatMap(item =>
                    item.steam_items.map(si => si.steam_price)
                )) / 100,
                maxPrice: maxPrice,
                maxLootToPriceRatio: maxLootToPriceRatio,
                riskType: determineRiskType(maxLootToPriceRatio)
            };
        }
    }
};