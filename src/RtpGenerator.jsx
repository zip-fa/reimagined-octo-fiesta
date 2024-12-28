import React, { useState, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts';
import {Link} from "react-router-dom";
import {calculateRTP, SITE_PROCESSORS} from "./lib/site-processors.js";

// Seeded random function
const seededRandom = (function() {
    let seed = 42;
    return function() {
        seed = (seed * 16807) % 2147483647;
        return (seed - 1) / 2147483646;
    };
})();

function generateItems(casePrice, rtp, minPrice, maxPrice, count, useImproved = false) {
    const targetEV = casePrice * (rtp / 100);
    const items = [];

    const cheaperCount = useImproved ? Math.floor(count * 0.4) : Math.floor(count / 2);
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
        const weights = items.map(it => {
            if (useImproved) {
                const priceRatio = it.price / casePrice;
                const boost = priceRatio > 1 ? 1.5 : 1;
                return (it.price ** mid) * boost;
            }
            return it.price ** mid;
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
        if (useImproved) {
            const priceRatio = it.price / casePrice;
            const boost = priceRatio > 1 ? 1.5 : 1;
            return (it.price ** a) * boost;
        }
        return it.price ** a;
    });

    const sumFinalWeights = finalWeights.reduce((a, b) => a + b, 0);
    const finalProbs = finalWeights.map(w => w / sumFinalWeights);

    for (let i = 0; i < count; i++) {
        items[i].chance = parseFloat((finalProbs[i] * 100).toFixed(3));
    }

    return items.sort((a, b) => b.price - a.price);
}

function calculateDistribution(items, casePrice) {
    const thresholds = {
        lowTier: 0.5,
        midTier: 0.99,
        highTier: 5,
        premiumTier: 10
    };

    const distribution = {
        lowTier: 0,
        midTier: 0,
        highTier: 0,
        premiumTier: 0,
        exoticTier: 0
    };

    items.forEach(item => {
        const priceRatio = item.price / casePrice;
        if (priceRatio <= thresholds.lowTier) {
            distribution.lowTier++;
        } else if (priceRatio <= thresholds.midTier) {
            distribution.midTier++;
        } else if (priceRatio <= thresholds.highTier) {
            distribution.highTier++;
        } else if (priceRatio <= thresholds.premiumTier) {
            distribution.premiumTier++;
        } else {
            distribution.exoticTier++;
        }
    });

    Object.keys(distribution).forEach(key => {
        distribution[key] = Number(((distribution[key] / items.length) * 100).toFixed(2));
    });

    return distribution;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];


export default function RtpGenerator() {
    const [inputs, setInputs] = useState({
        casePrice: 2.5,
        rtp: 90,
        minPrice: 0.1,
        maxPrice: 100,
        itemsCount: 20
    });
    const [uploadedCase, setUploadedCase] = useState(null);
    const [dragActive, setDragActive] = useState(false);

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
            true
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
                        <h3 className="font-bold mb-2">Сейчас в проде</h3>
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
                        <h3 className="font-bold mb-2">Улучшенная версия</h3>
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
                            <h3 className="font-bold mb-2">{uploadedCase.name} from competitor</h3>
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
        </div>
    );
}