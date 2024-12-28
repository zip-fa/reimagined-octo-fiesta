import React, { useState, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts';
import {Link} from "react-router-dom";
import {calculateDistribution, calculateRTP, SITE_PROCESSORS} from "./lib/site-processors.js";
import Papa from 'papaparse';

// Seeded random function
const seededRandom = (function() {
    let seed = 42;
    const random = function() {
        seed = (seed * 16807) % 2147483647;
        return (seed - 1) / 2147483646;
    };
    random.reset = function() {
        seed = 42;
    };
    return random;
})();

// Original function without modifications
function generateItemsOriginal(casePrice, rtp, minPrice, maxPrice, count) {
    seededRandom.reset();

    const targetEV = casePrice * (rtp / 100);
    const items = [];

    const cheaperCount = Math.floor(count / 2);
    const expensiveCount = count - cheaperCount;

    for (let i = 0; i < cheaperCount; i++) {
        const price = parseFloat((seededRandom() * (casePrice - minPrice) + minPrice).toFixed(2));
        items.push({ price });
    }

    for (let i = 0; i < expensiveCount; i++) {
        const price = parseFloat((seededRandom() * (maxPrice - casePrice) + casePrice).toFixed(2));
        items.push({ price });
    }

    let low = -10;
    let high = 10;

    for (let iter = 0; iter < 100; iter++) {
        const mid = (low + high) / 2;
        const weights = items.map(it => it.price ** mid);
        const sumWeights = weights.reduce((a, b) => a + b, 0);
        const probs = weights.map(w => w / sumWeights);
        const ev = items.reduce((acc, it, i) => acc + it.price * probs[i], 0);

        if (ev > targetEV) {
            high = mid;
        } else {
            low = mid;
        }
    }

    const a = (low + high) / 2;
    const finalWeights = items.map(it => it.price ** a);
    const sumFinalWeights = finalWeights.reduce((a, b) => a + b, 0);
    const finalProbs = finalWeights.map(w => w / sumFinalWeights);

    for (let i = 0; i < count; i++) {
        items[i].chance = parseFloat((finalProbs[i] * 100).toFixed(3));
    }

    return items.sort((a, b) => b.price - a.price);
}

// New function with improved distribution
function generateItemsImproved(casePrice, rtp, minPrice, maxPrice, count, customDistribution) {
    seededRandom.reset();

    const targetEV = casePrice * (rtp / 100);
    const items = [];

    const distribution = {
        lowTier: Math.floor(count * customDistribution.lowTier / 100),
        midTier: Math.floor(count * customDistribution.midTier / 100),
        highTier: Math.floor(count * customDistribution.highTier / 100),
        premiumTier: Math.floor(count * customDistribution.premiumTier / 100)
    };
    distribution.exoticTier = count - Object.values(distribution).reduce((a,b) => a+b, 0);

    for (let i = 0; i < distribution.lowTier; i++) {
        const maxTierPrice = casePrice * 0.5;
        const price = parseFloat((seededRandom() * (maxTierPrice - minPrice) + minPrice).toFixed(2));
        items.push({ price });
    }

    for (let i = 0; i < distribution.midTier; i++) {
        const minTierPrice = casePrice * 0.5;
        const maxTierPrice = casePrice * 0.99;
        const price = parseFloat((seededRandom() * (maxTierPrice - minTierPrice) + minTierPrice).toFixed(2));
        items.push({ price });
    }

    for (let i = 0; i < distribution.highTier; i++) {
        const minTierPrice = casePrice;
        const maxTierPrice = casePrice * 5;
        const price = parseFloat((seededRandom() * (maxTierPrice - minTierPrice) + minTierPrice).toFixed(2));
        items.push({ price });
    }

    for (let i = 0; i < distribution.premiumTier; i++) {
        const minTierPrice = casePrice * 5;
        const maxTierPrice = casePrice * 10;
        const price = parseFloat((seededRandom() * (maxTierPrice - minTierPrice) + minTierPrice).toFixed(2));
        items.push({ price });
    }

    for (let i = 0; i < distribution.exoticTier; i++) {
        const minTierPrice = casePrice * 10;
        const price = parseFloat((seededRandom() * (maxPrice - minTierPrice) + minTierPrice).toFixed(2));
        items.push({ price });
    }

    let low = -10;
    let high = 10;

    for (let iter = 0; iter < 100; iter++) {
        const mid = (low + high) / 2;
        const weights = items.map(it => {
            const priceRatio = it.price / casePrice;
            const boost = priceRatio > 1 ? 1.5 : 1;
            return (it.price ** mid) * boost;
        });

        const sumWeights = weights.reduce((a, b) => a + b, 0);
        const probs = weights.map(w => w / sumWeights);
        const ev = items.reduce((acc, it, i) => acc + it.price * probs[i], 0);

        if (ev > targetEV) {
            high = mid;
        } else {
            low = mid;
        }
    }

    const a = (low + high) / 2;
    const finalWeights = items.map(it => {
        const priceRatio = it.price / casePrice;
        const boost = priceRatio > 1 ? 1.5 : 1;
        return (it.price ** a) * boost;
    });

    const sumFinalWeights = finalWeights.reduce((a, b) => a + b, 0);
    const finalProbs = finalWeights.map(w => w / sumFinalWeights);

    for (let i = 0; i < count; i++) {
        items[i].chance = parseFloat((finalProbs[i] * 100).toFixed(3));
    }

    return items.sort((a, b) => b.price - a.price);
}

function generateItems(casePrice, rtp, minPrice, maxPrice, count, useImproved = false, customDistribution) {
    return useImproved
        ? generateItemsImproved(casePrice, rtp, minPrice, maxPrice, count, customDistribution)
        : generateItemsOriginal(casePrice, rtp, minPrice, maxPrice, count);
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];


export default function RtpGenerator() {
    const [inputs, setInputs] = useState({
        casePrice: 2.5,
        rtp: 90,
        minPrice: 0.1,
        maxPrice: 100,
        itemsCount: 20,
        distribution: {
            lowTier: 24,
            midTier: 14,
            highTier: 35,
            premiumTier: 11,
            exoticTier: 15
        }
    });
    const [savedResults, setSavedResults] = useState([]);
    const [uploadedCase, setUploadedCase] = useState(null);
    const [dragActive, setDragActive] = useState(false);

    const handleDistributionChange = (tier, value) => {
        const newDist = { ...inputs.distribution, [tier]: value };
        setInputs(prev => ({...prev, distribution: newDist}));
        // const total = Object.values(newDist).reduce((a, b) => a + b, 0);

        // if (total <= 100) {
        //     newDist.exoticTier = 100 - (total - newDist.exoticTier);
        //     setInputs(prev => ({...prev, distribution: newDist}));
        // }
    };

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(e.type === 'dragenter' || e.type === 'dragover');
    };

    const handleDrop = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            try {
                const file = e.dataTransfer.files[0];
                const text = await file.text();
                const data = JSON.parse(text);
                const siteName = file.name.split('-')[0];
                const processor = SITE_PROCESSORS[siteName];

                if (processor) {
                    const processedCase = processor.processData(data);
                    const rtp = calculateRTP(processedCase.items, processedCase.price);

                    processedCase.items = processedCase.items.map((item) => ({
                        price: item.steam_items[0].steam_price / 100,
                        chance: item.steam_items[0].probability * 100
                    }));

                    setUploadedCase(processedCase);

                    const dist = calculateDistribution(processedCase.items, processedCase.price);

                    setSavedResults(prev => [...prev, {
                        caseName: processedCase.name,
                        projectName: siteName,
                        prodDist: dist,
                        betterDist: inputs.distribution
                    }]);

                    setInputs(prev => ({
                        ...prev,
                        rtp,
                        casePrice: processedCase.price,
                        minPrice: processedCase.minPrice,
                        maxPrice: processedCase.maxPrice,
                        itemsCount: processedCase.items.length
                    }));
                }
            } catch (err) {
                console.error('Error processing file:', err);
            }
        }
    };

    const exportToCsv = () => {
        const headers = ['Case Name', 'Project Name',
            'Prod Low Tier %', 'Prod Mid Tier %', 'Prod High Tier %', 'Prod Premium Tier %', 'Prod Exotic Tier %',
            'Better Low Tier %', 'Better Mid Tier %', 'Better High Tier %', 'Better Premium Tier %', 'Better Exotic Tier %'
        ];

        const rows = savedResults.map(result => [
            result.caseName,
            result.projectName,
            result.prodDist.lowTier,
            result.prodDist.midTier,
            result.prodDist.highTier,
            result.prodDist.premiumTier,
            result.prodDist.exoticTier,
            result.betterDist.lowTier,
            result.betterDist.midTier,
            result.betterDist.highTier,
            result.betterDist.premiumTier,
            result.betterDist.exoticTier
        ]);

        const csvContent = Papa.unparse({
            fields: headers,
            data: rows
        });

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'case-analysis.csv';
        a.click();
        window.URL.revokeObjectURL(url);
    };

    const results = useMemo(() => {
        const originalItems = generateItems(
            inputs.casePrice,
            inputs.rtp,
            inputs.minPrice,
            inputs.maxPrice,
            inputs.itemsCount,
            false
        );

        const improvedItems = generateItems(
            inputs.casePrice,
            inputs.rtp,
            inputs.minPrice,
            inputs.maxPrice,
            inputs.itemsCount,
            true,
            inputs.distribution
        );

        return {
            original: {
                items: originalItems,
                distribution: calculateDistribution(originalItems, inputs.casePrice)
            },
            improved: {
                items: improvedItems,
                distribution: calculateDistribution(improvedItems, inputs.casePrice)
            }
        };
    }, [inputs]);

    return (
        <div className="p-4 space-y-4">
            <h1 className="text-3xl font-bold mb-8 text-center">Lootbox Sites Analysis</h1>
            <nav className="my-4">
                <Link
                    to="/"
                    className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                    Home
                </Link>

                <Link
                    to="/case-analysis"
                    className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                    Case Analysis
                </Link>

                <Link
                    to="/rtp-generator"
                    className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                    RTP Generator
                </Link>
            </nav>

            <div
                className={`mb-8 p-8 border-2 border-dashed rounded-lg text-center 
          ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
            >
                <p className="mb-4">Drop a case file here to compare with generated distributions</p>
            </div>

            <div className="mb-8">
                <h3 className="font-bold mb-4">Distribution Settings</h3>
                <div className="space-y-4">
                    {Object.entries(inputs.distribution).map(([tier, value]) => (
                        <div key={tier} className="flex items-center gap-4">
                            <span className="w-24">{tier}</span>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={value}
                                onChange={(e) => handleDistributionChange(tier, parseInt(e.target.value))}
                                className="flex-1"
                            />
                            <span className="w-12">{value}%</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                    <label className="block text-sm font-medium">Case Price ($)</label>
                    <input
                        type="number"
                        value={inputs.casePrice}
                        onChange={e => setInputs(prev => ({...prev, casePrice: parseFloat(e.target.value)}))}
                        className="mt-1 w-full rounded-md border p-2"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium">RTP (%)</label>
                    <input
                        type="number"
                        value={inputs.rtp}
                        onChange={e => setInputs(prev => ({...prev, rtp: parseFloat(e.target.value)}))}
                        className="mt-1 w-full rounded-md border p-2"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium">Min Price ($)</label>
                    <input
                        type="number"
                        value={inputs.minPrice}
                        onChange={e => setInputs(prev => ({...prev, minPrice: parseFloat(e.target.value)}))}
                        className="mt-1 w-full rounded-md border p-2"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium">Max Price ($)</label>
                    <input
                        type="number"
                        value={inputs.maxPrice}
                        onChange={e => setInputs(prev => ({...prev, maxPrice: parseFloat(e.target.value)}))}
                        className="mt-1 w-full rounded-md border p-2"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium">Items Count</label>
                    <input
                        type="number"
                        value={inputs.itemsCount}
                        onChange={e => setInputs(prev => ({...prev, itemsCount: parseInt(e.target.value)}))}
                        className="mt-1 w-full rounded-md border p-2"
                    />
                </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
                <div className="p-4">
                    <h3 className="font-bold mb-2">Сейчас в проде (RTP {calculateRTP(results.original.items, inputs.casePrice).toFixed(3)}%)</h3>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={Object.entries(results.original.distribution).map(([name, value]) => ({
                                        name,
                                        value
                                    }))}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    animationDuration={0}
                                    label
                                >
                                    {Object.keys(results.original.distribution).map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]}/>
                                    ))}
                                </Pie>
                                <Legend/>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="mt-4 overflow-x-auto">
                        <table className="min-w-full">
                            <thead>
                            <tr>
                                <th className="px-4 py-2">Price ($)</th>
                                <th className="px-4 py-2">Chance (%)</th>
                            </tr>
                            </thead>
                            <tbody>
                            {results.original.items.map((item, idx) => (
                                <tr key={idx} className={idx % 2 === 0 ? 'bg-gray-50' : ''}>
                                    <td className="px-4 py-2">{item.price.toFixed(2)}</td>
                                    <td className="px-4 py-2">{item.chance.toFixed(3)}</td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="p-4">
                    <h3 className="font-bold mb-2">Улучшенная версия (RTP {calculateRTP(results.improved.items, inputs.casePrice).toFixed(3)}%)</h3>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={Object.entries(results.improved.distribution).map(([name, value]) => ({
                                        name,
                                        value
                                    }))}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    animationDuration={0}
                                    label
                                >
                                    {Object.keys(results.improved.distribution).map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]}/>
                                    ))}
                                </Pie>
                                <Legend/>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="mt-4 overflow-x-auto">
                        <table className="min-w-full">
                            <thead>
                            <tr>
                                <th className="px-4 py-2">Price ($)</th>
                                <th className="px-4 py-2">Chance (%)</th>
                            </tr>
                            </thead>
                            <tbody>
                            {results.improved.items.map((item, idx) => (
                                <tr key={idx} className={idx % 2 === 0 ? 'bg-gray-50' : ''}>
                                    <td className="px-4 py-2">{item.price.toFixed(2)}</td>
                                    <td className="px-4 py-2">{item.chance.toFixed(3)}</td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {uploadedCase && (
                    <div className="p-4">
                        <h3 className="font-bold mb-2">{uploadedCase.name}</h3>
                        <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={Object.entries(calculateDistribution(uploadedCase.items, uploadedCase.price))
                                            .map(([name, value]) => ({
                                                name,
                                                value
                                            }))}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        animationDuration={0}
                                        label
                                    >
                                        {Object.keys(results.original.distribution).map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]}/>
                                        ))}
                                    </Pie>
                                    <Legend/>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="mt-4 overflow-x-auto">
                            <table className="min-w-full">
                                <thead>
                                <tr>
                                    <th className="px-4 py-2">Price ($)</th>
                                    <th className="px-4 py-2">Chance (%)</th>
                                </tr>
                                </thead>
                                <tbody>
                                {uploadedCase.items.map((item, idx) => (
                                    <tr key={idx} className={idx % 2 === 0 ? 'bg-gray-50' : ''}>
                                        <td className="px-4 py-2">{item.price.toFixed(2)}</td>
                                        <td className="px-4 py-2">{item.chance.toFixed(3)}</td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {savedResults.length > 0 && (
                <div className="mt-8">
                    <div className="flex justify-between mb-4">
                        <h3 className="font-bold">Saved Results</h3>
                        <button
                            onClick={exportToCsv}
                            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                        >
                            Export as CSV
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full">
                            <thead>
                            <tr>
                                <th className="px-4 py-2">Case Name</th>
                                <th className="px-4 py-2">Project Name</th>
                                <th className="px-4 py-2">Prod Low Tier %</th>
                                <th className="px-4 py-2">Prod Mid Tier %</th>
                                <th className="px-4 py-2">Prod High Tier %</th>
                                <th className="px-4 py-2">Prod Premium Tier %</th>
                                <th className="px-4 py-2">Prod Exotic Tier %</th>
                                <th className="px-4 py-2">Better Low Tier %</th>
                                <th className="px-4 py-2">Better Mid Tier %</th>
                                <th className="px-4 py-2">Better High Tier %</th>
                                <th className="px-4 py-2">Better Premium Tier %</th>
                                <th className="px-4 py-2">Better Exotic Tier %</th>
                            </tr>
                            </thead>
                            <tbody>
                            {savedResults.map((result, idx) => (
                                <tr key={idx} className={idx % 2 === 0 ? 'bg-gray-50' : ''}>
                                    <td className="px-4 py-2">{result.caseName}</td>
                                    <td className="px-4 py-2">{result.projectName}</td>
                                    <td className="px-4 py-2">{result.prodDist.lowTier}</td>
                                    <td className="px-4 py-2">{result.prodDist.midTier}</td>
                                    <td className="px-4 py-2">{result.prodDist.highTier}</td>
                                    <td className="px-4 py-2">{result.prodDist.premiumTier}</td>
                                    <td className="px-4 py-2">{result.prodDist.exoticTier}</td>
                                    <td className="px-4 py-2">{result.betterDist.lowTier}</td>
                                    <td className="px-4 py-2">{result.betterDist.midTier}</td>
                                    <td className="px-4 py-2">{result.betterDist.highTier}</td>
                                    <td className="px-4 py-2">{result.betterDist.premiumTier}</td>
                                    <td className="px-4 py-2">{result.betterDist.exoticTier}</td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}